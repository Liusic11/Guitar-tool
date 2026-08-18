/**
 * Jam 训练器——把「节奏 + 和弦进行 + 在合适音阶里选音」焊成一个可练的闭环。
 *
 * 布局（单屏 1080p，两栏）：
 *  · 顶部：进行预设选择 + 音阶模式（全局父音阶 / 每和弦换音阶）+ 父调标签
 *  · 进行时间轴：每和弦一张小和弦图 + 级数，当前和弦高亮，点一下可手动跳
 *  · 左大栏：指板，底部按钮在「和弦形状」↔「音阶音高亮」两态切换
 *  · 右小栏：老师口吻——为什么这个进行用这个音阶 / 当前和弦该上什么音阶
 *  · 底部：节奏条（复用 RhythmBar，跟拍推进和弦）+ 出声 backing 开关 + 跳去音阶/和弦页
 *
 * 复用：RhythmBar（节奏）、ChordDiagram / voiceChord（和弦形状与把位）、
 * Fretboard（高亮）、harmony.ts（老师文案）、sessionStore（贯通跳转）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Fretboard, type Highlight } from './Fretboard'
import { ChordDiagram } from './ChordDiagram'
import { RhythmBar } from './RhythmBar'
import { audioEngine } from '../lib/audio'
import { getGroove } from '../lib/rhythm'
import { useRhythmState } from '../lib/rhythmStore'
import { voiceChord, listChordVoicings, type ChordPosition } from '../lib/chords'
import { SCALES, scalePositions } from '../lib/scales'
import { midiAt, LETTER_NAMES, type PitchClass, type Tuning } from '../lib/music'
import { scaleSuggestions } from '../lib/harmony'
import {
  JAM_PRESETS,
  typeOf,
  jamChordName,
  progressionKeyLabel,
  globalScaleFor,
  perChordScaleFor,
  scaleLabel,
} from '../lib/progressions'
import { sessionStore } from '../lib/session'
import { LICKS, licksForChordType, transposeLick, LICK_STYLE_LABEL, type Lick, type LickNote, type LickStyle } from '../lib/licks'
import {
  advisorHighlights,
  advisorStory,
  closestMidiForPc,
  type AdvisorLevel,
} from '../lib/advisor'
import { TutorialDrawer } from './TutorialDrawer'
import { JAM_TUTORIAL } from '../lib/tutorials'
import { STRUM_PATTERNS } from '../lib/strums'

type ScaleMode = 'global' | 'perchord'
type RenderMode = 'chord' | 'scale' | 'lick'

/** 参谋递进选项：0 = 原样（不精选，整条音阶）；3/5/7 精选；'all' 全开 */
const ADVISOR_OPTIONS: { id: AdvisorLevel; label: string }[] = [
  { id: 0, label: '原样' },
  { id: 3, label: '3 音' },
  { id: 5, label: '5 音' },
  { id: 7, label: '7 音' },
  { id: 'all', label: '全开' },
]

/** Jam 把位形状组：四个和弦共用同一 CAGED 形状 */
const JAM_SHAPES: { id: ChordPosition; label: string }[] = [
  { id: 'root6', label: 'E 形' },
  { id: 'root5', label: 'A 形' },
  { id: 'root4', label: 'D 形' },
  { id: 'g', label: 'G 形' },
  { id: 'c', label: 'C 形' },
  { id: 'open', label: '开放' },
]

