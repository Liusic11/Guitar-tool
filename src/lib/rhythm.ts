/**
 * 节奏 / 律动预设
 * ─────────────────────────────────────────────
 * 以「一小节」为单位描述节拍。每个预设是一个网格：
 *   - kit：发声方式 —— 'click' 传统节拍器 / 'drums' 架子鼓
 *   - subdiv：每一拍（四分音符）里分几步（1=四分、2=八分、3=三连音、4=十六分）
 *   - steps：一小节的步序列；每步可为 重拍(accent) / 弱音(tick) / 底鼓(kick) / 军鼓(snare) / 踩镲(hat)
 *   - 所有预设都是 4 拍一小节（4/4），onBeat 每拍（每 subdiv 步）回调一次
 *
 * 这样音阶「跟拍」、「模进」就能跟着真实律动走，而不是冷冰冰的节拍器。
 */

export type RhythmKit = 'click' | 'drums'

export interface RhythmStep {
  accent?: boolean
  tick?: boolean
  kick?: boolean
  snare?: boolean
  hat?: boolean
}

export interface RhythmPreset {
  id: string
  /** 控件上显示的名字，如「4/4 动次打次」 */
  label: string
  /** 拍号显示，如 '4/4' / '3连音' */
  beat: string
  kit: RhythmKit
  /** 每一拍分成几步（决定步长与 onBeat 频率） */
  subdiv: number
  /** 一小节的步序列 */
  steps: RhythmStep[]
  /** 一句话要点 */
  tip: string
}

const qa = (): RhythmStep => ({ accent: true })
const qt = (): RhythmStep => ({ tick: true })

/* ── 4/4 动次打次：底鼓 1·3、军鼓 2·4、踩镲走八分 ── */
const boomTss = (): RhythmStep[] => [
  { kick: true, hat: true },
  { hat: true },
  { snare: true, hat: true },
  { hat: true },
  { kick: true, hat: true },
  { hat: true },
  { snare: true, hat: true },
  { hat: true },
]

/* ── 三连音鼓：踩镲三连、底鼓在 1&3、军鼓在 2&4 ── */
const tripletDrums = (): RhythmStep[] => {
  const s: RhythmStep[] = new Array(12).fill(null).map(() => ({ hat: true }))
  s[0] = { kick: true, hat: true }
  s[3] = { snare: true, hat: true }
  s[6] = { kick: true, hat: true }
  s[9] = { snare: true, hat: true }
  return s
}

/* ── Funk 16 分：踩镲十六分 + 切分底鼓 + 反拍军鼓 ── */
const funk16 = (): RhythmStep[] => {
  const s: RhythmStep[] = new Array(16).fill(null).map(() => ({ hat: true }))
  s[0] = { kick: true, hat: true }
  s[3] = { kick: true, hat: true }
  s[4] = { snare: true, hat: true }
  s[8] = { kick: true, hat: true }
  s[10] = { kick: true, hat: true }
  s[12] = { snare: true, hat: true }
  s[14] = { kick: true, hat: true }
  return s
}

export const RHYTHM_PRESETS: RhythmPreset[] = [
  {
    id: 'click-44',
    label: '4/4 节拍器',
    beat: '4/4',
    kit: 'click',
    subdiv: 1,
    steps: [qa(), qt(), qt(), qt()],
    tip: '四个四分音符，最稳的地基。先把这练到不用想，再上细分。',
  },
  {
    id: 'click-8',
    label: '8分 节拍器',
    beat: '4/4',
    kit: 'click',
    subdiv: 2,
    steps: [qa(), qt(), qa(), qt(), qa(), qt(), qa(), qt()],
    tip: '一拍两下，跟扫弦 / 跟音阶最常用的细分。重拍落在 1·2·3·4。',
  },
  {
    id: 'drums-44',
    label: '4/4 动次打次',
    beat: '4/4',
    kit: 'drums',
    subdiv: 2,
    steps: boomTss(),
    tip: '底鼓在 1·3、军鼓在 2·4、踩镲走八分——这就是绝大多数歌的骨架。',
  },
  {
    id: 'click-triplet',
    label: '三连音 节拍器',
    beat: '3连音',
    kit: 'click',
    subdiv: 3,
    steps: [qa(), qt(), qt(), qa(), qt(), qt(), qa(), qt(), qt(), qa(), qt(), qt()],
    tip: '把一拍三等分，swing / shuffle 的呼吸感从这里来。跟着数「1-2-3」。',
  },
  {
    id: 'drums-triplet',
    label: '三连音 架子鼓',
    beat: '3连音',
    kit: 'drums',
    subdiv: 3,
    steps: tripletDrums(),
    tip: '三连音感觉的鼓点，专练 shuffle / 蓝调律动。',
  },
  {
    id: 'drums-funk',
    label: 'Funk 16分',
    beat: '4/4',
    kit: 'drums',
    subdiv: 4,
    steps: funk16(),
    tip: '十六分踩镲 + 切分底鼓，funk 的「反拍律动」——重心落在「and」上。',
  },
]

export function getPreset(id: string): RhythmPreset {
  return RHYTHM_PRESETS.find((p) => p.id === id) ?? RHYTHM_PRESETS[0]
}
