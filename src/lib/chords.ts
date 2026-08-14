/**
 * 和弦库 + 指法生成器
 * ─────────────────────────────────────────────
 * 不依赖任何手写把位表：给定「根音 + 和弦类型」，用「可移动横按把位」思路
 * 自动生成指法——根音落在 6 弦或 5 弦（或 4 弦），取其最低、且能覆盖最多弦的把位。
 * 同时支持「开放把位（0 品）」生成，让同一和弦可以在多种把位间切换。
 * 任意 12 个根音 × 任意类型（含减七 / 半减七 / 增 / 减）都能一键得到。
 */

import { pitchClassOf, pitchClassAt, type PitchClass, type Tuning } from './music'

export type ChordCategory = 'triad' | 'seventh'

export type ChordPosition = 'auto' | 'open' | 'root6' | 'root5' | 'root4' | 'g' | 'c'

export interface ChordType {
  /** 稳定 id */
  id: string
  /** 中文名 */
  label: string
  /** 和弦标记，如 "" / "m" / "7" / "m7" / "maj7" / "m7b5" / "dim7" / "dim" / "aug" */
  abbr: string
  /** 相对根音的半音间隔（三度叠置的结果） */
  formula: number[]
  category: ChordCategory
  /** 三度叠置描述 */
  stack: string
  /** 听感 / 色彩 */
  color: string
  /** 常见用法 */
  usage: string
  /** 为什么叫这个名字（乐理讲解，老师口吻 + 类比） */
  theory: string
  /** 你会在哪些歌 / 风格里听到它（以歌带练的锚点） */
  songs: string
  /** 一句话记忆钩子 */
  remember: string
  /** 一个耳朵练习小任务 */
  ear: string
}

