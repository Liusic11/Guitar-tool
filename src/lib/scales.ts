/**
 * 音阶数据与指板定位
 * ─────────────────────────────────────────────
 * 一份纯数据 + 两个定位函数，供 ScaleTrainer 复用 Fretboard / audioEngine。
 * 选的 7 个正好覆盖 funk / blues / jazz / rock：
 *   小调五声 + 布鲁斯 → blues / rock 主音地基
 *   自然大调 / 自然小调 → 通识
 *   多利亚 Dorian / 混合利底亚 Mixolydian → funk / jazz 的调式色彩
 */

import { type Tuning, type PitchClass, pitchClassOf } from './music'

export type ScaleCategory = 'pentatonic' | 'blues' | 'mode'

export interface ScaleDef {
  id: string
  /** 中文名 */
  label: string
  /** 缩写标记 */
  abbr: string
  /** 相对根音的半音集合（含 0 = 根音） */
  formula: number[]
  category: ScaleCategory
  /** 听感 / 色彩 */
  color: string
  /** 常见用法 / 你会在哪听到 */
  usage: string
  /** 老师口吻的乐理讲解 */
  theory: string
}

export const SCALES: ScaleDef[] = [
  {
    id: 'minorPent',
    label: '小调五声',
    abbr: 'min pent',
    formula: [0, 3, 5, 7, 10],
    category: 'pentatonic',
    color: '摇滚 / 蓝调的万能钥匙，怎么弹都不太难听',
    usage: 'blues、rock、pop 的 solo 主粮；几乎任何小调进行都能往上糊',
    theory:
      '「五声」= 5 个音，把大调音阶里最「刺」的两个音（4 级、7 级）拿掉，剩下 1·♭3·4·5·♭7。少掉冲突音，所以闭眼乱弹也和谐——这就是为什么它是一切主音即兴的起点。',
  },
  {
    id: 'blues',
    label: '布鲁斯',
    abbr: 'blues',
    formula: [0, 3, 5, 6, 7, 10],
    category: 'blues',
    color: '在小调五声里塞了一个「蓝调音」，一下就有了哭腔',
    usage: 'blues / funk / rock 的灵魂；那个 ♭5 是「蓝调音」',
    theory:
      '在小调五声的基础上加一个 ♭5（比纯五度低半音）——这个音不在大小调里，所以听起来「悬」、带点幽怨，叫 blue note。它是 blues 的魂，也是 jazz 爱玩的「外围音」。',
  },
  {
    id: 'majorPent',
    label: '大调五声',
    abbr: 'maj pent',
    formula: [0, 2, 4, 7, 9],
    category: 'pentatonic',
    color: '明亮、顺耳，乡村 / 流行最爱',
    usage: '大调歌曲的轻松 solo；和「小调五声」是同一套把位，只是换根音',
    theory:
      '大调版的五声音阶（1·2·3·5·6）。有趣的是：A 小调五声 = C 大调五声（共享音），所以你练熟小调五声后，把根音挪到关系大调，立刻就有大调五声可用。',
  },
  {
    id: 'major',
    label: '自然大调',
    abbr: '',
    formula: [0, 2, 4, 5, 7, 9, 11],
    category: 'mode',
    color: '最「标准」、最明亮，西方音乐的底色',
    usage: '大调歌曲旋律 / 主音；和弦跟音阶的接口',
    theory:
      '七个音全用上（1·2·3·4·5·6·7）。它是所有调式（Ionian）的妈妈——多利亚、混合利底亚都是它在某个音上「重新起算」得到的。先把这条音阶在指板上走顺，后面调式只是挪一下起点。',
  },
  {
    id: 'minor',
    label: '自然小调',
    abbr: '',
    formula: [0, 2, 3, 5, 7, 8, 10],
    category: 'mode',
    color: '比大调低沉、内敛',
    usage: '小调歌曲旋律 / 主音；ballad、民谣',
    theory:
      '大调音阶降 3、6、7 级得到（1·2·♭3·4·5·♭6·♭7）。它和大调是「关系大小调」——共享一套音，只是起始音不同。',
  },
  {
    id: 'dorian',
    label: '多利亚',
    abbr: 'Dorian',
    formula: [0, 2, 3, 5, 7, 9, 10],
    category: 'mode',
    color: '小调底子 + 一个亮晶晶的 6 级 → 又暗又 funky',
    usage: 'funk / jazz / fusion 的小调和弦上 solo 最常用',
    theory:
      '把自然小调的 6 级抬高半音（♭6→6），得到 1·2·♭3·4·5·6·♭7。它「小三度带亮六度」的配方，正好是 funk 和 minor 7 和弦上的经典色彩——想让小调 solo 不那么悲，就上多利亚。',
  },
  {
    id: 'mixolydian',
    label: '混合利底亚',
    abbr: 'Mixo',
    formula: [0, 2, 4, 5, 7, 9, 10],
    category: 'mode',
    color: '大调底子 + 一个 ♭7 → 亮里带点放克张力',
    usage: '属七和弦（dom7）上 solo 的指定音阶；rock / funk riff',
    theory:
      '把自然大调的 7 级降半音（7→♭7），得到 1·2·3·4·5·6·♭7。它和大调几乎一样，只差那个 ♭7——而这正是属七和弦的张力来源。所以「在属七上 solo」= 混合利底亚，记住这一条就通了。',
  },
]

