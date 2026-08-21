import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Fretboard, type Highlight } from './components/Fretboard'
import { PromptStage } from './components/PromptStage'
import { ChordLibrary } from './components/ChordLibrary'
import { EarTrainer } from './components/EarTrainer'
import { ScaleTrainer } from './components/ScaleTrainer'
import { JamTrainer } from './components/JamTrainer'
import { LickLibrary } from './components/LickLibrary'
import { LearningPath } from './components/LearningPath'
import { TheoryGuide } from './components/TheoryGuide'
import { SettingsDrawer } from './components/SettingsDrawer'
import { useQuizEngine } from './hooks/useQuizEngine'
import { BIAS_OPTIONS, MAX_FRET, LETTER_NAMES } from './lib/music'
import { audioEngine } from './lib/audio'
import { sessionStore } from './lib/session'

export default function App() {
  const engine = useQuizEngine()
  const {
    settings,
    update,
    updateScope,
    resetSettings,
    tuning,
    phase,
    question,
    verdict,
    guess,
    pickedNote,
    marked,
    cycleToken,
    running,
    ringingString,
    stats,
    mastery,
    start,
    stop,
    reveal,
    next,
    answerAt,
    answerNote,
    toggleMark,
    replay,
    resetStats,
    resetMastery,
    auditionAt,
  } = engine

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState<'train' | 'chords' | 'scales' | 'ear' | 'jam' | 'licks' | 'path' | 'theory'>('train')
  const task = settings.task

  // 离开指板训练时若还在跑就先停掉，避免两套声音打架
  const switchView = useCallback(
    (next: 'train' | 'chords' | 'scales' | 'ear' | 'jam' | 'licks' | 'path' | 'theory') => {
      if (next !== 'train' && running) stop()
      setView(next)
    },
    [running, stop],
  )

  // 贯通层：响应来自和弦页 / 音阶页的「跳过去」请求（目标根音 / 音阶 / 和弦已写好）
  const navState = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  useEffect(() => {
    const target = sessionStore.consumeNav()
    if (target) switchView(target)
  }, [navState, switchView])

  /* ─────────────── 指板高亮 ─────────────── */

  const highlights = useMemo<Highlight[]>(() => {
    if (!question) return []
    const out: Highlight[] = []

    if (phase === 'asking') {
      // name / octave 模式下先高亮参考格（不含音名）
      if (question.task === 'name' || question.task === 'octave') {
        out.push({ string: question.string, fret: question.fret, kind: 'reference' })
        if (question.task === 'octave') {
          marked.forEach((k) => {
            const [s, f] = k.split(':').map(Number)
            const isTarget = question.targets.some((t) => t.string === s && t.fret === f)
            out.push({ string: s, fret: f, kind: isTarget ? 'hit' : 'miss' })
          })
        }
        return out
      }
      return [] // find 模式作答前不剧透位置
    }

    // 已揭示
    if (question.task === 'octave') {
      question.targets.forEach((t, i) =>
        out.push({ string: t.string, fret: t.fret, kind: i === 0 ? 'answer' : 'secondary' }),
      )
      marked.forEach((k) => {
        const [s, f] = k.split(':').map(Number)
        if (!question.targets.some((t) => t.string === s && t.fret === f)) {
          out.push({ string: s, fret: f, kind: 'miss' })
        }
      })
      return out
    }

    if (question.task === 'name') {
      return [{ string: question.string, fret: question.fret, kind: 'answer' }]
    }

    // find 模式（原逻辑）
    const twins = settings.showOctaveTwins ? question.answers : [question.primaryFret]
    if (verdict === 'hit' && guess) {
      out.push({ string: guess.string, fret: guess.fret, kind: 'hit' })
      twins
        .filter((f) => f !== guess.fret)
        .forEach((f) => out.push({ string: question.string, fret: f, kind: 'secondary' }))
    } else {
      out.push({ string: question.string, fret: question.primaryFret, kind: 'answer' })
      twins
        .filter((f) => f !== question.primaryFret)
        .forEach((f) => out.push({ string: question.string, fret: f, kind: 'secondary' }))
      if (verdict === 'miss' && guess) {
        out.push({ string: guess.string, fret: guess.fret, kind: 'miss' })
      }
    }
    return out
  }, [question, phase, verdict, guess, marked, settings.showOctaveTwins])

  /* ─────────────── 指板点击：按任务分流 ─────────────── */

  const handleFretClick = useCallback(
    (stringNumber: number, fret: number) => {
      void audioEngine.unlock()
      if (phase !== 'asking') {
        auditionAt(stringNumber, fret)
        return
      }
      if (task === 'find') answerAt(stringNumber, fret)
      else if (task === 'octave') toggleMark(stringNumber, fret)
      else auditionAt(stringNumber, fret) // name 模式：点指板只是试听
    },
    [phase, task, answerAt, toggleMark, auditionAt],
  )

  /* ─────────────── 主操作：一个键走完全流程 ─────────────── */

  const primaryAction = useCallback(() => {
    if (!running || phase === 'idle') {
      start()
    } else if (phase === 'asking') {
      reveal()
    } else {
      next()
    }
  }, [running, phase, start, reveal, next])

  /* ─────────────── 快捷键 ─────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen && e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return

      // 和弦参考视图下，只保留设置 / 退出快捷键，其余交给和弦模块自行处理
      if (view !== 'train') {
        if (e.key === 's' || e.key === 'S') setSettingsOpen((v) => !v)
        else if (e.key === 'Escape' && settingsOpen) setSettingsOpen(false)
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          primaryAction()
          break
        case 'Enter':
          e.preventDefault()
          if (running && phase !== 'idle') next()
          else start()
          break
        case 'r':
        case 'R':
          replay()
          break
        case 'a':
        case 'A':
          update('mode', 'auto')
          break
        case 'm':
        case 'M':
          update('mode', 'manual')
          break
        case 'f':
        case 'F':
          update('task', 'find')
          break
        case 'n':
        case 'N':
          update('task', 'name')
          break
        case 'o':
        case 'O':
          update('task', 'octave')
          break
        case 's':
        case 'S':
          setSettingsOpen((v) => !v)
          break
        case 'Escape':
          if (settingsOpen) setSettingsOpen(false)
          else if (running) stop()
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          update('intervalSec', Number(e.key))
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [primaryAction, running, phase, next, start, replay, update, stop, settingsOpen, view])

  /* ─────────────── 首次交互解锁音频 ─────────────── */

  useEffect(() => {
    const unlock = () => void audioEngine.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : null

  return (
    <div className="app">
      {/* ══════════ 顶栏 ══════════ */}
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">Fretboard Atlas</span>
          <span className="brand__sub">指板音记忆训练 · {tuning.note}</span>
        </div>

        <div className="topbar__controls">
          <div className="segmented" role="group" aria-label="模块">
            <button
              className="segmented__item"
              aria-pressed={view === 'path'}
              onClick={() => switchView('path')}
            >
              路径
            </button>
            <button
              className="segmented__item"
              aria-pressed={view === 'train'}
              onClick={() => switchView('train')}
            >
              指板训练
            </button>
            <button
              className="segmented__item"
              aria-pressed={view === 'chords'}
              onClick={() => switchView('chords')}
            >
              和弦参考
            </button>
            <button
              className="segmented__item"
              aria-pressed={view === 'scales'}
              onClick={() => switchView('scales')}
            >
              音阶
            </button>
            <button
              className="segmented__item"
              aria-pressed={view === 'ear'}
              onClick={() => switchView('ear')}
            >
              耳朵
            </button>
            <button
              className="segmented__item"
              aria-pressed={view === 'jam'}
              onClick={() => switchView('jam')}
            >
              Jam
            </button>
            <button
              className="segmented__item"
              aria-pressed={view === 'licks'}
              onClick={() => switchView('licks')}
            >
              乐句
            </button>
            <button
              className="segmented__item"
              aria-pressed={view === 'theory'}
              onClick={() => switchView('theory')}
            >
              乐理
            </button>
          </div>

          {view === 'train' && (
            <>
              <div className="segmented" role="group" aria-label="练习任务">
                <button
                  className="segmented__item"
                  aria-pressed={task === 'find'}
                  onClick={() => update('task', 'find')}
                >
                  找位置
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={task === 'name'}
                  onClick={() => update('task', 'name')}
                >
                  认音名
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={task === 'octave'}
                  onClick={() => update('task', 'octave')}
                >
                  找八度
                </button>
              </div>

              <div className="segmented" role="group" aria-label="练习节奏">
                <button
                  className="segmented__item"
                  aria-pressed={settings.mode === 'auto'}
                  onClick={() => update('mode', 'auto')}
                >
                  自动
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={settings.mode === 'manual'}
                  onClick={() => update('mode', 'manual')}
                >
                  手动
                </button>
              </div>
            </>
          )}
        </div>

        <div className="stats" aria-live="polite">
          {stats.streak > 0 && (
            <span className="stat stat--streak">
              <span className="stat__value">{stats.streak}</span>
              <span className="stat__label">连对</span>
            </span>
          )}
          {accuracy !== null && (
            <span className="stat">
              <span className="stat__value">{accuracy}%</span>
              <span className="stat__label">正确率</span>
            </span>
          )}
          <span className="stat">
            <span className="stat__value">{stats.asked}</span>
            <span className="stat__label">题</span>
          </span>
        </div>

        <div className="row" style={{ gap: 'var(--s-2)' }}>
          {running && (
            <button className="btn btn--ghost" onClick={stop} title="结束练习（Esc）">
              结束
            </button>
          )}
          <button
            className="btn btn--icon btn--ghost"
            onClick={() => update('muted', !settings.muted)}
            aria-label={settings.muted ? '取消静音' : '静音'}
            title={settings.muted ? '取消静音' : '静音'}
          >
            {settings.muted ? '🔇' : '🔊'}
          </button>
          <button
            className="btn btn--icon btn--ghost"
            onClick={() => setSettingsOpen(true)}
            aria-label="打开设置"
            title="设置（S）"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ══════════ 主舞台：按模块切换 ══════════ */}
      {view === 'path' ? (
        <LearningPath />
      ) : view === 'train' ? (
        <main className="stage">
          <div className="train-bar">
            {navState.rootPc !== null && (
              <span className="train-bar__root">
                <span className="train-context__dot" aria-hidden="true" />
                贯通根音 <b>{LETTER_NAMES[navState.rootPc]}</b>
              </span>
            )}
            <span className="train-bar__label">出题偏好</span>
            <div className="segmented segmented--wrap" role="group" aria-label="出题偏好">
              {BIAS_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  className="segmented__item"
                  aria-pressed={settings.biasMode === o.id}
                  onClick={() => update('biasMode', o.id)}
                  type="button"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="train-bar__hint">
              {navState.rootPc === null
                ? '偏向 Do / Fa / Sol 需先在和弦或音阶页选一个根音作锚；当前无锚，自动随机。'
                : settings.biasMode === 'random'
                  ? '纯随机出题，12 个音均匀轮。'
                  : `以 ${LETTER_NAMES[navState.rootPc]} 为锚：Do=${LETTER_NAMES[navState.rootPc]} · Fa=${LETTER_NAMES[(navState.rootPc + 5) % 12]} · Sol=${LETTER_NAMES[(navState.rootPc + 7) % 12]}，约 40% 命中该音，其余随机。`}
            </span>
          </div>
          <PromptStage
            phase={phase}
            mode={settings.mode}
            task={task}
            question={question}
            verdict={verdict}
            cycleToken={cycleToken}
            intervalSec={settings.intervalSec}
            labelMode={settings.labelMode}
            pickedNote={pickedNote}
            markedCount={marked.size}
            targetCount={question?.targets.length ?? 0}
            showSharps={settings.scope.includeAccidentals}
            onStart={start}
            onReveal={reveal}
            onNext={next}
            onReplay={replay}
            onAnswerNote={answerNote}
          />
        </main>
      ) : view === 'chords' ? (
        <ChordLibrary tuning={tuning} settings={settings} />
      ) : view === 'scales' ? (
        <ScaleTrainer tuning={tuning} />
      ) : view === 'ear' ? (
        <EarTrainer tuning={tuning} />
      ) : view === 'jam' ? (
        <JamTrainer tuning={tuning} />
      ) : view === 'theory' ? (
        <TheoryGuide tuning={tuning} />
      ) : (
        <LickLibrary tuning={tuning} />
      )}

      {/* ══════════ 指板 ══════════ */}
      {view === 'train' && (
        <section className="fretboard-zone" aria-label="吉他指板">
          <Fretboard
            tuning={tuning}
            maxFret={MAX_FRET}
            highlights={highlights}
            targetString={phase === 'asking' && question ? question.string : null}
            scopeRange={settings.scope.fretRange}
            interactive
            showAllNotes={settings.showAllNotes}
            labelMode={settings.labelMode}
            ringingString={ringingString}
            onFretClick={handleFretClick}
          />
        </section>
      )}

      {/* ══════════ 设置 ══════════ */}
      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        tuning={tuning}
        stats={stats}
        mastery={mastery}
        onClose={() => setSettingsOpen(false)}
        update={update}
        updateScope={updateScope}
        onResetStats={resetStats}
        onResetSettings={resetSettings}
        onResetMastery={resetMastery}
      />
    </div>
  )
}