export const CHORD_TYPES: ChordType[] = [
  {
    id: 'maj',
    label: '大三和弦',
    abbr: '',
    formula: [0, 4, 7],
    category: 'triad',
    stack: '根音 + 大三度 + 小三度（从根音隔一个音叠两层）',
    color: '明亮、稳定，像一句话的句号，音乐里的「回家」',
    usage: '几乎所有风格的根基；大调歌曲的主和弦（I 级）',
    theory:
      '「三和弦」= 从根音出发，每隔一个音叠一层：根音 → 三音 → 五音，叠了两层三度，所以叫「三」和弦。大三和弦的三音离根音是「大三度」（4 个半音），听感亮、稳，像你说话时语气往上的那个字。记住：大调的 I 级、IV 级都是它，所以你听到「明亮又落地」多半是它。',
    songs: '流行歌的绝对主角。C→Am→F→G 这种进行里，C 和 F 都是大三；你听《Hotel California》开头、《平凡之路》副歌里都有它撑着。',
    remember: '记法：大三 = 「亮」。大调的 I 级、IV 级都是它；公式 0·4·7。',
    ear: '耳朵练习：弹 C 大三，记住这个「晴天的亮」；下一关去对比 Cm，先听出情绪差别，再去找那个暗下去的三音（从 E 降到 E♭）。',
  },
  {
    id: 'min',
    label: '小三和弦',
    abbr: 'm',
    formula: [0, 3, 7],
    category: 'triad',
    stack: '根音 + 小三度 + 大三度',
    color: '忧伤、柔和，像阴天',
    usage: '小调歌曲主和弦；ballad / blues 常用',
    theory:
      '叠法完全一样，只是三音离根音只差「小三度」（3 个半音），整体就暗下来了。同一个根音，大三很亮、小三就忧伤——差别全在那个三音，记住这一根弦你就懂了大小调。小调的 i 级、iv 级、v 级都是它。',
    songs: '小调的魂：Am、Em、Dm 在流行/摇滚里到处都是。《Let It Be》里有 Am，《Bad Moon Rising》用小调营造那股不安。',
    remember: '记法：小三 = 「暗」。公式 0·3·7，比大三少了那 1 个半音（4→3）。',
    ear: '耳朵练习：弹 C 大三再弹 Cm，闭眼听——哪个音「沉」下去了？就是三音从 E 降到了 E♭（降半音）。这就是大小调情绪分水岭。',
  },
  {
    id: 'dom7',
    label: '属七和弦',
    abbr: '7',
    formula: [0, 4, 7, 10],
    category: 'seventh',
    stack: '大三 + 小三 + 小三（叠到七度）',
    color: '带一股「没说完、想往下走」的张力',
    usage: 'blues / funk / rock 的核心；V 级和弦制造推进感',
    theory:
      '在三和弦上「再叠一层三度」就到了七音 → 4 个音，所以叫「七」和弦。属七 = 大三 + 小七度（♭7）。那个 ♭7 制造一股「想解决」的拉力，是 blues 的发动机——它不停在说「跟我走，还没完」。在调里它永远是 V 级（比如 C 大调里的 G7），最想回到主和弦。',
    songs: 'blues 的 12 小节里每个和弦几乎都是属七；funk 的招牌。《Sweet Home Chicago》《Superstition》(Stevie Wonder) 的 riff 全是它。',
    remember: '记法：属七 = 「想解决」。公式 0·4·7·10，盯住那个 ♭7（10）。它是 V 级，永远想回 I。',
    ear: '耳朵练习：弹 G7 停在 ♭7（B♭），再弹 G 大三——感受 ♭7 像在拽你往 C 走。这就是 V→I 解决的味道，funk/blues 的灵魂。',
  },
  {
    id: 'm7',
    label: '小七和弦',
    abbr: 'm7',
    formula: [0, 3, 7, 10],
    category: 'seventh',
    stack: '小三 + 大三 + 小三',
    color: '柔和、松弛，有 groove',
    usage: 'jazz / soul / funk 的主料；小调的 ii、V',
    theory:
      '小三和弦 + 小七度。比属七温柔太多了，没有那种急着解决的冲动，松松的、能一直 loop。jazz 和 soul 里几乎每一小节都有它，是「放松」的声音。它常出现在小调的 ii 级（比如 Dm7）和很多 funk 的重复进行里。',
    songs: 'jazz 标准曲《Autumn Leaves》《So What》(Miles Davis) 满是小七；funk 的《Chameleon》全程靠它。',
    remember: '记法：小七 = 「松弛」。公式 0·3·7·10，和属七比只是三音暗了一点（4→3）。',
    ear: '耳朵练习：对比 G7（属七，紧）和 Gm7（松）——记住这种「松」就是 funk/jazz 的底色。',
  },
  {
    id: 'maj7',
    label: '大七和弦',
    abbr: 'maj7',
    formula: [0, 4, 7, 11],
    category: 'seventh',
    stack: '大三 + 小三 + 大三',
    color: '温暖、梦幻、像「不想落地」',
    usage: 'jazz / city pop / bossa；大调的 I、IV',
    theory:
      '大三和弦 + 大七度（自然七度）。那个大七度带来一种温柔悬停感——美好但不想结束，是 city pop、bossa、现代流行的招牌色彩。注意它和属七只差半音（7 音是 B 还是 B♭），但情绪天差地别：maj7 是「甜」，dom7 是「想走」。',
    songs: 'city pop《Plastic Love》、bossa《The Girl From Ipanema》、周杰伦《晴天》副歌里都有 maj7 的甜。',
    remember: '记法：大七 = 「甜/梦幻」。公式 0·4·7·11，注意 11 那个大七度（比属七的 ♭7 高半音）。',
    ear: '耳朵练习：弹 Cmaj7 听那个 7 音（B）有多「甜」，再和 C7 的 ♭7（B♭）比——半音之差，情绪天壤。',
  },
  {
    id: 'm7b5',
    label: '半减七和弦',
    abbr: 'm7♭5',
    formula: [0, 3, 6, 10],
    category: 'seventh',
    stack: '小三 + 小三 + 大三',
    color: '晦暗、带悬疑',
    usage: 'jazz 的 ii–V–I 里 ii 级（如 Dm7♭5 → G7 → Cmaj7）',
    theory:
      '把小七和弦的五音降半音（♭5），就得到半减七。之所以叫「半减」，是因为它只把五度减了，七度还是小七——所以和「全减七(dim7)」区分开。它常出现在 jazz 进行里，负责把气氛往下拽一点，是 ii–V–I 里那个悬疑的 ii 级。',
    songs: 'jazz 进行 Dm7♭5 → G7 → Cmaj7 是教科书级开头；听《Stella By Starlight》。',
    remember: '记法：半减 = 「只减了五度」。公式 0·3·6·10。',
    ear: '耳朵练习：先听 Dm7，再把五音降半音变成 Dm7♭5——那一丝「晦暗悬疑」就是 ♭5。',
  },
  {
    id: 'dim7',
    label: '减七和弦',
    abbr: 'dim7',
    formula: [0, 3, 6, 9],
    category: 'seventh',
    stack: '全小三度（四个音全是小三度间隔）',
    color: '极度紧张、对称、悬疑',
    usage: '过渡 / 离调；恐怖、悬疑配乐',
    theory:
      '四个音全是小三度（0·3·6·9），完全对称。妙处在于：任意一个音都能当根音，所以一个 dim7 指法能「转位」出 4 个不同根的减七。它极不稳定，最适合当过渡桥或离调的踏板——你听到它就该意识到「要转弯 / 要离调了」。',
    songs: '古典和爵士的「连接桥」；恐怖/悬疑配乐常用。听 Bach 里的 dim7，或《Girl From Ipanema》的过渡。',
    remember: '记法：减七 = 「全对称、最紧张」。一个把位 = 4 个根。',
    ear: '耳朵练习：弹一个 dim7，挨个把它当根音重新命名——音色居然一样！这就是对称和弦的诡异之处。',
  },
  {
    id: 'dim',
    label: '减三和弦',
    abbr: 'dim',
    formula: [0, 3, 6],
    category: 'triad',
    stack: '小三 + 小三',
    color: '紧张、导向性强',
    usage: '经过和弦；古典 / 爵士过渡',
    theory:
      '三度叠置里三音、五音都用小三度。比小三和弦还暗一截，常当「踏板」踩向稳定和弦——你听到它就知道「要转弯了」。常见用法是摆在属和弦前面当铺垫（比如 Bdim → G7）。',
    songs: '古典过渡、爵士过门常用。比如走向 G7 之前常先来个 Bdim 当铺垫。',
    remember: '记法：减三 = 「更暗的小三」。公式 0·3·6。',
    ear: '耳朵练习：听 Bdim → G7 → C——dim 像上楼梯前的一个踉跄，紧接着就稳了。',
  },
  {
    id: 'aug',
    label: '增三和弦',
    abbr: 'aug',
    formula: [0, 4, 8],
    category: 'triad',
    stack: '大三 + 大三',
    color: '悬疑、上浮、不确定',
    usage: '转向关系远调；电影配乐',
    theory:
      '三音、五音都用大三度（0·4·8），对称结构。听感像「悬在半空、上不去下不来」，常用来制造离调或梦幻感，很适合电影里那种「要变天了」的瞬间。它和全音阶是绝配。',
    songs: 'Jimmy Page 的《Oh, Pretty Woman》riff 里有 aug；悬疑/科幻配乐常用它。',
    remember: '记法：增三 = 「上浮、不确定」。公式 0·4·8。',
    ear: '耳朵练习：弹 Caug 听那个五音（C♯）有多「飘」，它随时能滑去别的和弦。',
  },
]

