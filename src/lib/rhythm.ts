/**
 * 节奏 / 律动（Groove 库）
 * ─────────────────────────────────────────────
 * 鼓点不再只是「动次打次」——这里是一份**命名 groove 库**：每一种律动是一段
 * 写死的、可练习的鼓点编排（动次打次 / funk 16 分 / boom-bap 咚咚打次 / bossa /
 * samba / reggae one-drop / 半拍摇滚 / shuffle…）。任何模块（RhythmBar、和弦切换
 * 训练、Jam、耳朵训练）都通过 rhythmStore 里的单一 grooveId 消费同一份律动，
 * 这就是「节奏唯一真相源」——也是系统 robust 的底座。
 *
 * 每个 groove 是一小节（4 拍）的步序列 steps：
 *   · subdiv = 每一拍分几步（1=四分、2=八分、4=十六分）
 *   · 每步可同时带 kick / snare / hat / ghost(轻军鼓) / openHat(长镲) / rim(边击)
 *   · swing=true 时，RhythmBar 会把反拍（八分/十六分里的弱位）往后拖成摇摆感
 */

export type RhythmKit = 'click' | 'drums'
export type RhythmSubdivision = 'q' | 'e' | 's' | 't'

export interface RhythmStep {
  accent?: boolean
  tick?: boolean
  kick?: boolean
  snare?: boolean
  hat?: boolean
  /** 轻军鼓（ghost note），比正拍军鼓弱很多 */
  ghost?: boolean
  /** 长镲（open hi-hat），拖尾比闭镲长 */
  openHat?: boolean
  /** 边击（rimshot），短促高频，用于 latin 的调性重音 */
  rim?: boolean
}

export interface RhythmPreset {
  id: string
  /** 控件上显示的名字，如「动次打次 · 8分」 */
  label: string
  /** 风格标签，如 'rock' / 'jazz' / 'latin' */
  style: string
  kit: RhythmKit
  /** 每一拍分成几步（决定步长与 onBeat 频率） */
  subdiv: number
  /** 一小节的步序列 */
  steps: RhythmStep[]
  /** 摇摆（把反拍往后拖） */
  swing?: boolean
  /** 一句话要点 */
  tip: string
}

/* ── 步序列生成辅助 ── */

type Spec = Partial<RhythmStep>

/** 16 分音符网格：给定底鼓/军鼓位置 + 可选每步额外装饰，生成一整小节 */
function grid16(kicks: number[], snares: number[], extras: Record<number, Spec> = {}): RhythmStep[] {
  return Array.from({ length: 16 }, (_, i) => ({
    hat: true,
    ...(kicks.includes(i) ? { kick: true } : {}),
    ...(snares.includes(i) ? { snare: true } : {}),
    ...(extras[i] ?? {}),
  }))
}

/** 8 分音符网格：同上，8 步 */
function grid8(kicks: number[], snares: number[], extras: Record<number, Spec> = {}): RhythmStep[] {
  return Array.from({ length: 8 }, (_, i) => ({
    hat: true,
    ...(kicks.includes(i) ? { kick: true } : {}),
    ...(snares.includes(i) ? { snare: true } : {}),
    ...(extras[i] ?? {}),
  }))
}

/* ── Groove 库 ── */

