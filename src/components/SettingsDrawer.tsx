/**
 * 设置抽屉
 * ─────────────────────────────────────────────
 * 出题范围的调整会实时反映到指板上（范围外压暗），
 * 所以改设置的时候就能直接看到练习区变化，不用来回确认。
 */

import { memo, useEffect, useRef } from 'react'
import {
  ACCIDENTAL_PITCH_CLASSES,
  letterOf,
  MAX_FRET,
  NATURAL_PITCH_CLASSES,
  octaveOf,
  pitchClassOf,
  stringNameCN,
  TUNINGS,
  type PitchClass,
  type QuizScope,
  type TaskType,
  type Tuning,
} from '../lib/music'
import type { MasteryMap } from '../lib/srs'
import type { LabelMode } from './Fretboard'
import type { ToneProfileId } from '../lib/audio'
import { RHYTHM_PRESETS } from '../lib/rhythm'
import { useRhythmState, rhythmStore } from '../lib/rhythmStore'
import type { Settings, Stats } from '../hooks/useQuizEngine'

interface SettingsDrawerProps {
  open: boolean
  settings: Settings
  tuning: Tuning
  stats: Stats
  mastery: MasteryMap
  onClose: () => void
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  updateScope: <K extends keyof QuizScope>(key: K, value: QuizScope[K]) => void
  onResetStats: () => void
  onResetSettings: () => void
  onResetMastery: () => void
}

const TONE_OPTIONS: { id: ToneProfileId; label: string }[] = [
  { id: 'acoustic', label: '原声' },
  { id: 'electric-clean', label: '电吉他清音' },
  { id: 'electric-overdrive', label: '电吉他过载' },
]

/** 把某音级的掌握度聚合成「记忆强度」，用于展示面板 */
const noteStrength = (
  task: TaskType,
  scope: QuizScope,
  mastery: MasteryMap,
): { pc: PitchClass; ease: number; seen: number }[] => {
  const pcs = scope.includeAccidentals
    ? [...NATURAL_PITCH_CLASSES, ...ACCIDENTAL_PITCH_CLASSES]
    : NATURAL_PITCH_CLASSES
  return pcs.map((pc) => {
    if (task === 'find') {
      let easeSum = 0
      let cnt = 0
      let seen = 0
      for (const s of scope.strings) {
        const item = mastery[`find:${s}:${pc}`]
        if (item) {
          easeSum += item.ease
          cnt += 1
          seen += item.seen
        }
      }
      return { pc, ease: cnt ? easeSum / cnt : 0, seen }
    }
    const item = mastery[`${task}:${pc}`]
    return { pc, ease: item?.ease ?? 0, seen: item?.seen ?? 0 }
  })
}

/** 掌握度 → 颜色：弱=炭火红，强=鼠尾草绿 */
const easeColor = (ease: number): string => {
  const hue = 27 + (152 - 27) * ease
  const chroma = 0.16 - 0.06 * ease
  const light = 62 - 4 * ease
  return `oklch(${light}% ${chroma.toFixed(3)} ${hue.toFixed(0)})`
}

/* ── 小组件 ── */

