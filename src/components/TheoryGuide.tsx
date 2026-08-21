/**
 * 练习手册（Theory Guide）· 渲染层
 * ─────────────────────────────────────────────
 * 顶栏「乐理」入口。左侧常驻目录（滚动高亮当前节），右侧依次渲染：
 *   ① 每日配比 + 练习顺序总纲（技能阶梯：阶段 × 量化目标 × 模块跳转）
 *   ② 分模块详解（是什么 / 怎么练 / 拆解分析，内嵌拟真指板教学图）
 *   ③ 术语速查（复用 ConceptCheatSheet）
 * 图示复用 Fretboard 组件（compact 模式 + 高亮标记 + 取景压暗）；
 * 「去练」按钮经 sessionStore 跳到对应模块（与和弦→音阶页同一套贯通机制）。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Fretboard, type Highlight, type HighlightKind } from './Fretboard'
import { ConceptCheatSheet } from './ConceptCheatSheet'
import {
  DAILY_ROUTINE,
  DIAGRAMS,
  GUIDE_INTRO,
  MODULE_GUIDES,
  ROADMAP_BASIS_NOTE,
  ROADMAP_STAGES,
  type DiagramSpec,
  type GuideBlock,
  type MarkKind,
} from '../lib/guide'
import { sessionStore, type ViewKey } from '../lib/session'
import type { Tuning } from '../lib/music'

/* ─────────────── 「去练」：写入贯通参数再跳模块 ─────────────── */

const PRACTICE_SEEDS: Partial<Record<ViewKey, () => void>> = {
  chords: () => {
    sessionStore.setRoot(0)
    sessionStore.setChord('maj')
  },
  scales: () => sessionStore.setScale('minorPent'),
  jam: () => {
    sessionStore.setKey(0, 'major')
    sessionStore.setJamPreset('1-6-4-5')
  },
  licks: () => {
    sessionStore.setRoot(9) // 乐句库以 A(根音 9) 为参考根音书写
    sessionStore.setLick('blues-open')
  },
}

function goPractice(view: ViewKey) {
  PRACTICE_SEEDS[view]?.()
  sessionStore.requestNav(view)
}

/* ─────────────── 指板教学图 ─────────────── */

const MARK_TO_KIND: Record<MarkKind, HighlightKind> = {
  root: 'answer',
  start: 'answer',
  note: 'secondary',
  accent: 'accent',
  ghost: 'ghost',
  end: 'done',
}

function Diagram({ spec, tuning }: { spec: DiagramSpec; tuning: Tuning }) {
  const highlights = useMemo<Highlight[]>(
    () =>
      spec.marks.map((m) => ({
        string: m.string,
        fret: m.fret,
        kind: MARK_TO_KIND[m.kind],
        label: m.label,
      })),
    [spec],
  )

  return (
    <figure className="theory-diagram">
      <div className="theory-diagram__board">
        <Fretboard
          tuning={tuning}
          maxFret={spec.maxFret}
          highlights={highlights}
          targetString={null}
          scopeRange={spec.scope}
          interactive={false}
          showAllNotes={false}
          labelMode="letter"
          ringingString={null}
          compact
        />
      </div>
      {spec.legend && (
        <div className="theory-diagram__legend">
          {spec.legend.map((l) => (
            <span key={l.text} className="theory-diagram__key">
              <i className={`theory-diagram__swatch theory-diagram__swatch--${l.kind}`} />
              {l.text}
            </span>
          ))}
        </div>
      )}
      <figcaption className="theory-diagram__caption">{spec.caption}</figcaption>
    </figure>
  )
}

/* ─────────────── 内容块渲染 ─────────────── */

