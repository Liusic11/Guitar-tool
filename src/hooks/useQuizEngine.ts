/**
 * 练习状态机
 * ─────────────────────────────────────────────
 * 三维正交：
 *   · task（练什么）：find 找位置 / name 认音名 / octave 找八度
 *   · mode（怎么交付）：auto 计时器揭示 / manual 自己点揭示
 *   · srs（怎么抽题）：加权优先弱项 / 均匀随机
 *
 * 三任务共用 asking → revealed 流转。作答入口各不相同：
 *   · find  → 直接点指板
 *   · name  → 在音名键盘上选
 *   · octave→ 在指板上逐个标记，按「确认」或等计时器结算
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audioEngine } from '../lib/audio'
import {
  MAX_FRET,
  STANDARD_TUNING,
  TUNINGS,
  findFretsForPitchClass,
  generateQuestion,
  midiAt,
  pitchClassOf,
  type PitchClass,
  type Question,
  type QuizScope,
  type TaskType,
  type Tuning,
} from '../lib/music'
import {
  updateMastery,
  type MasteryMap,
} from '../lib/srs'
import type { ToneProfileId } from '../lib/audio'
import type { LabelMode } from '../components/Fretboard'

export type PracticeMode = 'auto' | 'manual'
export type Phase = 'idle' | 'asking' | 'revealed'
export type Verdict = 'pending' | 'hit' | 'miss'

export interface Settings {
  mode: PracticeMode
  /** 练习任务：找位置 / 认音名 / 找八度 */
  task: TaskType
  /** 自动模式的思考时间（秒），1–5 */
  intervalSec: number
  /** 揭示答案后停留多久再出下一题（秒） */
  revealHoldSec: number
  tuningId: string
  scope: QuizScope
  labelMode: LabelMode
  /** 出题时朗读（拨响）目标音 */
  playOnAsk: boolean
  /** 揭示答案时再拨一次 */
  playOnReveal: boolean
  /** 把同一根弦上的其他正确品位也一并高亮（find 模式） */
  showOctaveTwins: boolean
  showAllNotes: boolean
  /** 智能加权抽题（SRS） */
  srsEnabled: boolean
  /** 合成音色档位：原声 / 电吉他清音 / 电吉他过载 */
  toneProfile: ToneProfileId
  volume: number
  muted: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'auto',
  task: 'find',
  intervalSec: 3,
  revealHoldSec: 1.6,
  tuningId: 'standard',
  scope: {
    strings: [6, 5, 4, 3, 2, 1],
    fretRange: [0, 12],
    includeAccidentals: false,
  },
  labelMode: 'both',
  playOnAsk: true,
  playOnReveal: true,
  showOctaveTwins: true,
  showAllNotes: false,
  srsEnabled: true,
  toneProfile: 'electric-clean',
  volume: 0.75,
  muted: false,
}

export interface Stats {
  asked: number
  answered: number
  correct: number
  streak: number
  bestStreak: number
  /** 弦号 → [答对数, 作答数] */
  perString: Record<number, [number, number]>
  /** 最近若干次作答的反应时间（毫秒） */
  reactionTimes: number[]
}

const EMPTY_STATS: Stats = {
  asked: 0,
  answered: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  perString: {},
  reactionTimes: [],
}

const STORAGE_KEY = 'fretboard-atlas:settings:v1'
const MASTERY_KEY = 'fretboard-atlas:mastery:v1'

