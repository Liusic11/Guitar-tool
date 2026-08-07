/**
 * 间隔重复（SRS）记忆模型
 * ─────────────────────────────────────────────
 * 每个「抽题锚点」(如 find:6:0 表示「6弦上的 C」) 维护一条掌握度记录。
 * 出题时按掌握度加权抽：越不熟、越久没练的题，越容易被抽到。
 * 这样你不用自己挑弱项——系统会自动把练习时间花在最该练的地方。
 *
 * 模型刻意做得轻量：不搞完整的 SM-2 调度日期，只用：
 *   · ease    0..1  越接近 1 表示越熟
 *   · lastSeen      上次出现的时间戳，用于「久没练就该回锅」
 *   · streak        连续答对次数，给一点连续正反馈
 */

export interface MasteryItem {
  /** 出现次数 */
  seen: number
  /** 答对次数 */
  correct: number
  /** 掌握度 0..1 */
  ease: number
  /** 连续答对 */
  streak: number
  /** 上次出现时间戳 */
  lastSeen: number
}

export type MasteryMap = Record<string, MasteryItem>

const DAY = 86_400_000

/** 没见过的锚点给一个偏高的初始权重，确保新题一定会被练到 */
export const NEW_ITEM_WEIGHT = 3.4

/**
 * 给单个锚点算「被抽中的权重」。
 * 没见过 → 高权重；见过 → 越不熟、越久没练，权重越高。
 */
export function scoreItem(item: MasteryItem | undefined, now: number): number {
  if (!item) return NEW_ITEM_WEIGHT
  const days = (now - item.lastSeen) / DAY
  // 久没练就慢慢回锅：0.35（刚练过）→ 3（超过 5 天没碰）
  const recency = Math.min(3, 0.35 + days * 0.5)
  return Math.max(0.03, (1 - item.ease) * recency)
}

/**
 * 一次作答后更新掌握度。
 * 答对：ease 朝 1 收敛；答错：ease 明显回落，连对清零。
 */
export function updateMastery(
  map: MasteryMap,
  key: string,
  correct: boolean,
  now: number,
): MasteryMap {
  const prev = map[key]
  const ease = prev?.ease ?? 0
  const nextEase = correct
    ? ease + (1 - ease) * 0.22
    : Math.max(0, ease - ease * 0.45 - 0.05)
  return {
    ...map,
    [key]: {
      seen: (prev?.seen ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
      ease: nextEase,
      streak: correct ? (prev?.streak ?? 0) + 1 : 0,
      lastSeen: now,
    },
  }
}

/**
 * 加权随机抽一个下标。
 * 权重越高的项越容易被选中；rng 可注入便于测试。
 */
export function pickWeighted<T>(items: T[], score: (t: T) => number, rng = Math.random): number {
  const weights = items.map(score)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return Math.floor(rng() * items.length)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return items.length - 1
}

/** 找出满足谓词的下标集合 */
export function indicesWhere<T>(items: T[], pred: (t: T) => boolean): number[] {
  const out: number[] = []
  items.forEach((t, i) => pred(t) && out.push(i))
  return out
}
