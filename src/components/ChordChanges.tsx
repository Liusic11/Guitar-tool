/**
 * 和弦切换训练（Chord Changes）· 计时换把
 * ─────────────────────────────────────────────
 * 确定性练习（不调 LLM / 不智能）：
 *  · 控制把位：可选「开放 / E形 / A形 / D形」或「不限」——序列里的每个和弦都在同一把位弹出，
 *    逼你在琴颈上准确定位（这正是用户要的「定位」训练）；
 *  · 跟拍换把：底部节拍器按 BPM 驱动，每 N 拍切到新和弦，并在切换拍自动扫响新和弦（无需手动按键）；
 *  · 贯通：右侧实时标出「当前和弦属于哪些音阶、为什么」（复用 harmony.ts + ChordConnection）。
 *
 * 复用：voiceChord / listChordVoicings（指法生成）、audioEngine（节拍+试听）、
 *      ChordConnection（和弦→音阶贯通）、sessionStore（一键跳音阶页）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChordDiagram } from './ChordDiagram'
import { ChordConnection } from './ChordConnection'
import { audioEngine } from '../lib/audio'
import { getRhythm, type RhythmPreset } from '../lib/rhythm'
import { useRhythmState } from '../lib/rhythmStore'
import {
  CHORD_TYPES,
  voiceChord,
  listChordVoicings,
  DEGREE_LABEL,
  type ChordType,
  type ChordPosition,
} from '../lib/chords'
import { defaultScaleForChord, scaleLabel } from '../lib/harmony'
import { sessionStore } from '../lib/session'
import { LETTER_NAMES, midiAt, type PitchClass, type Tuning } from '../lib/music'

const POSITION_OPTIONS: { id: ChordPosition; label: string }[] = [
  { id: 'root6', label: 'E 形（6弦）' },
  { id: 'root5', label: 'A 形（5弦）' },
  { id: 'root4', label: 'D 形（4弦）' },
  { id: 'open', label: '开放把位' },
  { id: 'auto', label: '不限把位' },
]

const CHORD_SET_OPTIONS = [
  { id: 'maj-min-dom7', label: '大/小/属七', types: ['maj', 'min', 'dom7'] },
  { id: 'maj-min', label: '大/小三和弦', types: ['maj', 'min'] },
  { id: 'seventh', label: '七和弦组', types: ['maj7', 'm7', 'dom7'] },
  { id: 'all', label: '全部九类', types: CHORD_TYPES.map((t) => t.id) },
]

const SWITCH_OPTIONS = [
  { beats: 2, label: '每 2 拍' },
  { beats: 4, label: '每 4 拍' },
]

interface ChordSpec {
  rootPc: PitchClass
  typeId: string
}

/** 某和弦在指定把位是否有可用指法 */
function chordAtPosition(rootPc: PitchClass, typeId: string, pos: ChordPosition, tuning: Tuning): boolean {
  if (pos === 'auto') return true
  const type = CHORD_TYPES.find((t) => t.id === typeId)
  if (!type) return false
  return listChordVoicings(rootPc, type, tuning).some((o) => o.position === pos)
}

/** 生成一串「都要能在该把位弹出」的练习序列（随机游走，避免相邻重复） */
function buildSequence(position: ChordPosition, types: string[], tuning: Tuning): ChordSpec[] {
  const pool: ChordSpec[] = []
  for (const typeId of types) {
    for (let r = 0; r < 12; r++) {
      if (chordAtPosition(r as PitchClass, typeId, position, tuning)) {
        pool.push({ rootPc: r as PitchClass, typeId })
      }
    }
  }
  if (pool.length === 0) return [{ rootPc: 9, typeId: 'dom7' }]
  const seq: ChordSpec[] = []
  let last = -1
  for (let i = 0; i < 8; i++) {
    let idx = Math.floor(Math.random() * pool.length)
    if (pool.length > 1) {
      while (idx === last) idx = Math.floor(Math.random() * pool.length)
    }
    last = idx
    seq.push(pool[idx])
  }
  return seq
}

interface ChordChangesProps {
  tuning: Tuning
  onReference: () => void
}

