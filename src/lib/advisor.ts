/**
 * 即兴参谋（Improviser's Desk）· 计算引擎
 * ─────────────────────────────────────────────
 * 回答「现在该弹哪些音、往哪落」：
 *   · 落点（target）——当前和弦的和弦音（1 3 5…），句尾落在这里就稳
 *   · 逼近音（approach）——调内的 7 / 4 级，「想回家」的音，可当跳板（7→1、4→3 两条故事线）
 *   · 递进：3 音（只落和弦音）→ 5 音（+五声）→ 7 音（+逼近音，全音阶）→ 全放开
 *
 * 纯确定性计算，不调 LLM：和弦音来自 chords.ts 的 formula，
 * 音阶音来自 scales.ts 的 formula，逼近音就是音阶的第 7 / 第 4 级。
 */

import { CHORD_TYPES, type ChordType } from './chords'
import { LETTER_NAMES, type PitchClass, type Tuning } from './music'

/** 参谋递进层级：0 = 关（保持原「全部音阶音」），3 / 5 / 7 / 'all' 为精选层 */
export type AdvisorLevel = 0 | 3 | 5 | 7 | 'all'

export interface AdvisorChord {
  rootPc: PitchClass
  typeId: string
}

/** 大调 / 自然小调的全音阶公式（7 个音） */
export const KEY_SCALE_FORMULA: Record<'major' | 'minor', number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

/** 大调 / 小调五声音阶公式（5 个音） */
export const PENT_FORMULA: Record<'major' | 'minor', number[]> = {
  major: [0, 2, 4, 7, 9],
  minor: [0, 3, 5, 7, 10],
}

function chordTypeOf(typeId: string): ChordType {
  return CHORD_TYPES.find((t) => t.id === typeId) ?? CHORD_TYPES[0]
}

/** 当前和弦的和弦音 pitch class 集合（如 C 大三 → {0,4,7}） */
export function chordTonePcs(chord: AdvisorChord): Set<PitchClass> {
  const type = chordTypeOf(chord.typeId)
  return new Set(type.formula.map((iv) => (((chord.rootPc + iv) % 12) + 12) % 12))
}

/** 调的五声音阶 pitch class 集合 */
export function keyPentPcs(keyPc: PitchClass, keyQuality: 'major' | 'minor'): Set<PitchClass> {
  const formula = PENT_FORMULA[keyQuality]
  return new Set(formula.map((iv) => (((keyPc + iv) % 12) + 12) % 12))
}

/** 调的七声音阶 pitch class 集合 */
export function keyScalePcs(keyPc: PitchClass, keyQuality: 'major' | 'minor'): Set<PitchClass> {
  const formula = KEY_SCALE_FORMULA[keyQuality]
  return new Set(formula.map((iv) => (((keyPc + iv) % 12) + 12) % 12))
}

/** 逼近音（调内 7 级 / 4 级）的 pitch class；音阶不满 7 个音时缺省为空 */
export function approachPcs(keyPc: PitchClass, keyQuality: 'major' | 'minor'): Set<PitchClass> {
  const formula = KEY_SCALE_FORMULA[keyQuality]
  const out = new Set<PitchClass>()
  for (const idx of [6, 3]) {
    if (idx < formula.length) out.add(((keyPc + formula[idx]) % 12 + 12) % 12)
  }
  return out
}

