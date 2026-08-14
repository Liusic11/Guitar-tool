/**
 * 音阶 → 和弦 / 进行 贯通面板
 * ─────────────────────────────────────────────
 * 放在音阶页右侧：告诉用户「这个音阶包含哪些顺阶和弦、常见进行为什么成立」，
 * 并一键跳到和弦页看那个和弦（共享根音 + 目标类型已写好）。
 */

import { LETTER_NAMES, type PitchClass } from '../lib/music'
import { sessionStore } from '../lib/session'
import {
  isPentatonicScale,
  PENTATONIC_CONTEXT,
  diatonicChords,
  chordName,
  chordTypeLabel,
  progressionsFor,
  scaleLabel,
} from '../lib/harmony'

interface ScaleConnectionProps {
  rootPc: PitchClass
  scaleId: string
}

export function ScaleConnection({ rootPc, scaleId }: ScaleConnectionProps) {
  const root = LETTER_NAMES[rootPc]

  const openChord = (chordRootPc: number, typeId: string) => {
    sessionStore.setRoot(chordRootPc)
    sessionStore.setChord(typeId)
    sessionStore.requestNav('chords')
  }

  // 五声 / 布鲁斯：没有顺阶和弦概念，改用「常用落点 + 进行」
  if (isPentatonicScale(scaleId)) {
    const ctx = PENTATONIC_CONTEXT[scaleId]
    return (
      <section className="harmony harmony--scale" aria-label="贯通：这个音阶落在哪些和弦上">
        <div className="harmony__head">
          <h4 className="harmony__title">↔ 贯通 · 这个音阶落在哪</h4>
          <span className="harmony__sync">根音已与和弦页共享 {root}</span>
        </div>

        <p className="harmony__lead">
          {root} {scaleLabel(scaleId)} 是五声音阶，没有「顺阶和弦」概念。它最稳的落点是{' '}
          <strong>{ctx.homeLabel}</strong>。
        </p>

        <div className="harmony__block">
          <h5 className="harmony__h">{ctx.progression.name}</h5>
          <p className="harmony__numerals">{ctx.progression.numerals}</p>
          <p className="harmony__reason">{ctx.progression.why}</p>
        </div>
      </section>
    )
  }

  const chords = diatonicChords(rootPc, scaleId)
  const progs = progressionsFor(scaleId)

  return (
    <section className="harmony harmony--scale" aria-label="贯通：这个音阶的顺阶和弦与进行">
      <div className="harmony__head">
        <h4 className="harmony__title">↔ 贯通 · 顺阶和弦与进行</h4>
        <span className="harmony__sync">根音已与和弦页共享 {root}</span>
      </div>

      <p className="harmony__lead">
        {root} {scaleLabel(scaleId)} 里三级叠置，得到这 {chords.length} 个顺阶和弦（点开看把位）：
      </p>

      {chords.length > 0 ? (
        <ul className="harmony__chords">
          {chords.map((c) => (
            <li key={c.numeral} className="harmony__chord">
              <span className="harmony__numeral">{c.numeral}</span>
              <button
                className="harmony__chord-name"
                onClick={() => openChord(c.rootPc, c.typeId)}
                type="button"
                title="在和弦页打开"
              >
                {chordName(c.rootPc, c.typeId)}
                <small>{chordTypeLabel(c.typeId)}</small>
              </button>
              {c.note && <span className="harmony__chord-note">{c.note}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="harmony__reason">
          这条音阶（对称 / bebop 类）没有「传统顺阶三和弦」的概念——它更多是当作「色彩 / 经过音仓库」来用：
          直接落在它包含的和弦（如减七、增三）上制造张力，而不是叠出一组家感和弦。换个角度听：把它当「味道」，不是「骨架」。
        </p>
      )}

      {progs.length > 0 && (
        <div className="harmony__block">
          <h5 className="harmony__h">常见进行 · 为什么成立</h5>
          {progs.map((p) => (
            <div key={p.name} className="harmony__prog">
              <p className="harmony__prog-name">
                {p.name} <span className="harmony__numerals">{p.numerals}</span>
              </p>
              <p className="harmony__reason">{p.why}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
