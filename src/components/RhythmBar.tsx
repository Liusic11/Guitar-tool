import { useEffect, useRef, useState } from 'react'
import { getPreset, type RhythmPreset } from '../lib/rhythm'
import { useRhythmState } from '../lib/rhythmStore'
import { audioEngine } from '../lib/audio'

export function RhythmBar({ onBeat }: { onBeat?: (beatIndex: number) => void }) {
  const { bpm, presetId } = useRhythmState()
  const [playing, setPlaying] = useState(false)
  const [playStep, setPlayStep] = useState(-1)

  const preset = getPreset(presetId)
  const beatsPerBar = preset.steps.length / preset.subdiv

  // 实时读取，避免拖动时重启调度器（BPM 平滑，preset 切换则干净重启）
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const presetRef = useRef<RhythmPreset>(preset)
  presetRef.current = preset
  const onBeatRef = useRef(onBeat)
  onBeatRef.current = onBeat

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
        timers.push(
          window.setTimeout(() => {
            setPlayStep(s)
            // 每拍（每 subdiv 步）回调一次，供音阶跟拍 / 模进对齐高亮
            if (s % p.subdiv === 0) onBeatRef.current?.(s / p.subdiv)
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
    }
  }, [playing, presetId])

  const currentBeat = playStep >= 0 ? Math.floor(playStep / preset.subdiv) : -1

  return (
    <section className="rhythm-bar" aria-label="节奏条">
      <div className="rhythm-bar__left">
        <div className="rhythm-bar__group">
          <button
            className={playing ? 'btn btn--sm btn--ghost' : 'btn btn--sm btn--primary'}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? '停止节拍器' : '开始节拍器'}
          >
            {playing ? '■' : '▶'}
          </button>

          <div className="rhythm-bar__readout">
            <span className="rhythm-bar__bpm">
              <strong>{bpm}</strong> BPM
            </span>
            <span className="rhythm-bar__preset">{preset.label}</span>
          </div>
        </div>
        <p className="rhythm-bar__hint">节拍型在「设置 ⚙ → 节奏」里切换</p>
      </div>

      <div className="rhythm-bar__meter" aria-hidden="true">
        <div className="rhythm-bar__qnrow">
          {Array.from({ length: beatsPerBar }).map((_, b) => (
            <span
              key={b}
              className={[
                'rhythm-bar__qn',
                b === 0 ? 'is-downbeat' : '',
                currentBeat === b ? 'is-current' : '',
              ].join(' ')}
            >
              ♩
            </span>
          ))}
        </div>
        <div className="rhythm-bar__strip">
          {preset.steps.map((spec, i) => {
            const isCurrent = playStep === i
            return (
              <div
                key={i}
                className={[
                  'rhythm-bar__step',
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
        </div>
      </div>
    </section>
  )
}