/** 半音间隔 → 级数标签（与乐句库同一套：♭2、♭3…） */
export const DEGREE_LABEL: Record<number, string> = {
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

function degreeLabel(pc: PitchClass, keyPc: PitchClass): string {
  const iv = ((pc - keyPc) % 12 + 12) % 12
  return DEGREE_LABEL[iv] ?? String(iv)
}

/* ───────────────────────── 参谋高亮 ───────────────────────── */

export interface AdvisorHighlightInput {
  tuning: Tuning
  level: AdvisorLevel
  chord: AdvisorChord
  keyPc: PitchClass
  keyQuality: 'major' | 'minor'
  /** 「就近」窗口：窗口内落点用大号 target，窗口外同一批落点用弱化 secondary */
  window: readonly [number, number]
  fretRange: readonly [number, number]
}

/**
 * 按递进层级生成指板高亮：
 *   3 音 —— 只有和弦音：近窗 target，远八度 secondary（弱标，熟练后可跨八度跳）
 *   5 音 —— 和弦音(target) + 五声另两个音(accent)
 *   7 音 —— 全音阶：和弦音(target) + 4/7 级(approach) + 其余(secondary)
 *   all  —— 与 7 音同渲染（全音阶），语义是「全放开 + 乐句」
 */
export function advisorHighlights(input: AdvisorHighlightInput): { string: number; fret: number; kind: 'target' | 'secondary' | 'accent' | 'approach' }[] {
  const { tuning, level, chord, keyPc, keyQuality, window: [wLo, wHi], fretRange } = input
  if (level === 0) return []

  const chordTones = chordTonePcs(chord)
  const pent = keyPentPcs(keyPc, keyQuality)
  const full = keyScalePcs(keyPc, keyQuality)
  const approach = approachPcs(keyPc, keyQuality)

  /** 每个 pitch class 的渲染方式；null = 不显示 */
  const kindOf = (pc: PitchClass): 'target' | 'secondary' | 'accent' | 'approach' | null => {
    if (chordTones.has(pc)) return 'target'
    if (level === 3) return null // 3 音：只落和弦音
    if (level === 5) return pent.has(pc) ? 'accent' : null // 5 音：+五声另两个
    // 7 / all：全音阶
    if (approach.has(pc)) return 'approach'
    return 'secondary'
  }

  const out: { string: number; fret: number; kind: 'target' | 'secondary' | 'accent' | 'approach' }[] = []
  const [lo, hi] = fretRange
  for (const s of tuning.strings) {
    for (let f = lo; f <= hi; f++) {
      const pc = (((s.openMidi + f) % 12) + 12) % 12
      if (level === 3) {
        if (!chordTones.has(pc)) continue
        out.push({ string: s.number, fret: f, kind: f >= wLo && f <= wHi ? 'target' : 'secondary' })
        continue
      }
      if (level === 5) {
        // 落点（和弦音）必须保留——即使某个和弦音不在五声里（如 F 的根音），也不能消失
        const isChordTone = chordTones.has(pc)
        if (!isChordTone && !pent.has(pc)) continue
        out.push({
          string: s.number,
          fret: f,
          kind: isChordTone ? (f >= wLo && f <= wHi ? 'target' : 'secondary') : 'accent',
        })
        continue
      }
      // 7 / all：全音阶
      if (!full.has(pc)) continue
      const k = kindOf(pc)
      if (k === null) continue
      if (k === 'target') {
        out.push({ string: s.number, fret: f, kind: f >= wLo && f <= wHi ? 'target' : 'secondary' })
      } else {
        out.push({ string: s.number, fret: f, kind: k })
      }
    }
  }
  return out
}

/* ───────────────────────── 故事线与示范 ───────────────────────── */

export interface StoryPair {
  /** 出发点（如 7 级） */
  from: { pc: PitchClass; degree: string }
  /** 落点（如 1 级） */
  to: { pc: PitchClass; degree: string }
}

export interface AdvisorStory {
  /** 两条「回家」故事线（7 级→1 级、4 级→3 级）；showPairs=false 或和弦带七音时为 [] */
  pairs: StoryPair[]
  /** 一句话提示 */
  line: string
}

/**
 * 当前和弦 + 调 → 故事线。
 * 7 级→1 级、4 级→3 级：从「想回家」的音滑向稳定音。
 * 约束：
 *   · showPairs=false（3/5 音还没显示 4、7）时不讲故事线，只讲落点；
 *   · 和弦带七音（如 C7）时 7 级音反而是刺耳音，不讲故事线，只讲落点（根音 / 三音）。
 */
export function advisorStory(
  keyPc: PitchClass,
  keyQuality: 'major' | 'minor',
  chord: AdvisorChord,
  showPairs: boolean,
): AdvisorStory {
  const formula = KEY_SCALE_FORMULA[keyQuality]
  const pcOf = (idx: number) => (((keyPc + formula[idx]) % 12) + 12) % 12

  // 落点提纯：根音与三音（句尾最稳的两个落点）
  const root = pcOf(0)
  const third = pcOf(2)

  const pairs: StoryPair[] = []
  const isTriad = chordTypeOf(chord.typeId).formula.length <= 3
  if (showPairs && isTriad && formula.length >= 7) {
    const seven = pcOf(6)
    const four = pcOf(3)
    pairs.push(
      { from: { pc: seven, degree: degreeLabel(seven, keyPc) }, to: { pc: root, degree: degreeLabel(root, keyPc) } },
      { from: { pc: four, degree: degreeLabel(four, keyPc) }, to: { pc: third, degree: degreeLabel(third, keyPc) } },
    )
  }

  const chordName = `${LETTER_NAMES[chord.rootPc]}${chordTypeOf(chord.typeId).abbr}`
  const rootName = LETTER_NAMES[root]
  const thirdName = LETTER_NAMES[third]

  const line =
    pairs.length >= 2
      ? `在 ${chordName} 上：${LETTER_NAMES[pairs[0].from.pc]}(${pairs[0].from.degree})→${LETTER_NAMES[pairs[0].to.pc]}(${pairs[0].to.degree})、${LETTER_NAMES[pairs[1].from.pc]}(${pairs[1].from.degree})→${LETTER_NAMES[pairs[1].to.pc]}(${pairs[1].to.degree}) 是两条回家的路。句尾落在 ${rootName} 或 ${thirdName} 最稳。`
      : `在 ${chordName} 上：句尾落在根音 ${rootName} 或三音 ${thirdName} 最稳。`

  return { pairs, line }
}

/** 每个 pitch class 的最小可用 midi（找 [lo,hi] 内 5 弦优先的最低位）——给示范播放取音 */
export function closestMidiForPc(tuning: Tuning, pc: PitchClass, fretRange: readonly [number, number]): number | null {
  const [lo, hi] = fretRange
  for (const s of tuning.strings) {
    for (let f = lo; f <= hi; f++) {
      const midi = s.openMidi + f
      if ((((midi % 12) + 12) % 12) === pc) return midi
    }
  }
  return null
}