export function ChordChanges({ tuning, onReference }: ChordChangesProps) {
  const [position, setPosition] = useState<ChordPosition>('root6')
  const [setId, setSetId] = useState<string>('maj-min-dom7')
  const [bpm, setBpm] = useState(80)
  const [switchEvery, setSwitchEvery] = useState<number>(4)
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [sequence, setSequence] = useState<ChordSpec[]>(() =>
    buildSequence('root6', CHORD_SET_OPTIONS[0].types, tuning),
  )
  const [switches, setSwitches] = useState(0)

  const rhythm = useRhythmState()
  const preset = getRhythm(rhythm.subdiv, rhythm.kit)

  // 拍循环里读最新值，避免闭包拿到旧 state
  const bpmRef = useRef(bpm)
  const switchEveryRef = useRef(switchEvery)
  const sequenceRef = useRef(sequence)
  const effectivePosRef = useRef<ChordPosition>('auto')
  const presetRef = useRef<RhythmPreset>(preset)
  bpmRef.current = bpm
  switchEveryRef.current = switchEvery
  sequenceRef.current = sequence
  presetRef.current = preset

  const types = useMemo(
    () => CHORD_SET_OPTIONS.find((o) => o.id === setId)?.types ?? CHORD_SET_OPTIONS[0].types,
    [setId],
  )

  /** 重新生成序列（并复位练习状态） */
  const regenerate = (nextPos = position, nextTypes = types) => {
    setPlaying(false)
    setBeat(0)
    setSwitches(0)
    setSequence(buildSequence(nextPos, nextTypes, tuning))
  }

  // 改变把位 / 和弦集 → 重新生成
  const changePosition = (p: ChordPosition) => {
    setPosition(p)
    regenerate(p, types)
  }
  const changeSet = (id: string) => {
    setSetId(id)
    const t = CHORD_SET_OPTIONS.find((o) => o.id === id)?.types ?? types
    regenerate(position, t)
  }

  // 当前与目标
  const cursor = sequence.length > 0 ? Math.floor(beat / switchEvery) % sequence.length : 0
  const current: ChordSpec = sequence[cursor] ?? sequence[0]
  const currentType: ChordType = CHORD_TYPES.find((t) => t.id === current.typeId) ?? CHORD_TYPES[0]
  const effectivePos: ChordPosition = position === 'auto' ? 'auto' : position
  effectivePosRef.current = effectivePos
  const currentVoicing = useMemo(
    () => voiceChord(current.rootPc, currentType, tuning, effectivePos),
    [current.rootPc, currentType, tuning, effectivePos],
  )
  const posLabel = useMemo(() => {
    if (effectivePos === 'auto') return '自动把位'
    return (
      listChordVoicings(current.rootPc, currentType, tuning).find((o) => o.position === effectivePos)
        ?.label ?? ''
    )
  }, [current.rootPc, currentType, tuning, effectivePos])

  const upcoming = useMemo(() => {
    if (sequence.length === 0) return []
    return [1, 2]
      .map((k) => sequence[(cursor + k) % sequence.length])
      .filter(Boolean) as ChordSpec[]
  }, [sequence, cursor])

  // 节拍器：跟随「设置 → 节奏」里的全局预设（click / drums），
  // 在每个四分音符拍上走鼓点或节拍器；切换拍（beat % switchEvery === 0）自动扫响新和弦。
  useEffect(() => {
    if (!playing) {
      setBeat(0)
      return
    }
    void audioEngine.unlock()
    let nextTime = audioEngine.currentTime + 0.12
    let step = 0
    let gBeat = 0 // 全局累计拍计数（跨小节、不回绕）——切换判定与视觉都靠它，4 拍才成立
    const timers: number[] = []

    const schedule = () => {
      const p = presetRef.current
      const stepDur = 60 / bpmRef.current / p.subdiv
      const ahead = 0.14
      while (nextTime < audioEngine.currentTime + ahead) {
        const s = step
        const spec = p.steps[s % p.steps.length]
        const tPlay = nextTime

        // 播放当前律动（鼓组 or 节拍器）
        if (p.kit === 'click') {
          if (spec.accent) audioEngine.click(tPlay, true)
          else if (spec.tick) audioEngine.click(tPlay, false)
        } else {
          if (spec.kick) audioEngine.kick(tPlay)
          if (spec.snare) audioEngine.snare(tPlay)
          if (spec.hat) audioEngine.hat(tPlay)
        }

        // 四分音符拍边界才推进全局拍计数并做换把判定
        const isBeatStart = s % p.subdiv === 0
        if (isBeatStart) {
          const isSwitch = gBeat % switchEveryRef.current === 0
          if (isSwitch) {
            const beatCursor =
              Math.floor(gBeat / switchEveryRef.current) % sequenceRef.current.length
            const chordSpec = sequenceRef.current[beatCursor]
            if (chordSpec) {
              const ct = CHORD_TYPES.find((t) => t.id === chordSpec.typeId) ?? CHORD_TYPES[0]
              const v = voiceChord(chordSpec.rootPc, ct, tuning, effectivePosRef.current)
              audioEngine.strum(
                v.notes.map((n) => (n.muted ? null : midiAt(tuning, n.string, n.fret))),
                0.012,
                tPlay,
              )
            }
          }

          const visualDelay = Math.max(0, (tPlay - audioEngine.currentTime) * 1000)
          const thisBeat = gBeat
          timers.push(
            window.setTimeout(() => {
              setBeat(thisBeat)
              if (thisBeat > 0 && thisBeat % switchEveryRef.current === 0) {
                setSwitches((c) => c + 1)
              }
            }, visualDelay),
          )
          gBeat += 1
        }
        nextTime += stepDur
        step = (step + 1) % p.steps.length
      }
    }
    schedule()
    const interval = window.setInterval(schedule, 25)
    return () => {
      window.clearInterval(interval)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [playing, rhythm.subdiv, rhythm.kit, switchEvery])

  const barBeat = beat % switchEvery
  const strum = () => {
    audioEngine.strum(
      currentVoicing.notes.map((n) => (n.muted ? null : midiAt(tuning, n.string, n.fret))),
      0.012,
    )
  }

  /** 练完换把，直接在这个根音上走音阶（已预选适合该和弦的默认音阶） */
  const goScaleForCurrent = useCallback(() => {
    const scaleId = defaultScaleForChord(current.typeId)
    sessionStore.setRoot(current.rootPc)
    sessionStore.setScale(scaleId)
    sessionStore.requestNav('scales')
  }, [current.rootPc, current.typeId])

  return (
    <main className="module-stage chord-stage">
      <div className="module-scroll">
        <div className="chord-panel">
          <div className="chord-mode-bar">
            <p className="section-label">和弦参考 · 切换训练（计时换把）</p>
            <div className="segmented" role="group" aria-label="练习方式">
              <button className="segmented__item" aria-pressed={false} onClick={onReference} type="button">
                参考浏览器
              </button>
              <button className="segmented__item" aria-pressed type="button">
                切换训练
              </button>
            </div>
          </div>

          {/* 练习设置 */}
          <div className="changes-controls">
            <div className="field">
              <label className="field__label">练习把位</label>
              <div className="segmented segmented--wrap" role="group" aria-label="练习把位">
                {POSITION_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className="segmented__item"
                    aria-pressed={position === o.id}
                    onClick={() => changePosition(o.id)}
                    type="button"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field__label">和弦集</label>
              <div className="segmented segmented--wrap" role="group" aria-label="和弦集">
                {CHORD_SET_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className="segmented__item"
                    aria-pressed={setId === o.id}
                    onClick={() => changeSet(o.id)}
                    type="button"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field__label">切换频率</label>
              <div className="segmented" role="group" aria-label="切换频率">
                {SWITCH_OPTIONS.map((o) => (
                  <button
                    key={o.beats}
                    className="segmented__item"
                    aria-pressed={switchEvery === o.beats}
                    onClick={() => setSwitchEvery(o.beats)}
                    type="button"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn--ghost changes-reroll" onClick={() => regenerate()} type="button">
              ↻ 重排序列
            </button>
          </div>

          <div className="changes-layout">
            {/* 左：当前和弦（大图，定位在指定把位） + 节拍 + 换把 */}
            <div className="changes-figure">
              <div className="chord-head">
                <span className="chord-head__name">
                  {LETTER_NAMES[current.rootPc]}
                  {currentType.abbr}
                </span>
                <span className="chord-head__type">{currentType.label}</span>
                <span className="chord-head__formula">
                  {currentType.formula.map((i) => DEGREE_LABEL[i] ?? String(i)).join(' · ')}
                </span>
                <span className="chord-head__pos">{posLabel}</span>
              </div>

              <div className="changes-diagram-wrap">
                <ChordDiagram voicing={currentVoicing} />
              </div>

              {/* 接下来两个和弦 */}
              <div className="changes-next" aria-label="接下来">
                {upcoming.map((u, i) => {
                  const t = CHORD_TYPES.find((x) => x.id === u.typeId) ?? CHORD_TYPES[0]
                  return (
                    <span key={i} className="changes-next__chip">
                      <span className="changes-next__ord">{i === 0 ? '下一' : '再下'}</span>
                      <strong>
                        {LETTER_NAMES[u.rootPc]}
                        {t.abbr}
                      </strong>
                      <span className="changes-next__type">{t.label}</span>
                    </span>
                  )
                })}
              </div>

              {/* 节拍指示 + 倒计时 */}
              <div className="changes-beat-row">
                <div className="changes-strip" role="img" aria-label="节拍">
                  {Array.from({ length: switchEvery }).map((_, i) => (
                    <span
                      key={i}
                      className={[
                        'changes-beat',
                        i === barBeat ? 'is-current' : '',
                        i === 0 ? 'is-switch' : '',
                      ].join(' ')}
                    />
                  ))}
                </div>
                <div className="changes-ring" aria-hidden="true">
                  <div
                    className="changes-ring__fill"
                    style={{ width: `${Math.round((barBeat / switchEvery) * 100)}%` }}
                  />
                </div>
              </div>

              <button
                className="btn btn--primary changes-tap"
                onClick={strum}
                type="button"
              >
                ♪ 弹一下当前和弦
              </button>
              <span className="changes-tap__hint">
                当前律动「{preset.label}」驱动节拍；每到切换拍自动扫响新和弦——重音一响，你就该落在新把位。跟着听换把即可，不用腾手按键。
              </span>

              {/* 贯通：练完换把，直接在这个根音上走音阶（预选适合该和弦的默认音阶） */}
              <div className="changes-toscale">
                <button className="btn btn--primary" onClick={goScaleForCurrent} type="button">
                  🎯 同根音走音阶 →
                </button>
                <span className="changes-tap__hint">
                  跳到音阶页会预选 {scaleLabel(defaultScaleForChord(current.typeId))}（根音 {LETTER_NAMES[current.rootPc]} 已共享），手指记忆和音阶语汇接上。
                </span>
              </div>
            </div>

            {/* 右：贯通（当前和弦属于哪些音阶） + 统计 */}
            <div className="chord-aside">
              <ChordConnection rootPc={current.rootPc} typeId={current.typeId} />

              <section className="changes-stats" aria-label="换把统计">
                <h4 className="changes-stats__title">换把进度</h4>
                <div className="changes-stats__rate">{switches}<span>已完成换把</span></div>
                <p className="changes-stats__empty">
                  每完成一次换把就 +1。跟着重音把手指落到新把位，节奏就练出来了。
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* 底部节拍器 / 传输条（复用 rhythm-bar 视觉） */}
      <section className="rhythm-bar changes-transport" aria-label="练习传输条">
        <div className="rhythm-bar__left">
          <div className="rhythm-bar__group">
            <button
              className={playing ? 'btn btn--sm btn--ghost' : 'btn btn--sm btn--primary'}
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? '停止' : '开始'}
              type="button"
            >
              {playing ? '■ 停止' : '▶ 开始'}
            </button>

            <div className="rhythm-bar__field">
              <label className="rhythm-bar__label">
                速度 <strong>{bpm}</strong> BPM
              </label>
              <input
                className="rhythm-bar__slider"
                type="range"
                min={50}
                max={160}
                step={1}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
              />
            </div>

            <div className="rhythm-bar__readout">
              <span className="rhythm-bar__label">律动</span>
              <span className="rhythm-bar__preset">{preset.label}</span>
            </div>
          </div>

          <div className="rhythm-bar__group">
            <span className="rhythm-bar__label">试听当前</span>
            <button className="btn btn--sm btn--ghost" onClick={strum} type="button">
              ♪ 弹一下
            </button>
          </div>
        </div>

        <div className="changes-transport__info">
          第 {cursor + 1}/{sequence.length} 个 ·{' '}
          {LETTER_NAMES[current.rootPc]}
          {currentType.abbr} @ {posLabel}
        </div>
      </section>
    </main>
  )
}