export const GROOVES: RhythmPreset[] = [
  {
    id: 'click-4',
    label: '木鱼 · 4分',
    style: 'metronome',
    kit: 'click',
    subdiv: 1,
    steps: [{ accent: true }, { tick: true }, { tick: true }, { tick: true }],
    tip: '一拍一下，最稳的地基。先把这练到不用想。',
  },
  {
    id: 'click-8',
    label: '木鱼 · 8分',
    style: 'metronome',
    kit: 'click',
    subdiv: 2,
    steps: [
      { accent: true }, { tick: true },
      { accent: true }, { tick: true },
      { accent: true }, { tick: true },
      { accent: true }, { tick: true },
    ],
    tip: '一拍两下，跟扫弦 / 跟音阶最常用。重拍落在每拍头。',
  },
  {
    id: 'straight-8',
    label: '动次打次 · 8分',
    style: 'rock',
    kit: 'drums',
    subdiv: 2,
    steps: grid8([0, 4], [2, 6]),
    tip: '底鼓 1·3、军鼓 2·4、踩镲铺满——和真实歌曲的骨架一致，练出来直接能套。',
  },
  {
    id: 'straight-16',
    label: '16分直线',
    style: 'rock',
    kit: 'drums',
    subdiv: 4,
    steps: grid16([0, 8], [4, 12]),
    tip: '一拍四下踩镲铺满，funk / 快速琶音的密度。先慢练，别糊成一团。',
  },
  {
    id: 'funk-16',
    label: 'Funk 16分',
    style: 'funk',
    kit: 'drums',
    subdiv: 4,
    steps: grid16(
      [0, 6, 10],
      [4, 12],
      { 7: { ghost: true }, 14: { ghost: true } },
    ),
    tip: '切分底鼓（蹦-恰-蹦）+ 轻 ghost 军鼓，funk 的「懈」就在这反拍上。跟着数「1 2 3 4」别被带跑。',
  },
  {
    id: 'boombap',
    label: 'Boom-Bap 咚咚打次',
    style: 'hiphop',
    kit: 'drums',
    subdiv: 4,
    steps: grid16(
      [0, 6],
      [4, 12],
      { 10: { ghost: true } },
    ),
    tip: '底鼓砸在 1 和 2 的「啊」上（咚-咚），军鼓 2·4 收（打次）——老派 hip-hop / 慢摇的呼吸。',
  },
  {
    id: 'bossa',
    label: 'Bossa Nova',
    style: 'latin',
    kit: 'drums',
    subdiv: 4,
    steps: grid16(
      [0, 6],
      [],
      {
        2: { openHat: true },
        4: { rim: true },
        10: { openHat: true },
        12: { rim: true },
      },
    ),
    tip: '宽松的沙锤镲 + 边击(rim)点在 2·4 的拉丁重音，底鼓在 1 和 3 前抢半拍——city pop / bossa 的慵懒。',
  },
  {
    id: 'samba',
    label: 'Samba',
    style: 'latin',
    kit: 'drums',
    subdiv: 4,
    steps: grid16(
      [0, 8],
      [],
      { 1: { ghost: true }, 3: { ghost: true }, 5: { ghost: true }, 7: { ghost: true }, 9: { ghost: true }, 11: { ghost: true }, 13: { ghost: true }, 15: { ghost: true } },
    ),
    tip: '底鼓 1·3，caixa 军鼓把每个反拍都敲出碎密的点——桑巴的「滚滚」密度。',
  },
  {
    id: 'reggae',
    label: 'Reggae (One-Drop)',
    style: 'reggae',
    kit: 'drums',
    subdiv: 2,
    steps: grid8([4], [2, 6]),
    tip: '「one-drop」：底鼓故意不落在 1，而落在 3；军鼓稳稳压在 2·4。反拍才是重力——雷鬼的松弛全在这。',
  },
  {
    id: 'halftime',
    label: '半拍摇滚',
    style: 'rock',
    kit: 'drums',
    subdiv: 2,
    steps: grid8([0], [4]),
    tip: '底鼓只在 1，军鼓只在 3——拍子「拉宽」成半速，ballad / 史诗段落的推进感。',
  },
  {
    id: 'shuffle',
    label: 'Shuffle / Swing',
    style: 'blues',
    kit: 'drums',
    subdiv: 2,
    swing: true,
    steps: grid8([0, 4], [2, 6]),
    tip: '把八分音符拖成「长-短」三连音感——blues / rockabilly 那种「摇」起来。跟着点头别跟手。',
  },
]

/* ── 查询 ── */

export function getGroove(id: string): RhythmPreset {
  return GROOVES.find((g) => g.id === id) ?? GROOVES[2]
}

export function listGrooves(): RhythmPreset[] {
  return GROOVES
}

/**
 * 兼容旧调用：任何仍用 (subdiv, kit) 取律动的地方，落到最接近的 groove。
 * 新代码请直接用 getGroove(grooveId)。
 */
export function getRhythm(subdiv: RhythmSubdivision, kit: RhythmKit): RhythmPreset {
  if (kit === 'click') return subdiv === 'q' ? getGroove('click-4') : getGroove('click-8')
  if (subdiv === 's') return getGroove('straight-16')
  if (subdiv === 't') return getGroove('straight-8')
  return getGroove('straight-8')
}
