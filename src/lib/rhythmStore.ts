/**
 * 节奏共享状态
 * ─────────────────────────────────────────────
 * 把「速度 BPM」与「当前 groove（律动 id）」提升为全局共享状态：
 *   - 设置抽屉（SettingsDrawer）负责改它们
 *   - 底部节奏条（RhythmBar）/ 和弦切换训练（ChordChanges）/ Jam 读它们并真实发声
 * 两边都看到同一份，切换模块也不丢；并且持久化到 localStorage。
 *
 * groove 是节奏的「唯一真相源」：所有模块消费同一个 grooveId，鼓点真正有多种敲法，
 * 而不再是千篇一律的动次打次。详见 lib/rhythm.ts 的 GROOVES。
 */

import { useSyncExternalStore } from 'react'
import type { RhythmKit, RhythmSubdivision } from './rhythm'
import { getGroove } from './rhythm'

export interface RhythmState {
  bpm: number
  grooveId: string
}

const KEY = 'fretboard-rhythm'
const DEFAULT: RhythmState = { bpm: 90, grooveId: 'straight-8' }

/** 旧版 localStorage 字段 → 新 grooveId，保证老用户设置不丢 */
const LEGACY_PRESET: Record<string, string> = {
  'click-44': 'click-4',
  'click-8': 'click-8',
  'drums-44': 'straight-8',
  'click-triplet': 'click-8',
  'drums-triplet': 'straight-8',
  'drums-funk': 'funk-16',
  'drums-bossa': 'bossa',
  'drums-samba': 'samba',
  'drums-reggae': 'reggae',
  'drums-straight16': 'straight-16',
  'drums-halftime': 'halftime',
}

const LEGACY_SUBDIV_KIT: Record<string, string> = {
  'q-click': 'click-4',
  'e-click': 'click-8',
  's-click': 'click-8',
  't-click': 'click-8',
  'q-drums': 'straight-8',
  'e-drums': 'straight-8',
  's-drums': 'straight-16',
  't-drums': 'straight-8',
}

function clampBpm(v: number): number {
  if (Number.isNaN(v)) return DEFAULT.bpm
  return Math.min(200, Math.max(40, Math.round(v)))
}

function load(): RhythmState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<RhythmState> & {
        presetId?: string
        subdiv?: RhythmSubdivision
        kit?: RhythmKit
      }
      if (p.presetId && LEGACY_PRESET[p.presetId]) {
        return { bpm: clampBpm(p.bpm ?? DEFAULT.bpm), grooveId: LEGACY_PRESET[p.presetId] }
      }
      if (p.grooveId && getGroove(p.grooveId)) {
        return { bpm: clampBpm(p.bpm ?? DEFAULT.bpm), grooveId: p.grooveId }
      }
      if (p.subdiv && p.kit && LEGACY_SUBDIV_KIT[`${p.subdiv}-${p.kit}`]) {
        return { bpm: clampBpm(p.bpm ?? DEFAULT.bpm), grooveId: LEGACY_SUBDIV_KIT[`${p.subdiv}-${p.kit}`] }
      }
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
  setGroove(id: string): void {
    if (!getGroove(id)) return
    state = { ...state, grooveId: id }
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
