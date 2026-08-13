/**
 * 节奏共享状态
 * ─────────────────────────────────────────────
 * 把「速度 BPM」「时值 subdiv」「音色 kit」提升为全局共享状态：
 *   - 设置抽屉（SettingsDrawer）负责改它们
 *   - 底部节奏条（RhythmBar）/ 和弦切换训练（ChordChanges）读它们并真实发声
 * 两边都看到同一份，切换模块也不丢；并且持久化到 localStorage。
 *
 * 节奏由「时值 × 音色」两个维度决定（见 lib/rhythm.ts），不再是单一预设 id。
 */

import { useSyncExternalStore } from 'react'
import type { RhythmKit, RhythmSubdivision } from './rhythm'

export interface RhythmState {
  bpm: number
  subdiv: RhythmSubdivision
  kit: RhythmKit
}

const KEY = 'fretboard-rhythm'
const DEFAULT: RhythmState = { bpm: 90, subdiv: 'e', kit: 'drums' }

/** 旧版 localStorage 里的 presetId → 新 (subdiv, kit)，保证老用户设置不丢 */
const LEGACY: Record<string, { subdiv: RhythmSubdivision; kit: RhythmKit }> = {
  'click-44': { subdiv: 'q', kit: 'click' },
  'click-8': { subdiv: 'e', kit: 'click' },
  'drums-44': { subdiv: 'e', kit: 'drums' },
  'click-triplet': { subdiv: 't', kit: 'click' },
  'drums-triplet': { subdiv: 't', kit: 'drums' },
  'drums-funk': { subdiv: 's', kit: 'drums' },
  'drums-bossa': { subdiv: 'e', kit: 'drums' },
  'drums-samba': { subdiv: 's', kit: 'drums' },
  'drums-reggae': { subdiv: 'e', kit: 'drums' },
  'drums-straight16': { subdiv: 's', kit: 'drums' },
  'drums-halftime': { subdiv: 'e', kit: 'drums' },
}

function clampBpm(v: number): number {
  if (Number.isNaN(v)) return DEFAULT.bpm
  return Math.min(200, Math.max(40, Math.round(v)))
}

function load(): RhythmState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<RhythmState> & { presetId?: string }
      if (p.presetId && LEGACY[p.presetId]) {
        return { bpm: clampBpm(p.bpm ?? DEFAULT.bpm), ...LEGACY[p.presetId] }
      }
      const subdiv = (['q', 'e', 's', 't'] as const).includes(p.subdiv as RhythmSubdivision)
        ? (p.subdiv as RhythmSubdivision)
        : DEFAULT.subdiv
      const kit = p.kit === 'click' || p.kit === 'drums' ? p.kit : DEFAULT.kit
      return { bpm: clampBpm(p.bpm ?? DEFAULT.bpm), subdiv, kit }
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
  setSubdiv(id: RhythmSubdivision): void {
    state = { ...state, subdiv: id }
    persist()
    emit()
  },
  setKit(id: RhythmKit): void {
    state = { ...state, kit: id }
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
