import { useEffect, useRef, useState } from 'react'
import { RHYTHM_PRESETS, getPreset, type RhythmPreset } from '../lib/rhythm'
import { rhythmStore, useRhythmState } from '../lib/rhythmStore'
import { audioEngine } from '../lib/audio'

export function RhythmTrainer() {
  const { bpm, presetId } = useRhythmState()
  const [playing, setPlaying] = useState(false)
  const [playStep, setPlayStep] = useState(-1)

  const preset = getPreset(presetId)

  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const presetRef = useRef<RhythmPreset>(preset)
  presetRef.current = preset

  useEffect(() => {
    if (!playing) {
      setPlayStep(-1)
      return
    }
    void audioEngine.unlock()
    let nextTime = audioEngine.currentTime + 0.12
    let step = 0
    const timers: number[] = []
    const schedule = () => {
      const p = presetRef.current
      const stepDur = 60 / bpmRef.current / p.subdiv
      const ahead = 0.14
      while (nextTime < audioEngine.currentTime + ahead) {
        const s = step
        const spec = p.steps[s]
        const tPlay = nextTime
        if (p.kit === 'click') {
          if (spec.accent) audioEngine.click(tPlay, true)
          else if (spec.tick) audioEngine.click(tPlay, false)
        } else {
          if (spec.kick) audioEngine.kick(tPlay)
          if (spec.snare) audioEngine.snare(tPlay)
          if (spec.hat) audioEngine.hat(tPlay)
        }
        const visualDelay = Math.max(0, (tPlay - audioEngine.currentTime) * 1000)
        timers.push(window.setTimeout(() => setPlayStep(s), visualDelay))
        nextTime += stepDur
        step = (step + 1) % p.steps.length
      }
    }
    schedule()
    const interval = window.setInterval(schedule, 25)
    return () => {
      window.clearInterval(interval)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [playing, presetId])

  return (
    <main className="stage">
      <div className="chord-panel rhythm-panel">
        <div className="chord-controls">
          <div className="field">
            <label className="field__label">节拍型</label>
            <div className="segmented segmented--wrap" role="group" aria-label="节拍型">
              {RHYTHM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="segmented__item"
                  aria-pressed={presetId === p.id}
                  onClick={() => rhythmStore.setPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field field--grow">
            <label className="field__label">
              速度 <strong>{bpm}</strong> BPM
            </label>
            <input
              className="rhythm-slider"
              type="range"
              min={40}
              max={200}
              step={1}
              value={bpm}
              onChange={(e) => rhythmStore.setBpm(Number(e.target.value))}
            />
          </div>

          <button
            className={playing ? 'btn btn--sm btn--ghost' : 'btn btn--sm btn--primary'}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? '■ 停止' : '▶ 开始'}
          </button>
        </div>

        <p className="rhythm-tip">{preset.tip}</p>

        <section className="rhythm-grid" aria-label="节奏网格" style={{ gridTemplateColumns: `repeat(${preset.steps.length}, 1fr)` }}>
          {preset.steps.map((spec, i) => {
            const isDownbeat = i % preset.subdiv === 0
            const beatNo = isDownbeat ? Math.floor(i / preset.subdiv) + 1 : null
            return (
              <div
                key={i}
                className={[
                  'rhythm-cell',
                  spec.kick ? 'is-kick' : '',
                  spec.snare ? 'is-snare' : '',
                  spec.hat ? 'is-hat' : '',
                  spec.accent ? 'is-accent' : '',
                  spec.tick ? 'is-tick' : '',
                  isDownbeat ? 'is-beat' : '',
                  playStep === i ? 'is-current' : '',
                ].join(' ')}
              >
                {beatNo !== null && <span className="rhythm-cell__beat">{beatNo}</span>}
                <span className="rhythm-cell__sub">{spec.kick ? '动' : spec.snare ? '次' : spec.hat ? '镲' : spec.accent ? '1' : '·'}</span>
              </div>
            )
          })}
        </section>

        <section className="rhythm-legend" aria-label="图例">
          <span className="rhythm-legend__item">
            <i className="dot is-accent" /> 重拍 / 底鼓（动）
          </span>
          <span className="rhythm-legend__item">
            <i className="dot is-snare" /> 军鼓（次）
          </span>
          <span className="rhythm-legend__item">
            <i className="dot is-hat" /> 踩镲（镲）
          </span>
          <span className="rhythm-legend__item">
            <i className="dot is-tick" /> 细分弱音
          </span>
        </section>

        <p className="rhythm-hint">
          跟着播放头：重拍点头、细分数「1 e &amp; a」、到了军鼓那一格就在心里 / 手上「次」一下。
          先把 4/4 动次打次练稳，再开 Funk 卡反拍，最后用三连音找 shuffle 的慵懒。
        </p>
      </div>
    </main>
  )
}
