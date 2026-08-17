/**
 * 学习路径（Learning Path）· 课程地图视图
 * ─────────────────────────────────────────────
 * 顶栏第 1 项。把 PATH_STAGES 的 7 个阶段渲染成卡片，每张卡片包含：
 * 目标 / 概念 / 练习（可一键「去练」跳转到对应模块，贯通参数已写好）/ 自检 / 常见坑。
 *
 * 定位：地图，不是课程表。自检勾选只存本机 localStorage，工具不提醒、不追踪、
 * 不判定你「该练什么」——勾不勾、练多快，全由用户自己决定。
 */

import { useState } from 'react'
import { PATH_STAGES, type PathPractice, type PathStage } from '../lib/path'
import { sessionStore } from '../lib/session'

const STORAGE_KEY = 'fretboard-atlas:path:v1'

/** 自检勾选状态：stageId -> 已勾选的检查项文本列表 */
type Checks = Record<string, string[]>

function loadChecks(): Checks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const out: Checks = {}
      for (const k of Object.keys(parsed)) {
        if (Array.isArray(parsed[k]) && parsed[k].every((x) => typeof x === 'string')) {
          out[k] = parsed[k] as string[]
        }
      }
      return out
    }
  } catch {
    /* localStorage 不可用 / 数据损坏时静默回退为空 */
  }
  return {}
}

/** 「去练」：写入贯通参数并跳转到目标模块（与和弦→音阶页同一套机制） */
function go(p: PathPractice) {
  if (!p.view) return
  const s = p.seed
  if (s) {
    if (s.rootPc != null) sessionStore.setRoot(s.rootPc)
    if (s.scaleId) sessionStore.setScale(s.scaleId)
    if (s.chordTypeId) sessionStore.setChord(s.chordTypeId)
    if (s.lickId) sessionStore.setLick(s.lickId)
    if (s.keyPc != null && s.keyQuality) sessionStore.setKey(s.keyPc, s.keyQuality)
    if (s.jamPresetId) sessionStore.setJamPreset(s.jamPresetId)
  }
  sessionStore.requestNav(p.view)
}

export function LearningPath() {
  const [checks, setChecks] = useState<Checks>(loadChecks)

  const toggle = (stageId: string, text: string) => {
    setChecks((prev) => {
      const cur = prev[stageId] ?? []
      const next = cur.includes(text) ? cur.filter((t) => t !== text) : [...cur, text]
      const merged = { ...prev, [stageId]: next }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      } catch {
        /* 写入失败忽略（隐私模式等） */
      }
      return merged
    })
  }

  const stageDone = (s: PathStage) => s.checks.length > 0 && (checks[s.id] ?? []).length >= s.checks.length
  const doneCount = PATH_STAGES.filter(stageDone).length

  return (
    <main className="module-stage path-stage">
      <div className="module-scroll">
        <div className="path-hero">
          <p className="section-label">学习路径 · 课程地图</p>
          <h2 className="path-hero__title">从零到能即兴的地图</h2>
          <p className="path-hero__desc">
            这是地图，不是课程表：它告诉你先学什么、再学什么、练到什么程度算过关，节奏完全由你自己定。
            每阶段的自检项练到就勾掉（只存本机，工具不提醒你）。标注 <span className="path-hero__todo-mark">✦ 待补</span>{' '}
            的能力本工具还没做，是值得补的下一块。
          </p>
          <div className="path-progress">
            <div className="path-progress__bar" aria-hidden="true">
              <div
                className="path-progress__fill"
                style={{ width: `${(doneCount / PATH_STAGES.length) * 100}%` }}
              />
            </div>
            <span className="path-progress__label">
              已走完 {doneCount} / {PATH_STAGES.length} 阶段
            </span>
          </div>
        </div>

        {PATH_STAGES.map((s) => (
          <section key={s.id} className={`path-card${stageDone(s) ? ' path-card--done' : ''}`}>
            <header className="path-card__head">
              <span className="path-card__num" aria-hidden="true">
                {s.num}
              </span>
              <div className="path-card__titles">
                <h3 className="path-card__title">{s.title}</h3>
                <span className="path-card__duration">约 {s.duration}</span>
              </div>
              {stageDone(s) && <span className="path-card__badge">✓ 完成</span>}
            </header>

            <p className="path-card__goal">{s.goal}</p>

            <div className="path-card__block">
              <h4 className="path-card__h">先懂概念</h4>
              <ul className="path-card__concepts">
                {s.concepts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="path-card__block">
              <h4 className="path-card__h">去练</h4>
              <ul className="path-card__practices">
                {s.practices.map((p) => (
                  <li key={p.label} className="path-card__practice">
                    <span className="path-card__practice-label">{p.label}</span>
                    {p.view ? (
                      <button className="btn btn--ghost path-card__go" onClick={() => go(p)} type="button">
                        去练 →
                      </button>
                    ) : (
                      <span className="path-card__todo">✦ 待补</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="path-card__block">
              <h4 className="path-card__h">自检（练到就勾）</h4>
              <ul className="path-card__checks">
                {s.checks.map((c) => (
                  <li key={c}>
                    <label className="path-card__check">
                      <input
                        type="checkbox"
                        checked={(checks[s.id] ?? []).includes(c)}
                        onChange={() => toggle(s.id, c)}
                      />
                      <span>{c}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="path-card__block">
              <h4 className="path-card__h">常见坑</h4>
              <ul className="path-card__pitfalls">
                {s.pitfalls.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
