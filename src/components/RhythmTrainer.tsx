import { useEffect, useMemo, useRef, useState } from 'react'
import { GROOVES, stepLabel, type Groove } from '../lib/rhythm'
import { audioEngine } from '../lib/audio'

export function RhythmTrainer() {
  const [bpm, setBpm] = useState(90)
  const [grooveId, setGrooveId] = useState('straight')
  const [swing, setSwing] = useState(0.55)
  const [playing, setPlaying] = useState(false)
  const [playStep, setPlayStep] = useState(-1)

  const groove = useMemo<Groove>(
    () => GROOVES.find((g) => g.id === grooveId) ?? GROOVES[0],
    [grooveId],
  )

  // 实时读取，避免拖动滑块时重启调度器
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
    <main className="stage">
      <div className="chord-panel rhythm-panel">
        <div className="chord-controls">
          <div className="field">
            <label className="field__label">律动风格</label>
            <div className="segmented segmented--wrap" role="group" aria-label="律动风格">
              {GROOVES.map((g) => (
                <button
                  key={g.id}
                  className="segmented__item"
                  aria-pressed={grooveId === g.id}
                  onClick={() => setGrooveId(g.id)}
                >
                  {g.label}
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
              onChange={(e) => setBpm(Number(e.target.value))}
            />
          </div>

          {groove.swing && (
            <div className="field field--grow">
              <label className="field__label">
                摇摆量 <strong>{Math.round(swing * 100)}%</strong>
              </label>
              <input
                className="rhythm-slider"
                type="range"
                min={0}
                max={0.66}
                step={0.01}
                value={swing}
                onChange={(e) => setSwing(Number(e.target.value))}
              />
            </div>
          )}

          <button
            className={playing ? 'btn btn--sm btn--ghost' : 'btn btn--sm btn--primary'}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? '■ 停止' : '▶ 开始'}
          </button>
        </div>

        <p className="rhythm-tip">{groove.tip}</p>

        <section className="rhythm-grid" aria-label="节奏网格">
          {groove.pattern.map((kind, i) => {
            const { beat, sub } = stepLabel(i)
            const isCurrent = playStep === i
            return (
              <div
                key={i}
                className={[
                  'rhythm-cell',
                  `is-${kind}`,
                  isCurrent ? 'is-current' : '',
                  i % 4 === 0 ? 'is-beat' : '',
                ].join(' ')}
              >
                <span className="rhythm-cell__beat">{beat}</span>
                <span className="rhythm-cell__sub">{sub}</span>
              </div>
            )
          })}
        </section>

        <section className="rhythm-legend" aria-label="图例">
          <span className="rhythm-legend__item">
            <i className="dot is-accent" /> 重拍（1·2·3·4）
          </span>
          <span className="rhythm-legend__item">
            <i className="dot is-tick" /> 细分弱音
          </span>
          <span className="rhythm-legend__item">
            <i className="dot is-chuck" /> 闷音 chuck（反拍）
          </span>
          <span className="rhythm-legend__item">
            <i className="dot is-rest" /> 休止
          </span>
        </section>

        <p className="rhythm-hint">
          跟着播放头：重拍点头、细分数「1 e &amp; a」、到了 chuck 那一格就在心里 / 手上「嚓」一下。
          先把直拍 8 分练稳，再开 Funk 卡反拍，最后用摇摆找 jazz 的慵懒。
        </p>
      </div>
    </main>
  )
}
