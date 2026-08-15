import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audioEngine } from '../lib/audio'
import {
  CHORD_TYPES,
  voiceChord,
  type ChordType,
  type Voicing,
} from '../lib/chords'
import {
  SCALES,
  scalePositions,
  type ScaleDef,
  type ScaleNote,
} from '../lib/scales'
import { midiAt, type PitchClass, type Tuning } from '../lib/music'
import { sessionStore } from '../lib/session'
import { getGroove, GROOVES } from '../lib/rhythm'
import { useRhythmState } from '../lib/rhythmStore'
import {
  JAM_PRESETS,
  type JamPreset,
  typeOf,
  progressionKeyLabel,
  scaleLabel,
} from '../lib/progressions'
import { IntervalShapes } from './IntervalShapes'
import { ChordDiagram } from './ChordDiagram'
import { Fretboard } from './Fretboard'
import { ConceptCheatSheet } from './ConceptCheatSheet'

/* ──────────────────────────── 数据：音程 ──────────────────────────── */
interface IntervalDef {
  semis: number
  label: string
  /** 以歌带练的锚点（老师口吻 + 真实曲例） */
  ref: string
}
const INTERVALS: IntervalDef[] = [
  { semis: 1, label: '小二度', ref: '《Jaws》鲨鱼主题——两个音只差半音，刺耳又紧张。' },
  { semis: 2, label: '大二度', ref: '《Happy Birthday》"Hap-py" 的开头那个上行大二度。' },
  { semis: 3, label: '小三度', ref: '《Summertime》"Sum-mer"——忧郁的小三度上行。' },
  { semis: 4, label: '大三度', ref: '《When the Saints Go Marching In》"When-the"——明亮的大三度。' },
  { semis: 5, label: '纯四度', ref: '《Here Comes the Bride》"Here-comes" 那个庄严的纯四度。' },
  { semis: 6, label: '三全音', ref: '《The Simpsons》主题开头 "The-Simps-"——魔鬼的间隔。' },
  { semis: 7, label: '纯五度', ref: '《Twinkle Twinkle》"Twi-nkle"——空、稳的纯五度。' },
  { semis: 8, label: '小六度', ref: '《Love Me Tender》开头 "Love-me"——温柔的小六度。' },
  { semis: 9, label: '大六度', ref: 'NBC 三音钟声的后两个音——开阔的大六度。' },
  { semis: 10, label: '小七度', ref: '《Star Trek》主题开头那个大跳——属七和弦的 ♭7，想解决。' },
  { semis: 11, label: '大七度', ref: '《Take On Me》"Take-on"——悬而未落的大七度。' },
  { semis: 12, label: '纯八度', ref: '《Over the Rainbow》开头 "Some-where" 那个大跳——同一音高差八度。' },
]

/* ──────────────────────────── 题目模型 ──────────────────────────── */
interface EarOption {
  id: string
  label: string
}

type EarQuestion =
  | {
      kind: 'interval'
      rootMidi: number
      secondMidi: number
      answerId: string
      answerLabel: string
      options: EarOption[]
      explain: string
    }
  | {
      kind: 'chord'
      rootPc: PitchClass
      notes: (number | null)[]
      voicing: Voicing
      answerId: string
      answerLabel: string
      options: EarOption[]
      explain: string
    }
  | {
      kind: 'scale'
      rootPc: PitchClass
      run: ScaleNote[]
      answerId: string
      answerLabel: string
      options: EarOption[]
      explain: string
    }
  | {
      kind: 'groove'
      grooveId: string
      answerId: string
      answerLabel: string
      options: EarOption[]
      explain: string
    }
  | {
      kind: 'progression'
      presetId: string
      answerId: string
      answerLabel: string
      options: EarOption[]
      explain: string
      keyLabel: string
    }

type EarMode = 'interval' | 'chord' | 'scale' | 'groove' | 'progression'

/** 耳朵训练「听进行」用的候选父调池（答案 + 干扰项都从这里取） */
const KEY_POOL: { pc: number; q: 'major' | 'minor'; label: string }[] = [
  { pc: 0, q: 'major', label: 'C 大调 / A 小调' },
  { pc: 5, q: 'major', label: 'F 大调 / D 小调' },
  { pc: 7, q: 'major', label: 'G 大调 / E 小调' },
  { pc: 2, q: 'major', label: 'D 大调 / B 小调' },
  { pc: 9, q: 'minor', label: 'A 小调 / C 大调' },
  { pc: 4, q: 'minor', label: 'E 小调 / G 大调' },
]

