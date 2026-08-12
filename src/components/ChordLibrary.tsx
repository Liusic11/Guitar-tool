/**
 * 和弦参考模块（改版）
 * ─────────────────────────────────────────────
 * 不做题、不 SRS、不对错——纯「指法参考 + 试听 + 乐理」浏览器。
 *
 * · 选 根音 × 和弦类型 → 用竖向和弦图（chord box）画出「这一招怎么按」：
 *   手指号、根音橙点、空弦(O) / 闷音(×)、横按括号、把位标签；
 * · 支持同一和弦的多个把位切换：开放把位 / E 形 / A 形 / D 形横按；
 * · 「试听此把位」只扫当前这个形状；
 * · 右侧 ChordTheory 讲清「为什么叫三和弦 / 大 / 小 / 七和弦」等乐理；
 * · 保留「指板全景」开关（旧整颈高亮）作为进阶视角。
 */

import { useEffect, useMemo, useState } from 'react'
import { Fretboard, type Highlight, type LabelMode } from './Fretboard'
import { ChordDiagram } from './ChordDiagram'
import { ChordTheory } from './ChordTheory'
import { ChordConnection } from './ChordConnection'
import { ChordChanges } from './ChordChanges'
import { RhythmBar } from './RhythmBar'
import { audioEngine } from '../lib/audio'
import { sessionStore } from '../lib/session'
import {
  CHORD_TYPES,
  voiceChord,
  listChordVoicings,
  DEGREE_LABEL,
  type ChordType,
  type ChordPosition,
} from '../lib/chords'
import {
  MAX_FRET,
  midiAt,
  pitchClassAt,
  LETTER_NAMES,
  SOLFEGE_NAMES,
  type PitchClass,
  type Tuning,
} from '../lib/music'
import type { Settings } from '../hooks/useQuizEngine'

const ROOT_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

interface ChordLibraryProps {
  tuning: Tuning
  settings: Settings
}