export interface VoicingNote {
  /** 弦号 6..1 */
  string: number
  /** 实际品位 */
  fret: number
  /** 手指号 1..4；空弦 / 闷音为 null */
  finger: number | null
  muted: boolean
  isRoot: boolean
  /** 空弦（fret === 0） */
  open: boolean
}

export interface Voicing {
  /** 横按把位（0 = 开放把位 / 无横按） */
  baseFret: number
  /** 根音所在弦 */
  rootString: number
  hasBarre: boolean
  /** 按弦顺序 6→1，长度 6 */
  notes: VoicingNote[]
}

export interface VoicingOption {
  voicing: Voicing
  position: ChordPosition
  label: string
  shortLabel: string
}

/** 把位窗口大小：baseFret .. baseFret + WINDOW 共 4 个品格 */
const WINDOW = 3

const ROOT_STRING_NAMES: Record<number, string> = {
  6: 'E 形横按',
  5: 'A 形横按',
  4: 'D 形横按',
}

/* ─────────────── CAGED 补全：G 形 / C 形 ───────────────
 * 标准可移动 CAGED 五形状里，E/A/D 是「根音在窗口低端」的横按形，
 * 而 G 形（开放 G：3-2-0-0-0-3）与 C 形（开放 C：x-3-2-0-1-0）的
 * 特点是部分音落在根音品位**之下**（比根音低 1~3 品），这是旧算法
 * 的 [base, base+3] 窗口永远生成不出来的，所以此前只给了 4 个候选。
 *
 * 这里用「偏移模板 + 就近取和弦音」实现：每根弦按模板的偏移算出理想品位，
 * 再在 ±2 品窗口里取离理想品位最近的**真实和弦音**。这样任意和弦类型
 * （大/小/七/半减/减/增）都能得到保形的移动把位，且每个音都保证是
 * 该和弦的和弦音（确定性、不自创体系）。
 *
 *  G 形（根音落 6 弦，如 A 大 = 5-4-2-2-2-5）：
 *    三和弦：6=r  5=r-1(3度)  4=r-3(5度)  3=r-3(根)  2=r-3(3度)  1=r(根)
 *    七和弦：1 弦改成 7 音（r-2），如 G7 = 3-2-0-0-0-1
 *  C 形（根音落 5 弦，6 弦闷音，如 D 大 = x-5-4-2-3-2）：
 *    三和弦：5=r  4=r-1(3度)  3=r-3(5度)  2=r-2(根)  1=r-3(3度)
 *    七和弦：3 弦改成 7 音（r+0），如 C7 = x-3-2-3-1-0
 */