function Block({ block, tuning }: { block: GuideBlock; tuning: Tuning }) {
  switch (block.type) {
    case 'p':
      return <p className="theory-p">{block.text}</p>

    case 'definition':
      return (
        <div className="theory-def">
          <span className="theory-def__term">{block.term}</span>
          <span className="theory-def__text">{block.text}</span>
        </div>
      )

    case 'callout':
      return (
        <div className={`theory-callout theory-callout--${block.tone}`}>
          {block.title && <span className="theory-callout__title">{block.title}</span>}
          <span className="theory-callout__text">{block.text}</span>
        </div>
      )

    case 'practice':
      return (
        <div className="theory-practice">
          <h4 className="theory-practice__title">{block.title}</h4>
          <div className="theory-practice__row">
            <span className="theory-practice__k">练法</span>
            <p className="theory-practice__v theory-practice__v--pre">{block.method}</p>
          </div>
          <div className="theory-practice__row">
            <span className="theory-practice__k theory-practice__k--goal">目标</span>
            <p className="theory-practice__v">{block.goal}</p>
          </div>
        </div>
      )

    case 'steps':
      return (
        <div className="theory-steps">
          <h4 className="theory-steps__title">{block.title}</h4>
          <ol className="theory-steps__list">
            {block.items.map((it, i) => (
              <li key={i} className="theory-steps__item">
                <span className="theory-steps__num">{i + 1}</span>
                <span className="theory-steps__text">{it}</span>
              </li>
            ))}
          </ol>
        </div>
      )

    case 'chips':
      return (
        <div className="theory-chips">
          {block.title && <h4 className="theory-chips__title">{block.title}</h4>}
          <div className="theory-chips__flow">
            {block.items.map((c, i) => (
              <span key={c.label} className="theory-chips__wrap">
                <span className="theory-chips__chip">
                  <b>{c.label}</b>
                  {c.sub && <em>{c.sub}</em>}
                </span>
                {i < block.items.length - 1 && <span className="theory-chips__arrow">→</span>}
              </span>
            ))}
          </div>
        </div>
      )

    case 'diagram': {
      const spec = DIAGRAMS[block.diagram]
      return spec ? <Diagram spec={spec} tuning={tuning} /> : null
    }

    case 'relation':
      return (
        <button className="theory-relation" type="button" onClick={() => goPractice(block.to.view)}>
          <span className="theory-relation__text">{block.text}</span>
          <span className="theory-relation__btn">{block.to.label} →</span>
        </button>
      )
  }
}

/* ─────────────── 页面 ─────────────── */

interface TheoryGuideProps {
  tuning: Tuning
}

const TOC_SECTIONS: { id: string; title: string }[] = [
  { id: 'roadmap', title: '练习顺序总纲' },
  ...MODULE_GUIDES.map((m) => ({ id: m.id, title: m.title })),
  { id: 'terms', title: '术语速查' },
]

