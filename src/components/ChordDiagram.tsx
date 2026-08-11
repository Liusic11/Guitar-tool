/**
 * 竖向和弦图（chord box）
 * ─────────────────────────────────────────────
 * 吉他手通用的和弦记谱法：6 弦竖向网格 + 手指号 + 根音橙点 +
 * 空弦(O) / 闷音(×) + 横按括号 + 把位标签。
 * 一眼就能看懂「这一招具体怎么按」，替代原来整条琴颈的 dot-spray。
 */

import type { Voicing } from '../lib/chords'

const X_LEFT = 48
const STEP = 39
const TOP_Y = 60
const FRET_GAP = 60
const WINDOW = 3
const DOT_R = 16
const ROOT_FILL = '#BA7517'
const DARK_FILL = '#2C2C2A'
const LINE = '#5F5E5A'
const FRET_LINE = '#B4B2A9'

interface ChordDiagramProps {
  voicing: Voicing
}

export function ChordDiagram({ voicing }: ChordDiagramProps) {
  const { baseFret, notes, hasBarre } = voicing
  const xOf = (stringNumber: number) => X_LEFT + (6 - stringNumber) * STEP
  const dotY = (fret: number) => TOP_Y + (fret - baseFret + 0.5) * FRET_GAP
  const bottomY = TOP_Y + (WINDOW + 1) * FRET_GAP

  const barreNotes = notes.filter((n) => !n.muted && !n.open && n.fret === baseFret)
  const barreXs = barreNotes.map((n) => xOf(n.string))

  return (
    <svg
      viewBox="0 0 270 350"
      className="chord-diagram"
      role="img"
      aria-label="和弦指法图"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 弦线 */}
      {notes.map((n) => (
        <line
          key={`s${n.string}`}
          x1={xOf(n.string)}
          y1={TOP_Y}
          x2={xOf(n.string)}
          y2={bottomY}
          stroke={LINE}
          strokeWidth={2}
        />
      ))}

      {/* 品丝（k=0 为琴枕 / 横按线） */}
      {[0, 1, 2, 3, 4].map((k) => {
        const y = TOP_Y + k * FRET_GAP
        if (k === 0 && !hasBarre) {
          return (
            <line
              key={k}
              x1={X_LEFT}
              y1={y}
              x2={X_LEFT + 5 * STEP}
              y2={y}
              stroke={DARK_FILL}
              strokeWidth={7}
            />
          )
        }
        return (
          <line
            key={k}
            x1={X_LEFT}
            y1={y}
            x2={X_LEFT + 5 * STEP}
            y2={y}
            stroke={FRET_LINE}
            strokeWidth={2}
          />
        )
      })}

      {/* 横按括号 */}
      {hasBarre && barreXs.length > 0 && (
        <line
          x1={Math.min(...barreXs)}
          y1={TOP_Y}
          x2={Math.max(...barreXs)}
          y2={TOP_Y}
          stroke={DARK_FILL}
          strokeWidth={8}
          strokeLinecap="round"
        />
      )}
      {hasBarre && (
        <text x={X_LEFT - 22} y={TOP_Y + 6} fontSize={17} fill={LINE} fontWeight={700}>
          {baseFret}fr
        </text>
      )}

      {/* 顶部 O / × 标记 */}
      {notes.map((n) => {
        const x = xOf(n.string)
        if (n.muted) {
          return (
            <g key={`m${n.string}`}>
              <line x1={x - 7} y1={28} x2={x + 7} y2={44} stroke={LINE} strokeWidth={3} />
              <line x1={x + 7} y1={28} x2={x - 7} y2={44} stroke={LINE} strokeWidth={3} />
            </g>
          )
        }
        if (n.open) {
          return (
            <circle
              key={`o${n.string}`}
              cx={x}
              cy={36}
              r={7}
              fill="none"
              stroke={n.isRoot ? ROOT_FILL : LINE}
              strokeWidth={3}
            />
          )
        }
        return null
      })}

      {/* 按弦点 + 手指号 */}
      {notes
        .filter((n) => !n.muted && !n.open)
        .map((n) => {
          const x = xOf(n.string)
          const y = dotY(n.fret)
          const fill = n.isRoot ? ROOT_FILL : DARK_FILL
          return (
            <g key={`d${n.string}`}>
              <circle cx={x} cy={y} r={DOT_R} fill={fill} />
              {n.finger != null && (
                <text
                  x={x}
                  y={y + 6}
                  fontSize={18}
                  fill="#fff"
                  textAnchor="middle"
                  fontWeight={700}
                >
                  {n.finger}
                </text>
              )}
            </g>
          )
        })}
    </svg>
  )
}