interface ShapeTemplate {
  position: ChordPosition
  rootString: number
  label: string
  /** 每根弦（6→1）相对根音品位的偏移；null = 闷音 */
  triad: (number | null)[]
  seventh: (number | null)[]
}

const CAGED_SHAPES: ShapeTemplate[] = [
  {
    position: 'g',
    rootString: 6,
    label: 'G 形',
    triad: [0, -1, -3, -3, -3, 0],
    seventh: [0, -1, -3, -3, -3, -2],
  },
  {
    position: 'c',
    rootString: 5,
    label: 'C 形',
    triad: [null, 0, -1, -3, -2, -3],
    seventh: [null, 0, -1, 0, -2, -3],
  },
]

/**
 * 生成 CAGED G/C 形的把位：每根弦按模板偏移取理想品位，
 * 在 ±2 品窗口内找离它最近的和弦音（保证每个音都是真实和弦音）。
 * 找不到就闷音；根音缺失或发声弦太少则整体判为不可用。
 */
function buildCagedVoicing(
  rootPc: PitchClass,
  type: ChordType,
  tuning: Tuning,
  template: ShapeTemplate,
  baseFret: number,
): Voicing | null {
  const chordTones = new Set(type.formula.map((i) => (rootPc + i) % 12))
  const offsets = type.category === 'seventh' ? template.seventh : template.triad
  const notes: VoicingNote[] = []

  for (const spec of tuning.strings) {
    const s = spec.number
    const offset = offsets[6 - s]
    if (offset === null) {
      notes.push({ string: s, fret: 0, finger: null, muted: true, isRoot: false, open: false })
      continue
    }
    const ideal = baseFret + offset
    const lo = Math.max(0, ideal - 2)
    const hi = ideal + 2
    let chosen: number | null = null
    let bestDist = Infinity
    for (let f = lo; f <= hi; f++) {
      if (!chordTones.has(pitchClassAt(tuning, s, f))) continue
      const d = Math.abs(f - ideal)
      if (d < bestDist) {
        bestDist = d
        chosen = f
      }
    }
    if (chosen === null) {
      notes.push({ string: s, fret: 0, finger: null, muted: true, isRoot: false, open: false })
      continue
    }
    const pc = pitchClassAt(tuning, s, chosen)
    notes.push({
      string: s,
      fret: chosen,
      finger: null,
      muted: false,
      isRoot: pc === rootPc,
      open: chosen === 0,
    })
  }

  const voicing: Voicing = { baseFret, rootString: template.rootString, hasBarre: false, notes }
  if (!isValidVoicing(voicing, type)) return null

  // CAGED 形强度校验：七和弦必须包含 7 音；♭5/♯5 类色彩和弦必须含其色彩音
  const pcs = new Set(notes.filter((n) => !n.muted).map((n) => pitchClassAt(tuning, n.string, n.fret)))
  if (type.formula.length >= 4 && !pcs.has(((rootPc + type.formula[3]) % 12 + 12) % 12)) return null
  const color = type.formula[2]
  if (color === 6 || color === 8 || color === 9) {
    if (!pcs.has(((rootPc + color) % 12 + 12) % 12)) return null
  }

  // 指法 + 显示基品：含空弦时按开放把位画（画琴枕），否则取最低按品位并视为横按
  const hasOpen = notes.some((n) => !n.muted && n.open)
  if (hasOpen) {
    voicing.baseFret = 0
    voicing.hasBarre = false
    assignFingers(notes, 0)
  } else {
    voicing.baseFret = Math.min(...notes.filter((n) => !n.muted).map((n) => n.fret))
    voicing.hasBarre = true
    assignFingers(notes, voicing.baseFret)
  }
  return voicing
}

