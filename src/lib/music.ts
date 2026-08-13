/**
 * 音乐理论核心
 * ─────────────────────────────────────────────
 * 所有音高以 MIDI note number 表示（A4 = 69 = 440Hz）。
 * 弦编号沿用吉他习惯：6 弦 = 最粗最低音，1 弦 = 最细最高音。
 */

import { scoreItem, pickWeighted, indicesWhere, type MasteryMap } from './srs'

/** 十二平均律的比值常数：每上升一个半音，频率 × 2^(1/12) */
export const SEMITONE_RATIO = Math.pow(2, 1 / 12)

/** 指板渲染的最大品位 */
export const MAX_FRET = 22

/* ────────────────────────────── 音名 ────────────────────────────── */

/** 十二个半音的字母音名（以升号记谱） */
export const LETTER_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

/** 对应的唱名（固定调唱名法，Do = C） */
export const SOLFEGE_NAMES = [
  'Do',
  'Do♯',
  'Re',
  'Re♯',
  'Mi',
  'Fa',
  'Fa♯',
  'Sol',
  'Sol♯',
  'La',
  'La♯',
  'Si',
] as const

/** 自然音（白键）的 pitch class，出题默认只用这七个 */
export const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11]

/** 变化音（黑键）的 pitch class */
export const ACCIDENTAL_PITCH_CLASSES = [1, 3, 6, 8, 10]

export type PitchClass = number // 0..11

/** midi → pitch class (0..11) */
export const pitchClassOf = (midi: number): PitchClass => ((midi % 12) + 12) % 12

/** midi → 科学音高记号里的八度数，C4 = 中央 C = 60 */
export const octaveOf = (midi: number): number => Math.floor(midi / 12) - 1

/** midi → 频率（Hz） */
export const frequencyOf = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

/** pitch class → 字母音名 */
export const letterOf = (pc: PitchClass): string => LETTER_NAMES[pc]

/** pitch class → 唱名 */
export const solfegeOf = (pc: PitchClass): string => SOLFEGE_NAMES[pc]

/** 是否为变化音（带升降号） */
export const isAccidental = (pc: PitchClass): boolean => ACCIDENTAL_PITCH_CLASSES.includes(pc)

/* ──────────────────────────── 调弦方案 ──────────────────────────── */

export interface StringSpec {
  /** 吉他习惯编号：6 = 最粗，1 = 最细 */
  readonly number: number
  /** 空弦音的 MIDI 值 */
  readonly openMidi: number
  /** 弦径（英寸），用于决定绘制粗细 */
  readonly gauge: number
  /** 是否为缠绕弦——缠绕弦要画出螺旋纹理 */
  readonly wound: boolean
}

export interface Tuning {
  readonly id: string
  readonly name: string
  readonly note: string
  /** 按 6→1 弦顺序排列 */
  readonly strings: readonly StringSpec[]
}

/** 标准调弦 E A D G B E（6→1） */
export const STANDARD_TUNING: Tuning = {
  id: 'standard',
  name: '标准调弦',
  note: 'E A D G B E',
  strings: [
    { number: 6, openMidi: 40, gauge: 0.053, wound: true }, // E2
    { number: 5, openMidi: 45, gauge: 0.042, wound: true }, // A2
    { number: 4, openMidi: 50, gauge: 0.032, wound: true }, // D3
    { number: 3, openMidi: 55, gauge: 0.024, wound: true }, // G3
    { number: 2, openMidi: 59, gauge: 0.016, wound: false }, // B3
    { number: 1, openMidi: 64, gauge: 0.012, wound: false }, // E4
  ],
}

/** Drop D — 只把 6 弦降一个全音 */
export const DROP_D_TUNING: Tuning = {
  id: 'dropD',
  name: 'Drop D',
  note: 'D A D G B E',
  strings: [
    { number: 6, openMidi: 38, gauge: 0.053, wound: true }, // D2
    ...STANDARD_TUNING.strings.slice(1),
  ],
}

/** 半音下降调弦 */
export const HALF_STEP_DOWN_TUNING: Tuning = {
  id: 'halfDown',
  name: '降半音',
  note: 'E♭ A♭ D♭ G♭ B♭ E♭',
  strings: STANDARD_TUNING.strings.map((s) => ({ ...s, openMidi: s.openMidi - 1 })),
}

export const TUNINGS: readonly Tuning[] = [
  STANDARD_TUNING,
  DROP_D_TUNING,
  HALF_STEP_DOWN_TUNING,
]

/* ─────────────────────────── 指板坐标计算 ─────────────────────────── */

/**
 * 第 n 品到琴枕的距离，按有效弦长归一化（0 = 琴枕，1 = 琴桥）。
 * 这就是真实吉他的品丝定位公式，品距随把位升高而递减。
 */