const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      scope: { ...DEFAULT_SETTINGS.scope, ...(parsed.scope ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const loadMastery = (): MasteryMap => {
  try {
    const raw = localStorage.getItem(MASTERY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as MasteryMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export interface QuizEngine {
  settings: Settings
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  updateScope: <K extends keyof QuizScope>(key: K, value: QuizScope[K]) => void
  resetSettings: () => void

  tuning: Tuning
  phase: Phase
  question: Question | null
  verdict: Verdict
  guess: { string: number; fret: number } | null
  /** name 模式下用户选中的音级 */
  pickedNote: PitchClass | null
  /** octave 模式下用户标记的位置集合，key 为 `string:fret` */
  marked: Set<string>
  /** 当前这一轮倒计时的开始时间戳，用于重启进度环动画 */
  cycleToken: number
  running: boolean
  ringingString: number | null
  stats: Stats
  /** SRS 掌握度（只读展示用） */
  mastery: MasteryMap

  start: () => void
  stop: () => void
  reveal: () => void
  next: () => void
  answerAt: (stringNumber: number, fret: number) => void
  /** name 模式：选一个音名 */
  answerNote: (pc: PitchClass) => void
  /** octave 模式：标记 / 取消标记一个位置 */
  toggleMark: (stringNumber: number, fret: number) => void
  replay: () => void
  resetStats: () => void
  resetMastery: () => void
  /** 不计分地试听某个位置——练习之外的自由探索 */
  auditionAt: (stringNumber: number, fret: number) => void
}

export const useQuizEngine = (): QuizEngine => {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [phase, setPhase] = useState<Phase>('idle')
  const [question, setQuestion] = useState<Question | null>(null)
  const [verdict, setVerdict] = useState<Verdict>('pending')
  const [guess, setGuess] = useState<{ string: number; fret: number } | null>(null)
  const [pickedNote, setPickedNote] = useState<PitchClass | null>(null)
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [cycleToken, setCycleToken] = useState(0)
  const [running, setRunning] = useState(false)
  const [ringingString, setRingingString] = useState<number | null>(null)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [mastery, setMastery] = useState<MasteryMap>(loadMastery)

  const timerRef = useRef<number | null>(null)
  const ringTimerRef = useRef<number | null>(null)
  const questionRef = useRef<Question | null>(null)
  questionRef.current = question
  const masteryRef = useRef<MasteryMap>(mastery)
  masteryRef.current = mastery
  const markedRef = useRef<Set<string>>(marked)
  markedRef.current = marked
  const pickedNoteRef = useRef<PitchClass | null>(pickedNote)
  pickedNoteRef.current = pickedNote
  /** 本题是否已计分，防止 reveal / commit 重复计分 */
  const scoredRef = useRef(false)

  const tuning = useMemo(
    () => TUNINGS.find((t) => t.id === settings.tuningId) ?? STANDARD_TUNING,
    [settings.tuningId],
  )

  /* ─────────────────── 设置 / 记忆持久化 ─────────────────── */

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* 隐私模式下写不进去，忽略即可 */
    }
  }, [settings])

  useEffect(() => {
    try {
      localStorage.setItem(MASTERY_KEY, JSON.stringify(mastery))
    } catch {
      /* ignore */
    }
  }, [mastery])

  useEffect(() => {
    audioEngine.setVolume(settings.volume)
  }, [settings.volume])

  useEffect(() => {
    audioEngine.setMuted(settings.muted)
  }, [settings.muted])

  useEffect(() => {
    audioEngine.setProfile(settings.toneProfile)
  }, [settings.toneProfile])

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateScope = useCallback(<K extends keyof QuizScope>(key: K, value: QuizScope[K]) => {
    setSettings((prev) => ({ ...prev, scope: { ...prev.scope, [key]: value } }))
  }, [])

  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), [])
  const resetMastery = useCallback(() => setMastery({}), [])

  /* ─────────────────── 计时器工具 ─────────────────── */

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** 触发弦振动动画 */
  const flashString = useCallback((stringNumber: number) => {
    setRingingString(stringNumber)
    if (ringTimerRef.current !== null) window.clearTimeout(ringTimerRef.current)
    ringTimerRef.current = window.setTimeout(() => setRingingString(null), 520)
  }, [])

  const playNote = useCallback(
    (stringNumber: number, fret: number, velocity = 0.78) => {
      audioEngine.pluck(midiAt(tuning, stringNumber, fret), { velocity, stringNumber })
      flashString(stringNumber)
    },
    [tuning, flashString],
  )

  /** 播放任意音级（name 模式用户选音时给即时听觉反馈） */
  const playPitchClass = useCallback(
    (pc: PitchClass) => {
      for (const s of tuning.strings) {
        const frets = findFretsForPitchClass(tuning, s.number, pc, settings.scope.fretRange)
        if (frets.length > 0) {
          playNote(s.number, frets[0], 0.7)
          return
        }
      }
      // 范围外也至少响一声：以中央 C 为基准的该音级
      audioEngine.pluck(60 + pc, { velocity: 0.7 })
    },
    [tuning, settings.scope.fretRange, playNote],
  )

  /* ─────────────────── 计分（find / name / octave 共用）─────────────────── */

  const recordOutcome = useCallback(
    (correct: boolean, atString: number) => {
      const q = questionRef.current
      if (!q || scoredRef.current) return
      scoredRef.current = true
      const elapsed = Date.now() - q.createdAt
      setVerdict(correct ? 'hit' : 'miss')
      setStats((s) => {
        const [c, t] = s.perString[atString] ?? [0, 0]
        return {
          ...s,
          answered: s.answered + 1,
          correct: s.correct + (correct ? 1 : 0),
          streak: correct ? s.streak + 1 : 0,
          bestStreak: correct ? Math.max(s.bestStreak, s.streak + 1) : s.bestStreak,
          perString: { ...s.perString, [atString]: [c + (correct ? 1 : 0), t + 1] },
          reactionTimes: correct ? [...s.reactionTimes.slice(-29), elapsed] : s.reactionTimes,
        }
      })
      setMastery((m) => updateMastery(m, q.key, correct, Date.now()))
    },
    [],
  )

  /* ─────────────────── 出题 / 揭示 / 推进 ─────────────────── */

  const ask = useCallback(() => {
    const q = generateQuestion(
      tuning,
      settings.scope,
      settings.task,
      questionRef.current,
      settings.srsEnabled ? masteryRef.current : {},
    )
    if (!q) {
      setRunning(false)
      setPhase('idle')
      return
    }
    scoredRef.current = false
    setMarked(new Set())
    setPickedNote(null)
    setQuestion(q)
    setVerdict('pending')
    setGuess(null)
    setPhase('asking')
    setCycleToken((t) => t + 1)
    setStats((s) => ({ ...s, asked: s.asked + 1 }))

    if (settings.playOnAsk) {
      // 稍微延后一点点，让入场动画和声音同时到达
      window.setTimeout(() => playNote(q.string, q.primaryFret, 0.8), 90)
    }
  }, [tuning, settings.scope, settings.task, settings.srsEnabled, settings.playOnAsk, playNote])

  /** octave 结算：标记集合是否恰好等于全部正确位置 */
  const gradeOctave = useCallback(() => {
    const q = questionRef.current
    if (!q || q.task !== 'octave') return
    const correctSet = new Set(q.targets.map((t) => `${t.string}:${t.fret}`))
    const marks = markedRef.current
    let anyWrong = false
    let allHit = true
    marks.forEach((mk) => {
      if (!correctSet.has(mk)) anyWrong = true
    })
    correctSet.forEach((cs) => {
      if (!marks.has(cs)) allHit = false
    })
    const isHit = allHit && !anyWrong
    clearTimer()
    setPhase('revealed')
    recordOutcome(isHit, q.string)
    if (!isHit && settings.playOnReveal) {
      window.setTimeout(() => playNote(q.string, q.fret, 0.8), 420)
    }
  }, [clearTimer, settings.playOnReveal, playNote, recordOutcome])

  const reveal = useCallback(() => {
    const q = questionRef.current
    if (!q) return
    clearTimer()
    setPhase('revealed')
    if (q.task === 'find') {
      if (settings.playOnReveal) playNote(q.string, q.primaryFret, 0.72)
      return
    }
    if (q.task === 'name') {
      // 已作答则 recordOutcome 已在 answerNote 里完成；未作答只揭示答案
      if (settings.playOnReveal) playNote(q.string, q.fret, 0.72)
      return
    }
    // octave
    if (markedRef.current.size > 0 && !scoredRef.current) {
      gradeOctave()
      return
    }
    if (settings.playOnReveal) playNote(q.string, q.fret, 0.72)
  }, [clearTimer, settings.playOnReveal, playNote, gradeOctave])

  const next = useCallback(() => {
    clearTimer()
    ask()
  }, [clearTimer, ask])

  const start = useCallback(() => {
    void audioEngine.unlock()
    setRunning(true)
    ask()
  }, [ask])

  const stop = useCallback(() => {
    clearTimer()
    setRunning(false)
    setPhase('idle')
    setQuestion(null)
    setVerdict('pending')
    setGuess(null)
    setMarked(new Set())
    setPickedNote(null)
    audioEngine.silence()
  }, [clearTimer])

  const replay = useCallback(() => {
    const q = questionRef.current
    if (!q) return
    // 已揭示就弹真实位置，未揭示只给音高提示
    playNote(q.string, q.primaryFret, 0.82)
  }, [playNote])

  /* ─────────────────── 作答判定 ─────────────────── */

  const answerAt = useCallback(
    (stringNumber: number, fret: number) => {
      const q = questionRef.current
      if (!q || phase !== 'asking' || q.task !== 'find') return

      // 听见自己按的那个音，是最快的纠错反馈
      playNote(stringNumber, fret, 0.75)

      const correctString = stringNumber === q.string
      const correctPitch = pitchClassOf(midiAt(tuning, stringNumber, fret)) === q.pitchClass
      const inScope = q.answers.includes(fret)
      const isHit = correctString && correctPitch && inScope

      setGuess({ string: stringNumber, fret })
      clearTimer()
      setPhase('revealed')
      recordOutcome(isHit, q.string)

      if (!isHit) window.setTimeout(() => audioEngine.thud(), 120)

      // 答错时补一次正确音，形成「错音 → 正确音」的对照
      if (!isHit && settings.playOnReveal) {
        window.setTimeout(() => playNote(q.string, q.primaryFret, 0.8), 460)
      }
    },
    [phase, tuning, playNote, clearTimer, settings.playOnReveal, recordOutcome],
  )

  /** name 模式：用户在音名键盘上选一个音级 */
  const answerNote = useCallback(
    (pc: PitchClass) => {
      const q = questionRef.current
      if (!q || phase !== 'asking' || q.task !== 'name') return
      playPitchClass(pc)
      setPickedNote(pc)
      const isHit = pc === q.pitchClass
      clearTimer()
      setPhase('revealed')
      recordOutcome(isHit, q.string)
      if (!isHit && settings.playOnReveal) {
        window.setTimeout(() => playNote(q.string, q.fret, 0.8), 420)
      }
    },
    [phase, playPitchClass, clearTimer, settings.playOnReveal, playNote, recordOutcome],
  )

  /** octave 模式：标记 / 取消标记一个位置 */
  const toggleMark = useCallback(
    (stringNumber: number, fret: number) => {
      const q = questionRef.current
      if (!q || phase !== 'asking' || q.task !== 'octave') return
      const k = `${stringNumber}:${fret}`
      playNote(stringNumber, fret, 0.7)

      const nextSet = new Set(markedRef.current)
      if (nextSet.has(k)) nextSet.delete(k)
      else nextSet.add(k)
      markedRef.current = nextSet
      setMarked(nextSet)

      // 全部命中且无误标 → 立即结算（即时正反馈）
      if (nextSet.size > 0) {
        const correctSet = new Set(q.targets.map((t) => `${t.string}:${t.fret}`))
        let allHit = true
        let anyWrong = false
        nextSet.forEach((mk) => {
          if (!correctSet.has(mk)) anyWrong = true
        })
        correctSet.forEach((cs) => {
          if (!nextSet.has(cs)) allHit = false
        })
        if (allHit && !anyWrong) {
          window.setTimeout(() => gradeOctave(), 0)
        }
      }
    },
    [phase, playNote, gradeOctave],
  )

  const auditionAt = useCallback(
    (stringNumber: number, fret: number) => playNote(stringNumber, fret, 0.7),
    [playNote],
  )

  const resetStats = useCallback(() => setStats(EMPTY_STATS), [])

  /* ─────────────────── 自动流转 ─────────────────── */

  // asking → revealed（仅自动模式，手动模式等你出手）
  useEffect(() => {
    if (!running || phase !== 'asking' || settings.mode !== 'auto') return
    clearTimer()
    timerRef.current = window.setTimeout(reveal, settings.intervalSec * 1000)
    return clearTimer
  }, [running, phase, settings.mode, settings.intervalSec, cycleToken, reveal, clearTimer])

  // revealed → 下一题（自动模式自动推进；手动模式停下来等你）
  useEffect(() => {
    if (!running || phase !== 'revealed' || settings.mode !== 'auto') return
    clearTimer()
    timerRef.current = window.setTimeout(ask, settings.revealHoldSec * 1000)
    return clearTimer
  }, [running, phase, settings.mode, settings.revealHoldSec, ask, clearTimer])

  // 切换任务后，当前题目任务类型不一致就立即换一题
  useEffect(() => {
    if (!running || !question) return
    if (question.task !== settings.task) {
      next()
    }
  }, [running, question, settings.task, next])

  // 改动出题范围后，如果当前题目已经不在范围内，就换一题
  useEffect(() => {
    if (!running || !question) return
    const [lo, hi] = settings.scope.fretRange
    const stillValid =
      settings.scope.strings.includes(question.string) &&
      question.targets.some((t) => t.fret >= lo && t.fret <= hi)
    if (!stillValid) ask()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.scope.strings, settings.scope.fretRange, settings.scope.includeAccidentals])

  // 卸载时清干净
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (ringTimerRef.current !== null) window.clearTimeout(ringTimerRef.current)
    },
    [],
  )

  return {
    settings,
    update,
    updateScope,
    resetSettings,
    tuning,
    phase,
    question,
    verdict,
    guess,
    pickedNote,
    marked,
    cycleToken,
    running,
    ringingString,
    stats,
    mastery,
    start,
    stop,
    reveal,
    next,
    answerAt,
    answerNote,
    toggleMark,
    replay,
    resetStats,
    resetMastery,
    auditionAt,
  }
}

export { MAX_FRET }
