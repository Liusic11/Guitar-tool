/**
 * 节奏 / 律动预设
 * ─────────────────────────────────────────────
 * 以一小节 16 分网格（4 拍 × 4 个十六分）描述律动。
 * 每个格子是四种之一：
 *   accent 重拍（节拍器强音，落在 1/2/3/4 拍）
 *   tick  细分弱音（帮你数清每一拍里的小格子）
 *   chuck 闷音（funk 标志性的「嚓」，落在反拍）
 *   rest  休止
 */

export type StepKind = 'accent' | 'tick' | 'chuck' | 'rest'

export interface Groove {
  id: string
  label: string
  style: string
  /** 是否启用摇摆（jazz 的 8 分三连化） */
  swing: boolean
  pattern: StepKind[]
  /** 一句话要点 */
  tip: string
}

const STEPS = 16

const make = (
  id: string,
  label: string,
  style: string,
  tip: string,
  build: () => StepKind[],
  swing = false,
): Groove => ({ id, label, style, swing, tip, pattern: build() })

/** 反拍（8 分音符的「and」）所在格子 */
const OFF_EIGHTHS = [2, 6, 10, 14]

export const GROOVES: Groove[] = [
  make('straight', '直拍 8 分', 'rock', '一拍两下，最稳的地基，先把这玩明白', () => {
    const p: StepKind[] = new Array(STEPS).fill('rest')
    for (let i = 0; i < STEPS; i += 2) p[i] = i % 4 === 0 ? 'accent' : 'tick'
    return p
  }),

  make('funk', 'Funk 16 分', 'funk', '重拍稳住，反拍上「嚓」——funk 的魂在反拍', () => {
    const p: StepKind[] = new Array(STEPS).fill('tick')
    for (let i = 0; i < STEPS; i += 4) p[i] = 'accent'
    OFF_EIGHTHS.forEach((i) => (p[i] = 'chuck'))
    return p
  }),

  make(
    'swing',
    'Jazz 摇摆',
    'jazz',
    '8 分音符「长短长短」，把反拍往后拖一点就是 swing',
    () => {
      const p: StepKind[] = new Array(STEPS).fill('rest')
      for (let i = 0; i < STEPS; i += 4) p[i] = 'accent'
      OFF_EIGHTHS.forEach((i) => (p[i] = 'tick'))
      return p
    },
    true,
  ),
]

/** 把步号映射到节拍 / 细分位置，用于网格标注 */
export function stepLabel(step: number): { beat: number; sub: string } {
  const beat = Math.floor(step / 4) + 1
  const subIdx = step % 4
  const sub = ['1', 'e', '&', 'a'][subIdx]
  return { beat, sub }
}
