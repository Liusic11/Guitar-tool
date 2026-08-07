/**
 * 拟真吉他指板
 * ─────────────────────────────────────────────
 * 全部用 SVG 手绘，没有位图资源，所以任何缩放下都清晰，
 * 而且每个品位都是可精确定位的交互元素。
 *
 * 拟真的关键在这几处：
 *  · 品距按 12 次方根 2 递减，和真琴一模一样
 *  · 指板是梯形的（琴枕窄、末端宽），弦跨度同步张开
 *  · feTurbulence 生成横向拉伸的噪声当玫瑰木纹理
 *  · 弦用带圆柱高光渐变的旋转矩形，缠绕弦额外叠螺旋纹
 *  · 品丝有金属反光，品位标记是珍珠贝母的径向渐变
 */

import { memo, useMemo, useState } from 'react'
import {
  INLAY_DOUBLE,
  INLAY_SINGLE,
  fretOffsetRatio,
  letterOf,
  octaveOf,
  pitchClassOf,
  solfegeOf,
  type Tuning,
} from '../lib/music'

/* ───────────────────────── 几何常量 ───────────────────────── */

const VIEW_W = 1640
const VIEW_H = 226

const BOARD_X0 = 78 // 琴枕位置
const BOARD_X1 = 1612 // 最后一品
const BOARD_LEN = BOARD_X1 - BOARD_X0

const CENTER_Y = 104
const H_NUT = 140 // 琴枕处指板宽度
const H_END = 172 // 末品处指板宽度
const SPAN_RATIO = 0.815 // 弦跨度占指板宽度的比例

/** 弦的绘制粗细（SVG 单位），6 弦 → 1 弦 */
const STRING_WIDTHS = [5.0, 4.1, 3.3, 2.6, 1.9, 1.5]

export type HighlightKind = 'answer' | 'secondary' | 'hit' | 'miss' | 'ghost' | 'reference'

export interface Highlight {
  string: number
  fret: number
  kind: HighlightKind
  /** 覆盖默认标签文字 */
  label?: string
}

export type LabelMode = 'letter' | 'solfege' | 'both'

interface FretboardProps {
  tuning: Tuning
  maxFret: number
  highlights: readonly Highlight[]
  /** 当前题目所在弦，会打一道柔光带 */
  targetString: number | null
  /** 出题品位范围，范围外的区域压暗 */
  scopeRange: readonly [number, number]
  /** 是否允许点击作答 */
  interactive: boolean
  /** 铺满整块指板的音名，用于「探索」学习 */
  showAllNotes: boolean
  labelMode: LabelMode
  /** 正在发声的弦，触发振动动画 */
  ringingString: number | null
  onFretClick?: (stringNumber: number, fret: number) => void
}

/* ───────────────────────── 几何计算 ───────────────────────── */

interface Geometry {
  scale: number
  fretX: (fret: number) => number
  cellCenterX: (fret: number) => number
  boardHalfHeightAt: (x: number) => number
  /** 每根弦在琴枕端与末端的 y 坐标 */
  strings: { number: number; yNut: number; yEnd: number; width: number; wound: boolean }[]
  yOn: (stringIndex: number, x: number) => number
}

const buildGeometry = (tuning: Tuning, maxFret: number): Geometry => {
  // 让指板末端恰好落在 BOARD_X1，反推出等效弦长
  const span = fretOffsetRatio(maxFret)
  const scale = BOARD_LEN / span

  const fretX = (fret: number) => BOARD_X0 + scale * fretOffsetRatio(fret)

  const cellCenterX = (fret: number) => {
    if (fret === 0) return BOARD_X0 - 30 // 空弦画在琴枕外侧
    return (fretX(fret - 1) + fretX(fret)) / 2
  }

  const boardHalfHeightAt = (x: number) => {
    const t = Math.min(1, Math.max(0, (x - BOARD_X0) / BOARD_LEN))
    return (H_NUT + (H_END - H_NUT) * t) / 2
  }

  const spanNut = H_NUT * SPAN_RATIO
  const spanEnd = H_END * SPAN_RATIO

  const strings = tuning.strings.map((spec, index) => ({
    number: spec.number,
    yNut: CENTER_Y - spanNut / 2 + (index * spanNut) / 5,
    yEnd: CENTER_Y - spanEnd / 2 + (index * spanEnd) / 5,
    width: STRING_WIDTHS[index],
    wound: spec.wound,
  }))

  const yOn = (stringIndex: number, x: number) => {
    const s = strings[stringIndex]
    const t = (x - BOARD_X0) / BOARD_LEN
    return s.yNut + (s.yEnd - s.yNut) * t
  }

  return { scale, fretX, cellCenterX, boardHalfHeightAt, strings, yOn }
}