/** 为某根弦计算「根音落在这根弦上」所需的 baseFret */
function baseFretForRootString(
  rootPc: PitchClass,
  rootString: number,
  tuning: Tuning,
): number | null {
  const spec = tuning.strings.find((s) => s.number === rootString)
  if (!spec) return null
  const base = (((rootPc - pitchClassOf(spec.openMidi)) % 12) + 12) % 12
  if (base + WINDOW > 22) return null
  return base
}

/** 在 [baseFret, baseFret+WINDOW] 窗口内为每根弦挑一个和弦音 */
function buildVoicing(
  rootPc: PitchClass,
  type: ChordType,
  tuning: Tuning,
  baseFret: number,
): VoicingNote[] {
  const chordTones = new Set(type.formula.map((i) => (rootPc + i) % 12))
  const notes: VoicingNote[] = []

  for (const spec of tuning.strings) {
    const s = spec.number
    const candidates: number[] = []
    if (baseFret === 0 && chordTones.has(pitchClassAt(tuning, s, 0))) {
      candidates.push(0)
    }
    for (let f = baseFret; f <= baseFret + WINDOW; f++) {
      if (chordTones.has(pitchClassAt(tuning, s, f))) candidates.push(f)
    }

    if (candidates.length === 0) {
      notes.push({ string: s, fret: 0, finger: null, muted: true, isRoot: false, open: false })
      continue
    }

    const chosen = baseFret === 0 && candidates.includes(0) ? 0 : Math.min(...candidates)
    const pc = pitchClassAt(tuning, s, chosen)
    notes.push({
      string: s,
      fret: chosen,
      finger: null,
      muted: false,
      isRoot: pc === rootPc,
      open: chosen === 0,
    })
  }

  return notes
}

/** 给指法分配手指号。baseFret=0 为开放把位，>0 为横按把位 */
function assignFingers(notes: VoicingNote[], baseFret: number): void {
  if (baseFret === 0) {
    // 开放把位：按「品位低 → 弦号低」排序，依次分配 1·2·3·4 指。
    // 这样开放 A/E/D/G 等常见把位都能得到接近标准教材的手指号。
    const fretted = notes
      .filter((n) => !n.muted && !n.open)
      .sort((a, b) => (a.fret === b.fret ? a.string - b.string : a.fret - b.fret))
    fretted.forEach((n, i) => {
      n.finger = Math.min(4, i + 1)
    })
    for (const n of notes) {
      if (n.open || n.muted) n.finger = null
    }
  } else {
    for (const n of notes) {
      if (n.muted) {
        n.finger = null
        continue
      }
      n.finger = n.fret === baseFret ? 1 : Math.min(4, Math.max(2, n.fret - baseFret + 1))
    }
  }
}

/** 判断一个把位是否可用：包含根音，且发声弦不少于和弦所需音数 */
function isValidVoicing(voicing: Voicing, type: ChordType): boolean {
  const sounded = voicing.notes.filter((n) => !n.muted).length
  const hasRoot = voicing.notes.some((n) => n.isRoot)
  return hasRoot && sounded >= Math.min(4, type.formula.length)
}

