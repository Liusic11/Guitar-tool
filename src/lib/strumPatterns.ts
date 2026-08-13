/**
 * 扫弦型 / 节奏型库
 * ─────────────────────────────────────────────
 * 以「一小节 4/4」为单位，按当前节拍型的 subdiv 决定步数：
 *   - subdiv=1（四分音符）→ 4 步
 *   - subdiv=2（八分音符）→ 8 步
 *   - subdiv=3（三连音）  → 12 步
 *   - subdiv=4（十六分）  → 16 步
 *
 * 这样 RhythmTrainer 的扫弦格能和 RhythmBar / 鼓点网格 1:1 对齐。
 */

export type StrumAction = 'down' | 'up' | 'rest'

export interface StrumPattern {
  id: string
  label: string
  /** 匹配哪种细分，保证一格对一拍 */
  subdiv: number
  /** 一小节的扫弦动作序列 */
  steps: StrumAction[]
  /** 一句话要点 */
  tip: string
}

export const STRUM_PATTERNS: StrumPattern[] = [
  /* ── 四分音符（4 步） ── */
  {
    id: 'q-all-down',
    label: '四分下扫',
    subdiv: 1,
    steps: ['down', 'down', 'down', 'down'],
    tip: '每拍一下，先练稳根音向下的律动，适合慢摇滚。',
  },
  {
    id: 'q-boom-chick',
    label: 'Boom-Chick',
    subdiv: 1,
    steps: ['down', 'rest', 'down', 'rest'],
    tip: '只在 1、3 拍扫，模拟底鼓+贝斯的重音落点。',
  },

  /* ── 八分音符（8 步）─最常用 ── */
  {
    id: 'e-pop-basic',
    label: '流行八分',
    subdiv: 2,
    steps: ['down', 'down', 'up', 'up', 'down', 'up', 'rest', 'rest'],
    tip: '民谣/流行最常见的「下 下上 上下上」，第四拍留白。',
  },
  {
    id: 'e-folk-drive',
    label: '民谣推进',
    subdiv: 2,
    steps: ['down', 'down', 'up', 'down', 'up', 'down', 'up', 'rest'],
    tip: '连续上下驱动，适合副歌或情绪上扬的段落。',
  },
  {
    id: 'e-reggae-skip',
    label: '雷鬼反拍',
    subdiv: 2,
    steps: ['rest', 'rest', 'down', 'up', 'rest', 'rest', 'down', 'up'],
    tip: '只在 2、4 拍后出手，练反拍重心——funk / reggae 的骨架。',
  },

  /* ── 三连音（12 步）─shuffle / blues ── */
  {
    id: 't-shuffle',
    label: 'Shuffle 摇摆',
    subdiv: 3,
    steps: ['down', 'rest', 'up', 'down', 'rest', 'up', 'down', 'rest', 'up', 'down', 'rest', 'up'],
    tip: '把一拍三等分，长-短-长的摇摆感，蓝调必备。',
  },

  /* ── 十六分音符（16 步）─funk ── */
  {
    id: 's-funk-16',
    label: 'Funk 十六分',
    subdiv: 4,
    steps: [
      'down', 'rest', 'rest', 'up',
      'rest', 'down', 'rest', 'up',
      'down', 'rest', 'rest', 'up',
      'rest', 'down', 'up', 'rest',
    ],
    tip: '重心落在「and」上，十六分踩镲里藏着切分。',
  },
  {
    id: 's-sixteenth-alt',
    label: '十六分交替',
    subdiv: 4,
    steps: [
      'down', 'rest', 'up', 'rest',
      'down', 'rest', 'up', 'rest',
      'down', 'rest', 'up', 'rest',
      'down', 'rest', 'up', 'rest',
    ],
    tip: '先练最简单的十六分上下交替，手腕放松。',
  },
]

export function patternsForSubdiv(subdiv: number): StrumPattern[] {
  return STRUM_PATTERNS.filter((p) => p.subdiv === subdiv)
}

export function getPattern(id: string): StrumPattern | undefined {
  return STRUM_PATTERNS.find((p) => p.id === id)
}
