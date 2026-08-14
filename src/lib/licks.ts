/**
 * 乐句库（Lick Library）数据层
 * ─────────────────────────────────────────────
 * 把「词汇 → 造句」里缺的中间层补上：别人写好的、真实语感的乐句。
 * 每条乐句都是手写数据（确定性，不调 LLM），以 A 参考根音书写绝对品位，
 * 移调时按根音在锚定弦上的品位差整体平移（同 intervalShapes 的思路）。
 *
 * 设计铁律（与全站一致）：
 *  · 参考真实吉他教学法（五声盒 1 / 布鲁斯盒 / dorian / 琶音 / 半音趋近），不自创体系
 *  · 每句都锚定曲例，乐理讲解用老师口吻，讲「用了哪几个音、为什么好听」
 *  · 指法全部落在低把位（0–16 品内），任意 12 个根音都能平移弹奏
 */

import type { Tuning, PitchClass } from './music'
import { pitchClassOf } from './music'

export type LickStyle = 'blues' | 'funk' | 'jazz' | 'rock'

export const LICK_STYLES: { id: LickStyle | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'blues', label: '蓝调' },
  { id: 'funk', label: 'Funk' },
  { id: 'jazz', label: '爵士' },
  { id: 'rock', label: '摇滚' },
]

export const LICK_STYLE_LABEL: Record<LickStyle, string> = {
  blues: '蓝调',
  funk: 'Funk',
  jazz: '爵士',
  rock: '摇滚',
}

export interface LickNote {
  /** 弦号 6..1 */
  string: number
  /** 品位（相对参考根音的绝对品位） */
  fret: number
}

export interface Lick {
  id: string
  name: string
  style: LickStyle
  /** 难度 1..3 */
  difficulty: 1 | 2 | 3
  /** 参考根音（乐句按这个根音书写） */
  rootPc: PitchClass
  /** 锚定弦（移调时按这根弦上的根音品位差平移） */
  anchorString: number
  /** 参考根音在锚定弦上的品位 */
  anchorFret: number
  /** 演奏顺序的音符 */
  notes: LickNote[]
  /** 节奏提示（人话，用于听感预期） */
  timing: string
  /** 适合跟哪类和弦类型（和弦 typeId）搭配 */
  worksOver: string[]
  /** 老师口吻：用了哪些音、为什么好听、来自哪 */
  why: string
  /** 练习提示：怎么练、怎么移到别的和弦 */
  tip: string
}

/**
 * 乐句移调：目标根音在锚定弦上的品位 - 参考根音的品位 = 平移量。
 * 所有音符品位加上平移量；超出可弹范围（0..22）时返回 null（该根音不可用）。
 * 空弦根音（0 品）自动取 12 品八度，保证整个形状可移动。
 */
export function transposeLick(lick: Lick, targetPc: PitchClass, tuning: Tuning): LickNote[] | null {
  const spec = tuning.strings.find((s) => s.number === lick.anchorString)
  if (!spec) return null
  const openPc = pitchClassOf(spec.openMidi)
  const targetFret = ((((targetPc - openPc) % 12) + 12) % 12) || 12
  const delta = targetFret - lick.anchorFret
  const out: LickNote[] = []
  for (const n of lick.notes) {
    const fret = n.fret + delta
    if (fret < 0 || fret > 22) return null
    out.push({ string: n.string, fret })
  }
  return out
}

/** 乐句实际占用的品位范围（参考根音下），用于指板取景 */
export function lickFretRange(lick: Lick): [number, number] {
  let lo = 99
  let hi = -1
  for (const n of lick.notes) {
    if (n.fret < lo) lo = n.fret
    if (n.fret > hi) hi = n.fret
  }
  return [Math.max(0, lo - 1), Math.min(22, hi + 2)]
}

/** 半音间隔 → 级数标注（相对根音） */
export const LICK_DEGREE_LABEL: Record<number, string> = {
  0: '1',
  1: '♭2',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♭5',
  7: '5',
  8: '♭6',
  9: '6',
  10: '♭7',
  11: '7',
}

