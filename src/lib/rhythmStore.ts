/**
 * 节奏共享状态
 * ─────────────────────────────────────────────
 * 把「速度 BPM」与「节拍型 presetId」提升为全局共享状态：
 *   - 设置抽屉（SettingsDrawer）负责改它们
 *   - 底部节奏条（RhythmBar）负责读它们并真实发声
 * 两边都看到同一份，切换模块也不丢；并且持久化到 localStorage。
 */

import { useSyncExternalStore } from 'react'
import { getPreset } from './rhythm'

export interface RhythmState {
  bpm: number
  presetId: string
}

const KEY = 'fretboard-rhythm'
const DEFAULT: RhythmState = { bpm: 90, presetId: 'drums-44' }

function clampBpm(v: number): number {
  if (Number.isNaN(v)) return DEFAULT.bpm
  return Math.min(200, Math.max(40, Math.round(v)))
}

function load(): RhythmState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<RhythmState>
      const presetId = p.presetId && getPreset(p.presetId).id === p.presetId ? p.presetId : DEFAULT.presetId
      return { bpm: clampBpm(p.bpm ?? DEFAULT.bpm), presetId }
    }
  } catch {
    /* 忽略损坏的本地数据 */
  }
  return DEFAULT
}

let state: RhythmState = load()
const listeners = new Set<() => void>()

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 隐私模式可能写不进，忽略 */
  }
}

function emit(): void {
  listeners.forEach((l) => l())
}

export const rhythmStore = {
  get: (): RhythmState => state,
  setBpm(v: number): void {
    state = { ...state, bpm: clampBpm(v) }
    persist()
    emit()
  },
  setPreset(id: string): void {
    if (getPreset(id).id !== id) return
    state = { ...state, presetId: id }
    persist()
    emit()
  },
  subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export function useRhythmState(): RhythmState {
  return useSyncExternalStore(rhythmStore.subscribe, rhythmStore.get)
}
