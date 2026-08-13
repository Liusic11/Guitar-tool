import { useCallback, useEffect, useMemo, useState } from 'react'
import { audioEngine } from '../lib/audio'
import {
  CHORD_TYPES,
  voiceChord,
  type ChordType,
} from '../lib/chords'
import {
  SCALES,
  scalePositions,
  type ScaleDef,
  type ScaleNote,
} from '../lib/scales'
import { midiAt, type PitchClass, type Tuning } from '../lib/music'

/* ──────────────────────────── 数据：音程 ──────────────────────────── */
interface IntervalDef {
  semis: number
  label: string
  /** 以歌带练的锚点（老师口吻 + 真实曲例） */
  ref: string
}
const INTERVALS: IntervalDef[] = [
  { semis: 1, label: '小二度', ref: '《Jaws》鲨鱼主题——两个音只差半音，刺耳又紧张。' },
  { semis: 2, label: '大二度', ref: '《Happy Birthday》"Hap-py" 的开头那个上行大二度。' },
  { semis: 3, label: '小三度', ref: '《Summertime》"Sum-mer"——忧郁的小三度上行。' },
  { semis: 4, label: '大三度', ref: '《When the Saints Go Marching In》"When-the"——明亮的大三度。' },
  { semis: 5, label: '纯四度', ref: '《Here Comes the Bride》"Here-comes" 那个庄严的纯四度。' },
  { semis: 6, label: '三全音', ref: '《The Simpsons》主题开头 "The-Simps-"——魔鬼的间隔。' },
  { semis: 7, label: '纯五度', ref: '《Twinkle Twinkle》"Twi-nkle"——空、稳的纯五度。' },
  { semis: 8, label: '小六度', ref: '《Love Me Tender》开头 "Love-me"——温柔的小六度。' },
  { semis: 9, label: '大六度', ref: 'NBC 三音钟声的后两个音——开阔的大六度。' },
  { semis: 10, label: '小七度', ref: '《Star Trek》主题开头那个大跳——属七和弦的 ♭7，想解决。' },
  { semis: 11, label: '大七度', ref: '《Take On Me》"Take-on"——悬而未落的大七度。' },
  { semis: 12, label: '纯八度', ref: '《Over the Rainbow》开头 "Some-where" 那个大跳——同一音高差八度。' },
]

/* ──────────────────────────── 题目模型 ──────────────────────────── */
interface EarOption {
  id: string
  label: string
}

type EarQuestion =
  | {
      kind: 'interval'
      rootMidi: number
      secondMidi: number
      answerId: string
      answerLabel: string
      options: EarOption[]
      explain: string
    }
  | {
      kind: 'chord'
      rootPc: PitchClass
      notes: (number | null)[]
      answerId: string
      answerLabel: string
      options: EarOption[]
      explain: string
    }
  | {
      kind: 'scale'
      rootPc: PitchClass
      run: ScaleNote[]
      answerId: string
      answerLabel: string
      options: EarOption[]
      explain: string
    }

type EarMode = 'interval' | 'chord' | 'scale'

type Verdict = 'none' | 'correct' | 'wrong'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 从最低根音开始取约一个八度的音阶音，供「音阶听辨」逐音上行播放 */
function scaleRun(tuning: Tuning, rootPc: PitchClass, formula: number[]): ScaleNote[] {
  const all = scalePositions(tuning, rootPc, formula, [0, 15]).sort((a, b) => a.midi - b.midi)
  const root = all.find((n) => n.degree === 0) ?? all[0]
  if (!root) return []
  return all.filter((n) => n.midi >= root.midi && n.midi <= root.midi + 14).slice(0, 8)
}

