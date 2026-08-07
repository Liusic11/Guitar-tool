/**
 * 倒计时环
 * ─────────────────────────────────────────────
 * 进度环交给 CSS 动画跑，只有秒数文字走 React state，
 * 这样每帧的平滑动画不会牵动整块指板重渲染。
 */

import { memo, useEffect, useState } from 'react'

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface CountdownRingProps {
  /** 总时长（秒） */
  duration: number
  /** 变化时重启动画 */
  token: number
  /** 暂停时环停在原地 */
  paused?: boolean
}

export const CountdownRing = memo(function CountdownRing({
  duration,
  token,
  paused = false,
}: CountdownRingProps) {
  const [remaining, setRemaining] = useState(duration)

  useEffect(() => {
    if (paused) return
    const startedAt = performance.now()
    setRemaining(duration)
    const id = window.setInterval(() => {
      const left = duration - (performance.now() - startedAt) / 1000
      setRemaining(Math.max(0, left))
      if (left <= 0) window.clearInterval(id)
    }, 90)
    return () => window.clearInterval(id)
  }, [duration, token, paused])

  return (
    <div className="timer" role="timer" aria-label={`剩余 ${Math.ceil(remaining)} 秒`}>
      <svg className="timer__ring" viewBox="0 0 60 60">
        <circle className="timer__track" cx="30" cy="30" r={RADIUS} />
        <circle
          key={token}
          className="timer__progress"
          cx="30"
          cy="30"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          style={{
            animation: paused ? 'none' : `ring-drain ${duration}s linear forwards`,
            strokeDashoffset: paused ? 0 : undefined,
          }}
        />
      </svg>
      <span className="timer__value">{remaining < 0.1 ? '0.0' : remaining.toFixed(1)}</span>
    </div>
  )
})
