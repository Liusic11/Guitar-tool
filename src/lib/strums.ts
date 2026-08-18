/**
 * 扫弦型（Strum Patterns）
 * ─────────────────────────────────────────────
 * Jam 页选定和弦进行后，用它做「基础节奏」：程序按图案逐 8 分音符扫当前和弦
 * （D = 下扫 / U = 上扫 / _ = 休止），替代原来「每换和弦扫一下」的默认 backing。
 *
 * 全部写在 8 分音符网格上（4/4 一小节 8 步），subdiv=2 的鼓点正好对齐。
 */

export type StrumDir = 'D' | 'U' | '_'

export interface StrumPattern {
  id: string
  name: string
  /** 8 分音符网格上的扫法（一小节 8 步） */
  steps: StrumDir[]
  /** 一句话风格提示 */
  hint: string
}

export const STRUM_PATTERNS: StrumPattern[] = [
  {
    id: 'quarter',
    name: '四分下扫',
    steps: ['D', '_', 'D', '_', 'D', '_', 'D', '_'],
    hint: '最稳，慢歌 / 抒情打底',
  },
  {
    id: 'eighth-down',
    name: '八分全下',
    steps: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D'],
    hint: '有力，摇滚 / 进行曲',
  },
  {
    id: 'folk',
    name: '民谣（下 下上 上 下上）',
    steps: ['D', '_', 'D', 'U', '_', 'U', 'D', 'U'],
    hint: '万能民谣扫法',
  },
  {
    id: 'pop',
    name: '流行（下 下上 上下上）',
    steps: ['D', '_', 'D', 'U', 'D', 'U', 'D', 'U'],
    hint: '轻快，流行标配',
  },
  {
    id: 'slow-rock',
    name: '慢摇（下 下·上下·下）',
    steps: ['D', '_', 'D', '_', 'D', 'U', 'D', '_'],
    hint: '有呼吸感，适合 ballad',
  },
  {
    id: 'reggae',
    name: '雷鬼反拍（全上）',
    steps: ['_', 'U', '_', 'U', '_', 'U', '_', 'U'],
    hint: '切分律动，雷鬼 / 斯卡',
  },
]

export function strumPatternById(id: string | null): StrumPattern | null {
  if (!id) return null
  return STRUM_PATTERNS.find((p) => p.id === id) ?? null
}