export function JamTrainer({ tuning }: { tuning: Tuning }) {
  const { bpm, grooveId } = useRhythmState()

  const [presetId, setPresetId] = useState<string>(() => {
    // 耳朵训练「去 Jam 页练这个」写入的目标进行：挂载时优先接上
    const requested = sessionStore.get().jamPresetId
    return requested ?? JAM_PRESETS[0].id
  })
  const preset = useMemo(
    () => JAM_PRESETS.find((p) => p.id === presetId) ?? JAM_PRESETS[0],
    [presetId],
  )

  const [scaleMode, setScaleMode] = useState<ScaleMode>('global')
  const [renderMode, setRenderMode] = useState<RenderMode>('chord')
  const [backing, setBacking] = useState(false)
  const [advisorLevel, setAdvisorLevel] = useState<AdvisorLevel>(5)
  const [activeLick, setActiveLick] = useState<{
    id: string
    name: string
    notes: LickNote[]
    style: LickStyle
    timing: string
    difficulty: number
  } | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  /** 参谋窗口外是否显示同一批音的远八度弱标（熟练后跨八度跳用） */
  const [showFarOctaves, setShowFarOctaves] = useState(false)
  /** 扫弦型：null = 不启用（用默认「每换和弦扫一下」） */
  const [strumPatternId, setStrumPatternId] = useState<string | null>(null)
  /** 预备拍：开始前空一小节 count-in，方便开内录 */
  const [countIn, setCountIn] = useState(false)

  const [chordIndex, setChordIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  // 形状组：四个和弦共用同一个 CAGED 形状（E/A/D/开放），不随和弦切换跳回
  const [shape, setShape] = useState<ChordPosition>('root6')

  const currentChord = preset.chords[chordIndex]

  // 当前和弦固定用「形状组」的指法（选了 E 形，四个和弦都 E 形）
  const currentVoicing = useMemo(
    () => voiceChord(currentChord.rootPc, typeOf(currentChord.typeId), tuning, shape),
    [currentChord.rootPc, currentChord.typeId, tuning, shape],
  )

  // 实时引用：RhythmBar 的每步回调里读最新扫弦型 / 和弦指法，避免闭包过期
  const strumPatternRef = useRef<string | null>(null)
  strumPatternRef.current = strumPatternId
  const voicingRef = useRef(currentVoicing)
  voicingRef.current = currentVoicing

  // 进入 Jam 即把父调写进共享上下文，其他模块能看到这条调性线
  useEffect(() => {
    sessionStore.setRoot(preset.keyPc)
    sessionStore.setKey(preset.keyPc, preset.keyQuality)
  }, [preset])

  // ── 时间轴每和弦的小和弦图（一次算好）──
  const stepVoicings = useMemo(
    () => preset.chords.map((c) => voiceChord(c.rootPc, typeOf(c.typeId), tuning, shape)),
    [preset, tuning, shape],
  )

  // ── 当前激活音阶（global 用父音阶；perchord 用当前和弦推荐音阶）──
  const activeScale = useMemo(() => {
    if (scaleMode === 'global') return globalScaleFor(preset)
    const scaleId = perChordScaleFor(preset, chordIndex)
    const def = SCALES.find((s) => s.id === scaleId) ?? SCALES[0]
    return { scaleId: def.id, rootPc: currentChord.rootPc as PitchClass, formula: def.formula }
  }, [scaleMode, preset, chordIndex, currentChord.rootPc])

  /**
   * 参谋的指板范围：
   *   · 3 / 5 / 7 音 —— 只亮当前和弦形状的把位窗口（跟把位走，选 E 形就亮 E 形那块）
   *   · 开「远八度」或 全放开 / 全部 —— 整条指板
   */
  const advisorFretRange: [number, number] = useMemo(() => {
    if (advisorLevel === 0 || advisorLevel === 'all' || showFarOctaves) return [0, 15]
    const lo = Math.max(0, currentVoicing.baseFret - 1)
    const hi = Math.min(15, currentVoicing.baseFret + 5)
    return [lo, hi]
  }, [advisorLevel, showFarOctaves, currentVoicing.baseFret])

  // ── 指板高亮 ──
  const highlights = useMemo<Highlight[]>(() => {
    if (renderMode === 'chord') {
      return currentVoicing.notes
        .filter((n) => !n.muted)
        .map((n) => ({ string: n.string, fret: n.fret, kind: n.isRoot ? ('answer' as const) : ('secondary' as const) }))
    }

    // 乐句模式：转调后的乐句音用 target 强调，可用的音阶音压暗当背景
    if (renderMode === 'lick') {
      if (!activeLick) return []
      const out: Highlight[] = activeLick.notes.map((n) => ({
        string: n.string,
        fret: n.fret,
        kind: 'target' as const,
      }))
      const bg = scalePositions(tuning, activeScale.rootPc, activeScale.formula, [0, 15])
      for (const p of bg) {
        if (!activeLick.notes.some((n) => n.string === p.string && n.fret === p.fret)) {
          out.push({ string: p.string, fret: p.fret, kind: 'ghost' as const })
        }
      }
      return out
    }

    // 音阶模式：参谋开 → 精选「落点 + 逼近音」；关 → 原「全部音阶音」
    if (advisorLevel !== 0) {
      return advisorHighlights({
        tuning,
        level: advisorLevel,
        chord: currentChord,
        keyPc: preset.keyPc,
        keyQuality: preset.keyQuality,
        window: [currentVoicing.baseFret, currentVoicing.baseFret + 4],
        fretRange: advisorFretRange,
      })
    }
    const lo = currentVoicing.baseFret
    const hi = currentVoicing.baseFret + 4
    const positions = scalePositions(tuning, activeScale.rootPc, activeScale.formula, [0, 15])
    return positions.map((p) => {
      if (p.degree === 0) return { string: p.string, fret: p.fret, kind: 'answer' as const }
      const near = p.fret >= lo && p.fret <= hi
      return { string: p.string, fret: p.fret, kind: near ? ('accent' as const) : ('secondary' as const) }
    })
  }, [renderMode, currentVoicing, activeScale, advisorLevel, activeLick, currentChord, preset, tuning, advisorFretRange])

  const scopeRange: [number, number] = useMemo(() => {
    if (renderMode === 'chord') return [currentVoicing.baseFret, currentVoicing.baseFret + 4]
    if (renderMode === 'lick' && activeLick) {
      let lo = 99
      let hi = -1
      for (const n of activeLick.notes) {
        if (n.fret < lo) lo = n.fret
        if (n.fret > hi) hi = n.fret
      }
      return [Math.max(0, lo - 1), Math.min(15, hi + 2)]
    }
    return advisorFretRange
  }, [renderMode, currentVoicing.baseFret, activeLick, advisorFretRange])

  const onFretClick = useCallback(
    (stringNumber: number, fret: number) => {
      void audioEngine.unlock()
      audioEngine.pluck(midiAt(tuning, stringNumber, fret), { stringNumber, velocity: 0.82 })
    },
    [tuning],
  )

  // ── 跟拍推进和弦（复用 RhythmBar 的 onBeat）──
  const tickRef = useRef(0)
  const lastBeatRef = useRef(0)
  const chordIdxRef = useRef(0)
  const presetRef = useRef(preset)
  const bpmRef = useRef(bpm)
  const beatsPerBarRef = useRef(4)
  const backingRef = useRef(backing)
  presetRef.current = preset
  bpmRef.current = bpm
  backingRef.current = backing
  const rhythmPreset = getGroove(grooveId)
  beatsPerBarRef.current = rhythmPreset.steps.length / rhythmPreset.subdiv

  const handleBeat = useCallback(
    (beat: number) => {
      void audioEngine.unlock()
      const now = audioEngine.currentTime
      const beatDur = 60 / bpmRef.current
      // 重新开始标志：拍号回到 0 且距上次超过 2.5 拍（用户暂停后又开始）
      // 用音频时钟判断，避免和 RhythmBar 的播放产生漂移
      if (beat === 0 && now - lastBeatRef.current > beatDur * 2.5) {
        tickRef.current = 0
        chordIdxRef.current = 0
        setChordIndex(0)
        setPlaying(true)
      }
      lastBeatRef.current = now
      tickRef.current += 1
      const bpb = beatsPerBarRef.current
      const bar = Math.floor((tickRef.current - 1) / bpb)
      const n = presetRef.current.chords.length
      const idx = ((bar % n) + n) % n
      if (idx !== chordIdxRef.current) {
        chordIdxRef.current = idx
        setChordIndex(idx)
        // 有扫弦型时由图案逐下扫（避免换和弦那一下额外多扫一次）
        if (backingRef.current && !strumPatternRef.current) {
          const c = presetRef.current.chords[idx]
          const v = voiceChord(c.rootPc, typeOf(c.typeId), tuning)
          audioEngine.strum(
            v.notes.map((m) => (m.muted ? null : midiAt(tuning, m.string, m.fret))),
            0.009,
          )
        }
      }
    },
    [tuning],
  )

  // ── 扫弦型：每个 subdiv 步按图案扫当前和弦（D 下扫 / U 上扫），精确对齐音频时钟 ──
  const handleStep = useCallback(
    (stepInBar: number, t: number) => {
      const pid = strumPatternRef.current
      if (!pid) return
      const pat = STRUM_PATTERNS.find((x) => x.id === pid)
      if (!pat) return
      const dir = pat.steps[stepInBar % pat.steps.length]
      if (dir === '_') return
      const v = voicingRef.current
      const notes = v.notes.map((n) => (n.muted ? null : midiAt(tuning, n.string, n.fret)))
      audioEngine.strum(notes, dir === 'D' ? 0.009 : -0.009, t)
    },
    [tuning],
  )

  //  watchdog：RhythmBar 停了就不再有 beat，把 playing 归位（同样用音频时钟）
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const now = audioEngine.currentTime
      if (now - lastBeatRef.current > (60 / bpmRef.current) * 3) setPlaying(false)
    }, 400)
    return () => window.clearInterval(id)
  }, [playing, bpm])

  // ── 贯通跳转 ──
  const goScale = useCallback(() => {
    sessionStore.setRoot(activeScale.rootPc)
    sessionStore.setScale(activeScale.scaleId)
    sessionStore.requestNav('scales')
  }, [activeScale])
  const goChord = useCallback(() => {
    sessionStore.setRoot(currentChord.rootPc)
    sessionStore.setChord(currentChord.typeId)
    sessionStore.requestNav('chords')
  }, [currentChord])

  // ── 参谋：故事线文案 + 示范播放 ──
  // showPairs 只在 7 音 / 全开时为 true：4、7 两个逼近音在 3/5 音还没高亮，不能提前讲故事
  const story = useMemo(
    () =>
      advisorLevel !== 0 && renderMode === 'scale'
        ? advisorStory(
            preset.keyPc,
            preset.keyQuality,
            currentChord,
            advisorLevel === 7 || advisorLevel === 'all',
          )
        : null,
    [advisorLevel, renderMode, preset, currentChord],
  )

  /** 指板标题：参谋开着时如实显示「实际高亮的是什么」，不拿 activeScale 的名字骗人 */
  const advisorCaption = useMemo(() => {
    if (advisorLevel === 0) return scaleLabel(activeScale.scaleId)
    const keyName = `${LETTER_NAMES[preset.keyPc]}${preset.keyQuality === 'major' ? '大调' : '小调'}`
    switch (advisorLevel) {
      case 3:
        return `参谋 · 3 音：只落当前和弦音（${keyName}）`
      case 5:
        return `参谋 · 5 音：落点 + 五声经过音（${keyName}）`
      case 7:
        return `参谋 · 7 音：${keyName}全音阶（加了 4、7 两个想回家的音）`
      default:
        return `参谋 · 全开：${keyName}全音阶 + 乐句`
    }
  }, [advisorLevel, activeScale, preset])

  const playStoryDemo = useCallback(() => {
    void audioEngine.unlock()
    const s = advisorStory(preset.keyPc, preset.keyQuality, currentChord, true)
    let t = 0
    for (const pair of s.pairs) {
      const m1 = closestMidiForPc(tuning, pair.from.pc, [1, 15])
      const m2 = closestMidiForPc(tuning, pair.to.pc, [1, 15])
      if (m1 != null) audioEngine.pluck(m1, { delay: t, velocity: 0.85 })
      if (m2 != null) audioEngine.pluck(m2, { delay: t + 0.55, velocity: 0.85 })
      t += 1.15
    }
  }, [tuning, preset, currentChord])

  // ── 乐句联动：在 Jam 指板上直接高亮 + 示范播放 / 去乐句页学 ──
  const playLickInJam = useCallback(
    (l: Lick) => {
      const notes = transposeLick(l, currentChord.rootPc, tuning)
      if (!notes) return
      setActiveLick({
        id: l.id,
        name: l.name,
        notes,
        style: l.style,
        timing: l.timing,
        difficulty: l.difficulty,
      })
      setRenderMode('lick')
      void audioEngine.unlock()
      notes.forEach((n, i) =>
        audioEngine.pluck(midiAt(tuning, n.string, n.fret), {
          delay: i * 0.14,
          stringNumber: n.string,
          velocity: 0.85,
        }),
      )
    },
    [tuning, currentChord],
  )

  const goLickPage = useCallback(
    (l: Lick) => {
      sessionStore.setRoot(currentChord.rootPc)
      sessionStore.setLick(l.id)
      sessionStore.requestNav('licks')
    },
    [currentChord],
  )

  const closeLick = useCallback(() => {
    setActiveLick(null)
    setRenderMode('scale')
  }, [])

  // 乐句跟随进行：换和弦时把乐句重新转调到当前和弦（标题说「已转到当前调」就得是真的）
  useEffect(() => {
    const id = activeLick?.id
    if (!id) return
    const src = LICKS.find((l) => l.id === id)
    if (!src) return
    const notes = transposeLick(src, currentChord.rootPc, tuning)
    if (!notes) {
      setActiveLick(null)
      return
    }
    setActiveLick((prev) => (prev && prev.id === id ? { ...prev, notes } : prev))
    // 依赖不含 activeLick 对象本身，避免 setState 循环；id 或和弦根音变化时重转
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChord.rootPc, tuning, activeLick?.id])

  // 当前和弦是否有所选形状的指法（没有时 voiceChord 会静默回退到最近把位，需要提示用户）
  const shapeAvailable = useMemo(() => {
    const opts = listChordVoicings(currentChord.rootPc, typeOf(currentChord.typeId), tuning)
    return opts.some((o) => o.position === shape)
  }, [currentChord.rootPc, currentChord.typeId, shape, tuning])
  const shapeLabel = JAM_SHAPES.find((s) => s.id === shape)?.label ?? shape

  const suggestions = scaleSuggestions(currentChord.typeId)

  return (
    <>
      <main className="module-scroll jam">
      {/* ── 头部：预设 + 音阶模式 + 父调 ── */}
      <div className="jam-head">
        <div className="field">
          <span className="field__label">进行</span>
          <div className="segmented segmented--wrap" role="group" aria-label="进行预设">
            {JAM_PRESETS.map((p) => (
              <button
                key={p.id}
                className="segmented__item"
                aria-pressed={p.id === presetId}
                onClick={() => setPresetId(p.id)}
                type="button"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field__label">音阶模式</span>
          <div className="segmented" role="group" aria-label="音阶模式">
            <button
              className="segmented__item"
              aria-pressed={scaleMode === 'global'}
              onClick={() => setScaleMode('global')}
              type="button"
            >
              全局父音阶
            </button>
            <button
              className="segmented__item"
              aria-pressed={scaleMode === 'perchord'}
              onClick={() => setScaleMode('perchord')}
              type="button"
            >
              每和弦换音阶
            </button>
          </div>
        </div>
        <div className="jam-key" aria-live="polite">
          父调 <b>{progressionKeyLabel(preset)}</b> · {preset.style}
        </div>
        <button className="btn btn--ghost jam-head__help" onClick={() => setTutorialOpen(true)} type="button">
          ❓ 说明书
        </button>
      </div>

      {/* ── 进行时间轴 ── */}
      <div className="jam-timeline" role="group" aria-label="和弦进行时间轴">
        {preset.chords.map((c, i) => (
          <button
            key={i}
            className={`jam-step${i === chordIndex ? ' is-current' : ''}`}
            onClick={() => {
              chordIdxRef.current = i
              setChordIndex(i)
            }}
            type="button"
            aria-pressed={i === chordIndex}
          >
            <span className="jam-step__num">{preset.chordNumerals[i]}</span>
            <ChordDiagram voicing={stepVoicings[i]} />
            <span className="jam-step__name">{jamChordName(c)}</span>
          </button>
        ))}
      </div>

      {/* ── 主体：指板 + 老师面板 ── */}
      <div className="jam-layout">
        <section className="jam-fret">
          <div className="jam-fret__caption">
            {renderMode === 'chord' ? (
              <>
                <span className="jam-fret__title">
                  和弦形状 · 当前 <b>{jamChordName(currentChord)}</b>（{preset.chordNumerals[chordIndex]}）
                </span>
                <div className="segmented segmented--sm" role="group" aria-label="把位形状">
                  {JAM_SHAPES.map((s) => (
                    <button
                      key={s.id}
                      className="segmented__item"
                      aria-pressed={shape === s.id}
                      onClick={() => setShape(s.id)}
                      type="button"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {!shapeAvailable && (
                  <span className="jam-fret__shape-warn">
                    ⚠ {shapeLabel}：当前和弦没有此把位指法，已显示最近把位
                  </span>
                )}
              </>
            ) : renderMode === 'lick' && activeLick ? (
              <>
                <span className="jam-fret__title">
                  乐句 · <b>{activeLick.name}</b>
                  <span className="jam-fret__hint">
                    已转到当前调 {jamChordName(currentChord)}（{preset.chordNumerals[chordIndex]}），点指板可试听
                  </span>
                  <button className="btn btn--ghost jam-fret__close-lick" onClick={closeLick} type="button">
                    ✕ 关掉乐句
                  </button>
                </span>
                <span className="jam-fret__legend">
                  <span>
                    <i className="lg lg--root" />
                    乐句音
                  </span>
                  <span>
                    <i className="lg lg--sec" />
                    可用音阶音（背景）
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="jam-fret__title">
                  音阶音高亮 ·{' '}
                  <b>{advisorCaption}</b>
                  {scaleMode === 'perchord' && advisorLevel === 0 && (
                    <>（在 {jamChordName(currentChord)} 上）</>
                  )}
                </span>
                <div className="jam-advisor">
                  <div className="segmented segmented--sm" role="group" aria-label="参谋层级">
                    {ADVISOR_OPTIONS.map((o) => (
                      <button
                        key={String(o.id)}
                        className="segmented__item"
                        aria-pressed={advisorLevel === o.id}
                        onClick={() => setAdvisorLevel(o.id)}
                        type="button"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {advisorLevel === 0 ? (
                    <span className="jam-fret__legend">
                      <span><i className="lg lg--root" />根音</span>
                      <span><i className="lg lg--accent" />和弦附近</span>
                      <span><i className="lg lg--sec" />其余音阶音</span>
                      <span className="jam-fret__hint">点指板上的音可试听</span>
                    </span>
                  ) : (
                    <>
                      <div className="jam-advisor__row">
                        <p className="jam-advisor__story">{story?.line}</p>
                        <div className="jam-advisor__tools">
                          {advisorLevel !== 'all' && (
                            <button
                              className={
                                showFarOctaves
                                  ? 'btn btn--ghost is-on jam-advisor__far'
                                  : 'btn btn--ghost jam-advisor__far'
                              }
                              aria-pressed={showFarOctaves}
                              onClick={() => setShowFarOctaves((v) => !v)}
                              type="button"
                              title="把同一批落点音在其他八度的位置也用弱标显示，熟练后可跨八度跳"
                            >
                              🔭 远八度
                            </button>
                          )}
                          {story && story.pairs.length > 0 && (
                            <button
                              className="btn btn--ghost jam-advisor__demo"
                              onClick={playStoryDemo}
                              type="button"
                            >
                              ▶ 听「回家」
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="jam-advisor__legend">
                        <span><i className="lg lg--root" />落点（句尾落这）</span>
                        {advisorLevel === 7 || advisorLevel === 'all' ? (
                          <span><i className="lg lg--accent" />逼近音（想回家的音）</span>
                        ) : advisorLevel === 5 ? (
                          <span><i className="lg lg--accent" />五声经过音</span>
                        ) : null}
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="jam-fret__board">
            <Fretboard
              tuning={tuning}
              maxFret={15}
              highlights={highlights}
              targetString={null}
              scopeRange={scopeRange}
              interactive
              showAllNotes={false}
              labelMode="letter"
              ringingString={null}
              onFretClick={onFretClick}
              compact
            />
          </div>
        </section>

        <aside className="jam-theory chord-theory">
          <h2 className="chord-theory__title">{preset.name}</h2>
          <p className="chord-theory__lead">{preset.why}</p>

          {scaleMode === 'global' ? (
            <div className="jam-theory__block">
              <div className="chord-theory__h">整段用一个音阶</div>
              <p className="chord-theory__p">
                父音阶：<b>{scaleLabel(activeScale.scaleId)}</b>
                {activeScale.scaleId === 'minorPent' || activeScale.scaleId === 'majorPent'
                  ? '（五声不踩 4、7 级，闭眼弹都顺）'
                  : '（顺阶覆盖整段进行）'}
                。先把它在指板上走顺，再跟拍即兴。
              </p>
            </div>
          ) : (
            <div className="jam-theory__block">
              <div className="chord-theory__h">
                现在在 {jamChordName(currentChord)}（{preset.chordNumerals[chordIndex]}）上，该上什么音阶
              </div>
              {suggestions.map((s) => (
                <p
                  key={s.scaleId}
                  className={`chord-theory__p${s.scaleId === activeScale.scaleId ? ' is-active' : ''}`}
                >
                  <b>{scaleLabel(s.scaleId)}</b> — {s.reason}
                </p>
              ))}
            </div>
          )}

          <div className="jam-theory__tip">
            <span className="chord-theory__h">练习提示</span>
            <p className="chord-theory__p">{preset.tip}</p>
          </div>

          {/* ── 乐句建议：在当前和弦上直接高亮试弹，或去乐句页学 ── */}
          <div className="jam-licks">
            <span className="chord-theory__h">🎵 现在这个和弦上能弹的乐句</span>
            {licksForChordType(currentChord.typeId, 3).map((l) => (
              <div key={l.id} className="jam-licks__item">
                <button className="jam-licks__main" onClick={() => playLickInJam(l)} type="button">
                  <b>{l.name}</b>
                  <span>
                    {LICK_STYLE_LABEL[l.style]} · 难度 {l.difficulty} · {l.timing}
                  </span>
                </button>
                <button className="jam-licks__goto" onClick={() => goLickPage(l)} type="button">
                  去乐句页学 →
                </button>
              </div>
            ))}
            <p className="jam-licks__hint">点乐句名：转调到当前调、在指板上高亮并示范；想慢慢学再去乐句页</p>
          </div>
        </aside>
      </div>

      {/* ── 底部：节奏 + 扫弦型/预备拍 + 切换 + 贯通 ── */}
      <div className="jam-bottom">
        <RhythmBar
          onBeat={handleBeat}
          onStep={handleStep}
          countInBeats={countIn ? beatsPerBarRef.current : 0}
        />
        <div className="jam-bottom__extra">
          <label className="jam-bottom__label" htmlFor="jamStrum">
            扫弦型
          </label>
          <select
            id="jamStrum"
            value={strumPatternId ?? 'none'}
            onChange={(e) => {
              const v = e.target.value
              setStrumPatternId(v === 'none' ? null : v)
              if (v !== 'none') setBacking(true)
            }}
            title="选定后按这个扫法扫当前和弦当基础节奏（需开 backing 才出声）"
          >
            <option value="none">无（默认每换和弦扫一下）</option>
            {STRUM_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.hint}
              </option>
            ))}
          </select>
          <button
            className={countIn ? 'btn btn--ghost is-on' : 'btn btn--ghost'}
            aria-pressed={countIn}
            onClick={() => setCountIn((v) => !v)}
            title="开始前先空一小节预备拍（几声 click），给你开内录的时间"
          >
            🎬 预备拍
          </button>
        </div>
        <div className="jam-bottom__right">
          <div className="segmented" role="group" aria-label="指板展示">
            <button
              className="segmented__item"
              aria-pressed={renderMode === 'chord'}
              onClick={() => {
                setActiveLick(null)
                setRenderMode('chord')
              }}
              type="button"
            >
              和弦形状
            </button>
            <button
              className="segmented__item"
              aria-pressed={renderMode === 'scale'}
              onClick={() => {
                setActiveLick(null)
                setRenderMode('scale')
              }}
              type="button"
            >
              音阶音
            </button>
          </div>
          <button
            className={backing ? 'btn btn--ghost is-on' : 'btn btn--ghost'}
            aria-pressed={backing}
            onClick={() => setBacking((v) => !v)}
            type="button"
            title="开启后，App 会在每个和弦切换拍自动扫响和弦当伴奏（你用自己的 looper 时可关掉）"
          >
            {backing ? '🔊 出声 backing' : '🔇 仅视觉'}
          </button>
          <button className="btn btn--primary" onClick={goChord} type="button">
            去和弦页弹这个 →
          </button>
          <button className="btn btn--primary" onClick={goScale} type="button">
            去音阶页练这个 →
          </button>
        </div>
      </div>
      </main>

      <TutorialDrawer open={tutorialOpen} onClose={() => setTutorialOpen(false)} tree={JAM_TUTORIAL} />
    </>
  )
}