/** 生成某一指定根弦 / 开放把位的候选 */
function makeCandidate(
  rootPc: PitchClass,
  type: ChordType,
  tuning: Tuning,
  position: ChordPosition,
  rootString: number,
  baseFret: number,
): VoicingOption | null {
  const notes = buildVoicing(rootPc, type, tuning, baseFret)
  assignFingers(notes, baseFret)
  const hasBarre = baseFret > 0
  const voicing: Voicing = { baseFret, rootString, hasBarre, notes }
  if (!isValidVoicing(voicing, type)) return null

  if (position === 'open') {
    return {
      voicing,
      position,
      label: `开放把位（${baseFret}品）`,
      shortLabel: '开放',
    }
  }

  const shapeName = ROOT_STRING_NAMES[rootString] ?? '横按'
  return {
    voicing,
    position,
    label: `${shapeName}（${baseFret}品）`,
    shortLabel: `${shapeName.replace(' 形横按', '')}${baseFret}品`,
  }
}

/**
 * 列出当前和弦所有可用的把位候选：
 * · 开放把位（0 品，允许空弦）
 * · 根音落 6 弦（E 形横按）
 * · 根音落 5 弦（A 形横按）
 * · 根音落 4 弦（D 形横按，高把位时才会有）
 * · CAGED 补全：G 形（根音落 6 弦的开放伸展形）/ C 形（根音落 5 弦的开放伸展形）
 */
export function listChordVoicings(
  rootPc: PitchClass,
  type: ChordType,
  tuning: Tuning,
): VoicingOption[] {
  const options: VoicingOption[] = []

  // 开放把位
  const open = makeCandidate(rootPc, type, tuning, 'open', 0, 0)
  if (open) options.push(open)

  // 根音落在各弦上的横按把位
  for (const rootString of [6, 5, 4] as const) {
    const base = baseFretForRootString(rootPc, rootString, tuning)
    if (base === null) continue
    const position: ChordPosition = rootString === 6 ? 'root6' : rootString === 5 ? 'root5' : 'root4'
    const candidate = makeCandidate(rootPc, type, tuning, position, rootString, base)
    if (candidate) options.push(candidate)
  }

  // CAGED 补全：G 形 / C 形（带 7 音的移动形，个别和弦类型找不到色彩音时会跳过）
  for (const tpl of CAGED_SHAPES) {
    const base = baseFretForRootString(rootPc, tpl.rootString, tuning)
    if (base === null) continue
    const voicing = buildCagedVoicing(rootPc, type, tuning, tpl, base)
    if (!voicing) continue
    options.push({
      voicing,
      position: tpl.position,
      label: `${tpl.label}（${base}品）`,
      shortLabel: `${tpl.label}${base}品`,
    })
  }

  return options
}

/**
 * 生成指定和弦的指法。position 可指定把位；默认 'auto' 沿用之前的启发式：
 * 优先覆盖弦数最多，其次把位最低。
 */
export function voiceChord(
  rootPc: PitchClass,
  type: ChordType,
  tuning: Tuning,
  position: ChordPosition = 'auto',
): Voicing {
  const options = listChordVoicings(rootPc, type, tuning)

  if (position !== 'auto') {
    const match = options.find((o) => o.position === position)
    if (match) return match.voicing
  }

  // auto：按「发声弦多 → 把位低」排序，取第一个
  const sorted = [...options].sort((a, b) => {
    const soundedA = a.voicing.notes.filter((n) => !n.muted).length
    const soundedB = b.voicing.notes.filter((n) => !n.muted).length
    if (soundedB !== soundedA) return soundedB - soundedA
    return a.voicing.baseFret - b.voicing.baseFret
  })

  if (sorted.length === 0) {
    // 兜底：返回一个空把位（理论上不会发生）
    const notes: VoicingNote[] = tuning.strings.map((s) => ({
      string: s.number,
      fret: 0,
      finger: null,
      muted: true,
      isRoot: false,
      open: false,
    }))
    return { baseFret: 0, rootString: 6, hasBarre: false, notes }
  }

  return sorted[0].voicing
}

/** 半音间隔 → 级数名（用于公式展示） */
export const DEGREE_LABEL: Record<number, string> = {
  0: '1',
  3: '♭3',
  4: '3',
  6: '♭5',
  7: '5',
  8: '♯5',
  9: '♭♭7',
  10: '♭7',
  11: '7',
}
