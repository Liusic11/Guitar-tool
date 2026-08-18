import { useEffect, useRef, useState } from 'react'
import { getGroove, type RhythmPreset } from '../lib/rhythm'
import { useRhythmState } from '../lib/rhythmStore'
import { audioEngine } from '../lib/audio'

interface RhythmBarProps {
  /** 每拍（每 subdiv 步）回调一次，供音阶跟拍 / 模进对齐高亮 */
  onBeat?: (beatIndex: number) => void
  /** 每个 subdiv 步回调一次（带精确音频时钟时间），供 Jam 扫弦型逐下对齐 */
  onStep?: (stepInBar: number, time: number) => void
  /** 预备拍数（按「拍」计）：开始前先空出几拍只响 click，不推鼓点不回调；默认 0 = 无 */
  countInBeats?: number
}

export function RhythmBar({ onBeat, onStep, countInBeats = 0 }: RhythmBarProps) {
  const { bpm, grooveId } = useRhythmState()
  const [playing, setPlaying] = useState(false)
  const [playStep, setPlayStep] = useState(-1)

  const preset = getGroove(grooveId)
  const beatsPerBar = preset.steps.length / preset.subdiv

  // 实时读取，避免拖动时重启调度器（BPM 平滑，preset 切换则干净重启）
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const presetRef = useRef<RhythmPreset>(preset)
  presetRef.current = preset
  const onBeatRef = useRef(onBeat)
  onBeatRef.current = onBeat
  const onStepRef = useRef(onStep)
  onStepRef.current = onStep
  // 预备拍在「开始那一刻」读数，播放中改 toggle 不影响当前一轮
  const countInBeatsRef = useRef(countInBeats)
  countInBeatsRef.current = countInBeats

  useEffect(() => {
    if (!playing) {
      setPlayStep(-1)
      return
    }
    void audioEngine.unlock()
    let nextTime = audioEngine.currentTime + 0.12
    let countLeft = countInBeatsRef.current
    let step = 0
    const timers: number[] = []

    const schedule = () => {
      const p = presetRef.current
      const stepDur = 60 / bpmRef.current / p.subdiv
      const beatDur = stepDur * p.subdiv
      const ahead = 0.14
      while (nextTime < audioEngine.currentTime + ahead) {
        // 预备拍：只响重音 click 当倒计时，不推鼓点、不回调——给开内录留起手时间
        if (countLeft > 0) {
          audioEngine.click(nextTime, true)
          nextTime += beatDur
          countLeft -= 1
          continue
        }
        const s = step
        const spec = p.steps[s]
        // swing：把反拍（非拍头）往后拖成「长-短」三连音感
        const swingOffset = p.swing && s % p.subdiv !== 0 ? stepDur / 3 : 0
        const tPlay = nextTime + swingOffset
        if (p.kit === 'click') {
          if (spec.accent) audioEngine.click(tPlay, true)
          else if (spec.tick) audioEngine.click(tPlay, false)
        } else {
          if (spec.kick) audioEngine.kick(tPlay)
          if (spec.snare) audioEngine.snare(tPlay)
          if (spec.ghost) audioEngine.ghost(tPlay)
          if (spec.openHat) audioEngine.openHat(tPlay)
          if (spec.rim) audioEngine.rim(tPlay)
          if (spec.hat) audioEngine.hat(tPlay)
        }
        const visualDelay = Math.max(0, (tPlay - audioEngine.currentTime) * 1000)
        timers.push(
          window.setTimeout(() => {
            setPlayStep(s)
            // 每拍（每 subdiv 步）回调一次，供音阶跟拍 / 模进对齐高亮
            if (s % p.subdiv === 0) onBeatRef.current?.(s / p.subdiv)
            // 每个 subdiv 步都回调（带精确音频时间），供 Jam 扫弦型逐下对齐
            onStepRef.current?.(s, tPlay)
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
  }, [playing, grooveId])

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
                  spec.ghost ? 'is-ghost' : '',
                  spec.openHat ? 'is-openhat' : '',
                  spec.rim ? 'is-rim' : '',
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
