/**
 * 乐理贯通层（WHY）—— 把「和弦 / 音阶 / 进行」串成因果链
 * ─────────────────────────────────────────────
 * 这一切都是确定性的音乐理论规则，不调用 LLM、不猜测：
 *  · 和弦 → 可弹的音阶（同根音；标记 strong / color / tension，附老师口吻的「为什么」）
 *  · 音阶 → 顺阶和弦（diatonic chords）与常见进行（附「为什么成立」）
 * 数据参考标准吉他/爵士教学法（CAGED、调式、ii–V–I、12 小节蓝调），不自创体系。
 */

import { LETTER_NAMES, type PitchClass } from './music'
import { CHORD_TYPES } from './chords'
import { SCALES } from './scales'

/* ════════════════ 和弦 → 音阶 ════════════════ */

export type Fit = 'strong' | 'color' | 'tension'

export interface ScaleSuggestion {
  scaleId: string
  /** 老师口吻：为什么这个音阶配这个和弦 */
  reason: string
  fit: Fit
}

/**
 * 每个和弦类型 → 推荐的音阶（同根音）。
 * fit 含义：
 *  · strong   = 音阶包含所有和弦音，最安全、最「家」
 *  · color    = 大部分和弦音在音阶里，带一点明暗对比色彩
 *  · tension  = 故意用冲突音制造张力（蓝调 / 半音摩擦），是风格化的「对」而非「错」
 */
export const CHORD_SCALE_MAP: Record<string, ScaleSuggestion[]> = {
  maj: [
    { scaleId: 'major', fit: 'strong', reason: '大调音阶（Ionian）的每个音都落在 C 大三的延伸音里，最安全、最「家」。' },
    { scaleId: 'majorPent', fit: 'strong', reason: '大调五声拿掉 4、7 级，只留 1·2·3·5·6，明亮且不冲突——大调歌曲轻松 solo 的万能钥匙。' },
    { scaleId: 'minorPent', fit: 'color', reason: '关系小调五声（A 小调五声 = C 大调五声同音）。把情绪翻成暗色，适合在明亮和弦上做一点对比乐句。' },
  ],
  min: [
    { scaleId: 'minor', fit: 'strong', reason: '自然小调从根音数，正好叠出小三和弦的所有音，最稳。' },
    { scaleId: 'minorPent', fit: 'strong', reason: '小调五声 = 自然小调去掉 2、6 级，去掉了最「刺」的半音，暗而安全，摇滚 / blues 主粮。' },
    { scaleId: 'majorPent', fit: 'color', reason: '关系大调五声（C 大调五声 = A 小调五声同音），同一个把位换根音就到大调味，制造明暗对比。' },
    { scaleId: 'dorian', fit: 'color', reason: '多利亚把 6 级抬亮，小调里多一丝 funky 的亮——比纯自然小调更有 groove。' },
    { scaleId: 'phrygian', fit: 'color', reason: '弗利几亚把 2 级压成 ♭2，小调里多一股西班牙 / 金属的暗狠——想让小调更「异域」或更「凶」就上它。' },
  ],
  dom7: [
    { scaleId: 'mixolydian', fit: 'strong', reason: '混合利底亚 = 1·2·3·4·5·6·♭7，和属七的 1·3·5·♭7 完全吻合，属七上的指定音阶。' },
    { scaleId: 'blues', fit: 'strong', reason: '布鲁斯音阶在属七上是 blues / rock 的魂——那个 ♭5 蓝调音制造恰到好处的张力，往 ♭7 或 5 解决。' },
    { scaleId: 'minorPent', fit: 'tension', reason: '小调五声也常糊在属七上：它含根音·5·♭7，但用 ♭3 去「碰」属七的大三音，制造蓝调味的半音摩擦——故意的张力。' },
    { scaleId: 'dorian', fit: 'color', reason: '多利亚在属七上偏小调色彩，适合想让属七不那么「想解决」、更松弛地 loop。' },
  ],
  m7: [
    { scaleId: 'dorian', fit: 'strong', reason: '多利亚 = 1·♭3·5·♭7·6，小七的松弛感全在亮 6 级上，funk / jazz 的 ii、小调 V 的招牌。' },
    { scaleId: 'minor', fit: 'strong', reason: '自然小调含 1·♭3·5·♭7，干净稳当。' },
    { scaleId: 'minorPent', fit: 'strong', reason: '小调五声去 2、6 级，在小七上非常顺，没有冲突音。' },
  ],
  maj7: [
    { scaleId: 'major', fit: 'strong', reason: '大调音阶含 1·3·5·7，和 maj7 的 1·3·5·7 完美对应，最「家」。' },
    { scaleId: 'majorPent', fit: 'strong', reason: '大调五声拿掉 4、7 级冲突，留下明亮安全的五个音。' },
    { scaleId: 'lydian', fit: 'color', reason: '利底亚把 4 级抬成 #4，大七和弦上多一层悬浮的梦幻亮色，jazz ballad / fusion 的招牌——比普通大调「高级」一点。' },
  ],
  m7b5: [
    { scaleId: 'locrian', fit: 'strong', reason: 'Locrian（半减音阶）才是 m7♭5 的本命音阶：它天然含 ♭5，正好对上和弦的悬疑感，jazz 标准曲 ii–V–I 的 ii 级就该用它去 solo。' },
    { scaleId: 'minor', fit: 'color', reason: '没有 ♭5 的折中方案：用同根音自然小调，但把 5 音按 ♭5 弹，也能近似那个半减味。' },
    { scaleId: 'dorian', fit: 'tension', reason: '多利亚不含 ♭5（它用纯 5），严格不配；但很多吉他手在 Dm7♭5→G7→Cmaj7 上整段用 C 大调（即 D 多利亚）音阶，把 ♭5 当经过音带过。' },
  ],
  dim7: [
    { scaleId: 'minor', fit: 'color', reason: '减七是全对称和弦（一个指法 = 4 个根），常当过渡桥。实战上把它当「去往下一个大调的踏板」，用目标大调音阶即可。' },
  ],
  dim: [
    { scaleId: 'minor', fit: 'color', reason: '减三和弦极不稳定、导向性强，常踩向稳定和弦。实战建议：用「它要去的那个稳定和弦」的音阶，而不是减三自己。' },
  ],
  aug: [
    { scaleId: 'major', fit: 'color', reason: '增三和弦（全大三度）悬在半空、指向关系远调。常见用法：用它把情绪推去关系较远的大调，接那个大调音阶。' },
  ],
}

