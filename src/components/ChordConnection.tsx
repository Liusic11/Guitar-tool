/**
 * 和弦 → 音阶 贯通面板
 * ─────────────────────────────────────────────
 * 放在和弦页右侧：告诉用户「这个和弦上能弹哪些音阶、为什么」，
 * 并一键跳到音阶页开练（共享根音 + 目标音阶已写好）。
 */

import { LETTER_NAMES, type PitchClass } from '../lib/music'
import { sessionStore } from '../lib/session'
import { scaleSuggestions, scaleLabel, type Fit } from '../lib/harmony'

const FIT_LABEL: Record<Fit, string> = { strong: '稳', color: '色彩', tension: '张力' }

interface ChordConnectionProps {
  rootPc: PitchClass
  typeId: string
}

export function ChordConnection({ rootPc, typeId }: ChordConnectionProps) {
  const root = LETTER_NAMES[rootPc]
  const suggestions = scaleSuggestions(typeId)
  if (suggestions.length === 0) return null

  const openScale = (scaleId: string) => {
    sessionStore.setRoot(rootPc)
    sessionStore.setScale(scaleId)
    sessionStore.requestNav('scales')
  }

  return (
    <section className="harmony harmony--chord" aria-label="贯通：这个和弦上能弹什么音阶">
      <div className="harmony__head">
        <h4 className="harmony__title">↔ 贯通 · 这个和弦上弹什么</h4>
        <span className="harmony__sync">根音已与音阶页共享 {root}</span>
      </div>

      <p className="harmony__lead">
        同一个根音 <strong>{root}</strong>，下面这些音阶都和它「合得来」。点「去音阶页」直接开练。
      </p>

      <ul className="harmony__list">
        {suggestions.map((s) => (
          <li key={s.scaleId} className="harmony__item">
            <div className="harmony__item-head">
              <span className={`fit-badge fit-badge--${s.fit}`}>{FIT_LABEL[s.fit]}</span>
              <span className="harmony__scale-name">{scaleLabel(s.scaleId)}</span>
              <button
                className="btn btn--sm btn--ghost harmony__go"
                onClick={() => openScale(s.scaleId)}
                type="button"
              >
                → 音阶页
              </button>
            </div>
            <p className="harmony__reason">{s.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
