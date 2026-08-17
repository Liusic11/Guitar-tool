/**
 * 说明书抽屉（Tutorial Drawer）
 * ─────────────────────────────────────────────
 * 通用组件：角落一个 ❓ 按钮 → 抽屉展开树状说明书。
 * 每个节点可折叠；带 plain 的节点是可展开的「术语大白话」。
 * 内容来自 lib/tutorials.ts，先给 Jam，其他模块以后各挂一份。
 */

import { useEffect, useState } from 'react'
import type { TutorialNode, TutorialTree } from '../lib/tutorials'

interface TutorialDrawerProps {
  open: boolean
  onClose: () => void
  tree: TutorialTree
}

export function TutorialDrawer({ open, onClose, tree }: TutorialDrawerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([tree.id]))

  // 打开时默认展开根节点
  useEffect(() => {
    if (open) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(tree.id)
        return next
      })
    }
  }, [open, tree.id])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderNode = (node: TutorialNode, depth: number) => {
    const isOpen = expanded.has(node.id)
    const hasChildren = !!node.children?.length
    const hasPlain = !!node.plain

    return (
      <div key={node.id} className={`tut-node tut-node--d${depth}`}>
        <button
          className="tut-node__row"
          onClick={() => toggle(node.id)}
          type="button"
          aria-expanded={isOpen}
        >
          <span className="tut-node__arrow" aria-hidden="true">
            {hasChildren || hasPlain ? (isOpen ? '▾' : '▸') : '·'}
          </span>
          <span className="tut-node__label">{node.label}</span>
        </button>

        {isOpen && hasPlain && <p className="tut-node__plain">{node.plain}</p>}
        {isOpen && hasChildren && (
          <div className="tut-node__children">{node.children!.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" aria-label={tree.title} onClick={onClose}>
      <div className="tut-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="tut-drawer__head">
          <div>
            <h3 className="tut-drawer__title">❓ {tree.title}</h3>
            <p className="tut-drawer__subtitle">{tree.subtitle}</p>
          </div>
          <button className="btn btn--icon btn--ghost" onClick={onClose} aria-label="关闭说明书" title="关闭（Esc）">
            ✕
          </button>
        </header>
        <div className="tut-drawer__body">{tree.roots.map((r) => renderNode(r, 0))}</div>
      </div>
    </div>
  )
}