/** 解析和弦类型 → 音阶建议（带上音阶中文名与缩写） */
export function scaleSuggestions(typeId: string): ScaleSuggestion[] {
  const list = CHORD_SCALE_MAP[typeId] ?? []
  return list.map((s) => ({ ...s }))
}

export function scaleLabel(scaleId: string): string {
  return SCALES.find((s) => s.id === scaleId)?.label ?? scaleId
}

/**
 * 切到音阶页时，给「切换训练」当前和弦预选一个最顺手的默认音阶。
 * 落在能直接 solo 的把位，而不是一片无解的全指板。
 */
export function defaultScaleForChord(typeId: string): string {
  switch (typeId) {
    case 'min':
      return 'minorPent'
    case 'dom7':
      return 'blues'
    case 'maj':
      return 'majorPent'
    case 'm7':
      return 'dorian'
    case 'maj7':
      return 'major'
    default:
      return 'minorPent'
  }
}

/* ════════════════ 音阶 → 顺阶和弦 / 进行 ════════════════ */

export interface DiatonicChord {
  /** 罗马数字（如 I、ii、vii°） */
  numeral: string
  /** 相对根音的半音偏移 */
  offset: number
  /** 实际根音 pitch class（已加上 offset） */
  rootPc: PitchClass
  /** 和弦类型 id（对应 CHORD_TYPES） */
  typeId: string
  /** 一句注解（如「属七，最想解决」） */
  note?: string
}

/** DIATONIC 常量里只写相对信息，实际 rootPc 由 diatonicChords 计算 */
type DiatonicSeed = Omit<DiatonicChord, 'rootPc'>

export interface Progression {
  name: string
  /** 罗马数字串，如 "I–V–vi–IV" */
  numerals: string
  /** 老师口吻：为什么这个进行成立 / 好听 */
  why: string
}

/**
 * 七声音阶（大调 / 自然小调 / 多利亚 / 混合利底亚）的顺阶三和弦。
 * 写死而不是用音程去算，避免算法边界错误，也符合「参考真实教学法、不自创」。
 */
