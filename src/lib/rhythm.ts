/**
 * 节奏 / 律动
 * ─────────────────────────────────────────────
 * 节奏由两个互相独立的维度描述，设置里各自一个框：
 *   1. 时值（subdivision）：一小节里每个四分音符再分几步
 *        - 'q' 4分（一拍一下）  'e' 8分（一拍两下）
 *        - 's' 16分（一拍四下）  't' 三连音（一拍三等分）
 *   2. 音色（kit）：发声方式 —— 'click' 传统节拍器 / 'drums' 架子鼓
 *
 * 给定 (时值, 音色) 即能确定性地生成一小节的步序列 steps：
 *   - click：每拍重音 / 其余 tick
 *   - drums：底鼓 1·3、军鼓 2·4、踩镲铺满（动次打次骨架）
 * 这样音阶「跟拍」、和弦「切换训练」就能跟着真实律动走，而设置里只需选两个维度。
 */

export type RhythmKit = 'click' | 'drums'
export type RhythmSubdivision = 'q' | 'e' | 's' | 't'

export interface RhythmStep {
  accent?: boolean
  tick?: boolean
  kick?: boolean
  snare?: boolean
  hat?: boolean
}

export interface RhythmPreset {
  id: string
  /** 控件上显示的名字，如「8分 · 鼓」 */
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

/* ── 时值选项：每个四分音符分几步 ── */
export interface RhythmSubdivOption {
  id: RhythmSubdivision
  /** 控件标签：4分 / 8分 / 16分 / 三连音 */
  label: string
  /** 每一拍的步数（1=四分、2=八分、3=三连音、4=十六分） */
  subdiv: number
  beat: string
  tip: string
}

export const RHYTHM_SUBDIVISIONS: RhythmSubdivOption[] = [
  {
    id: 'q',
    label: '4分',
    subdiv: 1,
    beat: '4/4',
    tip: '一拍一下，最稳的地基。先把这练到不用想，再上细分。',
  },
  {
    id: 'e',
    label: '8分',
    subdiv: 2,
    beat: '4/4',
    tip: '一拍两下，跟扫弦 / 跟音阶最常用。重拍落在 1·2·3·4。',
  },
  {
    id: 's',
    label: '16分',
    subdiv: 4,
    beat: '4/4',
    tip: '一拍四下，funk / 快速琶音的密度。先慢练，别糊成一团。',
  },
  {
    id: 't',
    label: '三连音',
    subdiv: 3,
    beat: '3连音',
    tip: '把一拍三等分，swing / shuffle 的呼吸感。跟着数「1-2-3」。',
  },
]

/* ── 音色选项：节拍器还是鼓 ── */
export const RHYTHM_KITS: { id: RhythmKit; label: string; tip: string }[] = [
  {
    id: 'click',
    label: '节拍器',
    tip: '清脆的木鱼声，只给拍点，不干扰你的乐句。最干净。',
  },
  {
    id: 'drums',
    label: '鼓',
    tip: '底鼓 1·3、军鼓 2·4、踩镲铺满——和真实歌曲的骨架一致，练出来直接能套。',
  },
]

/* ── 步序列生成 ── */

/** 节拍器：每拍重音，其余 tick；4 分音符只重第一拍（模拟传统节拍器） */
function buildClickSteps(subdiv: number): RhythmStep[] {
  const len = subdiv * 4
  return Array.from({ length: len }, (_, i) => {
    const isBeat = i % subdiv === 0
    if (!isBeat) return { tick: true }
    if (subdiv === 1) return i === 0 ? { accent: true } : { tick: true }
    return { accent: true }
  })
}

/** 架子鼓：踩镲铺满每一·步，底鼓 1·3、军鼓 2·4（动次打次骨架） */
function buildDrumSteps(subdiv: number): RhythmStep[] {
  const len = subdiv * 4
  const steps: RhythmStep[] = new Array(len).fill(null).map(() => ({ hat: true }))
  steps[0] = { kick: true, hat: true } // 第 1 拍 底鼓
  steps[subdiv] = { snare: true, hat: true } // 第 2 拍 军鼓
  steps[subdiv * 2] = { kick: true, hat: true } // 第 3 拍 底鼓
  steps[subdiv * 3] = { snare: true, hat: true } // 第 4 拍 军鼓
  return steps
}

/** 由 (时值, 音色) 生成完整的一小节律动 */
export function getRhythm(subdiv: RhythmSubdivision, kit: RhythmKit): RhythmPreset {
  const sd = RHYTHM_SUBDIVISIONS.find((s) => s.id === subdiv) ?? RHYTHM_SUBDIVISIONS[1]
  const kitOpt = RHYTHM_KITS.find((k) => k.id === kit) ?? RHYTHM_KITS[1]
  const steps = kit === 'drums' ? buildDrumSteps(sd.subdiv) : buildClickSteps(sd.subdiv)
  const label = `${sd.label} · ${kitOpt.label}`
  return {
    id: `${subdiv}-${kit}`,
    label,
    beat: sd.beat,
    kit,
    subdiv: sd.subdiv,
    steps,
    tip: `${sd.tip} ${kitOpt.tip}`,
  }
}
