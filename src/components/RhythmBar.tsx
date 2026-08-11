import { useEffect, useMemo, useRef, useState } from 'react'
import { GROOVES, stepLabel, type Groove } from '../lib/rhythm'
import { audioEngine } from '../lib/audio'

export function RhythmBar() {
  const [bpm, setBpm] = useState(90)
  const [grooveId, setGrooveId] = useState('straight')
  const [swing, setSwing] = useState(0.55)
  const [playing, setPlaying] = useState(false)
  const [playStep, setPlayStep] = useState(-1)

  const groove = useMemo<Groove>(
    () => GROOVES.find((g) => g.id === grooveId) ?? GROOVES[0],
    [grooveId],
  )

  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const swingRef = useRef(swing)
  swingRef.current = swing

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
      const stepDur = 60 / bpmRef.current / 4
      const ahead = 0.14
      while (nextTime < audioEngine.currentTime + ahead) {
        const s = step
        const kind = groove.pattern[s]
        const isOff = groove.swing && s % 2 === 0 && s % 4 !== 0
        const delay = isOff ? swingRef.current * stepDur : 0
        const tPlay = nextTime + delay
        if (kind === 'accent') audioEngine.click(tPlay, true)
        else if (kind === 'tick') audioEngine.click(tPlay, false)
        else if (kind === 'chuck') audioEngine.click(tPlay, false, 600)
        const visualDelay = Math.max(0, (tPlay - audioEngine.currentTime) * 1000)
        timers.push(window.setTimeout(() => setPlayStep(s), visualDelay))
        nextTime += stepDur
        step = (step + 1) % 16
      }
    }
    schedule()
    const interval = window.setInterval(schedule, 25)
    return () => {
      window.clearInterval(interval)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [playing, groove])

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

          <div className="rhythm-bar__field">
            <label className="rhythm-bar__label">
              速度 <strong>{bpm}</strong> BPM
            </label>
            <input
              className="rhythm-bar__slider"
              type="range"
              min={40}
              max={180}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="rhythm-bar__group rhythm-bar__grooves" role="group" aria-label="律动风格">
          {GROOVES.map((g) => (
            <button
              key={g.id}
              className={`rhythm-bar__chip${grooveId === g.id ? ' is-active' : ''}`}
              onClick={() => setGrooveId(g.id)}
              aria-pressed={grooveId === g.id}
            >
              {g.label}
            </button>
          ))}
        </div>

        {groove.swing && (
          <div className="rhythm-bar__field rhythm-bar__swing">
            <label className="rhythm-bar__label">
              摇摆 <strong>{Math.round(swing * 100)}%</strong>
            </label>
            <input
              className="rhythm-bar__slider"
              type="range"
              min={0}
              max={0.66}
              step={0.01}
              value={swing}
              onChange={(e) => setSwing(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      <div className="rhythm-bar__strip" aria-hidden="true">
        {groove.pattern.map((kind, i) => {
          const { sub } = stepLabel(i)
          const isCurrent = playStep === i
          return (
            <div
              key={i}
              className={[
                'rhythm-bar__beat',
                `is-${kind}`,
                isCurrent ? 'is-current' : '',
                i % 4 === 0 ? 'is-downbeat' : '',
              ].join(' ')}
              title={sub}
            />
          )
        })}
      </div>
    </section>
  )
}