export const DIATONIC: Record<string, DiatonicSeed[]> = {
  major: [
    { numeral: 'I', offset: 0, typeId: 'maj', note: '主和弦，家' },
    { numeral: 'ii', offset: 2, typeId: 'min' },
    { numeral: 'iii', offset: 4, typeId: 'min' },
    { numeral: 'IV', offset: 5, typeId: 'maj' },
    { numeral: 'V', offset: 7, typeId: 'maj', note: '属和弦，最想解决回 I' },
    { numeral: 'vi', offset: 9, typeId: 'min', note: '关系小调的主和弦' },
    { numeral: 'vii°', offset: 11, typeId: 'dim', note: '导和弦，强导向 I' },
  ],
  minor: [
    { numeral: 'i', offset: 0, typeId: 'min', note: '主和弦，暗色家' },
    { numeral: 'ii°', offset: 2, typeId: 'dim' },
    { numeral: 'III', offset: 3, typeId: 'maj', note: '关系大调的主和弦' },
    { numeral: 'iv', offset: 5, typeId: 'min' },
    { numeral: 'v', offset: 7, typeId: 'min' },
    { numeral: 'VI', offset: 8, typeId: 'maj' },
    { numeral: 'VII', offset: 10, typeId: 'maj', note: '大调 VII，带一点野' },
  ],
  dorian: [
    { numeral: 'i', offset: 0, typeId: 'min', note: '小调底，但 6 级亮' },
    { numeral: 'ii', offset: 2, typeId: 'min' },
    { numeral: 'III', offset: 3, typeId: 'maj' },
    { numeral: 'IV', offset: 5, typeId: 'maj', note: '实战常用属七（IV7）制造张力' },
    { numeral: 'v', offset: 7, typeId: 'min' },
    { numeral: 'vi°', offset: 9, typeId: 'dim' },
    { numeral: 'VII', offset: 10, typeId: 'maj' },
  ],
  mixolydian: [
    { numeral: 'I', offset: 0, typeId: 'maj', note: '属色彩的大调，根音带 ♭7' },
    { numeral: 'ii', offset: 2, typeId: 'min' },
    { numeral: 'iii°', offset: 4, typeId: 'dim' },
    { numeral: 'IV', offset: 5, typeId: 'maj' },
    { numeral: 'V', offset: 7, typeId: 'min' },
    { numeral: 'vi', offset: 9, typeId: 'min' },
    { numeral: 'vii', offset: 10, typeId: 'maj' },
  ],
  phrygian: [
    { numeral: 'i', offset: 0, typeId: 'min', note: '主和弦，暗狠' },
    { numeral: '♭II', offset: 1, typeId: 'maj', note: '弗利几亚招牌大调（如 E 上的 F）' },
    { numeral: '♭III', offset: 3, typeId: 'maj' },
    { numeral: 'iv', offset: 5, typeId: 'min' },
    { numeral: 'v°', offset: 7, typeId: 'dim' },
    { numeral: '♭VI', offset: 8, typeId: 'maj' },
    { numeral: '♭vii', offset: 10, typeId: 'min' },
  ],
  lydian: [
    { numeral: 'I', offset: 0, typeId: 'maj', note: '悬浮大调，家' },
    { numeral: 'II', offset: 2, typeId: 'maj', note: 'Lydian 的招牌大二（不是小二）' },
    { numeral: 'iii', offset: 4, typeId: 'min' },
    { numeral: 'iv°', offset: 6, typeId: 'dim' },
    { numeral: 'V', offset: 7, typeId: 'maj' },
    { numeral: 'vi', offset: 9, typeId: 'min' },
    { numeral: 'vii', offset: 11, typeId: 'min' },
  ],
  locrian: [
    { numeral: 'i°', offset: 0, typeId: 'dim', note: '减主和弦，最悬' },
    { numeral: '♭II', offset: 1, typeId: 'maj' },
    { numeral: '♭III', offset: 3, typeId: 'min' },
    { numeral: 'iv', offset: 5, typeId: 'min' },
    { numeral: '♭V', offset: 6, typeId: 'maj' },
    { numeral: '♭VI', offset: 8, typeId: 'min' },
    { numeral: '♭vii', offset: 10, typeId: 'min' },
  ],
}

/** 五声 / 布鲁斯没有「顺阶和弦」概念，改用「常用落点 / 进行」 */
export const PENTATONIC_CONTEXT: Record<
  string,
  { home: string; homeLabel: string; progression: Progression }
> = {
  minorPent: {
    home: 'min',
    homeLabel: '小和弦（m）或属七（7）',
    progression: {
      name: '12 小节蓝调',
      numerals: 'I7 – IV7 – V7',
      why: '五声 / 小调五声的天然家。每个和弦上都用同一条五声，那个 ♭7 在小和弦上稳、在属七上最甜——蓝调的味道就来自这里。',
    },
  },
  blues: {
    home: 'dom7',
    homeLabel: '属七和弦（7）',
    progression: {
      name: '12 小节蓝调',
      numerals: 'I7 – IV7 – V7',
      why: '布鲁斯音阶就是为属七而生的：♭5 蓝调音在属七上制造「悬而未决」的哭腔，往 ♭7 或 5 解决。一条五声走完三个和弦，这就是 blues。',
    },
  },
  majorPent: {
    home: 'maj',
    homeLabel: '大和弦（maj / maj7）',
    progression: {
      name: 'I–IV–V 大调进行',
      numerals: 'I – IV – V',
      why: '大调五声 = 大调音阶去掉 4、7 级，明亮无冲突。落在 I–IV–V 这种大调进行上，是乡村 / 流行轻松 solo 的标配。',
    },
  },
}