export function ChordLibrary({ tuning, settings }: ChordLibraryProps) {
  // 贯通层：和弦类型与根音都从共享 store 初始化，跨模块跳转后能接上
  const [typeId, setTypeId] = useState<string>(() => sessionStore.get().chordTypeId ?? 'dom7')
  const [rootPc, setRootPc] = useState<PitchClass>(() => (sessionStore.get().rootPc as PitchClass) ?? 9)
  const [labelMode, setLabelMode] = useState<LabelMode>(settings.labelMode)
  const [position, setPosition] = useState<ChordPosition>('auto')
  const [showNeck, setShowNeck] = useState(false)
  const [mode, setMode] = useState<'reference' | 'changes'>('reference')

  // 根音变化即同步到共享 store，让音阶页 / 和弦页感知到同一把钥匙
  useEffect(() => {
    sessionStore.setRoot(rootPc)
  }, [rootPc])

  const type: ChordType = CHORD_TYPES.find((t) => t.id === typeId) ?? CHORD_TYPES[0]

  const voicingOptions = useMemo(
    () => listChordVoicings(rootPc, type, tuning),
    [rootPc, type, tuning],
  )

  // 当换根音/类型时，若当前把位不再可用就回到自动
  const validPosition = useMemo(() => {
    if (position === 'auto') return 'auto'
    return voicingOptions.some((o) => o.position === position) ? position : 'auto'
  }, [position, voicingOptions])

  const voicing = useMemo(
    () => voiceChord(rootPc, type, tuning, validPosition),
    [rootPc, type, tuning, validPosition],
  )

  const formulaText = useMemo(
    () => type.formula.map((i) => DEGREE_LABEL[i] ?? String(i)).join(' · '),
    [type],
  )

  const notesText = useMemo(() => {
    const notes = type.formula.map((i) => (rootPc + i) % 12)
    if (labelMode === 'solfege') return notes.map((pc) => SOLFEGE_NAMES[pc]).join(' · ')
    if (labelMode === 'both')
      return notes.map((pc) => `${LETTER_NAMES[pc]} / ${SOLFEGE_NAMES[pc]}`).join(' · ')
    return notes.map((pc) => LETTER_NAMES[pc]).join(' · ')
  }, [type, rootPc, labelMode])

  // 整颈高亮（进阶「指板全景」）
  const highlights = useMemo<Highlight[]>(() => {
    const chordTones = new Set(type.formula.map((i) => (rootPc + i) % 12))
    const out: Highlight[] = []
    const [lo, hi] = settings.scope.fretRange
    for (const s of tuning.strings) {
      if (!settings.scope.strings.includes(s.number)) continue
      for (let f = lo; f <= hi; f++) {
        const pc = pitchClassAt(tuning, s.number, f)
        if (chordTones.has(pc)) {
          out.push({ string: s.number, fret: f, kind: pc === rootPc ? 'answer' : 'secondary' })
        }
      }
    }
    return out
  }, [tuning, settings.scope, type, rootPc])

  const strum = () => {
    const notesOut: (number | null)[] = voicing.notes.map((n) =>
      n.muted ? null : midiAt(tuning, n.string, n.fret),
    )
    audioEngine.strum(notesOut, 0.012)
  }

  return mode === 'changes' ? (
    <ChordChanges tuning={tuning} onReference={() => setMode('reference')} />
  ) : (
    <main className="module-stage chord-stage">
      <div className="module-scroll">
        <div className="chord-panel">
          <div className="chord-mode-bar">
            <p className="section-label">和弦参考 · 指法浏览器</p>
            <div className="segmented" role="group" aria-label="练习方式">
              <button
                className="segmented__item"
                aria-pressed
                onClick={() => setMode('reference')}
                type="button"
              >
                参考浏览器
              </button>
              <button
                className="segmented__item"
                aria-pressed={false}
                onClick={() => setMode('changes')}
                type="button"
              >
                切换训练
              </button>
            </div>
          </div>

        <div className="chord-controls">
          <div className="field">
            <label className="field__label" htmlFor="chordRoot">
              根音
            </label>
            <select
              id="chordRoot"
              value={rootPc}
              onChange={(e) => setRootPc(Number(e.target.value) as PitchClass)}
            >
              {ROOT_NAMES.map((r, i) => (
                <option key={r} value={i}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="chordPosition">
              把位
            </label>
            <select
              id="chordPosition"
              value={validPosition}
              onChange={(e) => setPosition(e.target.value as ChordPosition)}
            >
              <option value="auto">自动选择</option>
              {voicingOptions.map((o) => (
                <option key={o.position} value={o.position}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="chordLabel">
              音名形式
            </label>
            <select
              id="chordLabel"
              value={labelMode}
              onChange={(e) => setLabelMode(e.target.value as LabelMode)}
            >
              <option value="letter">字母 · C D E</option>
              <option value="both">字母 + 唱名 · C / Do</option>
              <option value="solfege">唱名 · Do Re Mi</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field__label">和弦类型</label>
          <div className="segmented segmented--wrap" role="group" aria-label="和弦类型">
            {CHORD_TYPES.map((t) => (
              <button
                key={t.id}
                className="segmented__item"
                aria-pressed={typeId === t.id}
                onClick={() => setTypeId(t.id)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="chord-layout">
          <div className="chord-figure">
            <div className="chord-head">
              <span className="chord-head__name">
                {LETTER_NAMES[rootPc]}
                {type.abbr}
              </span>
              <span className="chord-head__type">{type.label}</span>
              <span className="chord-head__formula">{formulaText}</span>
              <span className="chord-head__notes">{notesText}</span>
            </div>

            <ChordDiagram voicing={voicing} />

            <div className="chord-actions">
              <button className="btn btn--primary chord-actions__strum" onClick={strum} type="button">
                ▶ 试听此把位
              </button>
              <span className="chord-actions__hint">
                橙点＝根音 · 数字＝手指（1食 2中 3无名 4小）· O 空弦 × 闷音
              </span>
              <button
                className="btn btn--ghost btn--sm chord-actions__toggle"
                onClick={() => setShowNeck((v) => !v)}
                type="button"
              >
                {showNeck ? '看和弦图' : '指板全景'}
              </button>
            </div>
          </div>

          <div className="chord-aside">
            <ChordTheory type={type} />
            <ChordConnection rootPc={rootPc} typeId={typeId} />
          </div>
        </div>

        {showNeck && (
          <section className="fretboard-zone" aria-label="和弦指板全景" style={{ marginTop: '1.5rem' }}>
            <Fretboard
              tuning={tuning}
              maxFret={MAX_FRET}
              highlights={highlights}
              targetString={null}
              scopeRange={settings.scope.fretRange}
              interactive
              showAllNotes={false}
              labelMode={labelMode}
              ringingString={null}
              onFretClick={() => {}}
            />
          </section>
        )}
      </div>
      </div>

      <RhythmBar />
    </main>
  )
}
