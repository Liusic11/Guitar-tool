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
    color: '摇滚 / 蓝调的万能钥匙：怎么弹都不太难听，是 solo 的安全区',
    usage: 'blues、rock、pop 的 solo 主粮；几乎任意小调进行往上糊都行',
    theory:
      '「五声」= 5 个音，做法是把大调音阶里最「刺」的两个音（4 级、7 级）拿掉，剩下 1·♭3·4·5·♭7。少了这两个爱打架的音，闭眼乱弹也和谐——所以它是一切主音即兴的起点。先把这条在指板上走顺，后面所有音阶都好懂。',
  },
  {
    id: 'blues',
    label: '布鲁斯',
    abbr: 'blues',
    formula: [0, 3, 5, 6, 7, 10],
    category: 'blues',
    color: '在小调五声里塞了一个「蓝调音(♭5)」，一下就有了哭腔和灵魂',
    usage: 'blues / funk / rock 的灵魂；那个 ♭5 就是「蓝调音」',
    theory:
      '在小调五声基础上加一个 ♭5（比纯五度低半音）。这个音不在大小调里，所以听起来「悬」、带点幽怨，叫 blue note（蓝调音）。它是 blues 的魂，也是 jazz 爱玩的「外围音」——别一直按着它，像撒胡椒面一样轻轻带过，或滑到 5 级解决掉。',
  },
  {
    id: 'majorPent',
    label: '大调五声',
    abbr: 'maj pent',
    formula: [0, 2, 4, 7, 9],
    category: 'pentatonic',
    color: '明亮、顺耳，乡村 / 流行最爱的「阳光版五声」',
    usage: '大调歌曲的轻松 solo；和小调五声是同一套把位，只换根音',
    theory:
      '大调版五声音阶（1·2·3·5·6）。关键诀窍：A 小调五声 = C 大调五声（共享音）。所以你练熟小调五声后，把「家」挪到关系大调，立刻就有大调五声可用——同一堆音，换根音就换味道。',
  },
  {
    id: 'major',
    label: '自然大调',
    abbr: '',
    formula: [0, 2, 4, 5, 7, 9, 11],
    category: 'mode',
    color: '最「标准」、最明亮，西方音乐的底色，像 Do Re Mi',
    usage: '大调歌曲旋律 / 主音；和弦跟音阶的接口',
    theory:
      '七个音全用上（1·2·3·4·5·6·7）。它是所有调式的「妈妈」——Dorian、Mixolydian 都是它在某个音上「重新起算」得到的。记一个关键点：大调的「台阶转折点」在 3→4 和 7→1 这两处是半音，其余都是全音。先把这条音阶在指板上走顺，后面调式只是挪一下起点。',
  },
  {
    id: 'minor',
    label: '自然小调',
    abbr: '',
    formula: [0, 2, 3, 5, 7, 8, 10],
    category: 'mode',
    color: '比大调低沉、内敛，像阴天或叙述',
    usage: '小调歌曲旋律 / 主音；ballad、民谣、抒情摇滚',
    theory:
      '大调音阶降 3、6、7 级得到（1·2·♭3·4·5·♭6·♭7）。它和大调是「关系大小调」——共享一套音，只是起始音不同。那个 ♭3 就是「小调为什么悲伤」的来源：只比大三度低半音，情绪差很多。',
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
      '把自然小调的 6 级抬高半音（♭6→6），得到 1·2·♭3·4·5·6·♭7。它「小三度带亮六度」的配方，正好是 funk 和 minor7 和弦上的经典色彩。想让小调 solo 不那么悲、多一丝律动，就上多利亚。经典曲例：Santana《Oye Como Va》、Miles Davis《So What》。',
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
      '把自然大调的 7 级降半音（7→♭7），得到 1·2·3·4·5·6·♭7。它和大调几乎一样，只差那个 ♭7——而这正是属七和弦张力来源（乐理上叫「导音想解决」）。所以「在属七上 solo」= 混合利底亚，记住这一条就通了。',
  },
  {
    id: 'phrygian',
    label: '弗利几亚',
    abbr: 'Phryg',
    formula: [0, 1, 3, 5, 7, 8, 10],
    category: 'mode',
    color: '小调底子压一个 ♭2 —— 一股西班牙 / 弗拉门戈 / 金属的暗狠',
    usage: '弗拉门戈扫弦、金属 riff（西班牙味段落）、modal jazz 的悬疑小调',
    theory:
      '把自然小调的 2 级也压低（♭2），得到 1·♭2·♭3·4·5·♭6·♭7。那个 ♭2 是它最毒的特征音——和主音只差一个半音，制造紧张、异域、甚至「凶」的色彩。弗拉门戈吉他几乎都用 E 弗利几亚（把 E 小调的根音挪到 E 的 ♭2），金属 riff 也爱它——就是那个「一步跨上去的暗狠」。',
  },
  {
    id: 'lydian',
    label: '利底亚',
    abbr: 'Lydian',
    formula: [0, 2, 4, 6, 7, 9, 11],
    category: 'mode',
    color: '大调底子抬一个 #4 —— 悬浮、梦幻、往外星走',
    usage: 'jazz fusion、前卫金属（Dream Theater 味）、电影配乐的「希望感」大调',
    theory:
      '把自然大调的 4 级抬半音（4→#4），得到 1·2·3·#4·5·6·7。#4 是它唯一的异色音——和 3 级叠成一个大三度再叠增四度，悬在半空不落地，听感「亮得飘」。Lydian 常被当作大七和弦的「高级」音阶（比普通大调多一层张力），fusion 和配乐最爱用它制造那种「聪明又悬浮」的大调。',
  },
  {
    id: 'locrian',
    label: '洛克里亚',
    abbr: 'Locrian',
    formula: [0, 1, 3, 5, 6, 8, 10],
    category: 'mode',
    color: '唯一一个「主和弦都是减的」调式——最不稳定、最悬疑',
    usage: 'jazz 标准曲 ii–V–I 里的 ii 级（m7♭5）本命音阶；半减和弦的解决感',
    theory:
      '把自然小调的 2、5 级都压低（♭2·♭5），得到 1·♭2·♭3·4·♭5·♭6·♭7。它是七个调式里唯一主和弦是减和弦的——没有纯五度「锚」，所以听起来一直在「要往哪去」、绝不落地。实战上你几乎不会拿它写歌，但它是 m7♭5（半减七）的本命音阶：ii–V–I 进行里那个悬疑的 ii 级，就该用 Locrian 去 solo。',
  },
  {
    id: 'harmonicMinor',
    label: '和声小调',
    abbr: 'Harm',
    formula: [0, 2, 3, 5, 7, 8, 11],
    category: 'mode',
    color: '小调底子把 7 级抬高成 #7——古典 / neoclassical 的暗色张力，那个 #7 拼命想解决回主音',
    usage: '古典、neoclassical、jazz、金属；小调里制造「想回家」的紧张',
    theory:
      '自然小调把 7 级抬高半音（7→#7）得到 1·2·♭3·4·5·♭6·7。那个 #7 与主音只差半音，制造一股「拼命想解决回主音」的张力——这是古典和 neoclassical（如 Yngwie）小调独奏的魂，也是 V7→i 解决的来源。它和「旋律小调」区别在于：和声小调的 6 级是降的(♭6)，所以听起来更「古典 / 中世纪」，没那么爵士。',
  },
  {
    id: 'melodicMinor',
    label: '旋律小调',
    abbr: 'Mela',
    formula: [0, 2, 3, 5, 7, 9, 11],
    category: 'mode',
    color: '上行小调：把 6、7 级都抬高，暗里带一点爵士的亮（jazz 里上下行都用同一条）',
    usage: 'jazz（爵士小调 / jazz minor）、fusion、金属；m7♭5 / mmaj7 的母音阶',
    theory:
      '爵士里说的「旋律小调」= 自然小调把 6、7 级都抬高（♭6→6、♭7→7），得到 1·2·♭3·4·5·6·7。它是 m7♭5 和 m(maj7) 的母音阶——在 ii–V–I 的 ii 级上 solo，这条比自然小调顺太多。注意它和「和声小调」不同：旋律小调的 6、7 都亮，所以味道更现代、更爵士，没那么「中世纪」。',
  },
  {
    id: 'diminished',
    label: '减音阶',
    abbr: 'Dim',
    formula: [0, 1, 3, 4, 6, 7, 9, 10],
    category: 'mode',
    color: '全对称（半音-全音交替），8 个音；最诡异、最紧张，一个把位 = 4 个根',
    usage: '减七和弦(dim7)的指定音阶；过渡 / 离调 / 悬疑配乐',
    theory:
      '减音阶 = 半音、全音、半音、全音…交替（whole-half），8 个音。它和小调减七和弦(dim7)完美咬合——dim7 的每个音都能当根音，所以这条音阶「一个把位 = 4 个不同根的减七」。实战上它不用来写歌，而是当「去往下一个和弦的踏板」：想离调 / 制造悬疑时用。',
  },
  {
    id: 'wholeTone',
    label: '全音阶',
    abbr: 'WT',
    formula: [0, 2, 4, 6, 8, 10],
    category: 'mode',
    color: '全是大二度（一个把位 = 6 个根），悬在半空、指向远调，梦幻又不稳定',
    usage: '增和弦(aug)的指定音阶；印象派 / fusion / 悬疑配乐',
    theory:
      '全音阶 = 只由大二度堆叠（C D E F# G# A#），没有小二度、没有解决感，所以听起来「悬在半空、上不去下不来」。它和增和弦(aug)是绝配——aug 的 1·3·#5 全在音阶里。印象派（德彪西）、fusion 和悬疑配乐最爱用它制造那种「要变天了」的漂浮感。',
  },
  {
    id: 'bebopDominant',
    label: 'Bebop 属',
    abbr: 'Bebop7',
    formula: [0, 2, 4, 5, 7, 9, 10, 11],
    category: 'mode',
    color: 'Mixolydian 多一个自然 7——8 个音让旋律「落在拍上」，swing 的精髓',
    usage: '属七和弦(dom7)上 solo 的爵士标配；swing / bebop',
    theory:
      '在混合利底亚（1·2·3·4·5·6·♭7）基础上，把自然 7 也加进来，得到 8 个音的 bebop 属音阶。为什么要 8 个？爵士手发现：在 8 分音符 swing 里，8 个音正好让「和弦音都落在强拍、经过音落在弱拍」——这就是 bebop 能又流动又稳的秘诀。属七上的指定爵士音阶。',
  },
  {
    id: 'bebopMajor',
    label: 'Bebop 大调',
    abbr: 'Bebop',
    formula: [0, 2, 4, 5, 7, 8, 9, 11],
    category: 'mode',
    color: '大调音阶多一个 ♭6——同样用 8 音把和弦音「钉」在强拍，大调的 bebop 味',
    usage: '大调 / maj7 上 solo 的爵士标配；swing / bebop',
    theory:
      '在大调音阶（1·2·3·4·5·6·7）里插入一个 ♭6，得到 8 个音的 bebop 大调（1·2·3·4·5·♭6·6·7）。和 bebop 属同理：多出来的那个音是「经过音」，作用是让旋律在 swing 的 8 分里自然地把和弦音落在强拍。大调 / maj7 上 solo 的爵士标配。',
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
  id?: string,
): ScaleBox[] {
  const sixth = tuning.strings.find((s) => s.number === 6)
  if (!sixth) return []

  // ── 五声 / 布鲁斯：CAGED 5 形状（按 id 显式判定，避免把全音阶等 6 音音阶误判）──
  if (id === 'minorPent' || id === 'blues' || id === 'majorPent') {
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