export function diatonicChords(rootPc: PitchClass, scaleId: string): DiatonicChord[] {
  const list = DIATONIC[scaleId]
  if (!list) return []
  return list.map((c) => ({ ...c, rootPc: ((rootPc + c.offset) % 12 + 12) % 12 }))
}

/** 给顺阶和弦补上实际根音音名（在组件里解析，避免在这里引太多东西） */
export function chordName(rootPc: PitchClass, typeId: string): string {
  const type = CHORD_TYPES.find((t) => t.id === typeId)
  return `${LETTER_NAMES[rootPc]}${type?.abbr ?? ''}`
}

export function chordTypeLabel(typeId: string): string {
  return CHORD_TYPES.find((t) => t.id === typeId)?.label ?? typeId
}

/** 常见进行（按音阶 id） */
export const PROGRESSIONS: Record<string, Progression[]> = {
  major: [
    { name: 'I–V–vi–IV', numerals: 'I – V – vi – IV', why: '流行进行之王：大调明亮、V 拉一点张力、vi 暗一下、IV 稳稳接回，无数情歌 / 摇滚的骨架。' },
    { name: 'ii–V–I', numerals: 'ii – V – I', why: 'jazz 的回家路：ii 制造一点悬、V（属七）拉满张力、I 落地。练 ii–V–I 就是练「紧张 → 解决」。' },
  ],
  minor: [
    { name: 'i–VI–VII（Andalusian）', numerals: 'i – VI – VII', why: '西班牙 / 弗拉门戈的暗色进行，i 小调的宿命感，从暗一步步走向更暗再绕回。' },
    { name: 'i–iv–v', numerals: 'i – iv – v', why: '小调最朴素的进行，ballad / 抒情摇滚常用，情绪内敛。' },
  ],
  dorian: [
    { name: 'i–IV（So What）', numerals: 'i – IV – i', why: 'Miles Davis《So What》的极简骨架：小调底 + 一个属七(IV7)的亮，loop 起来很 modal、很酷。' },
    { name: 'i–ii', numerals: 'i – ii – i', why: '小调 ii–V 的简化，funk / jazz 里用来在 m7 上制造一点推进。' },
  ],
  mixolydian: [
    { name: 'I–IV–I', numerals: 'I – IV – I', why: 'blues / rock 的「家 → 亮一下 → 回家」，属和弦的循环，稳中带野。' },
    { name: 'I–♭VII–IV', numerals: 'I – ♭VII – IV', why: '摇滚进行（如 Sweet Home Alabama 类），♭VII 从关系小调借来，带点野。' },
  ],
  phrygian: [
    { name: 'i–♭II（弗拉门戈 / 金属）', numerals: 'i – ♭II', why: '弗利几亚的招牌进行：小调主和弦接它上方那个大调（如 Em → F），那个 ♭2 一步跨上去的「异域凶狠」就是弗拉门戈扫弦和金属 riff 的魂。' },
    { name: 'i–♭VII–♭VI', numerals: 'i – ♭VII – ♭VI', why: '从暗的小调主和弦一路下行到 ♭VII、♭VI，越走越暗再绕回，西班牙 / 暗潮金属的常用走向。' },
  ],
  lydian: [
    { name: 'I–II（悬浮大调）', numerals: 'I – II', why: 'Lydian 的极简骨架：大调主和弦接它上方那个大二度大和弦（如 C → D），#4 制造「飘在半空」的希望感，fusion / 前卫金属 / 配乐最爱。' },
    { name: 'I–IV（现代悬浮）', numerals: 'I – IV', why: 'Lydian 的 IV 级本是减和弦，但实战常把它加个七音当属色彩来 loop，制造「想解决又不想落地」的现代悬浮感，前卫 / fusion 常用。' },
  ],
  locrian: [
    { name: 'i°–♭II（半减解决）', numerals: 'i° – ♭II', why: 'Locrian 几乎不单独写歌，但它是 m7♭5 的本命音阶：减主和弦接到上方大调（如 B° → C），正好是 jazz 标准曲 ii–V–I 里那个悬疑 ii 级的味道——「永远在想去哪」。' },
  ],
}

export function progressionsFor(scaleId: string): Progression[] {
  return PROGRESSIONS[scaleId] ?? []
}

export function isPentatonicScale(scaleId: string): boolean {
  return scaleId in PENTATONIC_CONTEXT
}