type Verdict = 'none' | 'correct' | 'wrong'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 从最低根音开始取约一个八度的音阶音，供「音阶听辨」逐音上行播放 */
function scaleRun(tuning: Tuning, rootPc: PitchClass, formula: number[]): ScaleNote[] {
  const all = scalePositions(tuning, rootPc, formula, [0, 15]).sort((a, b) => a.midi - b.midi)
  const root = all.find((n) => n.degree === 0) ?? all[0]
  if (!root) return []
  return all.filter((n) => n.midi >= root.midi && n.midi <= root.midi + 14).slice(0, 8)
}

const ROOT_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/* ──────────────────────────── 组件 ──────────────────────────── */
export function EarTrainer({ tuning }: { tuning: Tuning }) {
  const [mode, setMode] = useState<EarMode>('interval')
  const [question, setQuestion] = useState<EarQuestion | null>(null)
  const [verdict, setVerdict] = useState<Verdict>('none')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [stats, setStats] = useState({ answered: 0, correct: 0, streak: 0 })

  // 耳朵训练「听鼓点 / 听进行」复用的练习速度（与节奏条同一来源，听感和练习一致）
  const { bpm } = useRhythmState()
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm

  const genQuestion = useCallback(
    (m: EarMode): EarQuestion => {
      if (m === 'interval') {
        const def = INTERVALS[Math.floor(Math.random() * INTERVALS.length)]
        const rootMidi = 57 + Math.floor(Math.random() * 12) // A3..G#4 舒适音区
        return {
          kind: 'interval',
          rootMidi,
          secondMidi: rootMidi + def.semis,
          answerId: String(def.semis),
          answerLabel: def.label,
          // 按度数大小顺序排列（小二度 → … → 纯八度），方便用户按音程距离找答案
          options: INTERVALS.map((i) => ({ id: String(i.semis), label: i.label })),
          explain: def.ref,
        }
      }
      if (m === 'chord') {
        const t: ChordType = CHORD_TYPES[Math.floor(Math.random() * CHORD_TYPES.length)]
        const rootPc = (Math.floor(Math.random() * 12) as PitchClass)
        const v = voiceChord(rootPc, t, tuning)
        const notes = v.notes.map((n) => (n.muted ? null : midiAt(tuning, n.string, n.fret)))
        return {
          kind: 'chord',
          rootPc,
          notes,
          voicing: v,
          answerId: t.id,
          answerLabel: t.label,
          options: shuffle(CHORD_TYPES.map((c) => ({ id: c.id, label: c.label }))),
          explain: `${t.color} · ${t.ear}`,
        }
      }
      if (m === 'scale') {
        // scale
        const s: ScaleDef = SCALES[Math.floor(Math.random() * SCALES.length)]
        const rootPc = Math.floor(Math.random() * 12) as PitchClass
        const run = scaleRun(tuning, rootPc, s.formula)
        return {
          kind: 'scale',
          rootPc,
          run,
          answerId: s.id,
          answerLabel: s.label,
          options: shuffle(SCALES.map((x) => ({ id: x.id, label: x.label }))),
          explain: `${s.color} · ${s.usage}`,
        }
      }
    if (m === 'groove') {
      // 只从「鼓」类 groove 里抽（木鱼 click 不算律动）
      const drums = GROOVES.filter((g) => g.kit === 'drums')
      const g = drums[Math.floor(Math.random() * drums.length)]
      const distractors = shuffle(drums.filter((d) => d.id !== g.id)).slice(0, 3)
      return {
        kind: 'groove',
        grooveId: g.id,
        answerId: g.id,
        answerLabel: g.label,
        options: shuffle([g, ...distractors]).map((d) => ({ id: d.id, label: d.label })),
        explain: `风格：${g.style}。${g.tip}`,
      }
    }
    // progression：听一段和弦进行，猜它落在哪个父调
    const p: JamPreset = JAM_PRESETS[Math.floor(Math.random() * JAM_PRESETS.length)]
    const correct = KEY_POOL.find((k) => k.pc === p.keyPc && k.q === p.keyQuality) ?? KEY_POOL[0]
    const distractors = shuffle(KEY_POOL.filter((k) => k !== correct)).slice(0, 3)
    const options = shuffle([correct, ...distractors]).map((k) => ({ id: k.label, label: k.label }))
    return {
      kind: 'progression',
      presetId: p.id,
      answerId: correct.label,
      answerLabel: correct.label,
      options,
      explain: `${p.why} 听感上，它的「家」是 ${progressionKeyLabel(p)}；整段 solo 用 ${scaleLabel(
        p.globalScale.scaleId,
      )}（根音 ${ROOT_LABELS[p.globalScale.rootPc]}）。`,
      keyLabel: progressionKeyLabel(p),
    }
  },
    [tuning],
  )

  // 模式切换 / 首屏：生成一道新题
  useEffect(() => {
    setQuestion(genQuestion(mode))
    setVerdict('none')
    setPickedId(null)
  }, [mode, genQuestion])

  const playQuestion = useCallback(() => {
    if (!question) return
    void audioEngine.unlock()
    if (question.kind === 'interval') {
      audioEngine.pluck(question.rootMidi, { velocity: 0.9 })
      audioEngine.pluck(question.secondMidi, { velocity: 0.9, delay: 0.55 })
    } else if (question.kind === 'chord') {
      audioEngine.strum(question.notes, 0.02)
    } else if (question.kind === 'scale') {
      question.run.forEach((n, i) => audioEngine.pluck(n.midi, { velocity: 0.85, delay: i * 0.3 }))
    } else if (question.kind === 'groove') {
      const g = getGroove(question.grooveId)
      audioEngine.playGroove(g.steps, g.subdiv, bpmRef.current, 2, !!g.swing)
    } else {
      // progression：把整段进行扫两遍（每和弦占一拍），听「家」落在哪个调
      const p = JAM_PRESETS.find((x) => x.id === question.presetId) ?? JAM_PRESETS[0]
      const beatDur = 60 / Math.max(50, bpmRef.current)
      const start = audioEngine.currentTime + 0.1
      const loops = 2
      for (let loop = 0; loop < loops; loop++) {
        p.chords.forEach((c, i) => {
          const v = voiceChord(c.rootPc, typeOf(c.typeId), tuning)
          const notes = v.notes.map((n) => (n.muted ? null : midiAt(tuning, n.string, n.fret)))
          const when = start + loop * p.chords.length * beatDur + i * beatDur
          audioEngine.strum(notes, 0.009, when)
        })
      }
    }
  }, [question, tuning])

  // 新题自动播一次（需先有一次用户交互解锁音频，点「下一题」即满足）
  useEffect(() => {
    if (question) playQuestion()
  }, [question, playQuestion])

  const answer = useCallback(
    (id: string) => {
      if (!question || verdict !== 'none') return
      setPickedId(id)
      const ok = id === question.answerId
      setVerdict(ok ? 'correct' : 'wrong')
      setStats((s) => ({
        answered: s.answered + 1,
        correct: s.correct + (ok ? 1 : 0),
        streak: ok ? s.streak + 1 : 0,
      }))
      if (ok) playQuestion()
    },
    [question, verdict, playQuestion],
  )

  const next = useCallback(() => {
    setQuestion(genQuestion(mode))
    setVerdict('none')
    setPickedId(null)
  }, [mode, genQuestion])

  /** 揭示答案后，把「听到的」写进共享状态——让和弦 / 音阶 / Jam 页接上同一把钥匙 */
  useEffect(() => {
    if (!question || verdict === 'none') return
    if (question.kind === 'interval') {
      sessionStore.setRoot(((question.rootMidi % 12) + 12) % 12)
    } else if (question.kind === 'chord' || question.kind === 'scale') {
      sessionStore.setRoot(question.rootPc)
    } else if (question.kind === 'progression') {
      const p = JAM_PRESETS.find((x) => x.id === question.presetId) ?? JAM_PRESETS[0]
      // 把父调 + 父音阶写进共享上下文，去 Jam / 音阶页直接接上这条调性线
      sessionStore.setKey(p.keyPc, p.keyQuality)
      sessionStore.setRoot(p.globalScale.rootPc)
      sessionStore.setScale(p.globalScale.scaleId)
    }
    // groove 没有单一音高目标，不写共享根音
  }, [question, verdict])

  /** 去和弦页弹「这个」：写入根音 + 和弦类型，再请求跳转 */
  const goChords = useCallback(() => {
    if (question?.kind !== 'chord') return
    sessionStore.setRoot(question.rootPc)
    sessionStore.setChord(question.answerId)
    sessionStore.requestNav('chords')
  }, [question])

  /** 去音阶页练「这个」：写入根音 + 默认推荐音阶，再请求跳转 */
  const goScales = useCallback(() => {
    if (question?.kind !== 'scale') return
    sessionStore.setRoot(question.rootPc)
    sessionStore.setScale(question.answerId)
    sessionStore.requestNav('scales')
  }, [question])

  /** 去 Jam 页练「这个」进行：写入父调 + 父音阶 + 目标进行，再请求跳转 */
  const goJam = useCallback(() => {
    if (question?.kind !== 'progression') return
    const p = JAM_PRESETS.find((x) => x.id === question.presetId) ?? JAM_PRESETS[0]
    sessionStore.setRoot(p.globalScale.rootPc)
    sessionStore.setScale(p.globalScale.scaleId)
    sessionStore.setKey(p.keyPc, p.keyQuality)
    sessionStore.setJamPreset(p.id)
    sessionStore.requestNav('jam')
  }, [question])

  // 快捷键：空格再听，回车下一题（仅 ear 视图内）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        playQuestion()
      } else if (e.key === 'Enter' && verdict !== 'none') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playQuestion, next, verdict])

  const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : null
  const modeLabel = useMemo(
    () =>
      ({
        interval: '音程辨识',
        chord: '和弦辨识',
        scale: '音阶听辨',
        groove: '鼓点辨识',
        progression: '进行辨识',
      }[mode]),
    [mode],
  )
  const promptText = useMemo(() => {
    if (mode === 'groove') return '🎧 听这段鼓点——它是什么律动？点下面的选项猜一猜。'
    if (mode === 'progression') return '🎧 听这段和弦进行——它落在哪个调？点下面的选项猜一猜。'
    return `🎧 听好了——这是${modeLabel}？点下面的选项猜一猜。`
  }, [mode, modeLabel])

  /** 音阶揭示后：把整条音阶铺在指板上，根音（橙色）高亮——一眼看到「这个音阶长在哪」 */
  const scaleRevealHighlights = useMemo(() => {
    if (question?.kind !== 'scale') return []
    const def = SCALES.find((s) => s.id === question.answerId) ?? SCALES[0]
    const positions = scalePositions(tuning, question.rootPc, def.formula, [0, 12])
    return positions.map((p) => ({
      string: p.string,
      fret: p.fret,
      kind: (p.degree === 0 ? 'answer' : 'secondary') as 'answer' | 'secondary',
    }))
  }, [question, tuning])

  return (
    <main className="module-stage ear-stage">
      <div className="module-scroll">
        <div className="chord-panel ear-panel">
          {/* 模式选择 */}
          <div className="scale-controls">
            <div className="field field--practice">
              <label className="field__label">耳朵训练</label>
              <div className="segmented segmented--wrap" role="group" aria-label="训练类型">
                <button
                  className="segmented__item"
                  aria-pressed={mode === 'interval'}
                  onClick={() => setMode('interval')}
                >
                  音程
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={mode === 'chord'}
                  onClick={() => setMode('chord')}
                >
                  和弦
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={mode === 'scale'}
                  onClick={() => setMode('scale')}
                >
                  音阶
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={mode === 'groove'}
                  onClick={() => setMode('groove')}
                >
                  鼓点
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={mode === 'progression'}
                  onClick={() => setMode('progression')}
                >
                  进行
                </button>
              </div>
            </div>
            <div className="ear-stats" aria-live="polite">
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
                <span className="stat__value">{stats.answered}</span>
                <span className="stat__label">题</span>
              </span>
            </div>
          </div>

          <div className="ear-layout">
            {/* 左：题目 + 播放 + 选项 */}
            <section className="ear-figure" aria-label="听音答题">
              <div className="ear-prompt">{promptText}</div>

              <button className="ear-play" onClick={playQuestion} type="button">
                ▶ 再听一遍
                <small>（或按空格）</small>
              </button>

              <div className="ear-options">
                {question?.options.map((opt) => {
                  const isAnswer = opt.id === question.answerId
                  const isPicked = opt.id === pickedId
                  const cls = [
                    'ear-opt',
                    verdict !== 'none' && isAnswer ? 'is-correct' : '',
                    verdict === 'wrong' && isPicked ? 'is-wrong' : '',
                  ].join(' ').trim()
                  return (
                    <button
                      key={opt.id}
                      className={cls}
                      disabled={verdict !== 'none'}
                      onClick={() => answer(opt.id)}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <div className="ear-verdict">
                {verdict === 'correct' && (
                  <span className="ear-verdict__ok">✓ 对！就是「{question?.answerLabel}」</span>
                )}
                {verdict === 'wrong' && (
                  <span className="ear-verdict__no">
                    ✗ 答错了——正确答案是「{question?.answerLabel}」
                  </span>
                )}
                {verdict === 'none' && <span className="ear-verdict__hint">点一个选项，听完再想</span>}
                {verdict !== 'none' && (
                  <button className="btn btn--primary ear-next" onClick={next} type="button">
                    下一题 →
                  </button>
                )}
              </div>

              {/* 揭示后即展示该音程在指板上的常用距离形状（对错都展示，训练「听→看形状」） */}
              {verdict !== 'none' && question?.kind === 'interval' && (
                <IntervalShapes semitones={question.secondMidi - question.rootMidi} tuning={tuning} />
              )}

              {/* 和弦揭示后：竖向和弦图 + 一键去和弦页弹它 */}
              {verdict !== 'none' && question?.kind === 'chord' && (
                <div className="ear-shape-panel">
                  <p className="ear-shape-panel__title">把它弹出来——指板上长这样</p>
                  <div className="ear-chord-reveal">
                    <div className="ear-chord-diagram">
                      <ChordDiagram voicing={question.voicing} />
                    </div>
                    <div className="ear-shape-panel__actions">
                      <button className="btn btn--primary" onClick={goChords} type="button">
                        去和弦页弹这个 →
                      </button>
                      <p className="ear-shape-panel__hint">
                        根音 {ROOT_LABELS[question.rootPc]} 已写入共享——点按钮直接跳到和弦页开练。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 音阶揭示后：整条音阶铺在指板上 + 一键去音阶页练它 */}
              {verdict !== 'none' && question?.kind === 'scale' && (
                <div className="ear-shape-panel">
                  <p className="ear-shape-panel__title">在指板上走这个音阶</p>
                  <div className="ear-fretboard-wrap">
                    <Fretboard
                      tuning={tuning}
                      maxFret={12}
                      highlights={scaleRevealHighlights}
                      targetString={null}
                      scopeRange={[0, 12]}
                      interactive={false}
                      showAllNotes={false}
                      labelMode="letter"
                      ringingString={null}
                      compact
                    />
                  </div>
                  <div className="ear-shape-panel__actions">
                    <button className="btn btn--primary" onClick={goScales} type="button">
                      去音阶页练这个 →
                    </button>
                    <p className="ear-shape-panel__hint">
                      {ROOT_LABELS[question.rootPc]} {question.answerLabel}：根音已写入共享——跳过去直接在能 solo 的把位开练。
                    </p>
                  </div>
                </div>
              )}
            {/* 鼓点揭示后：解析这段律动「性格」在哪 */}
            {verdict !== 'none' && question?.kind === 'groove' && (
              <div className="ear-shape-panel">
                <p className="ear-shape-panel__title">这段鼓点长这样</p>
                <div className="ear-groove-reveal">
                  <p className="ear-explain__body">{question.explain}</p>
                  <p className="ear-shape-panel__hint">
                    留意：底鼓落在哪拍、军鼓是不是压在 2·4、有没有长镲 / 边击 / 切分——这些决定了律动的「性格」。
                  </p>
                </div>
              </div>
            )}

            {/* 进行揭示后：解析父调 + 一键去 Jam 页练同一段 */}
            {verdict !== 'none' && question?.kind === 'progression' && (
              <div className="ear-shape-panel">
                <p className="ear-shape-panel__title">这个进行的「家」</p>
                <div className="ear-groove-reveal">
                  <p className="ear-explain__body">{question.explain}</p>
                  <div className="ear-shape-panel__actions">
                    <button className="btn btn--primary" onClick={goJam} type="button">
                      去 Jam 页练这个 →
                    </button>
                    <p className="ear-shape-panel__hint">
                      父调 {question.keyLabel} 已写入共享——点按钮直接跳到 Jam 页，落在同一段进行上开练。
                    </p>
                  </div>
                </div>
              </div>
            )}
            </section>

            {/* 右：老师提示（揭示后给解析） */}
            <aside className="ear-theory" aria-label="解析">
              <h3 className="chord-theory__title">老师提示</h3>
              <p className="chord-theory__lead">
                耳朵是吉他手最被低估的肌肉。先别看谱——闭上眼睛，让音自己说话。猜完再看右边，把「名字」和「听到的感觉」对上号。
              </p>

              <div className="ear-teacher-tip">
                <p className="ear-teacher-tip__head">{modeLabel}怎么练</p>
                <ul className="ear-teacher-tip__list">
                  <li>
                    <strong>音程</strong>：先死磕 4 个最常用——大三度(4 半音，亮)、小三度(3 半音，暗)、纯五度(7，空旷)、纯四度(5，稳)。它们是和弦与旋律的骨架。小任务：弹根音，再弹它上方大三度，记住那个「亮一下」；换成小三度，那个「沉一下」——先让耳朵认得这两者的情绪差。
                  </li>
                  <li>
                    <strong>和弦</strong>：先分「大 / 小」的情绪（亮 vs 暗），再听七和弦多出来的那个音。♭7 想走（属七的发动机）、大七甜（maj7 的温柔）、减七最紧张（dim7 的悬疑）。小任务：轮流弹 C、Cm、C7、Cmaj7、Cdim，闭眼给每个起个情绪外号。
                  </li>
                  <li>
                    <strong>音阶</strong>：听「暗 / 亮」和那个特殊的音——蓝调音（♭5）一出现就是 blues；♭7 在就是 mixolydian（属七味）；亮里有个 #4 飘着就是 lydian。小任务：盲听时先判断「大调味还是小调味」，再去找那个「特征音」在哪。
                  </li>
                  <li>
                    <strong>鼓点 (groove)</strong>：别只数拍子——听「性格」。动次打次是 rock 的脊梁；funk 把底鼓甩到反拍(切分)；雷鬼故意不踩第 1 拍(反拍驱动)；bossa 用边击点出拉丁重音；shuffle 把 8 分音符「摇」成三连音感。小任务：先能分大风格，再抠「重音落在哪」。
                  </li>
                  <li>
                    <strong>进行</strong>：听「家」在哪——哪个和弦最「稳」、最想回来，就是主和弦(I)，它决定了调(大调还是小调)。小任务：盲听时先辨明暗定调，再听它整段该用什么音阶 solo（比如属七多就往 Mixolydian / blues 想）。
                  </li>
                </ul>
              </div>

              <ConceptCheatSheet
                filter={['basic', 'chord', 'scale', 'rhythm']}
                subtitle="练耳朵时最常碰到的术语，老师给你翻译成大白话。猜完看答案前，先对照着听。"
              />

              {verdict !== 'none' && question && (
                <div className="ear-explain">
                  <p className="ear-explain__label">
                    答案：<strong>{question.answerLabel}</strong>
                    {question.kind === 'chord' || question.kind === 'scale' && (
                      <span className="ear-explain__root">
                        {' '}
                        · 根音 {ROOT_LABELS[question.rootPc]}
                      </span>
                    )}
                  </p>
                  <p className="ear-explain__body">{question.explain}</p>
                </div>
              )}

              <p className="ear-foot">
                提示：练习音阶 / 和弦时，底部节奏条已经把律动嵌进去了——耳朵训练专注「听得出」，节奏交给鼓点。
              </p>
            </aside>
          </div>
        </div>
      </div>
    </main>
  )
}
