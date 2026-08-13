import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPreset, type RhythmPreset } from '../lib/rhythm'
import { rhythmStore, useRhythmState } from '../lib/rhythmStore'
import { audioEngine } from '../lib/audio'
import { getPattern, patternsForSubdiv, type StrumAction, type StrumPattern } from '../lib/strumPatterns'

type Mode = 'follow' | 'practice'
type Verdict = 'perfect' | 'good' | 'early' | 'late' | 'miss' | 'extra' | 'none'

interface ExpectedStrum {
  stepIndex: number
  action: StrumAction
  audioTime: number
  hit: boolean
}

interface Stats {
  perfect: number
  good: number
  early: number
  late: number
  miss: number
  extra: number
}

const VERDICT_LABEL: Record<Exclude<Verdict, 'none'>, string> = {
  perfect: '完美',
  good: '准',
  early: '早',
  late: '晚',
  miss: '漏',
  extra: '多',
}

const VERDICT_CLASS: Record<Exclude<Verdict, 'none'>, string> = {
  perfect: 'is-perfect',
  good: 'is-good',
  early: 'is-early',
  late: 'is-late',
  miss: 'is-miss',
  extra: 'is-extra',
}

export function RhythmTrainer() {
  const { bpm, presetId } = useRhythmState()
  const preset = getPreset(presetId)
  const availablePatterns = useMemo(() => patternsForSubdiv(preset.subdiv), [preset.subdiv])

  const [patternId, setPatternId] = useState<string>(() => availablePatterns[0]?.id ?? '')
  const [mode, setMode] = useState<Mode>('follow')
  const [playing, setPlaying] = useState(false)
  const [playStep, setPlayStep] = useState(-1)
  const [lastVerdict, setLastVerdict] = useState<Verdict>('none')
  const [stats, setStats] = useState<Stats>({ perfect: 0, good: 0, early: 0, late: 0, miss: 0, extra: 0 })

  // 当前拍型变化或节拍型细分变化时，自动切到第一个可用 pattern
  useEffect(() => {
    const first = availablePatterns[0]
    setPatternId((id) => {
      const stillOk = availablePatterns.some((p) => p.id === id)
      return stillOk ? id : first?.id ?? ''
    })
  }, [availablePatterns])

  const pattern = getPattern(patternId)

  // refs for scheduler (avoid stale closures)
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const presetRef = useRef<RhythmPreset>(preset)
  presetRef.current = preset
  const patternRef = useRef<StrumPattern | undefined>(pattern)
  patternRef.current = pattern
  const expectedRef = useRef<ExpectedStrum[]>([])
  const playStepRef = useRef(playStep)
  playStepRef.current = playStep

  // 播放/停止时清空判定
  useEffect(() => {
    if (!playing) {
      setPlayStep(-1)
      expectedRef.current = []
      return
    }
    void audioEngine.unlock()
    setLastVerdict('none')
  }, [playing])

  // 调度器：鼓点 + 高亮 + 练习模式记录期望时间
  useEffect(() => {
    if (!playing || !patternRef.current) {
      setPlayStep(-1)
      expectedRef.current = []
      return
    }

    let nextTime = audioEngine.currentTime + 0.12
    let step = 0
    const timers: number[] = []

    const schedule = () => {
      const p = presetRef.current
      const pat = patternRef.current!
      const stepDur = 60 / bpmRef.current / p.subdiv
      const ahead = 0.16
      const now = audioEngine.currentTime

      // 清理过期期望事件：未命中 → miss；已命中 → 稍后清理
      expectedRef.current.forEach((e) => {
        if (!e.hit && e.audioTime + 0.22 < now) {
          setStats((s) => ({ ...s, miss: s.miss + 1 }))
          e.hit = true
        }
      })
      expectedRef.current = expectedRef.current.filter((e) => e.audioTime + 0.5 > now)

      while (nextTime < now + ahead) {
        const s = step
        const spec = p.steps[s]
        const tPlay = nextTime

        // 鼓点 / 节拍器发声
        if (p.kit === 'click') {
          if (spec.accent) audioEngine.click(tPlay, true)
          else if (spec.tick) audioEngine.click(tPlay, false)
        } else {
          if (spec.kick) audioEngine.kick(tPlay)
          if (spec.snare) audioEngine.snare(tPlay)
          if (spec.hat) audioEngine.hat(tPlay)
        }

        // 练习模式：记录期望扫弦时间
        if (mode === 'practice') {
          const action = pat.steps[s]
          if (action !== 'rest') {
            expectedRef.current.push({ stepIndex: s, action, audioTime: tPlay, hit: false })
          }
        }

        const visualDelay = Math.max(0, (tPlay - audioEngine.currentTime) * 1000)
        timers.push(
          window.setTimeout(() => {
            setPlayStep(s)
            playStepRef.current = s
          }, visualDelay),
        )

        nextTime += stepDur
        step = (step + 1) % p.steps.length
      }
    }

    schedule()
    const interval = window.setInterval(schedule, 25)
    return () => {
      window.clearInterval(interval)
      timers.forEach((t) => window.clearTimeout(t))
      expectedRef.current = []
    }
  }, [playing, mode, presetId])

  // 判定一次用户输入
  const handleStrum = useCallback(
    (action: StrumAction) => {
      void audioEngine.unlock()
      if (mode === 'follow' || !pattern) {
        // 跟奏模式：点一下只播一个反馈音，不判定
        if (action === 'down') audioEngine.pluck(40, { velocity: 0.35 })
        else if (action === 'up') audioEngine.pluck(45, { velocity: 0.3 })
        return
      }

      const now = audioEngine.currentTime
      const tol = 0.22
      const candidates = expectedRef.current.filter(
        (e) => e.action === action && !e.hit && Math.abs(e.audioTime - now) <= tol,
      )
      if (candidates.length === 0) {
        setLastVerdict('extra')
        setStats((s) => ({ ...s, extra: s.extra + 1 }))
        return
      }
      candidates.sort((a, b) => Math.abs(a.audioTime - now) - Math.abs(b.audioTime - now))
      const target = candidates[0]
      target.hit = true
      const delta = now - target.audioTime
      const abs = Math.abs(delta)
      let verdict: Verdict
      if (abs <= 0.06) verdict = 'perfect'
      else if (abs <= 0.12) verdict = 'good'
      else if (delta < 0) verdict = 'early'
      else verdict = 'late'
      setLastVerdict(verdict)
      setStats((s) => ({ ...s, [verdict]: s[verdict] + 1 }))
    },
    [mode, pattern],
  )

  // 键盘：Space/↓ = 下扫，↑/U = 上扫
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.code === 'Space' || e.code === 'ArrowDown') {
        e.preventDefault()
        handleStrum('down')
      } else if (e.code === 'ArrowUp' || e.key === 'u' || e.key === 'U') {
        handleStrum('up')
      } else if (e.code === 'Escape') {
        setPlaying(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleStrum])

  const resetStats = () => {
    setStats({ perfect: 0, good: 0, early: 0, late: 0, miss: 0, extra: 0 })
    setLastVerdict('none')
  }

  const totalHits = stats.perfect + stats.good + stats.early + stats.late + stats.miss
  const solidHits = stats.perfect + stats.good
  const accuracy = totalHits > 0 ? Math.round((solidHits / totalHits) * 100) : null

  const gridCols = pattern?.steps.length ?? preset.steps.length

  return (
    <main className="stage rhythm-stage">
      <div className="rhythm-panel">
        {/* 顶栏控制 */}
        <div className="rhythm-controls">
          <div className="field">
            <label className="field__label">练习模式</label>
            <div className="segmented" role="group" aria-label="练习模式">
              <button
                className="segmented__item"
                aria-pressed={mode === 'follow'}
                onClick={() => {
                  setMode('follow')
                  resetStats()
                }}
              >
                跟奏
              </button>
              <button
                className="segmented__item"
                aria-pressed={mode === 'practice'}
                onClick={() => {
                  setMode('practice')
                  resetStats()
                }}
              >
                练习
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field__label">扫弦型</label>
            {pattern ? (
              <div className="segmented segmented--wrap" role="group" aria-label="扫弦型">
                {availablePatterns.map((p) => (
                  <button
                    key={p.id}
                    className="segmented__item"
                    aria-pressed={patternId === p.id}
                    onClick={() => {
                      setPatternId(p.id)
                      resetStats()
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rhythm-no-pattern">当前节拍型「{preset.label}」暂无扫弦型，请到设置换 4/4 或 8分 节拍型。</p>
            )}
          </div>

          <div className="field field--grow">
            <label className="field__label">
              律动 <strong>{preset.label}</strong> · {bpm} BPM
            </label>
            <p className="field__hint">速度和节拍型在「设置 ⚙ → 节奏」里统一调整。</p>
          </div>

          <button
            className={playing ? 'btn btn--sm btn--ghost' : 'btn btn--sm btn--primary'}
            onClick={() => {
              if (playing) setPlaying(false)
              else {
                resetStats()
                setPlaying(true)
              }
            }}
            disabled={!pattern}
          >
            {playing ? '■ 停止' : '▶ 开始'}
          </button>
        </div>

        {pattern && <p className="rhythm-tip">{pattern.tip}</p>}

        {/* 扫弦网格 */}
        {pattern && (
          <section
            className="strum-grid"
            aria-label="扫弦型网格"
            style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
          >
            {pattern.steps.map((action, i) => {
              const isDownbeat = i % preset.subdiv === 0
              const beatNo = isDownbeat ? Math.floor(i / preset.subdiv) + 1 : null
              const isCurrent = playStep === i
              const isPast = playStep > i || (playing && playStep >= 0 && playStep - i > gridCols / 2)
              return (
                <div
                  key={i}
                  className={[
                    'strum-cell',
                    action === 'down' ? 'is-down' : action === 'up' ? 'is-up' : 'is-rest',
                    isCurrent ? 'is-current' : '',
                    isPast ? 'is-past' : '',
                    isDownbeat ? 'is-beat' : '',
                  ].join(' ')}
                >
                  {beatNo !== null && <span className="strum-cell__beat">{beatNo}</span>}
                  <span className="strum-cell__arrow" aria-hidden="true">
                    {action === 'down' ? '↓' : action === 'up' ? '↑' : '·'}
                  </span>
                </div>
              )
            })}
          </section>
        )}

        {/* 鼓点可视化条（和 RhythmBar 一致，帮助对位） */}
        {pattern && (
          <section
            className="rhythm-mini-strip"
            aria-label="鼓点参考"
            style={{ gridTemplateColumns: `repeat(${preset.steps.length}, 1fr)` }}
          >
            {preset.steps.map((spec, i) => {
              const isCurrent = playStep === i
              return (
                <div
                  key={i}
                  className={[
                    'rhythm-mini-step',
                    spec.kick ? 'is-kick' : '',
                    spec.snare ? 'is-snare' : '',
                    spec.hat ? 'is-hat' : '',
                    spec.accent ? 'is-accent' : '',
                    spec.tick ? 'is-tick' : '',
                    i % preset.subdiv === 0 ? 'is-downbeat' : '',
                    isCurrent ? 'is-current' : '',
                  ].join(' ')}
                />
              )
            })}
          </section>
        )}

        {/* 练习区 */}
        {pattern && (
          <section className="strum-practice" aria-label="练习输入">
            {mode === 'practice' && (
              <div className="strum-verdict">
                <span
                  className={[
                    'strum-verdict__badge',
                    lastVerdict !== 'none' ? VERDICT_CLASS[lastVerdict] : '',
                  ].join(' ')}
                >
                  {lastVerdict === 'none' ? '准备' : VERDICT_LABEL[lastVerdict]}
                </span>
                {accuracy !== null && (
                  <span className="strum-stats">
                    正确率 <strong>{accuracy}%</strong> · Perfect {stats.perfect} · Good {stats.good} · Miss {stats.miss}
                  </span>
                )}
                <button className="btn btn--sm btn--ghost" onClick={resetStats} type="button">
                  重置统计
                </button>
              </div>
            )}

            <div className="strum-pads">
              <button
                className="strum-pad is-down"
                onPointerDown={() => handleStrum('down')}
                type="button"
                aria-label="下扫"
              >
                <span className="strum-pad__arrow">↓</span>
                <span className="strum-pad__label">下扫</span>
                <kbd className="strum-pad__key">Space</kbd>
              </button>
              <button
                className="strum-pad is-up"
                onPointerDown={() => handleStrum('up')}
                type="button"
                aria-label="上扫"
              >
                <span className="strum-pad__arrow">↑</span>
                <span className="strum-pad__label">上扫</span>
                <kbd className="strum-pad__key">↑ / U</kbd>
              </button>
            </div>

            <p className="strum-hint">
              {mode === 'follow'
                ? '跟着高亮箭头扫：箭头变橙就是这一下。你手弹真琴，屏幕只给提示。'
                : '鼓点响起的瞬间点对应方向。判定窗口 ±220ms：60ms 内 Perfect，120ms 内 Good。'}
            </p>
          </section>
        )}

        {!pattern && (
          <div className="rhythm-empty">
            <p>当前节拍型没有匹配的扫弦型。</p>
            <button className="btn btn--primary" onClick={() => rhythmStore.setPreset('drums-44')} type="button">
              切换到 4/4 动次打次
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
