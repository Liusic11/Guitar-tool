/**
 * Jam 模块数据层（乐理贯通的「练习汇点」）
 * ─────────────────────────────────────────────
 * 把「节奏 + 和弦进行 + 在合适音阶里选音」落成一个个可练习的进行预设。
 * 老师面板的文案 100% 由确定性乐理生成（复用 harmony.ts 的 CHORD_SCALE_MAP /
 * DIATONIC），不调 LLM、不猜测——每个进行都标了「为什么整段能用一个音阶」、
 * 以及「每和弦换音阶时该上什么音阶」。
 *
 * 设计铁律（与全站一致）：参考真实教学法，不自创体系。
 */

import { LETTER_NAMES, type PitchClass, type Tuning } from './music'
import { CHORD_TYPES, type ChordType } from './chords'
import { SCALES } from './scales'
import { scaleSuggestions, chordName, chordTypeLabel } from './harmony'

export interface JamChord {
  rootPc: PitchClass
  typeId: string
}

export interface JamPreset {
  id: string
  /** 显示名 */
  name: string
  /** 风格标签（pop / blues / jazz / spanish…） */
  style: string
  /** 父调根音（音阶/调式的 tonic） */
  keyPc: PitchClass
  keyQuality: 'major' | 'minor'
  /** 罗马数字串，如 "I–vi–IV–V" */
  numerals: string
  /** 进行里的具体和弦序列（与 chordNumerals 一一对应） */
  chords: JamChord[]
  /** 每个和弦的级数标签，与 chords 对齐 */
  chordNumerals: string[]
  /** 全局模式高亮的音阶（相对 keyPc 的「父音阶」，覆盖整段进行） */
  globalScale: { scaleId: string; rootPc: PitchClass }
  /** 可选：每和弦换音阶模式下的音阶 id（相对该和弦根音）；缺省则按 CHORD_SCALE_MAP 取第一推荐 */
  perChordScale?: string[]
  /** 老师口吻：为什么这个进行成立 / 整段该用什么音阶 */
  why: string
  /** 一句话练习提示 */
  tip: string
}