export interface ScaleNote {
  string: number
  fret: number
  midi: number
  pc: PitchClass
  /** 在 formula 里的下标，0 = 根音 */
  degree: number
}

/** 根音 + 公式 → 该音阶包含的音级集合 */
export function scalePitchClasses(rootPc: PitchClass, formula: number[]): Set<PitchClass> {
  return new Set(formula.map((iv) => (((rootPc + iv) % 12) + 12) % 12))
}

/** 在指板 [lo,hi] 范围内找出属于该音阶的所有位置，并按音级标注 */
export function scalePositions(
  tuning: Tuning,
  rootPc: PitchClass,
  formula: number[],
  fretRange: readonly [number, number],
): ScaleNote[] {
  const pcs = scalePitchClasses(rootPc, formula)
  const [lo, hi] = fretRange
  const out: ScaleNote[] = []
  for (const s of tuning.strings) {
    for (let f = lo; f <= hi; f++) {
      const midi = s.openMidi + f
      const pc = pitchClassOf(midi)
      if (pcs.has(pc)) {
        const degree = formula.findIndex((iv) => (((rootPc + iv) % 12) + 12) % 12 === pc)
        out.push({ string: s.number, fret: f, midi, pc, degree })
      }
    }
  }
  return out
}

/** 一个可弹奏的规范把位（五声=5 个 CAGED 形状 / 七声=7 个位置之一） */
export interface ScaleBox {
  lo: number
  hi: number
  notes: ScaleNote[]
  /** 该把位锚点（6 弦最低音）对应的音级半音偏移；0 = 根音 */
  anchorDegree: number
  /** 五声 / 布鲁斯的 CAGED 形状名（E/D/C/A/G）；七声音阶为 undefined */
  shapeName?: 'E' | 'D' | 'C' | 'A' | 'G'
  /** 是否根音把位（主形状 / 主位置） */
  isRoot: boolean
}

/**
 * A 参考根音（6 弦 5 品）下的 5 个 CAGED 小调五声形状，用绝对品位书写。
 * 之后按根音在 6 弦上的实际品位整体平移（delta）即可套到任意根音。
 * 这正是吉他教学里「五声 5 形状」的标准展开：E‑D‑C‑A‑G 彼此咬合覆盖全琴颈，
 * 而不是按数学切窗、一格一格往后挪。
 */
const MINOR_PENT_CAGED: { name: 'E' | 'D' | 'C' | 'A' | 'G'; pairs: [number, number][] }[] = [
  { name: 'E', pairs: [[6, 5], [6, 8], [5, 5], [5, 7], [4, 5], [4, 7], [3, 5], [3, 7], [2, 5], [2, 8], [1, 5], [1, 8]] },
  { name: 'D', pairs: [[6, 8], [6, 10], [5, 7], [5, 9], [4, 7], [4, 9], [3, 7], [3, 9], [2, 8], [2, 10], [1, 8], [1, 10]] },
  { name: 'C', pairs: [[6, 10], [6, 12], [5, 10], [5, 12], [4, 9], [4, 12], [3, 10], [3, 12], [2, 10], [2, 12], [1, 10], [1, 12]] },
  { name: 'A', pairs: [[6, 12], [6, 15], [5, 12], [5, 14], [4, 12], [4, 14], [3, 12], [3, 15], [2, 12], [2, 15], [1, 12], [1, 15]] },
  { name: 'G', pairs: [[6, 3], [5, 2], [5, 5], [4, 2], [4, 5], [3, 2], [3, 4], [2, 3], [2, 5], [1, 3], [1, 5]] },
]

