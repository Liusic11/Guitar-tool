/**
 * 音程在指板上的「距离形状」
 * ─────────────────────────────────────────────
 * 给定一个音程（半音数）和调弦，返回几个常用、好按的指板形状。
 * 每个形状描述：从某根弦的根音出发，「向下几弦、左右几品」就能找到目标音。
 *
 * 例如纯八度（12 半音）会返回：
 *   - 6 弦 → 4 弦，向右 2 品（用户提到的经典八度形状）
 *   - 5 弦 → 3 弦，向右 2 品
 *   - 4 弦 → 2 弦，向右 3 品（因 G-B 弦是大三度，偏移需 +1）
 *   - 6 弦 → 3 弦，向左 3 品
 * 等等。
 */

import type { Tuning } from './music'

export interface IntervalShape {
  /** 根音所在弦（6=最粗） */
  fromString: number
  /** 目标音所在弦 */
  toString: number
  /** 目标品 - 根音品（可正可负） */
  deltaFret: number
  /** 示例根音品（低把位） */
  rootFret: number
  /** 示例目标音品 */
  targetFret: number
  /** 人话说明：「下 2 弦，向右 2 品」 */
  caption: string
}

function openMidiOf(tuning: Tuning, stringNumber: number): number {
  return tuning.strings.find((s) => s.number === stringNumber)?.openMidi ?? 0
}

function shapeCaption(from: number, to: number, delta: number): string {
  const span = from - to
  const moveString = span === 1 ? '下 1 弦' : `下 ${span} 弦`
  const moveFret = delta === 0 ? '同品' : delta > 0 ? `向右 ${delta} 品` : `向左 ${-delta} 品`
  return `${from} 弦 → ${to} 弦：${moveString}，${moveFret}`
}

/**
 * 生成常用音程形状
 * @param semitones 音程半音数（1..12）
 * @param tuning 当前调弦
 * @param max 最多返回几个（默认 4，取最紧凑、最常用的）
 */
export function intervalShapes(semitones: number, tuning: Tuning, max = 4): IntervalShape[] {
  const candidates: IntervalShape[] = []

  // 跨弦上行形状：根音在粗弦，目标音在细弦（更高音）
  for (let from = 6; from >= 1; from--) {
    for (let to = from - 1; to >= 1; to--) {
      const span = from - to
      if (span > 3) continue // 只取近距形状，跨太多弦不常用
      const delta = semitones - (openMidiOf(tuning, to) - openMidiOf(tuning, from))
      if (Math.abs(delta) > 4) continue // 只取低把位能按的偏移

      // 找一个低把位示例，使根音和目标音都在 0..6 品内
      let rootFret = 3
      let targetFret = rootFret + delta
      if (targetFret < 0) {
        rootFret += -targetFret
        targetFret = 0
      } else if (targetFret > 6) {
        rootFret -= targetFret - 6
        targetFret = 6
      }
      if (rootFret < 0) continue

      candidates.push({
        fromString: from,
        toString: to,
        deltaFret: delta,
        rootFret,
        targetFret,
        caption: shapeCaption(from, to, delta),
      })
    }
  }

  // 同弦形状：半音数 <=7（纯五度）或 12（八度）比较常用，再大按不住
  if (semitones <= 7 || semitones === 12) {
    let rootFret = 3
    let targetFret = rootFret + semitones
    if (targetFret > 12) {
      rootFret -= targetFret - 12
      targetFret = 12
    }
    if (rootFret >= 0) {
      candidates.push({
        fromString: 6,
        toString: 6,
        deltaFret: semitones,
        rootFret,
        targetFret,
        caption: `同弦 6：向右 ${semitones} 品`,
      })
    }
  }

  // 排序：优先 |delta| 小的，其次跨弦少的，再次根音在粗弦的
  candidates.sort((a, b) => {
    const da = Math.abs(a.deltaFret)
    const db = Math.abs(b.deltaFret)
    if (da !== db) return da - db
    const sa = Math.abs(a.fromString - a.toString)
    const sb = Math.abs(b.fromString - b.toString)
    if (sa !== sb) return sa - sb
    return b.fromString - a.fromString
  })

  return candidates.slice(0, max)
}