export const JAM_PRESETS: JamPreset[] = [
  {
    id: '1-6-4-5',
    name: '1645 万能进行',
    style: 'pop / rock',
    keyPc: 0,
    keyQuality: 'major',
    numerals: 'I–vi–IV–V',
    chords: [
      { rootPc: 0, typeId: 'maj' },
      { rootPc: 9, typeId: 'min' },
      { rootPc: 5, typeId: 'maj' },
      { rootPc: 7, typeId: 'maj' },
    ],
    chordNumerals: ['I', 'vi', 'IV', 'V'],
    globalScale: { scaleId: 'minorPent', rootPc: 9 },
    why: '这四条和弦全来自 C 大调（C=I、Am=vi、F=IV、G=V），一条顺阶走完，所以整段用一个父音阶——A 小调五声（= C 大调五声，同音）——就能 solo，闭眼弹也不踩错音。想更「对味」：G 上换 Mixolydian 加属味、F 上换 Lydian 提亮、Am 上换 Dorian 加 funk 亮。这可是《卡农》《体面》之类无数歌的骨架。',
    tip: '先跟拍把四个和弦扫稳做 base，再在 A 小调五声里随便挑音哼一段；注意每个和弦切换的瞬间别断。',
  },
  {
    id: '1-5-6-4',
    name: '1564 另一王',
    style: 'pop',
    keyPc: 0,
    keyQuality: 'major',
    numerals: 'I–V–vi–IV',
    chords: [
      { rootPc: 0, typeId: 'maj' },
      { rootPc: 7, typeId: 'maj' },
      { rootPc: 9, typeId: 'min' },
      { rootPc: 5, typeId: 'maj' },
    ],
    chordNumerals: ['I', 'V', 'vi', 'IV'],
    globalScale: { scaleId: 'minorPent', rootPc: 9 },
    why: 'I–V–vi–IV 的另一种排法，明亮的 V 提前，推进感更强，是流行歌第二常见的骨架（如《江南》《Someone Like You》类走向）。同样整段顺阶于 C 大调，父音阶还是 A 小调五声。',
    tip: '和 1645 同一套把位，只是和弦顺序变了——重点练 V→vi 那个从亮到暗的落点。',
  },
  {
    id: '4-5-3-6',
    name: '4536 慢摇',
    style: 'ballad / rock',
    keyPc: 5,
    keyQuality: 'major',
    numerals: 'IV–V–vi–IV',
    chords: [
      { rootPc: 5, typeId: 'maj' },
      { rootPc: 7, typeId: 'maj' },
      { rootPc: 9, typeId: 'min' },
      { rootPc: 5, typeId: 'maj' },
    ],
    chordNumerals: ['IV', 'V', 'vi', 'IV'],
    globalScale: { scaleId: 'minorPent', rootPc: 2 },
    why: 'F 大调里的 IV–V–vi–IV，慢摇 / ballad 最爱（如《突然好想你》类走向）。整段顺阶于 F 大调，父音阶用它的关系小调——D 小调五声（= F 大调五声同音），弹起来亮又不踩错。',
    tip: '在 F 调把位上走 D 小调五声，留意 vi（Dm）落回来时那种「回家」的暗色。',
  },
  {
    id: '12-bar-blues',
    name: '12 小节蓝调',
    style: 'blues',
    keyPc: 0,
    keyQuality: 'major',
    numerals: 'I7–IV7–V7',
    chords: [
      { rootPc: 0, typeId: 'dom7' },
      { rootPc: 5, typeId: 'dom7' },
      { rootPc: 7, typeId: 'dom7' },
    ],
    chordNumerals: ['I7', 'IV7', 'V7'],
    globalScale: { scaleId: 'blues', rootPc: 0 },
    why: '12 小节蓝调 = I7–IV7–V7 各占几小节循环。关键反例：明明是大调和弦，却故意用 布鲁斯音阶（带 ♭5 蓝调音，不在大调里）去 solo——那个张力就是 blues 的魂。别用大调音阶，会太「乖」。',
    tip: '在 C7–F7–G7 上整段糊一条 C 布鲁斯音阶，那个 ♭5 往 ♭7 解决的哭腔多练几遍。',
  },
  {
    id: 'ii-V-I',
    name: 'ii–V–I（jazz）',
    style: 'jazz',
    keyPc: 0,
    keyQuality: 'major',
    numerals: 'ii–V–I',
    chords: [
      { rootPc: 2, typeId: 'm7' },
      { rootPc: 7, typeId: 'dom7' },
      { rootPc: 0, typeId: 'maj7' },
    ],
    chordNumerals: ['ii', 'V', 'I'],
    globalScale: { scaleId: 'major', rootPc: 0 },
    perChordScale: ['dorian', 'mixolydian', 'lydian'],
    why: 'jazz 的回家路：Dm7（ii）→ G7（V，属七）→ Cmaj7（I）。整段顺阶于 C 大调，所以一个 C 大调音阶能兜住；但想更「高级」就每和弦换音阶：Dm7 上多利亚、G7 上混合利底亚、Cmaj7 上利底亚——正好把你刚加的三个调式用上。',
    tip: '先整段 C 大调走顺，再切「每和弦换音阶」，感受 Dm7 的亮 6、G7 的 ♭7、Cmaj7 的 #4 各自对味。',
  },
  {
    id: 'andalusian',
    name: 'Andalusian（弗拉门戈）',
    style: 'spanish / 金属',
    keyPc: 9,
    keyQuality: 'minor',
    numerals: 'i–VII–VI–V',
    chords: [
      { rootPc: 9, typeId: 'min' },
      { rootPc: 7, typeId: 'maj' },
      { rootPc: 5, typeId: 'maj' },
      { rootPc: 4, typeId: 'maj' },
    ],
    chordNumerals: ['i', 'VII', 'VI', 'V'],
    globalScale: { scaleId: 'minor', rootPc: 9 },
    perChordScale: ['minorPent', 'mixolydian', 'majorPent', 'phrygian'],
    why: 'Am–G–F–E，西班牙 / 弗拉门戈的暗色进行，也是金属 riff 的爱（如《让读者...》类段落）。它整段顺阶于 A 小调，父音阶用 A 自然小调；但那个收尾的 E 和弦上，换成 E 弗利几亚（把 ♭2 压上去）立刻有西班牙凶狠味——正好用上你刚加的弗利几亚。',
    tip: '扫弦走 Am–G–F–E，solo 时切「每和弦换音阶」，重点听 E 和弦上弗利几亚的 ♭2 有多「异域」。',
  },
]

/* ─────────────── 查询 / 文案辅助 ─────────────── */

export function typeOf(typeId: string): ChordType {
  return CHORD_TYPES.find((t) => t.id === typeId) ?? CHORD_TYPES[0]
}

/** 和弦的显示名，如 "Am"、"G7" */
export function jamChordName(c: JamChord): string {
  return chordName(c.rootPc, c.typeId)
}

export function jamChordTypeLabel(c: JamChord): string {
  return chordTypeLabel(c.typeId)
}

/** 父调标签，如 "C 大调 / A 小调" */
export function progressionKeyLabel(p: JamPreset): string {
  const main = `${LETTER_NAMES[p.keyPc]} ${p.keyQuality === 'major' ? '大调' : '小调'}`
  if (p.keyQuality === 'major') {
    const rel = LETTER_NAMES[(p.keyPc + 9) % 12]
    return `${main} / ${rel} 小调`
  }
  const rel = LETTER_NAMES[(p.keyPc + 3) % 12]
  return `${main} / ${rel} 大调`
}

/** 全局模式高亮的音阶（含公式，供 Fretboard 定位） */
export function globalScaleFor(p: JamPreset): { scaleId: string; rootPc: PitchClass; formula: number[] } {
  const def = SCALES.find((s) => s.id === p.globalScale.scaleId) ?? SCALES[0]
  return { scaleId: def.id, rootPc: p.globalScale.rootPc, formula: def.formula }
}

/** 每和弦换音阶模式下，第 idx 个和弦该用的音阶 id */
export function perChordScaleFor(p: JamPreset, idx: number): string {
  if (p.perChordScale?.[idx]) return p.perChordScale[idx]
  const c = p.chords[idx]
  const sug = scaleSuggestions(c.typeId)
  return sug[0]?.scaleId ?? 'minorPent'
}

/** 音阶中文名 */
export function scaleLabel(id: string): string {
  return SCALES.find((s) => s.id === id)?.label ?? id
}