/** 6 弦上根音所在的品位；空弦根音取 12 品八度，保证所有把位都可移动 */
function rootOnSixthFret(tuning: Tuning, rootPc: PitchClass): number {
  const sixth = tuning.strings.find((s) => s.number === 6)
  if (!sixth) return 5
  const basePc = ((sixth.openMidi % 12) + 12) % 12
  const fret = (((rootPc - basePc) % 12) + 12) % 12 // 0..11
  return fret === 0 ? 12 : fret
}

/**
 * 生成音阶的「规范把位」，按吉他常用逻辑展开：
 *   · 五声 / 布鲁斯（5~6 个音）→ 5 个 CAGED 形状（E‑D‑C‑A‑G），
 *     用上面写死的模板按根音平移得到，彼此咬合、覆盖全琴颈；布鲁斯会带上蓝调音 ♭5。
 *   · 七声音阶 / 调式（7 个音）→ 每个音级在 6 弦上的品位作锚取 5 品窗口，
 *     即标准的「7 个位置」系统。
 * 所有把位都按最低品位（脖子顺序，从 0 品往上）升序排列，
 * 导航「上一个 / 下一个」就是顺着琴颈从琴枕爬到高把位。
 */
export function scaleBoxes(
  tuning: Tuning,
  rootPc: PitchClass,
  formula: number[],
  maxFret = 15,
): ScaleBox[] {
  const sixth = tuning.strings.find((s) => s.number === 6)
  if (!sixth) return []

  // ── 五声 / 布鲁斯：CAGED 5 形状 ──
  if (formula.length <= 6) {
    const delta = rootOnSixthFret(tuning, rootPc) - 5
    const boxes: ScaleBox[] = []
    for (const shape of MINOR_PENT_CAGED) {
      // 模板里的绝对品位平移到目标根音，得到这个形状的纵向范围
      const transposed = shape.pairs
        .map(([string, ref]) => ({ string, fret: ref + delta }))
        .filter((p) => p.fret >= 0 && p.fret <= maxFret)
      if (transposed.length === 0) continue
      const lo = Math.min(...transposed.map((p) => p.fret))
      const hi = Math.max(...transposed.map((p) => p.fret))
      // 在该范围内取音阶全部音（布鲁斯会自动带上蓝调音 ♭5）
      const notes = scalePositions(tuning, rootPc, formula, [lo, hi])
      if (notes.length === 0) continue
      boxes.push({ lo, hi, notes, anchorDegree: 0, shapeName: shape.name, isRoot: shape.name === 'E' })
    }
    boxes.sort((a, b) => a.lo - b.lo)
    return boxes
  }

  // ── 七声音阶 / 调式：7 个位置（3NPS 风格）──
  const basePc = ((sixth.openMidi % 12) + 12) % 12
  const all = scalePositions(tuning, rootPc, formula, [0, maxFret])
  const span = 4 // 5 品窗口
  const starts = formula
    .map((iv) => {
      const pc = (((rootPc + iv) % 12) + 12) % 12
      let fret = (((pc - basePc) % 12) + 12) % 12
      if (fret === 0) fret = 12
      return { iv, fret }
    })
    .sort((a, b) => a.fret - b.fret)

  const seen = new Set<number>()
  const boxes: ScaleBox[] = []
  for (const { iv, fret } of starts) {
    if (seen.has(fret)) continue
    seen.add(fret)
    const lo = fret
    const hi = Math.min(maxFret, fret + span)
    const notes = all.filter((n) => n.fret >= lo && n.fret <= hi)
    if (notes.length < 1) continue
    boxes.push({ lo, hi, notes, anchorDegree: iv, isRoot: iv === 0 })
  }
  boxes.sort((a, b) => a.lo - b.lo)
  return boxes
}