export const fretOffsetRatio = (fret: number): number => 1 - Math.pow(2, -fret / 12)

/** 指板可视区总长（归一化），即从琴枕到最后一品的距离 */
export const FRETBOARD_SPAN = fretOffsetRatio(MAX_FRET)

/** 把第 n 品的位置换算成 0..1 的指板内部坐标 */
export const fretPosition = (fret: number): number => fretOffsetRatio(fret) / FRETBOARD_SPAN

/** 第 n 品「品格」的中心位置（音是按在两条品丝之间的） */
export const fretCenter = (fret: number): number => {
  if (fret === 0) return -0.018 // 空弦：画在琴枕左侧
  return (fretPosition(fret - 1) + fretPosition(fret)) / 2
}

/** 传统的品位标记点位置 */
export const INLAY_SINGLE = [3, 5, 7, 9, 15, 17, 19, 21]
export const INLAY_DOUBLE = [12]

/* ────────────────────────── 指板音位查询 ────────────────────────── */

export interface FretboardPosition {
  /** 弦号 6..1 */
  string: number
  /** 品位 0..MAX_FRET */
  fret: number
  midi: number
}

/** 某根弦某一品的 MIDI 音高 */
export const midiAt = (tuning: Tuning, stringNumber: number, fret: number): number => {
  const spec = tuning.strings.find((s) => s.number === stringNumber)
  if (!spec) throw new Error(`未知弦号: ${stringNumber}`)
  return spec.openMidi + fret
}

/** 某根弦某一品的音级（pitch class） */
export const pitchClassAt = (tuning: Tuning, stringNumber: number, fret: number): PitchClass =>
  pitchClassOf(midiAt(tuning, stringNumber, fret))

/**
 * 找出某根弦上所有能奏出指定 pitch class 的品位。
 * 同一根弦每隔 12 品会重复出现同一个音——这是指板记忆的关键规律，
 * 所以这里返回全部匹配位置，揭示答案时一并高亮。
 */
export const findFretsForPitchClass = (
  tuning: Tuning,
  stringNumber: number,
  pc: PitchClass,
  fretRange: readonly [number, number],
): number[] => {
  const spec = tuning.strings.find((s) => s.number === stringNumber)
  if (!spec) return []
  const [lo, hi] = fretRange
  const result: number[] = []
  for (let fret = lo; fret <= hi; fret++) {
    if (pitchClassOf(spec.openMidi + fret) === pc) result.push(fret)
  }
  return result
}

/* ───────────────────────────── 出题逻辑 ───────────────────────────── */

/** 练习任务类型：找位置 / 认音名 / 找八度 */
export type TaskType = 'find' | 'name' | 'octave'

/** 一个具体的指板位置 */
export interface FretTarget {
  string: number
  fret: number
}

export interface Question {
  id: number
  /** 这一题属于哪种任务 */
  task: TaskType
  /** SRS 记忆键，如 find:6:0 / name:0 / octave:0 */
  key: string
  /** 参考弦（find 的提问弦；name/octave 的高亮参考格所在弦） */
  string: number
  /** 参考品位（find = 主答案品；name/octave = 高亮参考格的品） */
  fret: number
  /** 目标音级 */
  pitchClass: PitchClass
  /** 全部正确位置（find 只在参考弦；octave 跨全部弦；name 仅参考格一个） */
  targets: FretTarget[]
  /** 参考弦上的全部正确品位（升序），用于揭示文字与旧逻辑兼容 */
  answers: number[]
  /** 主答案品位，用于播放示范音 */
  primaryFret: number
  /** 主答案对应的 MIDI */
  primaryMidi: number
  createdAt: number
}

export interface QuizScope {
  /** 参与出题的弦号集合 */
  strings: number[]
  /** 出题品位范围 [lo, hi] */
  fretRange: [number, number]
  /** 是否把带升降号的音也纳入题库 */
  includeAccidentals: boolean
}

/** 抽题锚点：一道题的最小描述 + 它的 SRS 键 */
interface Anchor {
  string: number
  fret: number
  pc: PitchClass
  key: string
  targets: FretTarget[]
  primaryFret: number
}

let questionSeq = 0

/** 找出范围内所有能奏出某音级的位置（跨全部参与弦） */
const positionsOfPc = (tuning: Tuning, pc: PitchClass, scope: QuizScope): FretTarget[] => {
  const [lo, hi] = scope.fretRange
  const out: FretTarget[] = []
  for (const s of tuning.strings) {
    if (!scope.strings.includes(s.number)) continue
    for (let f = lo; f <= hi; f++) {
      if (pitchClassAt(tuning, s.number, f) === pc) out.push({ string: s.number, fret: f })
    }
  }
  return out
}