const ROOT_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/* ──────────────────────────── 组件 ──────────────────────────── */
export function EarTrainer({ tuning }: { tuning: Tuning }) {
  const [mode, setMode] = useState<EarMode>('interval')
  const [question, setQuestion] = useState<EarQuestion | null>(null)
  const [verdict, setVerdict] = useState<Verdict>('none')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [stats, setStats] = useState({ answered: 0, correct: 0, streak: 0 })

  const genQuestion = useCallback(
    (m: EarMode): EarQuestion => {
      if (m === 'interval') {
        const def = INTERVALS[Math.floor(Math.random() * INTERVALS.length)]
        const rootMidi = 57 + Math.floor(Math.random() * 12) // A3..G#4 舒适音区
        return {
          kind: 'interval',
          rootMidi,
          secondMidi: rootMidi + def.semis,
          answerId: String(def.semis),
          answerLabel: def.label,
          options: shuffle(INTERVALS.map((i) => ({ id: String(i.semis), label: i.label }))),
          explain: def.ref,
        }
      }
      if (m === 'chord') {
        const t: ChordType = CHORD_TYPES[Math.floor(Math.random() * CHORD_TYPES.length)]
        const rootPc = (Math.floor(Math.random() * 12) as PitchClass)
        const v = voiceChord(rootPc, t, tuning)
        const notes = v.notes.map((n) => (n.muted ? null : midiAt(tuning, n.string, n.fret)))
        return {
          kind: 'chord',
          rootPc,
          notes,
          answerId: t.id,
          answerLabel: t.label,
          options: shuffle(CHORD_TYPES.map((c) => ({ id: c.id, label: c.label }))),
          explain: `${t.color} · ${t.ear}`,
        }
      }
      // scale
      const s: ScaleDef = SCALES[Math.floor(Math.random() * SCALES.length)]
      const rootPc = (Math.floor(Math.random() * 12) as PitchClass)
      const run = scaleRun(tuning, rootPc, s.formula)
      return {
        kind: 'scale',
        rootPc,
        run,
        answerId: s.id,
        answerLabel: s.label,
        options: shuffle(SCALES.map((x) => ({ id: x.id, label: x.label }))),
        explain: `${s.color} · ${s.usage}`,
      }
    },
    [tuning],
  )

  // 模式切换 / 首屏：生成一道新题
  useEffect(() => {
    setQuestion(genQuestion(mode))
    setVerdict('none')
    setPickedId(null)
  }, [mode, genQuestion])

  const playQuestion = useCallback(() => {
    if (!question) return
    void audioEngine.unlock()
    if (question.kind === 'interval') {
      audioEngine.pluck(question.rootMidi, { velocity: 0.9 })
      audioEngine.pluck(question.secondMidi, { velocity: 0.9, delay: 0.55 })
    } else if (question.kind === 'chord') {
      audioEngine.strum(question.notes, 0.02)
    } else {
      question.run.forEach((n, i) => audioEngine.pluck(n.midi, { velocity: 0.85, delay: i * 0.3 }))
    }
  }, [question])

  // 新题自动播一次（需先有一次用户交互解锁音频，点「下一题」即满足）
  useEffect(() => {
    if (question) playQuestion()
  }, [question, playQuestion])

  const answer = useCallback(
    (id: string) => {
      if (!question || verdict !== 'none') return
      setPickedId(id)
      const ok = id === question.answerId
      setVerdict(ok ? 'correct' : 'wrong')
      setStats((s) => ({
        answered: s.answered + 1,
        correct: s.correct + (ok ? 1 : 0),
        streak: ok ? s.streak + 1 : 0,
      }))
      if (ok) playQuestion()
    },
    [question, verdict, playQuestion],
  )

  const next = useCallback(() => {
    setQuestion(genQuestion(mode))
    setVerdict('none')
    setPickedId(null)
  }, [mode, genQuestion])

  // 快捷键：空格再听，回车下一题（仅 ear 视图内）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        playQuestion()
      } else if (e.key === 'Enter' && verdict !== 'none') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playQuestion, next, verdict])

  const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : null
  const modeLabel = useMemo(
    () => ({ interval: '音程辨识', chord: '和弦辨识', scale: '音阶听辨' }[mode]),
    [mode],
  )

  return (
    <main className="module-stage ear-stage">
      <div className="module-scroll">
        <div className="chord-panel ear-panel">
          {/* 模式选择 */}
          <div className="scale-controls">
            <div className="field field--practice">
              <label className="field__label">耳朵训练</label>
              <div className="segmented" role="group" aria-label="训练类型">
                <button
                  className="segmented__item"
                  aria-pressed={mode === 'interval'}
                  onClick={() => setMode('interval')}
                >
                  音程
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={mode === 'chord'}
                  onClick={() => setMode('chord')}
                >
                  和弦
                </button>
                <button
                  className="segmented__item"
                  aria-pressed={mode === 'scale'}
                  onClick={() => setMode('scale')}
                >
                  音阶
                </button>
              </div>
            </div>
            <div className="ear-stats" aria-live="polite">
              {stats.streak > 0 && (
                <span className="stat stat--streak">
                  <span className="stat__value">{stats.streak}</span>
                  <span className="stat__label">连对</span>
                </span>
              )}
              {accuracy !== null && (
                <span className="stat">
                  <span className="stat__value">{accuracy}%</span>
                  <span className="stat__label">正确率</span>
                </span>
              )}
              <span className="stat">
                <span className="stat__value">{stats.answered}</span>
                <span className="stat__label">题</span>
              </span>
            </div>
          </div>

          <div className="ear-layout">
            {/* 左：题目 + 播放 + 选项 */}
            <section className="ear-figure" aria-label="听音答题">
              <div className="ear-prompt">🎧 听好了——这是{modeLabel}？点下面的选项猜一猜。</div>

              <button className="ear-play" onClick={playQuestion} type="button">
                ▶ 再听一遍
                <small>（或按空格）</small>
              </button>

              <div className="ear-options">
                {question?.options.map((opt) => {
                  const isAnswer = opt.id === question.answerId
                  const isPicked = opt.id === pickedId
                  const cls = [
                    'ear-opt',
                    verdict !== 'none' && isAnswer ? 'is-correct' : '',
                    verdict === 'wrong' && isPicked ? 'is-wrong' : '',
                  ].join(' ').trim()
                  return (
                    <button
                      key={opt.id}
                      className={cls}
                      disabled={verdict !== 'none'}
                      onClick={() => answer(opt.id)}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <div className="ear-verdict">
                {verdict === 'correct' && (
                  <span className="ear-verdict__ok">✓ 对！就是「{question?.answerLabel}」</span>
                )}
                {verdict === 'wrong' && (
                  <span className="ear-verdict__no">
                    ✗ 答错了——正确答案是「{question?.answerLabel}」
                  </span>
                )}
                {verdict === 'none' && <span className="ear-verdict__hint">点一个选项，听完再想</span>}
                {verdict !== 'none' && (
                  <button className="btn btn--primary ear-next" onClick={next} type="button">
                    下一题 →
                  </button>
                )}
              </div>
            </section>

            {/* 右：老师提示（揭示后给解析） */}
            <aside className="ear-theory" aria-label="解析">
              <h3 className="chord-theory__title">老师提示</h3>
              <p className="chord-theory__lead">
                耳朵是吉他手最被低估的肌肉。先别看谱——闭上眼睛，让音自己说话。猜完再看右边，把「名字」和「听到的感觉」对上号。
              </p>

              <div className="ear-teacher-tip">
                <p className="ear-teacher-tip__head">{modeLabel}怎么练</p>
                <ul className="ear-teacher-tip__list">
                  <li>
                    <strong>音程</strong>：先死磕 4 个最常用——大三度、纯五度、纯四度、小三度。它们是和弦与旋律的骨架。
                  </li>
                  <li>
                    <strong>和弦</strong>：先分「大 / 小」的情绪（亮 vs 暗），再听七和弦多出来的那个音。♭7 想走，大七甜，减七最紧张。
                  </li>
                  <li>
                    <strong>音阶</strong>：听「暗 / 亮」和那个特殊的音——蓝调音（♭5）一出现就是 blues；♭7 在就是 mixolydian。
                  </li>
                </ul>
              </div>

              {verdict !== 'none' && question && (
                <div className="ear-explain">
                  <p className="ear-explain__label">
                    答案：<strong>{question.answerLabel}</strong>
                    {question.kind !== 'interval' && (
                      <span className="ear-explain__root">
                        {' '}
                        · 根音 {ROOT_LABELS[question.rootPc]}
                      </span>
                    )}
                  </p>
                  <p className="ear-explain__body">{question.explain}</p>
                </div>
              )}

              <p className="ear-foot">
                提示：练习音阶 / 和弦时，底部节奏条已经把律动嵌进去了——耳朵训练专注「听得出」，节奏交给鼓点。
              </p>
            </aside>
          </div>
        </div>
      </div>
    </main>
  )
}
