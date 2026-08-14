/**
 * 乐句库（Lick Library）· 第 6 个视图「乐句」
 * ─────────────────────────────────────────────
 * 「词汇 → 造句」的中间层：别人写好的、真实语感的乐句。
 * 每条乐句 = 指板高亮 + 播放 + 老师拆解（用了哪几个音、为什么好听、怎么练）。
 * 可移调：选根音，整句平移到新把位（transposeLick）。
 *
 * 布局（单屏 1080p，两栏，对齐音阶页）：
 *  · 顶部：风格筛选 + 根音
 *  · 左大栏：指板（乐句音高亮，根音橙/其余强调色）+ 播放控制 + 逐音清单
 *  · 右小栏：乐句列表（点选）+ 老师面板（why / timing / 适用和弦 / tip）
 *
 * 复用：Fretboard（高亮）、audioEngine.pluck（播放）、sessionStore（Jam 贯通跳转）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Fretboard, type Highlight } from './Fretboard'
import { audioEngine } from '../lib/audio'
import {
  LICKS,
  LICK_STYLES,
  LICK_STYLE_LABEL,
  transposeLick,
  lickDegreeAt,
  type Lick,
  type LickStyle,
} from '../lib/licks'
import { letterOf, midiAt, pitchClassOf, type Tuning } from '../lib/music'
import { sessionStore } from '../lib/session'

/** 按节奏提示估算每个音的间隔（秒）——只影响播放听感，不影响乐理 */
function stepFor(timing: string): number {
  if (timing.includes('16 分')) return 0.14
  if (timing.includes('三连音')) return 0.2
  if (timing.includes('摇摆')) return 0.26
  return 0.3
}

/** 乐句 → Jam 进行的一键落点（按风格配一个顺手的进行） */
const STYLE_PRESET: Record<LickStyle, string> = {
  blues: '12-bar-blues',
  funk: '1-6-4-5',
  jazz: 'ii-V-I',
  rock: '1-5-6-4',
}

