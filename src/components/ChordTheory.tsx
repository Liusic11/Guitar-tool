/**
 * 和弦乐理讲解
 * ─────────────────────────────────────────────
 * 根据选中的和弦类型，讲清楚「为什么叫这个名字」：三度叠置的规律、
 * 大 / 小怎么分、七和弦怎么来的、听感与用法，以及可移动把位的提示。
 */

import type { ChordType } from '../lib/chords'

interface ChordTheoryProps {
  type: ChordType
}

export function ChordTheory({ type }: ChordTheoryProps) {
  return (
    <section className="chord-theory" aria-label="和弦乐理">
      <h3 className="chord-theory__title">为什么叫「{type.label}」</h3>
      <p className="chord-theory__lead">{type.theory}</p>

      <dl className="chord-theory__grid">
        <div>
          <dt>怎么叠出来的</dt>
          <dd>{type.stack}</dd>
        </div>
        <div>
          <dt>听感 / 色彩</dt>
          <dd>{type.color}</dd>
        </div>
        <div>
          <dt>常见用法</dt>
          <dd>{type.usage}</dd>
        </div>
      </dl>

      <div className="chord-theory__block">
        <h4 className="chord-theory__h">🎧 你会在哪听到它</h4>
        <p className="chord-theory__p">{type.songs}</p>
      </div>

      <div className="chord-theory__block">
        <h4 className="chord-theory__h">🪝 记忆钩子</h4>
        <p className="chord-theory__p">{type.remember}</p>
      </div>

      <div className="chord-theory__block">
        <h4 className="chord-theory__h">👂 耳朵练习</h4>
        <p className="chord-theory__p">{type.ear}</p>
      </div>

      <p className="chord-theory__note">
        提示：图上这是「可移动横按把位」——把整块形状沿琴颈平移，根音落回同一根弦，
        就能得到任意调的同类型和弦。吃透这一点，指板在你眼里就不再是散点，而是一组能平移的形状。
      </p>
    </section>
  )
}