/** 某个指板位置相对根音的音程度数标注（如 "♭3"） */
export function lickDegreeAt(string: number, fret: number, rootPc: PitchClass, tuning: Tuning): string {
  const spec = tuning.strings.find((s) => s.number === string)
  if (!spec) return ''
  const pc = pitchClassOf(spec.openMidi + fret)
  const interval = ((pc - rootPc) % 12 + 12) % 12
  return LICK_DEGREE_LABEL[interval] ?? ''
}

/* ═══════════════════════ 乐句库 ═══════════════════════
 * 全部以 A（rootPc 9，6 弦 5 品）为参考根音书写，锚定 6 弦。
 * 五声盒 1 / 布鲁斯盒的音位（A 小调五声：A C D E G；布鲁斯加 ♭5=E♭）：
 *   6弦: 5=A  8=C
 *   5弦: 5=D  6=E♭(♭5)  7=E
 *   4弦: 5=G  7=A
 *   3弦: 5=C  7=D  9=E
 *   2弦: 5=G  8=A
 *   1弦: 5=C  8=D
 */

export const LICKS: Lick[] = [
  /* ─────────────── 蓝调 ─────────────── */
  {
    id: 'blues-open',
    name: '开门句',
    style: 'blues',
    difficulty: 1,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 6, fret: 5 },
      { string: 6, fret: 8 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
    ],
    timing: '8 分音 · 滑音',
    worksOver: ['dom7', 'min', 'maj'],
    why: '从根音 A 滑到 ♭3（C）再落回 5 度 E，是布鲁斯最经典的开场句。用的就是盒 1 最顺手的三个音（1-♭3-5），闭眼都能摸到，跟着节拍器走一遍，马上有「我会弹 blues 了」的感觉。',
    tip: '6 弦 5 品滑到 8 品要干脆；每句最后落在 4 弦 7 品（根音）上，留白半拍再循环。',
  },
  {
    id: 'blues-cry',
    name: 'BB 哭腔',
    style: 'blues',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 4, fret: 7 },
      { string: 3, fret: 7 },
      { string: 3, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 5, fret: 7 },
    ],
    timing: '8 分音 · 3 弦 7 品推全音',
    worksOver: ['dom7'],
    why: '3 弦 7 品（D，4 度）推全音上去到 E（5 度），再滑回 ♭3（C）——BB King 的「哭腔」就是这个动作。推弦是布鲁斯的魂，音高从「推上去」的瞬间开始算，不是滑音。',
    tip: '推弦前先弹一下 3 弦 9 品（E）对音准；推完保持住再落回，别急着松。练到每次推完都准，这句就成你的了。',
  },
  {
    id: 'blues-blue-note',
    name: '蓝调音句',
    style: 'blues',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 5, fret: 6 },
      { string: 5, fret: 7 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 3, fret: 5 },
      { string: 3, fret: 7 },
    ],
    timing: '8 分音 · ♭5 蓝调音',
    worksOver: ['dom7', 'min'],
    why: '5 弦 6 品是 ♭5（E♭，蓝调音）——它既不在大调也不在小调里，正是 blues 那股「脏」味的来源。E♭ 蹭一下立刻落回 E（5 度），那种「将落未落」的张力就是蓝调味。',
    tip: '蓝调音是经过音，永远别停在上面；E♭→E 那一下要快，像踩到火苗缩回脚。',
  },
  {
    id: 'blues-descend',
    name: '五声下行',
    style: 'blues',
    difficulty: 1,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 6, fret: 8 },
      { string: 6, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 3, fret: 7 },
      { string: 3, fret: 5 },
    ],
    timing: '16 分音 · 下行爬梯',
    worksOver: ['dom7', 'min', 'maj'],
    why: '沿盒 1 一路下行（♭3→1→5→4→1→♭7→4→♭3），把整个盒子的低把位过一遍。下行是布鲁斯/摇滚 solo 的主力走向，练熟它等于给手指装了「自动导航」。',
    tip: '用拨片上下交替拨（down-up-down-up），手要松；先 60bpm 走顺，再慢慢加速。',
  },
  {
    id: 'blues-triplet',
    name: '三连音句',
    style: 'blues',
    difficulty: 3,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 6, fret: 5 },
      { string: 6, fret: 8 },
      { string: 6, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 3, fret: 5 },
    ],
    timing: '三连音 · 1-♭3-1 动机',
    worksOver: ['dom7', 'min'],
    why: '三连音是 blues 律动的第二引擎：1-♭3-1（A-C-A）每三连音一组，配合换弦下滑，弹出来就是 Albert King / SRV 那种「锯木头」的推背感。',
    tip: '心里数「1-2-3、1-2-3」，重音永远在第 1 下；先单组慢练，再串成整句。',
  },

  /* ─────────────── Funk ─────────────── */
  {
    id: 'funk-bite',
    name: 'Funk 咬合',
    style: 'funk',
    difficulty: 1,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
    ],
    timing: '16 分音 · 反拍重音',
    worksOver: ['m7', 'dom7'],
    why: '5 度 E 和 4 度 D 在 5 弦上来回咬合，是 funk 最基础的「两音动机」。funk 的灵魂不在音高而在反拍重音——把重音放在「and」（反拍）上，正拍轻带，律动就出来了。',
    tip: '先只弹重音（反拍），找到「弹-空-弹-空」的弹性；再补上正拍的轻音。节拍器开 90bpm 16 分音。',
  },
  {
    id: 'funk-seventh',
    name: '属七 Funk',
    style: 'funk',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
    ],
    timing: '16 分音 · 根音-♭7 骨架',
    worksOver: ['dom7'],
    why: '根音 A 和 ♭7（G）在 4 弦上交替，就是 A7 的「funk 骨架」——《Superstition》那种 riff 全是这个成分。♭7 是属七的招牌音，两音交替自带律动。',
    tip: '全部用闷音扫弦的右手感觉弹（手掌轻贴琴桥），只有重音出音头；配合 16 分音节拍器。',
  },
  {
    id: 'funk-ghost',
    name: '幽灵音句',
    style: 'funk',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 5, fret: 7 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
    ],
    timing: '16 分音 · 幽灵音（闷音）',
    worksOver: ['m7', 'dom7'],
    why: '两个真音之间夹一个「幽灵音」（左手虚按、只出声头不出音高），是 funk 语汇里的「标点符号」。它让律动像说话一样有停顿感。',
    tip: '幽灵音不用按实，左手轻搭在弦上即可；右手保持 16 分音匀速，别被幽灵音带乱。',
  },
  {
    id: 'funk-syncopate',
    name: '切分句',
    style: 'funk',
    difficulty: 3,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
      { string: 3, fret: 7 },
      { string: 3, fret: 5 },
      { string: 3, fret: 7 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
    ],
    timing: '16 分音 · 跨弦切分',
    worksOver: ['m7', 'dom7'],
    why: '根音 A → ♭7 G 之间插进 3 弦的 4 度 D 和 ♭3 C，把八分音「切开」，让旋律在弦与弦之间跳——切分是 funk 句子的「呼吸」。',
    tip: '慢练时先把 3 弦的两个音（D-C）单独抽出来弹熟，再拼回整句；反拍重音不要丢。',
  },
  {
    id: 'funk-one-string',
    name: '单弦 16 分',
    style: 'funk',
    difficulty: 1,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 6 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
    ],
    timing: '16 分音 · 单弦循环',
    worksOver: ['dom7', 'm7'],
    why: '单弦上的 E-D-E-♭5-E-D-E-D 循环，是练 16 分音时值最好的「纯律动句」——♭5（E♭）一蹭，funk 味立刻浓。练的是右手机械的均匀。',
    tip: '右手手腕固定、小臂小幅摆动，像钟摆；先 70bpm 弹均匀，再加速。这句可以当热身。',
  },

  /* ─────────────── 爵士 ─────────────── */
  {
    id: 'jazz-dorian',
    name: '多利亚爬升',
    style: 'jazz',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 4, fret: 7 },
      { string: 4, fret: 9 },
      { string: 3, fret: 9 },
      { string: 3, fret: 7 },
      { string: 3, fret: 5 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
      { string: 5, fret: 7 },
    ],
    timing: '8 分音 · A 多利亚（A B C D E F# G）',
    worksOver: ['m7', 'maj7'],
    why: 'A 多利亚音阶最顺手的骨架：1（A）→ 9（B）→ 5（E）→ 4（D）→ ♭3（C）→ ♭7（G）→ 回根音。多利亚的招牌是 6 度 F#，m7 和弦上 solo 的第一选择。',
    tip: '在 Am7 伴奏上弹；跟着节拍器 8 分音，重音在根音和 5 度上，其余轻带。',
  },
  {
    id: 'jazz-enclosure',
    name: '半音趋近',
    style: 'jazz',
    difficulty: 3,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 4, fret: 7 },
      { string: 4, fret: 6 },
      { string: 4, fret: 5 },
      { string: 3, fret: 7 },
      { string: 3, fret: 6 },
      { string: 3, fret: 5 },
      { string: 3, fret: 4 },
      { string: 4, fret: 7 },
    ],
    timing: '8 分音 · 半音经过',
    worksOver: ['m7', 'dom7', 'maj7', 'm7b5'],
    why: '先用 G#（导音）半音滑回根音 A，再走 D-C#-C-B 的半音阶梯下行回到 A——半音趋近是爵士旋律最核心的造句法，让句子永远在「逼近目标音」，听感高级。',
    tip: '半音是经过音，必须快速落到目标音，别让它成为「错音」；先在 ii–V–I 里用这一句收尾。',
  },
  {
    id: 'jazz-arpeggio',
    name: '琶音句',
    style: 'jazz',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 4, fret: 7 },
      { string: 3, fret: 5 },
      { string: 3, fret: 9 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
      { string: 5, fret: 7 },
      { string: 6, fret: 8 },
      { string: 6, fret: 5 },
    ],
    timing: '8 分音 · Am7 琶音（A C E G）',
    worksOver: ['m7', 'maj7'],
    why: 'Am7 琶音 A-C-E-G 上行再折回——琶音是「和弦的声音」，solo 时踩在琶音上永远不会错。这句把 m7 的四个音全串了一遍，是爵士句子的地基。',
    tip: '琶音要弹得像一个整体（唱出来：A-C-E-G）；熟练后每个琶音音之间可以加半音经过。',
  },
  {
    id: 'jazz-swung',
    name: '摇摆句',
    style: 'jazz',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 5, fret: 7 },
      { string: 5, fret: 9 },
      { string: 4, fret: 7 },
      { string: 3, fret: 9 },
      { string: 3, fret: 7 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
      { string: 5, fret: 7 },
    ],
    timing: '摇摆 8 分音（三连音感）',
    worksOver: ['m7', 'dom7'],
    why: 'E-F#-A-E-D-G-A-E 的线条用「摇摆」节奏弹：每两个 8 分音其实是一个三连音的前长后短。同一串音，直弹是 funk、摇摆弹就是爵士——时值决定风格。',
    tip: '心里数三连音「1-2-3」，把 1 和 2 连起来、3 单独短促；跟着爵士鼓的 ride 练。',
  },
  {
    id: 'jazz-approach',
    name: '导音落点',
    style: 'jazz',
    difficulty: 3,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 4, fret: 6 },
      { string: 4, fret: 7 },
      { string: 5, fret: 9 },
      { string: 5, fret: 7 },
      { string: 4, fret: 7 },
      { string: 3, fret: 7 },
      { string: 3, fret: 5 },
      { string: 4, fret: 7 },
    ],
    timing: '8 分音 · 导音（G#→A）',
    worksOver: ['m7', 'dom7'],
    why: 'G#（导音，7 度）半音上行解决到 A（根音），是「回家」的经典动作。F#（6 度）→E（5 度）再落 A，整句围绕根音转圈，jazz 的「说话感」就来自这种绕。',
    tip: '导音 G# 要弹得轻、A 要弹得实（解决音的重量感）；放慢听「张力→释放」的对比。',
  },

  /* ─────────────── 摇滚 ─────────────── */
  {
    id: 'rock-open',
    name: '开门 Riff',
    style: 'rock',
    difficulty: 1,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 6, fret: 5 },
      { string: 6, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 5, fret: 7 },
      { string: 6, fret: 5 },
    ],
    timing: '8 分音 · 强力和弦动机',
    worksOver: ['maj', 'min', 'dom7'],
    why: '根音 A 起手、5 度 E 跟上，用「低-高-回」的走向搭一个 riff 骨架——摇滚句子的起点就是把强力和弦拆成单音动机。',
    tip: '重音砸在根音上，其余轻带；这句适合当热身，跟着节拍器走 8 分音。',
  },
  {
    id: 'rock-power',
    name: '强力和弦跳',
    style: 'rock',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 6, fret: 5 },
      { string: 5, fret: 7 },
      { string: 6, fret: 8 },
      { string: 5, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
    ],
    timing: '8 分音 · 根音-5 度跳',
    worksOver: ['maj', 'min', 'dom7'],
    why: 'A→E、♭3（C）→D 的跳进，是摇滚 riff 的「推进器」——利用 5 度和 ♭3 的落差制造冲击力，AC/DC 式句子就是这个动作。',
    tip: '跨弦跳时右手跟随要果断；先慢练让每次换弦都干净，再加速。',
  },
  {
    id: 'rock-bend',
    name: '推弦句',
    style: 'rock',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 4, fret: 7 },
      { string: 3, fret: 7 },
      { string: 3, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 3, fret: 5 },
      { string: 3, fret: 7 },
      { string: 4, fret: 7 },
    ],
    timing: '8 分音 · 3 弦 7 品推全音',
    worksOver: ['min', 'dom7', 'maj'],
    why: '根音 A 起，3 弦 7 品（D，4 度）推全音到 E（5 度）——摇滚 solo 最标志性的表情。推完回落 ♭3（C）再接回 4 度 D，一条线里同时有「推弦」和「五声下行的落点」。',
    tip: '推弦用无名指、食指中指辅助支撑；推完先对 3 弦 9 品（E）的音高，再练「推-保持-回」的节奏感。',
  },
  {
    id: 'rock-run',
    name: '五声跑动',
    style: 'rock',
    difficulty: 3,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 6, fret: 5 },
      { string: 6, fret: 8 },
      { string: 5, fret: 5 },
      { string: 5, fret: 7 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
      { string: 3, fret: 5 },
      { string: 3, fret: 7 },
      { string: 2, fret: 5 },
      { string: 2, fret: 8 },
    ],
    timing: '16 分音 · 盒 1 上行',
    worksOver: ['min', 'maj'],
    why: '从 A 一路沿盒 1 爬到高八度 A（2 弦 8 品），把整个盒子的音阶音串成一条 16 分音跑道——摇滚速弹段落的原材料就是它。',
    tip: '用「下-上」交替拨弦，换弦时保持手腕转动；先 60bpm 均匀，再一点点提速。',
  },
  {
    id: 'rock-lick',
    name: '结尾句',
    style: 'rock',
    difficulty: 2,
    rootPc: 9,
    anchorString: 6,
    anchorFret: 5,
    notes: [
      { string: 6, fret: 8 },
      { string: 6, fret: 5 },
      { string: 5, fret: 7 },
      { string: 5, fret: 5 },
      { string: 4, fret: 7 },
      { string: 4, fret: 5 },
      { string: 3, fret: 5 },
      { string: 3, fret: 7 },
      { string: 3, fret: 5 },
      { string: 4, fret: 7 },
    ],
    timing: '16 分音 · 下行收束',
    worksOver: ['min', 'dom7'],
    why: '从高音 ♭3 一路下行回到根音 A——「从紧张回到稳定」是摇滚/布鲁斯句子的收束公式，落在根音上就像句子画上句号。',
    tip: '最后停在 4 弦 7 品根音上揉弦收尾；下行时注意每弦换弦的连贯性。',
  },
]

/** 按风格筛选乐句 */
export function licksByStyle(style: LickStyle | 'all'): Lick[] {
  return style === 'all' ? LICKS : LICKS.filter((l) => l.style === style)
}

/** 适合某类和弦类型的乐句（按难度排序，最多 n 条） */
export function licksForChordType(typeId: string, n = 3): Lick[] {
  return LICKS.filter((l) => l.worksOver.includes(typeId))
    .sort((a, b) => a.difficulty - b.difficulty)
    .slice(0, n)
}
