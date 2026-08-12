/**
 * 模块间共享上下文（贯通层的基础设施）
 * ─────────────────────────────────────────────
 * 和弦页 / 音阶页 / 指板训练是三个独立视图，但用户的学习是连贯的：
 * 在和弦页选了根音 C，切到音阶页应该还是 C；在音阶页点「去和弦页练这个」，
 * 和弦页应该直接打开那个和弦。这个 store 就是它们之间的「接线板」。
 *
 * 用 useSyncExternalStore 实现，带 localStorage 持久化，组件卸载再挂载也能接上。
 */

import { useSyncExternalStore } from 'react'

export type ViewKey = 'train' | 'chords' | 'scales'

interface SharedState {
  /** 当前共享根音（pitch class 0..11），null = 尚未设定 */
  rootPc: number | null
  /** 当前共享音阶 id（如 'minorPent'），用于和弦页 → 音阶页跳转 */
  scaleId: string | null
  /** 当前共享和弦类型 id（如 'dom7'），用于音阶页 → 和弦页跳转 */
  chordTypeId: string | null
  /** 跨模块导航请求；消费后置空 */
  navRequest: { view: ViewKey; token: number } | null
}

const STORAGE_KEY = 'fretboard-atlas-session'

function load(): SharedState {
  const base: SharedState = {
    rootPc: null,
    scaleId: null,
    chordTypeId: null,
    navRequest: null,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<SharedState>
      if (typeof p.rootPc === 'number') base.rootPc = p.rootPc
      if (typeof p.scaleId === 'string') base.scaleId = p.scaleId
      if (typeof p.chordTypeId === 'string') base.chordTypeId = p.chordTypeId
    }
  } catch {
    /* localStorage 不可用（如 SSR / 隐私模式）时静默回退 */
  }
  return base
}

let state: SharedState = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ rootPc: state.rootPc, scaleId: state.scaleId, chordTypeId: state.chordTypeId }),
    )
  } catch {
    /* 忽略写入失败 */
  }
}

function emit() {
  persist()
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: (): SharedState => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  setRoot(pc: number) {
    if (state.rootPc === pc) return
    state = { ...state, rootPc: pc }
    emit()
  },
  setScale(id: string) {
    if (state.scaleId === id) return
    state = { ...state, scaleId: id }
    emit()
  },
  setChord(typeId: string) {
    if (state.chordTypeId === typeId) return
    state = { ...state, chordTypeId: typeId }
    emit()
  },
  /** 请求 App 切换到某个视图（同时已通过 setRoot/setScale/setChord 写好目标状态） */
  requestNav(view: ViewKey) {
    state = { ...state, navRequest: { view, token: Date.now() } }
    emit()
  },
  /** 消费导航请求（读后清空，避免重复触发） */
  consumeNav(): ViewKey | null {
    const v = state.navRequest?.view ?? null
    if (v) {
      state = { ...state, navRequest: null }
      emit()
    }
    return v
  },
}

/** 共享根音：[当前根音, 写入函数] */
export function useSharedRoot(): [number | null, (pc: number) => void] {
  const s = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  return [s.rootPc, sessionStore.setRoot]
}

/** 共享音阶 id：[当前音阶 id, 写入函数] */
export function useSharedScale(): [string | null, (id: string) => void] {
  const s = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  return [s.scaleId, sessionStore.setScale]
}

/** 共享和弦类型：[当前和弦类型 id, 写入函数] */
export function useSharedChord(): [string | null, (id: string) => void] {
  const s = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  return [s.chordTypeId, sessionStore.setChord]
}