const Toggle = ({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) => (
  <button
    className="toggle"
    aria-pressed={checked}
    onClick={() => onChange(!checked)}
    type="button"
  >
    <span className="stack" style={{ gap: '0.15rem' }}>
      <span className="field__label">{label}</span>
      {hint && <span className="field__hint">{hint}</span>}
    </span>
    <span className="toggle__track">
      <span className="toggle__knob" />
    </span>
  </button>
)

export const SettingsDrawer = memo(function SettingsDrawer({
  open,
  settings,
  tuning,
  stats,
  mastery,
  onClose,
  update,
  updateScope,
  onResetStats,
  onResetSettings,
  onResetMastery,
}: SettingsDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const rhythm = useRhythmState()

  // Esc 关闭 + 打开时把焦点移进抽屉
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  const [lo, hi] = settings.scope.fretRange
  const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : null
  const avgReaction =
    stats.reactionTimes.length > 0
      ? stats.reactionTimes.reduce((a, b) => a + b, 0) / stats.reactionTimes.length / 1000
      : null

  const toggleString = (n: number) => {
    const current = settings.scope.strings
    const next = current.includes(n) ? current.filter((s) => s !== n) : [...current, n]
    // 至少留一根弦，否则出不了题
    if (next.length === 0) return
    updateScope(
      'strings',
      next.sort((a, b) => b - a),
    )
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="练习设置"
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="drawer__head">
          <h2 className="drawer__title">练习设置</h2>
          <button className="btn btn--icon btn--ghost" onClick={onClose} aria-label="关闭设置">
            ✕
          </button>
        </div>

        <div className="drawer__body">
          {/* ══════════ 节奏 ══════════ */}
          <p className="section-label">节奏</p>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="interval">
                思考时间
              </label>
              <span className="field__value">{settings.intervalSec.toFixed(1)} 秒</span>
            </div>
            <input
              id="interval"
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={settings.intervalSec}
              onChange={(e) => update('intervalSec', Number(e.target.value))}
            />
            <p className="field__hint">
              自动模式下从出题到揭示答案的间隔。刚开始建议 4–5 秒，熟练后压到 1–2 秒。
            </p>
          </div>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="hold">
                答案停留
              </label>
              <span className="field__value">{settings.revealHoldSec.toFixed(1)} 秒</span>
            </div>
            <input
              id="hold"
              type="range"
              min={0.5}
              max={4}
              step={0.5}
              value={settings.revealHoldSec}
              onChange={(e) => update('revealHoldSec', Number(e.target.value))}
            />
          </div>

          {/* ══════════ 出题范围 ══════════ */}
          <p className="section-label">出题范围</p>

          <div className="field">
            <span className="field__label">参与的弦</span>
            <div className="string-picker">
              {tuning.strings.map((s) => (
                <button
                  key={s.number}
                  className="string-chip"
                  aria-pressed={settings.scope.strings.includes(s.number)}
                  onClick={() => toggleString(s.number)}
                  title={stringNameCN(s.number)}
                  type="button"
                >
                  <span className="string-chip__num">{s.number}</span>
                  <span className="string-chip__note">
                    {letterOf(pitchClassOf(s.openMidi))}
                    {octaveOf(s.openMidi)}
                  </span>
                </button>
              ))}
            </div>
            <p className="field__hint">
              一次只练一两根弦，比六根一起练记得牢得多。建议从 6 弦和 5 弦开始。
            </p>
          </div>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="fretLo">
                品位范围
              </label>
              <span className="field__value">
                {lo} – {hi} 品
              </span>
            </div>
            <input
              id="fretLo"
              type="range"
              min={0}
              max={MAX_FRET}
              step={1}
              value={lo}
              onChange={(e) => {
                const v = Number(e.target.value)
                updateScope('fretRange', [Math.min(v, hi), hi])
              }}
            />
            <input
              id="fretHi"
              type="range"
              min={0}
              max={MAX_FRET}
              step={1}
              value={hi}
              onChange={(e) => {
                const v = Number(e.target.value)
                updateScope('fretRange', [lo, Math.max(v, lo)])
              }}
              aria-label="最高品位"
            />
            <p className="field__hint">
              0–12 品是一个完整八度，把这段吃透，13 品以上就是重复的图形。
            </p>
          </div>

          <Toggle
            label="包含升降号"
            hint="把 C♯ D♯ F♯ G♯ A♯ 也加进题库，题量从 7 个音扩到 12 个。"
            checked={settings.scope.includeAccidentals}
            onChange={(v) => updateScope('includeAccidentals', v)}
          />

          <div className="field">
            <label className="field__label" htmlFor="tuning">
              调弦
            </label>
            <select
              id="tuning"
              value={settings.tuningId}
              onChange={(e) => update('tuningId', e.target.value)}
            >
              {TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.note}
                </option>
              ))}
            </select>
          </div>

          {/* ══════════ 显示 ══════════ */}
          <p className="section-label">显示</p>

          <div className="field">
            <label className="field__label" htmlFor="labelMode">
              音名形式
            </label>
            <select
              id="labelMode"
              value={settings.labelMode}
              onChange={(e) => update('labelMode', e.target.value as LabelMode)}
            >
              <option value="letter">字母 · C D E</option>
              <option value="both">字母 + 唱名 · C / Do</option>
              <option value="solfege">唱名 · Do Re Mi</option>
            </select>
          </div>

          <Toggle
            label="标出同弦上的重复音"
            hint="同一根弦每隔 12 品会出现同一个音，一起点亮能帮你看清这个规律。"
            checked={settings.showOctaveTwins}
            onChange={(v) => update('showOctaveTwins', v)}
          />

          <Toggle
            label="铺满全部音名"
            hint="关掉练习、纯看图记忆时打开。"
            checked={settings.showAllNotes}
            onChange={(v) => update('showAllNotes', v)}
          />

          {/* ══════════ 智能抽题 ══════════ */}
          <p className="section-label">智能抽题</p>

          <Toggle
            label="优先练弱项（SRS）"
            hint="按掌握度加权抽题，越不熟、越久没练的越常出现。关掉则退化为均匀随机。"
            checked={settings.srsEnabled}
            onChange={(v) => update('srsEnabled', v)}
          />

          <div className="field">
            <span className="field__label">记忆强度</span>
            <div className="mem">
              {noteStrength(settings.task, settings.scope, mastery).map(({ pc, ease, seen }) => (
                <div
                  key={pc}
                  className="mem__chip"
                  title={
                    seen > 0
                      ? `${letterOf(pc)} · 掌握度 ${Math.round(ease * 100)}% · 练过 ${seen} 次`
                      : `${letterOf(pc)} · 还没练过`
                  }
                  style={{ backgroundColor: easeColor(ease) }}
                >
                  {letterOf(pc).replace('#', '♯')}
                </div>
              ))}
            </div>
            <p className="field__hint">
              颜色越绿越熟、越红越生。系统会自动把练习时间投到偏红的那几个音上。
            </p>
            <button className="btn btn--ghost btn--sm" type="button" onClick={onResetMastery}>
              重置记忆库
            </button>
          </div>

          {/* ══════════ 音色 ══════════ */}
          <p className="section-label">音色</p>

          <div className="field">
            <label className="field__label" htmlFor="tone">
              合成音色
            </label>
            <div className="segmented" role="group" aria-label="合成音色">
              {TONE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  className="segmented__item"
                  aria-pressed={settings.toneProfile === o.id}
                  onClick={() => update('toneProfile', o.id)}
                  type="button"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="field__hint">
              原声像木箱、偏闷；电吉他清音更亮更干；过载带一点 rock / funk 的咬音。
            </p>
          </div>

          {/* ══════════ 节奏 ══════════ */}
          <p className="section-label">节奏</p>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="rbpm">
                速度
              </label>
              <span className="field__value">{rhythm.bpm} BPM</span>
            </div>
            <input
              id="rbpm"
              type="range"
              min={40}
              max={200}
              step={1}
              value={rhythm.bpm}
              onChange={(e) => rhythmStore.setBpm(Number(e.target.value))}
            />
            <p className="field__hint">
              练习节拍。先慢（60）后快（90+），节奏稳了音阶才真正属于你。
            </p>
          </div>

          <div className="field">
            <label className="field__label">节拍型</label>
            <div className="segmented segmented--scale" role="group" aria-label="节拍型">
              {RHYTHM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="segmented__item"
                  aria-pressed={rhythm.presetId === p.id}
                  onClick={() => rhythmStore.setPreset(p.id)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="field__hint">
              {RHYTHM_PRESETS.find((p) => p.id === rhythm.presetId)?.tip}
            </p>
          </div>

          {/* ══════════ 声音 ══════════ */}
          <p className="section-label">声音</p>

          <div className="field">
            <div className="field__head">
              <label className="field__label" htmlFor="volume">
                音量
              </label>
              <span className="field__value">{Math.round(settings.volume * 100)}</span>
            </div>
            <input
              id="volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => update('volume', Number(e.target.value))}
            />
          </div>

          <Toggle
            label="出题时播放"
            hint="先听到音高再去找位置，是建立「音 ↔ 品」联系最快的方式。"
            checked={settings.playOnAsk}
            onChange={(v) => update('playOnAsk', v)}
          />

          <Toggle
            label="揭示时再拨一次"
            checked={settings.playOnReveal}
            onChange={(v) => update('playOnReveal', v)}
          />

          {/* ══════════ 统计 ══════════ */}
          <p className="section-label">本次练习</p>

          <div className="field">
            <div className="field__head">
              <span className="field__label">正确率</span>
              <span className="field__value">
                {accuracy === null ? '—' : `${accuracy}%`}
                {stats.answered > 0 && (
                  <span style={{ color: 'var(--ink-3)' }}> · {stats.answered} 题</span>
                )}
              </span>
            </div>
            {avgReaction !== null && (
              <p className="field__hint">平均反应 {avgReaction.toFixed(1)} 秒 · 最长连对 {stats.bestStreak}</p>
            )}
          </div>

          {Object.keys(stats.perString).length > 0 && (
            <div className="heat">
              {tuning.strings.map((s) => {
                const [c, t] = stats.perString[s.number] ?? [0, 0]
                const pct = t > 0 ? (c / t) * 100 : 0
                return (
                  <div className="heat__row" key={s.number}>
                    <span className="heat__name">{s.number} 弦</span>
                    <span className="heat__bar">
                      <span className="heat__fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="heat__pct">{t > 0 ? `${Math.round(pct)}%` : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="row">
            <button className="btn" onClick={onResetStats} type="button">
              清空统计
            </button>
            <button className="btn btn--ghost" onClick={onResetSettings} type="button">
              恢复默认设置
            </button>
          </div>
        </div>
      </div>
    </>
  )
})