/* ───────────────────────── 标签工具 ───────────────────────── */

const noteLabel = (midi: number, mode: LabelMode): string => {
  const pc = pitchClassOf(midi)
  if (mode === 'letter') return letterOf(pc)
  if (mode === 'solfege') return solfegeOf(pc)
  return letterOf(pc)
}

const HIGHLIGHT_STYLE: Record<
  HighlightKind,
  { fill: string; stroke: string; text: string; radius: number }
> = {
  answer: {
    fill: 'url(#dotEmber)',
    stroke: 'oklch(42% 0.16 32)',
    text: 'oklch(98% 0.01 60)',
    radius: 13.5,
  },
  secondary: {
    fill: 'oklch(62% 0.09 42 / 0.82)',
    stroke: 'oklch(46% 0.1 38)',
    text: 'oklch(97% 0.01 60)',
    radius: 11,
  },
  hit: {
    fill: 'url(#dotSage)',
    stroke: 'oklch(40% 0.09 152)',
    text: 'oklch(98% 0.01 150)',
    radius: 13.5,
  },
  miss: {
    fill: 'oklch(53% 0.175 27)',
    stroke: 'oklch(40% 0.16 25)',
    text: 'oklch(97% 0.01 40)',
    radius: 12,
  },
  ghost: {
    fill: 'oklch(88% 0.02 80 / 0.16)',
    stroke: 'oklch(88% 0.02 80 / 0.3)',
    text: 'oklch(90% 0.015 80 / 0.7)',
    radius: 10.5,
  },
  /** 参考格：name / octave 模式高亮「要识别的位置」，但绝不显示音名 */
  reference: {
    fill: 'oklch(88% 0.09 78 / 0.0)',
    stroke: 'oklch(58% 0.09 80)',
    text: 'oklch(0% 0 0 / 0)',
    radius: 13,
  },
}

/* ───────────────────────── 组件 ───────────────────────── */