/* ════════════════ 模进（Patterns / Sequences）═══════════════
 * 把当前把位里的音阶音排成一条「造句」路线——这是把音阶词汇
 * 变成能脱口而出的乐句的关键，也是面向 jam / 创作的内化层练习。
 */

export type PatternId = 'seq3' | 'octave' | 'arp' | 'blues'

export interface PatternDef {
  id: PatternId
  label: string
  /** 老师口吻：这个模进练什么、为什么有用 */
  tip: string
}

export const PATTERNS: PatternDef[] = [
  {
    id: 'seq3',
    label: '3 音一组',
    tip: '把音阶切成 3 个音一组、逐组往上叠（1-2-3 / 2-3-4 / 3-4-5…）。这是吉他手最基础的「模进」，练的是手指在把位里连续流动，而不是死背形状。',
  },
  {
    id: 'octave',
    label: '八度跳',
    tip: '每个音后面接它高八度的同一个音（在原把位里通常是换一根弦）。练八度跳能让你「看见」把位里音的镜像关系，solo 一下子就宽了。',
  },
  {
    id: 'arp',
    label: '琶音',
    tip: '只弹和弦音（根音·3 音·5 音·7 音），上行再下行。琶音是「为什么这个音阶能配这个和弦」的答案——你把和弦拆开弹，耳朵就懂了调。',
  },
  {
    id: 'blues',
    label: 'Blues 乐句',
    tip: '一条锚定在根音把位（E 形）的小蓝调乐句骨架：根音→♭3→根音→4→♭7→5→… 先把这条「说话的句式」弹顺，即兴时就知道往哪走了。',
  },
]

/** 去重：同一音高只留一个位置（取较低把位），按音高升序 */
function uniqueAscending(positions: ScaleNote[]): ScaleNote[] {
  const byMidi = new Map<number, ScaleNote>()
  for (const n of positions) {
    const existing = byMidi.get(n.midi)
    if (!existing || n.fret < existing.fret) byMidi.set(n.midi, n)
  }
  return [...byMidi.values()].sort((a, b) => a.midi - b.midi)
}

const CHORD_TONE_SEMIS = [0, 3, 4, 5, 7, 10, 11]

/**
 * 把当前把位里的音阶音排成一条「模进」路线。
 * 任何把位都能生成；规模太小则回退到直线升序，保证永远有得练。
 */
export function scalePattern(
  positions: ScaleNote[],
  formula: number[],
  patternId: PatternId,
): ScaleNote[] {
  const a = uniqueAscending(positions)
  if (a.length < 3) return a

  if (patternId === 'seq3') {
    const seq: ScaleNote[] = []
    for (let i = 0; i + 2 < a.length; i++) {
      seq.push(a[i], a[i + 1], a[i + 2])
    }
    return seq.length >= 3 ? seq : a
  }

  if (patternId === 'octave') {
    const seq: ScaleNote[] = []
    for (const n of a) {
      seq.push(n)
      const partner = positions.find((m) => m.degree === n.degree && m.midi === n.midi + 12)
      if (partner) seq.push(partner)
    }
    return seq
  }

  if (patternId === 'arp') {
    const arp = uniqueAscending(positions.filter((n) => CHORD_TONE_SEMIS.includes(formula[n.degree])))
    if (arp.length < 3) return a
    return [...arp, ...arp.slice().reverse().slice(1)]
  }

  // blues 乐句：仅在小调五声 / 布鲁斯上做完整腔调，否则回退 3 音一组
  const hasBluesSkeleton = [0, 3, 5, 7, 10].every((s) => formula.includes(s))
  if (patternId === 'blues') {
    if (!hasBluesSkeleton) return scalePattern(positions, formula, 'seq3')
    const order = [0, 3, 0, 5, 10, 7, 5, 3, 0]
    const lick: ScaleNote[] = []
    for (const s of order) {
      const cand = positions
        .filter((n) => formula[n.degree] === s)
        .sort((x, y) => x.midi - y.midi)
      if (cand.length) lick.push(cand[0])
    }
    return lick.length >= 4 ? lick : a
  }

  return a
}