export function TheoryGuide({ tuning }: TheoryGuideProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState<string>(TOC_SECTIONS[0].id)

  // 滚动高亮当前节（在滚动容器内部滚动，不是 window）
  useEffect(() => {
    const cont = scrollRef.current
    if (!cont) return
    const onScroll = () => {
      const top = cont.getBoundingClientRect().top
      let current = TOC_SECTIONS[0].id
      for (const s of TOC_SECTIONS) {
        const el = document.getElementById(`guide-${s.id}`)
        if (el && el.getBoundingClientRect().top - top <= 160) current = s.id
      }
      setActiveId(current)
    }
    onScroll() // 初始定位
    cont.addEventListener('scroll', onScroll, { passive: true })
    return () => cont.removeEventListener('scroll', onScroll)
  }, [])

  const handleNav = (id: string) => {
    const cont = scrollRef.current
    const el = document.getElementById(`guide-${id}`)
    if (el && cont) {
      const top =
        el.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 12
      cont.scrollTo({ top, behavior: 'smooth' })
    }
    setActiveId(id)
  }

  const backToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <section className="theory-page module-stage">
      <div className="theory-scroll" ref={scrollRef}>
        {/* ══ 左：目录 ══ */}
        <aside className="theory-toc" aria-label="练习手册目录">
          <div className="theory-toc__head">
            <span className="theory-toc__kicker">目录</span>
            <span className="theory-toc__count">{TOC_SECTIONS.length} 节</span>
          </div>
          <nav className="theory-toc__list">
            {TOC_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`theory-toc__item${activeId === s.id ? ' is-active' : ''}`}
                aria-current={activeId === s.id}
                onClick={() => handleNav(s.id)}
              >
                <span className="theory-toc__label">{s.title}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="theory-toc__top" onClick={backToTop}>
            ↑ 回到顶部
          </button>
        </aside>

        {/* ══ 右：内容 ══ */}
        <div className="theory-main">
          <header className="theory-intro">
            <h2 className="theory-intro__title">{GUIDE_INTRO.title}</h2>
            <p className="theory-intro__sub">{GUIDE_INTRO.subtitle}</p>
          </header>

          {/* ── 每日配比 ── */}
          <div className="theory-daily">
            <h3 className="theory-daily__title">⏱ {DAILY_ROUTINE.title}</h3>
            <ul className="theory-daily__list">
              {DAILY_ROUTINE.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
            <p className="theory-daily__note">{DAILY_ROUTINE.note}</p>
          </div>

          {/* ── ① 练习顺序总纲 ── */}
          <article id="guide-roadmap" className="theory-card">
            <div className="theory-card__head">
              <h3 className="theory-card__title">练习顺序总纲</h3>
              <p className="theory-card__tag">按这个顺序走，每阶段过了量化标准再进下一个</p>
            </div>
            <div className="theory-roadmap">
              {ROADMAP_STAGES.map((s, i) => (
                <div key={s.id} className="road-stage">
                  <div className="road-stage__rail">
                    <span className="road-stage__num">{i}</span>
                  </div>
                  <div className="road-stage__body">
                    <div className="road-stage__head">
                      <h4 className="road-stage__title">{s.title}</h4>
                      <span className="road-stage__duration">{s.duration}</span>
                    </div>
                    <p className="road-stage__what">{s.what}</p>
                    <div className="road-stage__cols">
                      <div className="road-stage__col">
                        <span className="road-stage__k">怎么练</span>
                        <ul className="road-stage__method">
                          {s.method.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="road-stage__col">
                        <span className="road-stage__k road-stage__k--goal">过关标准</span>
                        <ul className="road-stage__goals">
                          {s.goals.map((g) => (
                            <li key={g}>{g}</li>
                          ))}
                        </ul>
                        {s.modules.length > 0 && (
                          <div className="road-stage__modules">
                            {s.modules.map((m) => (
                              <button
                                key={m.label}
                                type="button"
                                className="road-stage__go"
                                onClick={() => goPractice(m.view)}
                              >
                                {m.label} →
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="road-stage__basis">依据 · {s.basis}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="road-basis-note">{ROADMAP_BASIS_NOTE}</p>
          </article>

          {/* ── ② 分模块详解 ── */}
          {MODULE_GUIDES.map((m) => (
            <article key={m.id} id={`guide-${m.id}`} className="theory-card">
              <div className="theory-card__head">
                <h3 className="theory-card__title">
                  <span className="theory-card__icon" aria-hidden="true">
                    {m.icon}
                  </span>
                  {m.title}
                </h3>
                <p className="theory-card__tag">{m.why}</p>
              </div>
              <p className="theory-module-what">{m.what}</p>
              <div className="theory-card__body">
                {m.blocks.map((b, i) => (
                  <Block key={i} block={b} tuning={tuning} />
                ))}
              </div>
            </article>
          ))}

          {/* ── ③ 术语速查 ── */}
          <article id="guide-terms" className="theory-card">
            <div className="theory-card__head">
              <h3 className="theory-card__title">术语速查</h3>
              <p className="theory-card__tag">正文里没展开的黑话，都在这张小抄里</p>
            </div>
            <ConceptCheatSheet />
          </article>

          <footer className="theory-foot">
            手上功夫看这页，脑子里的懂看「路径」页——两页一起用，练完记得回「路径」勾掉完成项。
          </footer>
        </div>
      </div>
    </section>
  )
}
