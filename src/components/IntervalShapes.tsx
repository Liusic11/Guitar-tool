import { useMemo } from 'react'
import { intervalShapes, type IntervalShape } from '../lib/intervalShapes'
import type { Tuning } from '../lib/music'

interface IntervalShapesProps {
  semitones: number
  tuning: Tuning
}

/** 单张小指板图：把根音和目标音的相对距离画出来 */
function ShapeCard({ shape }: { shape: IntervalShape }) {
  const strings = [6, 5, 4, 3, 2, 1]
  const minFretRaw = Math.min(shape.rootFret, shape.targetFret)
  const maxFretRaw = Math.max(shape.rootFret, shape.targetFret)

  // 显示窗口：包住两个音并各留一品呼吸
  let minF = Math.max(0, minFretRaw - 1)
  let maxF = Math.min(21, maxFretRaw + 2)
  const fretCount = Math.max(3, maxF - minF)
  maxF = minF + fretCount

  const W = 220
  const H = 130
  const m = { top: 18, right: 12, bottom: 18, left: 28 }
  const drawW = W - m.left - m.right
  const drawH = H - m.top - m.bottom
  const stringY = (n: number) => m.top + ((6 - n) / 5) * drawH
  const fretX = (f: number) => m.left + ((f - minF + 0.5) / fretCount) * drawW

  return (
    <div className="ear-shape-card">
      <p className="ear-shape-card__caption">{shape.caption}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="ear-shape-card__svg" aria-hidden="true">
        {/* 品丝 */}
        {Array.from({ length: fretCount + 1 }).map((_, i) => {
          const x = m.left + (i / fretCount) * drawW
          return (
            <line
              key={`f${i}`}
              x1={x}
              y1={m.top}
              x2={x}
              y2={m.top + drawH}
              className="ear-shape-fret"
            />
          )
        })}
        {/* 琴弦 */}
        {strings.map((n) => {
          const y = stringY(n)
          return (
            <line
              key={`s${n}`}
              x1={m.left}
              y1={y}
              x2={m.left + drawW}
              y2={y}
              className="ear-shape-string"
            />
          )
        })}
        {/* 品号 */}
        {Array.from({ length: fretCount }).map((_, i) => {
          const f = minF + i
          const x = m.left + ((i + 0.5) / fretCount) * drawW
          return (
            <text key={`fn${f}`} x={x} y={m.top - 4} className="ear-shape-fretnum">
              {f}
            </text>
          )
        })}
        {/* 弦号 */}
        {strings.map((n) => (
          <text key={`sn${n}`} x={m.left - 8} y={stringY(n) + 4} className="ear-shape-stringnum">
            {n}
          </text>
        ))}
        {/* 连接线 */}
        <line
          x1={fretX(shape.rootFret)}
          y1={stringY(shape.fromString)}
          x2={fretX(shape.targetFret)}
          y2={stringY(shape.toString)}
          className="ear-shape-line"
        />
        {/* 根音 */}
        <circle
          cx={fretX(shape.rootFret)}
          cy={stringY(shape.fromString)}
          r={6}
          className="ear-shape-root"
        />
        {/* 目标音 */}
        <circle
          cx={fretX(shape.targetFret)}
          cy={stringY(shape.toString)}
          r={6}
          className="ear-shape-target"
        />
      </svg>
      <div className="ear-shape-legend">
        <span className="ear-shape-legend__dot ear-shape-legend__dot--root" />
        <span>根音</span>
        <span className="ear-shape-legend__dot ear-shape-legend__dot--target" />
        <span>目标音</span>
      </div>
    </div>
  )
}

export function IntervalShapes({ semitones, tuning }: IntervalShapesProps) {
  const shapes = useMemo(() => intervalShapes(semitones, tuning, 4), [semitones, tuning])

  return (
    <section className="ear-shape-panel" aria-label="音程指板形状">
      <p className="ear-shape-panel__title">🎯 把听到的距离变成眼睛的形状</p>
      <p className="ear-shape-panel__hint">
        这些是可移动的形状：任意把位里，同样的相对位移都是同一个音程。
      </p>
      <div className="ear-shape-grid">
        {shapes.map((shape, i) => (
          <ShapeCard key={i} shape={shape} />
        ))}
      </div>
    </section>
  )
}