export const Fretboard = memo(function Fretboard({
  tuning,
  maxFret,
  highlights,
  targetString,
  scopeRange,
  interactive,
  showAllNotes,
  labelMode,
  ringingString,
  onFretClick,
}: FretboardProps) {
  const [hovered, setHovered] = useState<{ string: number; fret: number } | null>(null)

  const geo = useMemo(() => buildGeometry(tuning, maxFret), [tuning, maxFret])
  const frets = useMemo(() => Array.from({ length: maxFret }, (_, i) => i + 1), [maxFret])

  const highlightMap = useMemo(() => {
    const map = new Map<string, Highlight>()
    highlights.forEach((h) => map.set(`${h.string}:${h.fret}`, h))
    return map
  }, [highlights])

  const [scopeLo, scopeHi] = scopeRange

  return (
    <div className="fretboard-scroll">
      <svg
        className="fretboard"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`吉他指板，${tuning.name}，共 ${maxFret} 品`}
        style={{ minWidth: 680 }}
      >
        <defs>
          {/* ── 玫瑰木底色：中间偏亮模拟指板弧度 ── */}
          <linearGradient id="woodBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(19% 0.03 38)" />
            <stop offset="14%" stopColor="oklch(28% 0.043 44)" />
            <stop offset="42%" stopColor="oklch(36% 0.052 48)" />
            <stop offset="60%" stopColor="oklch(33% 0.05 46)" />
            <stop offset="88%" stopColor="oklch(25% 0.04 42)" />
            <stop offset="100%" stopColor="oklch(17% 0.028 36)" />
          </linearGradient>

          {/* ── 木纹：x 频率极低 y 频率高 → 被拉长成条纹 ── */}
          <filter id="woodGrain" x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.0022 0.075"
              numOctaves="5"
              seed="17"
              result="grain"
            />
            <feColorMatrix in="grain" type="saturate" values="0" result="mono" />
            <feComponentTransfer in="mono" result="shaped">
              <feFuncA type="linear" slope="1.15" intercept="-0.08" />
            </feComponentTransfer>
          </filter>

          {/* 更细的第二层纹理，增加深度 */}
          <filter id="woodGrainFine" x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.006 0.22"
              numOctaves="3"
              seed="43"
              result="grain"
            />
            <feColorMatrix in="grain" type="saturate" values="0" />
          </filter>

          {/* ── 指板上下缘的弧度内阴影 ── */}
          <linearGradient id="boardShadeTop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(12% 0.02 34)" stopOpacity="0.72" />
            <stop offset="100%" stopColor="oklch(12% 0.02 34)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="boardShadeBottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(12% 0.02 34)" stopOpacity="0" />
            <stop offset="100%" stopColor="oklch(12% 0.02 34)" stopOpacity="0.78" />
          </linearGradient>

          {/* ── 品丝：镍银圆柱反光 ── */}
          <linearGradient id="fretWire" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(48% 0.012 250)" />
            <stop offset="22%" stopColor="oklch(88% 0.008 250)" />
            <stop offset="42%" stopColor="oklch(97% 0.004 250)" />
            <stop offset="62%" stopColor="oklch(74% 0.01 250)" />
            <stop offset="85%" stopColor="oklch(52% 0.012 250)" />
            <stop offset="100%" stopColor="oklch(38% 0.014 252)" />
          </linearGradient>

          {/* ── 琴枕：牛骨 ── */}
          <linearGradient id="nutBone" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(74% 0.024 86)" />
            <stop offset="26%" stopColor="oklch(94% 0.026 88)" />
            <stop offset="60%" stopColor="oklch(87% 0.028 86)" />
            <stop offset="100%" stopColor="oklch(66% 0.026 82)" />
          </linearGradient>

          {/* ── 弦：光弦与缠绕弦两种圆柱高光 ── */}
          <linearGradient id="stringPlain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(52% 0.008 250)" />
            <stop offset="26%" stopColor="oklch(94% 0.004 250)" />
            <stop offset="46%" stopColor="oklch(80% 0.006 250)" />
            <stop offset="74%" stopColor="oklch(58% 0.008 250)" />
            <stop offset="100%" stopColor="oklch(38% 0.01 250)" />
          </linearGradient>
          <linearGradient id="stringWound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(46% 0.018 78)" />
            <stop offset="24%" stopColor="oklch(84% 0.036 84)" />
            <stop offset="44%" stopColor="oklch(70% 0.042 82)" />
            <stop offset="76%" stopColor="oklch(48% 0.03 78)" />
            <stop offset="100%" stopColor="oklch(32% 0.022 74)" />
          </linearGradient>

          {/* 缠绕弦的螺旋纹 */}
          <pattern
            id="windings"
            width="4.2"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(74)"
          >
            <rect width="1.7" height="8" fill="oklch(20% 0.02 60 / 0.42)" />
            <rect x="1.7" width="0.7" height="8" fill="oklch(96% 0.01 80 / 0.18)" />
          </pattern>

          {/* ── 珍珠贝母品位标记 ── */}
          <radialGradient id="pearl" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="oklch(98% 0.01 90)" />
            <stop offset="38%" stopColor="oklch(91% 0.014 86)" />
            <stop offset="72%" stopColor="oklch(82% 0.018 80)" />
            <stop offset="100%" stopColor="oklch(70% 0.02 74)" />
          </radialGradient>
          {/* 贝母的虹彩 */}
          <linearGradient id="pearlSheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(85% 0.06 200 / 0.34)" />
            <stop offset="50%" stopColor="oklch(88% 0.05 320 / 0.16)" />
            <stop offset="100%" stopColor="oklch(86% 0.06 120 / 0.28)" />
          </linearGradient>

          {/* ── 音点填充 ── */}
          <radialGradient id="dotEmber" cx="36%" cy="30%" r="78%">
            <stop offset="0%" stopColor="oklch(72% 0.15 48)" />
            <stop offset="58%" stopColor="oklch(58% 0.17 36)" />
            <stop offset="100%" stopColor="oklch(48% 0.16 30)" />
          </radialGradient>
          <radialGradient id="dotSage" cx="36%" cy="30%" r="78%">
            <stop offset="0%" stopColor="oklch(70% 0.1 155)" />
            <stop offset="58%" stopColor="oklch(56% 0.095 152)" />
            <stop offset="100%" stopColor="oklch(46% 0.085 150)" />
          </radialGradient>

          {/* 目标弦柔光带 */}
          <linearGradient id="spotlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(88% 0.11 78 / 0)" />
            <stop offset="50%" stopColor="oklch(88% 0.11 78 / 0.17)" />
            <stop offset="100%" stopColor="oklch(88% 0.11 78 / 0)" />
          </linearGradient>

          {/* 音点投影 */}
          <filter id="dotShadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              dx="0"
              dy="1.6"
              stdDeviation="2.2"
              floodColor="oklch(12% 0.02 40)"
              floodOpacity="0.5"
            />
          </filter>

          {/* 指板整体的外阴影 */}
          <filter id="boardShadow" x="-4%" y="-24%" width="108%" height="150%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="5"
              floodColor="oklch(30% 0.03 55)"
              floodOpacity="0.34"
            />
          </filter>

          {/* 指板裁剪路径：所有木纹 / 阴影都只在板内 */}
          <clipPath id="boardClip">
            <path
              d={`M ${BOARD_X0} ${CENTER_Y - H_NUT / 2}
                  L ${BOARD_X1} ${CENTER_Y - H_END / 2}
                  L ${BOARD_X1} ${CENTER_Y + H_END / 2}
                  L ${BOARD_X0} ${CENTER_Y + H_NUT / 2} Z`}
            />
          </clipPath>
        </defs>

        {/* ══════════ 指板本体 ══════════ */}
        <g filter="url(#boardShadow)">
          <path
            d={`M ${BOARD_X0} ${CENTER_Y - H_NUT / 2}
                L ${BOARD_X1} ${CENTER_Y - H_END / 2}
                L ${BOARD_X1} ${CENTER_Y + H_END / 2}
                L ${BOARD_X0} ${CENTER_Y + H_NUT / 2} Z`}
            fill="url(#woodBase)"
          />
        </g>

        <g clipPath="url(#boardClip)" style={{ isolation: 'isolate' }}>
          {/* 木纹两层叠加 */}
          <rect
            x={BOARD_X0}
            y={0}
            width={BOARD_LEN}
            height={VIEW_H}
            filter="url(#woodGrain)"
            opacity="0.4"
            style={{ mixBlendMode: 'overlay' }}
          />
          <rect
            x={BOARD_X0}
            y={0}
            width={BOARD_LEN}
            height={VIEW_H}
            filter="url(#woodGrainFine)"
            opacity="0.16"
            style={{ mixBlendMode: 'multiply' }}
          />

          {/* 弧度内阴影 */}
          <rect
            x={BOARD_X0}
            y={CENTER_Y - H_END / 2}
            width={BOARD_LEN}
            height={26}
            fill="url(#boardShadeTop)"
          />
          <rect
            x={BOARD_X0}
            y={CENTER_Y + H_END / 2 - 26}
            width={BOARD_LEN}
            height={26}
            fill="url(#boardShadeBottom)"
          />

          {/* 出题范围之外压暗，视线自然收束到练习区 */}
          {scopeHi < maxFret && (
            <rect
              x={geo.fretX(scopeHi)}
              y={0}
              width={BOARD_X1 - geo.fretX(scopeHi)}
              height={VIEW_H}
              fill="oklch(10% 0.02 40)"
              opacity="0.42"
            />
          )}
          {scopeLo > 0 && (
            <rect
              x={BOARD_X0}
              y={0}
              width={geo.fretX(scopeLo) - BOARD_X0}
              height={VIEW_H}
              fill="oklch(10% 0.02 40)"
              opacity="0.42"
            />
          )}

          {/* ── 品位标记（贝母嵌片）── */}
          {INLAY_SINGLE.filter((f) => f <= maxFret).map((fret) => {
            const cx = geo.cellCenterX(fret)
            const r = Math.min(11, (geo.fretX(fret) - geo.fretX(fret - 1)) * 0.19)
            return (
              <g key={`inlay-${fret}`}>
                <circle cx={cx} cy={CENTER_Y} r={r} fill="url(#pearl)" />
                <circle cx={cx} cy={CENTER_Y} r={r} fill="url(#pearlSheen)" />
                <circle
                  cx={cx}
                  cy={CENTER_Y}
                  r={r}
                  fill="none"
                  stroke="oklch(15% 0.02 40 / 0.45)"
                  strokeWidth="0.7"
                />
              </g>
            )
          })}
          {INLAY_DOUBLE.filter((f) => f <= maxFret).map((fret) => {
            const cx = geo.cellCenterX(fret)
            const half = geo.boardHalfHeightAt(cx)
            const r = Math.min(11, (geo.fretX(fret) - geo.fretX(fret - 1)) * 0.19)
            return [-half * 0.44, half * 0.44].map((dy, i) => (
              <g key={`inlay2-${fret}-${i}`}>
                <circle cx={cx} cy={CENTER_Y + dy} r={r} fill="url(#pearl)" />
                <circle cx={cx} cy={CENTER_Y + dy} r={r} fill="url(#pearlSheen)" />
                <circle
                  cx={cx}
                  cy={CENTER_Y + dy}
                  r={r}
                  fill="none"
                  stroke="oklch(15% 0.02 40 / 0.45)"
                  strokeWidth="0.7"
                />
              </g>
            ))
          })}

          {/* ── 品丝 ── */}
          {frets.map((fret) => {
            const x = geo.fretX(fret)
            const half = geo.boardHalfHeightAt(x)
            const w = 2.9
            return (
              <g key={`fret-${fret}`}>
                {/* 品丝在木头上投下的一道细影 */}
                <rect
                  x={x - w / 2 + 1.3}
                  y={CENTER_Y - half}
                  width={w}
                  height={half * 2}
                  fill="oklch(12% 0.02 38)"
                  opacity="0.4"
                />
                <rect
                  x={x - w / 2}
                  y={CENTER_Y - half}
                  width={w}
                  height={half * 2}
                  fill="url(#fretWire)"
                />
              </g>
            )
          })}

          {/* ── 目标弦柔光带 ── */}
          {targetString !== null &&
            (() => {
              const idx = tuning.strings.findIndex((s) => s.number === targetString)
              if (idx < 0) return null
              const s = geo.strings[idx]
              const band = 22
              return (
                <path
                  className="string-spotlight"
                  d={`M ${BOARD_X0} ${s.yNut - band}
                      L ${BOARD_X1} ${s.yEnd - band}
                      L ${BOARD_X1} ${s.yEnd + band}
                      L ${BOARD_X0} ${s.yNut + band} Z`}
                  fill="url(#spotlight)"
                />
              )
            })()}
        </g>

        {/* 指板边框 */}
        <path
          d={`M ${BOARD_X0} ${CENTER_Y - H_NUT / 2}
              L ${BOARD_X1} ${CENTER_Y - H_END / 2}
              L ${BOARD_X1} ${CENTER_Y + H_END / 2}
              L ${BOARD_X0} ${CENTER_Y + H_NUT / 2} Z`}
          fill="none"
          stroke="oklch(13% 0.022 36)"
          strokeWidth="2"
        />

        {/* ══════════ 琴枕 ══════════ */}
        <rect
          x={BOARD_X0 - 8}
          y={CENTER_Y - H_NUT / 2 - 3}
          width={8.5}
          height={H_NUT + 6}
          rx="1.5"
          fill="url(#nutBone)"
          stroke="oklch(58% 0.024 80)"
          strokeWidth="0.6"
        />

        {/* ══════════ 侧边点（指板边缘的定位点）══════════ */}
        {[...INLAY_SINGLE, ...INLAY_DOUBLE]
          .filter((f) => f <= maxFret)
          .map((fret) => {
            const cx = geo.cellCenterX(fret)
            const half = geo.boardHalfHeightAt(cx)
            return (
              <circle
                key={`side-${fret}`}
                cx={cx}
                cy={CENTER_Y - half - 5}
                r="2.4"
                fill="oklch(90% 0.02 84)"
                opacity="0.82"
              />
            )
          })}

        {/* ══════════ 弦 ══════════ */}
        {geo.strings.map((s, i) => {
          const dy = s.yEnd - s.yNut
          const length = Math.hypot(BOARD_LEN, dy)
          const angle = (Math.atan2(dy, BOARD_LEN) * 180) / Math.PI
          const isRinging = ringingString === s.number
          return (
            <g
              key={`string-${s.number}`}
              className={isRinging ? 'string--ringing' : undefined}
              style={{ transformOrigin: `${BOARD_X0 + BOARD_LEN / 2}px ${CENTER_Y}px` }}
            >
              {/* 弦影 */}
              <rect
                x={BOARD_X0 - 12}
                y={s.yNut - s.width / 2 + 2.6}
                width={length + 14}
                height={s.width}
                fill="oklch(10% 0.02 40)"
                opacity="0.34"
                transform={`rotate(${angle} ${BOARD_X0} ${s.yNut})`}
              />
              {/* 弦体 */}
              <rect
                x={BOARD_X0 - 12}
                y={s.yNut - s.width / 2}
                width={length + 14}
                height={s.width}
                fill={`url(#${s.wound ? 'stringWound' : 'stringPlain'})`}
                transform={`rotate(${angle} ${BOARD_X0} ${s.yNut})`}
              />
              {/* 缠绕纹 */}
              {s.wound && (
                <rect
                  x={BOARD_X0 - 12}
                  y={s.yNut - s.width / 2}
                  width={length + 14}
                  height={s.width}
                  fill="url(#windings)"
                  opacity="0.55"
                  transform={`rotate(${angle} ${BOARD_X0} ${s.yNut})`}
                />
              )}
              {/* 顶部高光 */}
              <rect
                x={BOARD_X0 - 12}
                y={s.yNut - s.width / 2 + s.width * 0.2}
                width={length + 14}
                height={Math.max(0.4, s.width * 0.16)}
                fill="oklch(99% 0.005 90)"
                opacity={i > 3 ? 0.6 : 0.34}
                transform={`rotate(${angle} ${BOARD_X0} ${s.yNut})`}
              />
            </g>
          )
        })}

        {/* ══════════ 铺满指板的音名（探索模式）══════════ */}
        {showAllNotes && (
          <g pointerEvents="none">
            {geo.strings.map((s, si) =>
              Array.from({ length: maxFret + 1 }, (_, fret) => {
                if (highlightMap.has(`${s.number}:${fret}`)) return null
                const cx = geo.cellCenterX(fret)
                const cy = geo.yOn(si, Math.max(BOARD_X0, cx))
                const midi = tuning.strings[si].openMidi + fret
                const inScope = fret >= scopeLo && fret <= scopeHi
                const accidental = letterOf(pitchClassOf(midi)).length > 1
                return (
                  <g key={`all-${s.number}-${fret}`} opacity={inScope ? 0.9 : 0.35}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="10"
                      fill="oklch(96% 0.02 82 / 0.14)"
                      stroke="oklch(94% 0.02 84 / 0.3)"
                      strokeWidth="0.8"
                    />
                    <text
                      className="dot__label"
                      x={cx}
                      y={cy}
                      fontSize={accidental ? 9 : 10.5}
                      fill="oklch(95% 0.02 84 / 0.88)"
                    >
                      {noteLabel(midi, labelMode)}
                    </text>
                  </g>
                )
              }),
            )}
          </g>
        )}

        {/* ══════════ 交互热区 ══════════ */}
        <g>
          {geo.strings.map((s, si) =>
            Array.from({ length: maxFret + 1 }, (_, fret) => {
              const xLeft = fret === 0 ? BOARD_X0 - 56 : geo.fretX(fret - 1)
              const xRight = fret === 0 ? BOARD_X0 - 4 : geo.fretX(fret)
              const cx = (xLeft + xRight) / 2
              const cy = geo.yOn(si, Math.max(BOARD_X0, cx))
              const halfBand =
                (geo.boardHalfHeightAt(cx) * 2 * SPAN_RATIO) / 5 / 2 + 2
              const isHovered = hovered?.string === s.number && hovered?.fret === fret
              const midi = tuning.strings[si].openMidi + fret

              return (
                <g key={`cell-${s.number}-${fret}`}>
                  <rect
                    className={`fret-cell${interactive ? '' : ' fret-cell--locked'}`}
                    x={xLeft}
                    y={cy - halfBand}
                    width={xRight - xLeft}
                    height={halfBand * 2}
                    onClick={interactive ? () => onFretClick?.(s.number, fret) : undefined}
                    onMouseEnter={() => setHovered({ string: s.number, fret })}
                    onMouseLeave={() => setHovered(null)}
                    role={interactive ? 'button' : undefined}
                    aria-label={
                      interactive
                        ? `${s.number}弦 ${fret}品 ${letterOf(pitchClassOf(midi))}${octaveOf(midi)}`
                        : undefined
                    }
                  />
                  {/* 悬停预览：不打断练习，但随时能查证 */}
                  {isHovered && !showAllNotes && !highlightMap.has(`${s.number}:${fret}`) && (
                    <g pointerEvents="none">
                      <circle
                        cx={cx}
                        cy={cy}
                        r="12"
                        fill="oklch(96% 0.02 82 / 0.2)"
                        stroke="oklch(94% 0.03 84 / 0.55)"
                        strokeWidth="1"
                      />
                      <text
                        className="dot__label"
                        x={cx}
                        y={cy}
                        fontSize="11"
                        fill="oklch(97% 0.015 84)"
                      >
                        {noteLabel(midi, labelMode)}
                      </text>
                    </g>
                  )}
                </g>
              )
            }),
          )}
        </g>

        {/* ══════════ 高亮音点 ══════════ */}
        <g>
          {highlights.map((h) => {
            const si = tuning.strings.findIndex((s) => s.number === h.string)
            if (si < 0) return null
            const cx = geo.cellCenterX(h.fret)
            const cy = geo.yOn(si, Math.max(BOARD_X0, cx))
            const style = HIGHLIGHT_STYLE[h.kind]
            const midi = tuning.strings[si].openMidi + h.fret
            const text = h.label ?? noteLabel(midi, labelMode)
            const showSolfege = labelMode === 'both' && h.kind === 'answer'

            // 参考格：只画一个空心环 + 中心点，绝不显示音名（否则泄题）
            if (h.kind === 'reference') {
              return (
                <g
                  key={`hl-${h.string}-${h.fret}-ref`}
                  className="dot dot--reference"
                  aria-hidden="true"
                >
                  <circle
                    className="ref-ring"
                    cx={cx}
                    cy={cy}
                    r={style.radius + 3}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth="2.4"
                  />
                  <circle cx={cx} cy={cy} r={4.2} fill={style.stroke} />
                </g>
              )
            }

            return (
              <g key={`hl-${h.string}-${h.fret}-${h.kind}`} className={`dot dot--${h.kind}`}>
                {(h.kind === 'hit' || h.kind === 'miss') && (
                  <circle
                    className="ripple"
                    cx={cx}
                    cy={cy}
                    stroke={h.kind === 'hit' ? 'oklch(58% 0.1 152)' : 'oklch(55% 0.17 27)'}
                  />
                )}
                <g className="dot__body" filter="url(#dotShadow)">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={style.radius}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth="1.4"
                  />
                  {/* 顶部高光，让音点像一颗有厚度的珠子 */}
                  <ellipse
                    cx={cx}
                    cy={cy - style.radius * 0.34}
                    rx={style.radius * 0.56}
                    ry={style.radius * 0.32}
                    fill="oklch(100% 0 0)"
                    opacity="0.22"
                  />
                  <text
                    className="dot__label"
                    x={cx}
                    y={showSolfege ? cy - 2.5 : cy}
                    fontSize={text.length > 1 ? style.radius * 0.82 : style.radius * 0.98}
                    fill={style.text}
                  >
                    {text}
                  </text>
                  {showSolfege && (
                    <text
                      className="dot__label"
                      x={cx}
                      y={cy + style.radius * 0.52}
                      fontSize={style.radius * 0.5}
                      fill={style.text}
                      opacity="0.82"
                    >
                      {solfegeOf(pitchClassOf(midi))}
                    </text>
                  )}
                </g>
              </g>
            )
          })}
        </g>

        {/* ══════════ 左侧弦名 ══════════ */}
        {geo.strings.map((s, i) => {
          const midi = tuning.strings[i].openMidi
          return (
            <g key={`label-${s.number}`}>
              <text className="string-label" x={BOARD_X0 - 22} y={s.yNut}>
                {letterOf(pitchClassOf(midi))}
                <tspan className="string-label__num" dx="1" dy="1">
                  {octaveOf(midi)}
                </tspan>
              </text>
              <text
                className="string-label string-label__num"
                x={BOARD_X0 - 52}
                y={s.yNut}
                textAnchor="middle"
              >
                {s.number}
              </text>
            </g>
          )
        })}

        {/* ══════════ 品位数字 ══════════ */}
        {Array.from({ length: maxFret + 1 }, (_, fret) => {
          const cx = fret === 0 ? BOARD_X0 - 30 : geo.cellCenterX(fret)
          const marked = INLAY_SINGLE.includes(fret) || INLAY_DOUBLE.includes(fret)
          const inScope = fret >= scopeLo && fret <= scopeHi
          return (
            <text
              key={`num-${fret}`}
              className={`fret-number${marked ? ' fret-number--marked' : ''}`}
              x={cx}
              y={CENTER_Y + H_END / 2 + 26}
              opacity={inScope ? 1 : 0.38}
            >
              {fret}
            </text>
          )
        })}
      </svg>
    </div>
  )
})