export function LickLibrary({ tuning }: { tuning: Tuning }) {
  const [style, setStyle] = useState<LickStyle | 'all'>('all')
  const [rootPc, setRootPc] = useState<number>(() => sessionStore.get().rootPc ?? 9)
  const [selectedId, setSelectedId] = useState<string>(() => {
    const requested = sessionStore.get().lickId
    return requested ?? LICKS[0].id
  })
  const [playing, setPlaying] = useState(false)
  const [playIdx, setPlayIdx] = useState(-1)

  const timerRef = useRef<number | null>(null)

  const selected = useMemo(() => LICKS.find((l) => l.id === selectedId) ?? LICKS[0], [selectedId])
  const list = useMemo(
    () => (style === 'all' ? LICKS : LICKS.filter((l) => l.style === style)),
    [style],
  )

  // 挂载时优先消费 Jam / 和弦页的「去乐句页练这个」目标
  useEffect(() => {
    const requested = sessionStore.get().lickId
    if (requested && LICKS.some((l) => l.id === requested)) {
      setSelectedId(requested)
      const lick = LICKS.find((l) => l.id === requested)!
      setRootPc(lick.rootPc)
    }
  }, [])

  const notes = useMemo(
    () => transposeLick(selected, rootPc, tuning),
    [selected, rootPc, tuning],
  )

  const fretRange = useMemo<[number, number]>(() => {
    if (!notes) return [0, 12]
    let lo = 99
    let hi = -1
    for (const n of notes) {
      if (n.fret < lo) lo = n.fret
      if (n.fret > hi) hi = n.fret
    }
    return [Math.max(0, lo - 1), Math.min(15, hi + 2)]
  }, [notes])

  const highlights = useMemo<Highlight[]>(() => {
    if (!notes) return []
    return notes.map((n, i) => ({
      string: n.string,
      fret: n.fret,
      kind: i === playIdx ? ('hit' as const) : n.fret === (notes[0]?.fret ?? -1) ? ('answer' as const) : ('secondary' as const),
      label: lickDegreeAt(n.string, n.fret, rootPc, tuning),
    }))
  }, [notes, playIdx, rootPc, tuning])

  // 播放：逐音 pluck + 高亮推进
  const play = useCallback(
    (lick: Lick, root: number) => {
      const seq = transposeLick(lick, root, tuning)
      if (!seq) return
      const step = stepFor(lick.timing)
      void audioEngine.unlock()
      setPlaying(true)
      setPlayIdx(0)
      audioEngine.pluck(midiAt(tuning, seq[0].string, seq[0].fret), {
        stringNumber: seq[0].string,
        velocity: 0.85,
      })
      seq.forEach((n, i) => {
        if (i === 0) return
        const delay = step * i
        window.setTimeout(() => {
          audioEngine.pluck(midiAt(tuning, n.string, n.fret), {
            stringNumber: n.string,
            velocity: 0.85,
          })
          setPlayIdx(i)
        }, delay * 1000)
      })
      const lastDelay = step * (seq.length - 1) * 1000 + 400
      timerRef.current = window.setTimeout(() => {
        setPlaying(false)
        setPlayIdx(-1)
      }, lastDelay)
    },
    [tuning],
  )

  const stopPlayback = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPlaying(false)
    setPlayIdx(-1)
  }, [])

  useEffect(() => stopPlayback, [stopPlayback, selectedId, rootPc])

  const goJam = useCallback(() => {
    sessionStore.setRoot(selected.rootPc)
    sessionStore.setJamPreset(STYLE_PRESET[selected.style])
    sessionStore.requestNav('jam')
  }, [selected])

  const ringing = playIdx >= 0 && notes ? notes[playIdx]?.string ?? null : null

  return (
    <main className="module-scroll lick">
      {/* ── 顶部控制：风格 + 根音 ── */}
      <div className="lick-controls">
        <div className="field">
          <span className="field__label">风格</span>
          <div className="segmented" role="group" aria-label="乐句风格">
            {LICK_STYLES.map((s) => (
              <button
                key={s.id}
                className="segmented__item"
                aria-pressed={style === s.id}
                onClick={() => setStyle(s.id)}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field field--lickroot">
          <span className="field__label">根音（整句移调）</span>
          <div className="segmented segmented--wrap" role="group" aria-label="根音">
            {Array.from({ length: 12 }, (_, pc) => (
              <button
                key={pc}
                className="segmented__item"
                aria-pressed={rootPc === pc}
                onClick={() => setRootPc(pc)}
                type="button"
              >
                {letterOf(pc)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 主体：指板 + 老师面板 ── */}
      <div className="lick-layout">
        <section className="lick-figure">
          <div className="lick-figure__head">
            <div>
              <span className="lick-figure__style">{LICK_STYLE_LABEL[selected.style]}</span>
              <span className="lick-figure__name">{selected.name}</span>
              <span className="lick-figure__diff">{'●'.repeat(selected.difficulty)}{'○'.repeat(3 - selected.difficulty)}</span>
            </div>
            <div className="lick-figure__actions">
              <button
                className="btn btn--primary"
                onClick={() => (playing ? stopPlayback() : play(selected, rootPc))}
                type="button"
              >
                {playing ? '■ 停止' : '▶ 播放这句'}
              </button>
              <button className="btn btn--ghost" onClick={goJam} type="button" title="带着这句的根音/风格去 Jam 页即兴">
                去 Jam 页练这个 →
              </button>
            </div>
          </div>

          <div className="lick-figure__board">
            <Fretboard
              tuning={tuning}
              maxFret={15}
              highlights={highlights}
              targetString={null}
              scopeRange={fretRange}
              interactive
              showAllNotes={false}
              labelMode="letter"
              ringingString={ringing}
              onFretClick={(s, f) =>
                audioEngine.pluck(midiAt(tuning, s, f), { stringNumber: s, velocity: 0.8 })
              }
              compact
            />
          </div>

          {/* ── 逐音清单：弦·品·音名·级数 ── */}
          <div className="lick-figure__notes" aria-label="乐句音符">
            {notes?.map((n, i) => (
              <span
                key={`${n.string}:${n.fret}:${i}`}
                className={`lick-note-chip${i === playIdx ? ' is-current' : ''}`}
              >
                <b>{n.string}弦{n.fret}品</b>
                <span className="lick-note-chip__letter">
                  {letterOf(pitchClassOf(midiAt(tuning, n.string, n.fret)))}
                </span>
                <span className="lick-note-chip__deg">{lickDegreeAt(n.string, n.fret, rootPc, tuning)}</span>
              </span>
            )) ?? <p className="lick-figure__empty">该根音超出可弹范围，换个根音试试</p>}
          </div>

          <p className="lick-figure__hint">点指板上的音可试听 · 移调后整句平移到新把位，度数不变</p>
        </section>

        <aside className="lick-theory chord-theory">
          <h2 className="chord-theory__title">乐句列表 · {style === 'all' ? '全部' : LICK_STYLE_LABEL[style]}</h2>
          <div className="lick-list" role="listbox" aria-label="乐句列表">
            {list.map((l) => (
              <button
                key={l.id}
                className={`lick-card${l.id === selectedId ? ' is-active' : ''}`}
                aria-pressed={l.id === selectedId}
                onClick={() => setSelectedId(l.id)}
                type="button"
                role="option"
              >
                <span className="lick-card__head">
                  <b>{l.name}</b>
                  <span className="lick-card__meta">
                    {LICK_STYLE_LABEL[l.style]} · {l.difficulty} 星
                  </span>
                </span>
                <span className="lick-card__timing">{l.timing}</span>
              </button>
            ))}
          </div>

          <div className="lick-theory__panel">
            <div className="chord-theory__h">老师拆解</div>
            <p className="chord-theory__p">{selected.why}</p>
            <p className="chord-theory__p lick-theory__tip">
              <b>怎么练：</b>
              {selected.tip}
            </p>
            <div className="lick-theory__tags">
              <span className="lick-theory__tag">适合和弦：{selected.worksOver.map((t) => ` ${t}`)}</span>
              <span className="lick-theory__tag">节奏：{selected.timing}</span>
              <span className="lick-theory__tag">
                参考根音：{letterOf(selected.rootPc)} · 当前 {letterOf(rootPc)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
