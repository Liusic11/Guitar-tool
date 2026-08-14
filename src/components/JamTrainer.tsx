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
import { voiceChord, type ChordPosition } from '../lib/chords'
import { SCALES, scalePositions } from '../lib/scales'
import { midiAt, type PitchClass, type Tuning } from '../lib/music'
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

type ScaleMode = 'global' | 'perchord'
type RenderMode = 'chord' | 'scale'

/** Jam 把位形状组：四个和弦共用同一 CAGED 形状 */
const JAM_SHAPES: { id: ChordPosition; label: string }[] = [
  { id: 'root6', label: 'E 形' },
  { id: 'root5', label: 'A 形' },
  { id: 'root4', label: 'D 形' },
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

  // ── 指板高亮 ──
  const highlights = useMemo<Highlight[]>(() => {
    if (renderMode === 'chord') {
      return currentVoicing.notes
        .filter((n) => !n.muted)
        .map((n) => ({ string: n.string, fret: n.fret, kind: n.isRoot ? ('answer' as const) : ('secondary' as const) }))
    }
    // 音阶模式：全量标出所有音阶音；落在「当前和弦把位窗口」内的用强调色（accent）
    const lo = currentVoicing.baseFret
    const hi = currentVoicing.baseFret + 4
    const positions = scalePositions(tuning, activeScale.rootPc, activeScale.formula, [0, 15])
    return positions.map((p) => {
      if (p.degree === 0) return { string: p.string, fret: p.fret, kind: 'answer' as const }
      const near = p.fret >= lo && p.fret <= hi
      return { string: p.string, fret: p.fret, kind: near ? ('accent' as const) : ('secondary' as const) }
    })
  }, [renderMode, currentVoicing, activeScale, tuning])

  const scopeRange: [number, number] =
    renderMode === 'chord'
      ? [currentVoicing.baseFret, currentVoicing.baseFret + 4]
      : [0, 15]

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
        if (backingRef.current) {
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

  const suggestions = scaleSuggestions(currentChord.typeId)

  return (
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
              </>
            ) : (
              <>
                <span className="jam-fret__title">
                  音阶音高亮 ·{' '}
                  <b>{scaleLabel(activeScale.scaleId)}</b>
                  {scaleMode === 'perchord' && (
                    <>（在 {jamChordName(currentChord)} 上）</>
                  )}
                </span>
                <span className="jam-fret__legend">
                  <span><i className="lg lg--root" />根音</span>
                  <span><i className="lg lg--accent" />和弦附近</span>
                  <span><i className="lg lg--sec" />其余音阶音</span>
                  <span className="jam-fret__hint">点指板上的音可试听</span>
                </span>
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
        </aside>
      </div>

      {/* ── 底部：节奏 + 切换 + 贯通 ── */}
      <div className="jam-bottom">
        <RhythmBar onBeat={handleBeat} />
        <div className="jam-bottom__right">
          <div className="segmented" role="group" aria-label="指板展示">
            <button
              className="segmented__item"
              aria-pressed={renderMode === 'chord'}
              onClick={() => setRenderMode('chord')}
              type="button"
            >
              和弦形状
            </button>
            <button
              className="segmented__item"
              aria-pressed={renderMode === 'scale'}
              onClick={() => setRenderMode('scale')}
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
  )
}