/**
 * 按任务构建抽题池。
 * - find：每个「弦 × 音级」一个锚点
 * - name：每个具体格子一个锚点，键按音级归并（认音名不挑位置）
 * - octave：每个具体格子一个锚点，键按音级归并（找八度不挑起始位置）
 */
const buildPool = (tuning: Tuning, scope: QuizScope, task: TaskType): Anchor[] => {
  const pcs = scope.includeAccidentals
    ? [...NATURAL_PITCH_CLASSES, ...ACCIDENTAL_PITCH_CLASSES]
    : NATURAL_PITCH_CLASSES
  const [lo, hi] = scope.fretRange
  const pool: Anchor[] = []

  if (task === 'find') {
    for (const s of tuning.strings) {
      if (!scope.strings.includes(s.number)) continue
      for (const pc of pcs) {
        const frets = findFretsForPitchClass(tuning, s.number, pc, scope.fretRange)
        if (frets.length === 0) continue
        pool.push({
          string: s.number,
          fret: frets[0],
          pc,
          key: `find:${s.number}:${pc}`,
          targets: frets.map((f) => ({ string: s.number, fret: f })),
          primaryFret: frets[0],
        })
      }
    }
  } else {
    for (const s of tuning.strings) {
      if (!scope.strings.includes(s.number)) continue
      for (let f = lo; f <= hi; f++) {
        const pc = pitchClassAt(tuning, s.number, f)
        if (!scope.includeAccidentals && isAccidental(pc)) continue
        const targets =
          task === 'octave' ? positionsOfPc(tuning, pc, scope) : [{ string: s.number, fret: f }]
        pool.push({
          string: s.number,
          fret: f,
          pc,
          key: `${task}:${pc}`,
          targets,
          primaryFret: f,
        })
      }
    }
  }
  return pool
}

const buildQuestion = (tuning: Tuning, a: Anchor, task: TaskType): Question => ({
  id: ++questionSeq,
  task,
  key: a.key,
  string: a.string,
  fret: a.fret,
  pitchClass: a.pc,
  targets: a.targets,
  answers: a.targets.filter((t) => t.string === a.string).map((t) => t.fret),
  primaryFret: a.primaryFret,
  primaryMidi: midiAt(tuning, a.string, a.primaryFret),
  createdAt: Date.now(),
})

/**
 * 加权抽题：越不熟 / 越久没练的锚点越容易出。
 * 另外保证：只要还有没见过的锚点，就有 60% 概率从「未见过」里均匀抽，
 * 避免熟练项把新题挤掉。srsEnabled 关掉时传空 mastery → 退化为均匀随机。
 */
const sampleAnchor = (pool: Anchor[], mastery: MasteryMap, now: number): number => {
  const unseenIdx = indicesWhere(pool, (a) => !mastery[a.key])
  if (unseenIdx.length > 0 && Math.random() < 0.6) {
    return unseenIdx[Math.floor(Math.random() * unseenIdx.length)]
  }
  return pickWeighted(pool, (a) => scoreItem(mastery[a.key], now))
}

/**
 * 生成一道新题。
 * @param previous 上一题，用于避免连续重复同一锚点
 * @param mastery  当前掌握度，用于加权抽题
 * @param preferredPc 优先考的音级（贯通层：当前共享根音）。命中则把题库收敛到该音级，
 *                    让「我刚在和弦 / 音阶页看的根音」直接变成指板训练要练的位置。
 */
export const generateQuestion = (
  tuning: Tuning,
  scope: QuizScope,
  task: TaskType,
  previous: Question | null,
  mastery: MasteryMap,
  preferredPc: PitchClass | null = null,
): Question | null => {
  const pool = buildPool(tuning, scope, task)
  if (pool.length === 0) return null

  let candidates = pool
  if (preferredPc !== null) {
    const focused = pool.filter((a) => a.pc === preferredPc)
    if (focused.length > 0) candidates = focused
  }
  const prevKey = previous?.key ?? null
  if (candidates.length > 1 && prevKey) {
    const filtered = candidates.filter((a) => a.key !== prevKey)
    if (filtered.length > 0) candidates = filtered
  }

  const idx = sampleAnchor(candidates, mastery, Date.now())
  return buildQuestion(tuning, candidates[idx], task)
}

/** 把题目渲染成「6-C」这样的简写 */
export const questionLabel = (q: Question): string => `${q.string}-${letterOf(q.pitchClass)}`

/** 序数中文，用于「六弦」这样的读法 */
const CHINESE_NUMERALS = ['', '一', '二', '三', '四', '五', '六']
export const stringNameCN = (stringNumber: number): string =>
  `${CHINESE_NUMERALS[stringNumber] ?? stringNumber}弦`
