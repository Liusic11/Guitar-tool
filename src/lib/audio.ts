/**
 * 拨弦音色引擎
 * ─────────────────────────────────────────────
 * 用 Karplus-Strong 物理建模实时合成尼龙 / 钢弦吉他的拨弦音，
 * 全程零音频资源依赖——任何品位、任何调弦都能即时发声。
 *
 * 信号链：
 *   KS 弦模型 buffer → 弦级 gain（含 attack/release 包络）
 *     → 琴体共鸣 EQ（Helmholtz + 面板共振 + 高频滚降）
 *       → dry ─┬─→ master → destination
 *              └─→ convolver（算法生成的房间脉冲响应）→ wet → master
 */

import { frequencyOf } from './music'

export interface PluckOptions {
  /** 力度 0..1，影响音量与拨片亮度 */
  velocity?: number
  /** 属于哪根弦——同一根弦上的新音会掐断旧音，模拟真实演奏 */
  stringNumber?: number
  /** 延迟多少秒发声，用于扫弦 */
  delay?: number
}

interface VoiceHandle {
  source: AudioBufferSourceNode
  gain: GainNode
}

const BUFFER_CACHE_LIMIT = 24

export class GuitarAudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private dry: GainNode | null = null
  private wet: GainNode | null = null
  private bodyChainInput: AudioNode | null = null

  /** midi → 合成好的弦振动波形，LRU 淘汰 */
  private bufferCache = new Map<number, AudioBuffer>()
  /** 每根弦当前正在响的声音，用于掐断 */
  private activeVoices = new Map<number, VoiceHandle>()

  private _muted = false
  private _volume = 0.75

  /* ─────────────────────── 生命周期 ─────────────────────── */

  /**
   * 创建 / 恢复 AudioContext。
   * 浏览器要求音频必须由用户手势触发，所以每次交互都调一次是安全的。
   */
  async unlock(): Promise<void> {
    if (!this.ctx) this.build()
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* 用户尚未交互，忽略 */
      }
    }
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  get muted(): boolean {
    return this._muted
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    this.applyVolume()
  }

  get volume(): number {
    return this._volume
  }

  setVolume(volume: number): void {
    this._volume = Math.min(1, Math.max(0, volume))
    this.applyVolume()
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return
    const target = this._muted ? 0 : this._volume
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02)
  }

  /**
   * 调整混响的干湿比。
   * 0 = 全干（贴耳、像抱着琴），1 = 全湿（远、像在琴房里）。
   */
  setReverbMix(amount: number): void {
    if (!this.ctx || !this.dry || !this.wet) return
    const mix = Math.min(1, Math.max(0, amount))
    const now = this.ctx.currentTime
    this.dry.gain.setTargetAtTime(0.9 - mix * 0.35, now, 0.05)
    this.wet.gain.setTargetAtTime(mix * 0.55, now, 0.05)
  }

  private build(): void {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    const ctx = new Ctor()
    this.ctx = ctx

    // ── 琴体共鸣：三段 peaking 模拟音箱腔体，再用 shelf 收掉过亮的高频
    const helmholtz = ctx.createBiquadFilter()
    helmholtz.type = 'peaking'
    helmholtz.frequency.value = 104 // 音孔亥姆霍兹共鸣
    helmholtz.Q.value = 1.1
    helmholtz.gain.value = 4.5

    const topPlate = ctx.createBiquadFilter()
    topPlate.type = 'peaking'
    topPlate.frequency.value = 218 // 面板主共振
    topPlate.Q.value = 1.6
    topPlate.gain.value = 3

    const boxDip = ctx.createBiquadFilter()
    boxDip.type = 'peaking'
    boxDip.frequency.value = 430 // 箱声凹陷，避免发闷
    boxDip.Q.value = 1.1
    boxDip.gain.value = -2.5

    const presence = ctx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.value = 2600 // 一点点指甲触弦的颗粒感
    presence.Q.value = 0.9
    presence.gain.value = 2

    const airRolloff = ctx.createBiquadFilter()
    airRolloff.type = 'highshelf'
    airRolloff.frequency.value = 6200
    airRolloff.gain.value = -7

    const rumbleCut = ctx.createBiquadFilter()
    rumbleCut.type = 'highpass'
    rumbleCut.frequency.value = 62
    rumbleCut.Q.value = 0.7

    helmholtz.connect(topPlate)
    topPlate.connect(boxDip)
    boxDip.connect(presence)
    presence.connect(airRolloff)
    airRolloff.connect(rumbleCut)
    this.bodyChainInput = helmholtz

    // ── 干湿分路
    const dry = ctx.createGain()
    dry.gain.value = 0.82
    const wet = ctx.createGain()
    wet.gain.value = 0.24
    this.dry = dry
    this.wet = wet

    const convolver = ctx.createConvolver()
    convolver.buffer = this.createRoomImpulse(ctx, 1.7, 2.6)

    rumbleCut.connect(dry)
    rumbleCut.connect(convolver)
    convolver.connect(wet)

    // ── 总输出：限一道软压缩，防止连续拨弦叠加削顶
    const glue = ctx.createDynamicsCompressor()
    glue.threshold.value = -14
    glue.knee.value = 22
    glue.ratio.value = 3
    glue.attack.value = 0.004
    glue.release.value = 0.22

    const master = ctx.createGain()
    master.gain.value = this._muted ? 0 : this._volume
    this.master = master

    dry.connect(glue)
    wet.connect(glue)
    glue.connect(master)
    master.connect(ctx.destination)
  }

  /* ─────────────────── 算法混响脉冲响应 ─────────────────── */

  /** 生成一段带早期反射的指数衰减噪声，当作小房间的 IR */
  private createRoomImpulse(ctx: AudioContext, seconds: number, curve: number): AudioBuffer {
    const rate = ctx.sampleRate
    const length = Math.floor(rate * seconds)
    const impulse = ctx.createBuffer(2, length, rate)

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const progress = i / length
        // 指数衰减的白噪声主体
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - progress, curve)
      }
      // 叠几颗早期反射，让空间感更具体而不是一团糊
      const reflections = [0.011, 0.019, 0.031, 0.047, 0.063]
      reflections.forEach((time, index) => {
        const pos = Math.floor(rate * time * (channel === 0 ? 1 : 1.07))
        if (pos < length) data[pos] += (0.6 - index * 0.1) * (channel === 0 ? 1 : -1)
      })
    }
    return impulse
  }

  /* ─────────────────── Karplus-Strong 弦模型 ─────────────────── */

  /**
   * 合成一根弦被拨响后的完整振动波形。
   *
   * 与教科书版本相比做了三处改进：
   *  1. 分数延迟线性插值 —— 保证高把位音准不跑偏
   *  2. T60 频率补偿 —— 低音延音长、高音收得快，符合真实吉他
   *  3. 拨弦位置梳状滤波 —— 在弦长 1/5 处拨动，抹掉第 5 泛音，音色更像琴而非合成器
   */
  private synthesize(midi: number): AudioBuffer {
    const ctx = this.ctx!
    const rate = ctx.sampleRate
    const freq = frequencyOf(midi)

    // 低音延音更长：82Hz 约 4s，660Hz 约 2s
    const t60 = Math.min(4.2, Math.max(1.9, 4.2 - Math.log2(freq / 82.4) * 0.62))
    const duration = t60 + 0.35
    const totalSamples = Math.ceil(rate * duration)

    const delayLength = rate / freq
    const N = Math.max(2, Math.floor(delayLength))
    const frac = delayLength - N

    // ── 激励：低通过的噪声，比纯白噪声更接近指腹 / 拨片
    const line = new Float32Array(N + 1)
    const softness = 0.28 // 越大越暗
    let lp = 0
    for (let i = 0; i < line.length; i++) {
      const white = Math.random() * 2 - 1
      lp = lp * softness + white * (1 - softness)
      line[i] = lp
    }

    // 拨弦位置梳状滤波：y[n] = x[n] - x[n - pos]
    const pickPos = Math.max(1, Math.round(N / 5))
    const excited = new Float32Array(line.length)
    for (let i = 0; i < line.length; i++) {
      excited[i] = line[i] - line[(i - pickPos + line.length) % line.length] * 0.7
    }

    // 去直流分量，避免整段波形偏置产生低频轰鸣
    let mean = 0
    for (let i = 0; i < excited.length; i++) mean += excited[i]
    mean /= excited.length
    let peak = 1e-6
    for (let i = 0; i < excited.length; i++) {
      excited[i] -= mean
      peak = Math.max(peak, Math.abs(excited[i]))
    }
    for (let i = 0; i < excited.length; i++) excited[i] /= peak

    // 每循环一圈的衰减系数，反推自目标 T60
    const loopsPerSecond = freq
    const decay = Math.pow(0.001, 1 / (loopsPerSecond * t60))
    // 阻尼：控制高频衰减速度，高音弦亮一些
    const damping = 0.5 + Math.min(0.12, Math.log2(freq / 82.4) * 0.035)

    const buffer = ctx.createBuffer(1, totalSamples, rate)
    const out = buffer.getChannelData(0)

    let idx = 0
    const attackSamples = Math.floor(rate * 0.002)
    const releaseSamples = Math.floor(rate * 0.12)

    for (let i = 0; i < totalSamples; i++) {
      const current = excited[idx]
      const next = excited[(idx + 1) % excited.length]
      // 分数延迟：线性插值读出，保证音高精确
      out[i] = current + frac * (next - current)

      // 反馈回路：一阶低通 + 衰减
      excited[idx] = (current * damping + next * (1 - damping)) * decay
      idx = (idx + 1) % excited.length

      // 首尾包络，杜绝爆音
      if (i < attackSamples) out[i] *= i / attackSamples
      const tail = totalSamples - i
      if (tail < releaseSamples) out[i] *= tail / releaseSamples
    }

    return buffer
  }

  private getBuffer(midi: number): AudioBuffer {
    const cached = this.bufferCache.get(midi)
    if (cached) {
      // LRU：命中后挪到队尾
      this.bufferCache.delete(midi)
      this.bufferCache.set(midi, cached)
      return cached
    }
    const buffer = this.synthesize(midi)
    if (this.bufferCache.size >= BUFFER_CACHE_LIMIT) {
      const oldest = this.bufferCache.keys().next().value
      if (oldest !== undefined) this.bufferCache.delete(oldest)
    }
    this.bufferCache.set(midi, buffer)
    return buffer
  }

  /* ───────────────────────── 演奏接口 ───────────────────────── */

  /** 拨响一个音 */
  pluck(midi: number, options: PluckOptions = {}): void {
    void this.unlock()
    if (!this.ctx || !this.bodyChainInput || this._muted) return

    const ctx = this.ctx
    const { velocity = 0.8, stringNumber, delay = 0 } = options
    const startAt = ctx.currentTime + delay

    // 同一根弦上的旧音要先掐断——真实吉他一根弦只能响一个音
    if (stringNumber !== undefined) {
      const previous = this.activeVoices.get(stringNumber)
      if (previous) {
        previous.gain.gain.cancelScheduledValues(startAt)
        previous.gain.gain.setTargetAtTime(0, startAt, 0.035)
        previous.source.stop(startAt + 0.25)
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = this.getBuffer(midi)

    const gain = ctx.createGain()
    // 力度映射成对数音量，听感更线性
    gain.gain.value = 0.34 * Math.pow(Math.min(1, Math.max(0.05, velocity)), 1.4)

    // 力度越大越亮：模拟用力拨弦时的高频泛音
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 1800 + velocity * 5200
    tone.Q.value = 0.6

    source.connect(tone)
    tone.connect(gain)
    gain.connect(this.bodyChainInput)

    source.start(startAt)

    if (stringNumber !== undefined) {
      const handle: VoiceHandle = { source, gain }
      this.activeVoices.set(stringNumber, handle)
      source.onended = () => {
        if (this.activeVoices.get(stringNumber) === handle) {
          this.activeVoices.delete(stringNumber)
        }
      }
    }
  }

  /**
   * 扫弦 —— 为后续的和弦练习模块预留。
   * @param notes 从 6 弦到 1 弦的 MIDI 数组，null 表示该弦闷音不发声
   * @param spread 相邻两根弦之间的时间差（秒），负值为上扫
   */
  strum(notes: (number | null)[], spread = 0.028): void {
    void this.unlock()
    const upward = spread < 0
    const step = Math.abs(spread)
    const order = upward ? [...notes].reverse() : notes

    order.forEach((midi, index) => {
      if (midi === null) return
      const stringNumber = upward ? index + 1 : 6 - index
      this.pluck(midi, {
        velocity: 0.62 + Math.random() * 0.16,
        stringNumber,
        delay: index * step,
      })
    })
  }

  /** 轻微的 UI 提示音，用于答错反馈 */
  thud(): void {
    void this.unlock()
    if (!this.ctx || !this.master || this._muted) return
    const ctx = this.ctx
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(148, now)
    osc.frequency.exponentialRampToValueAtTime(74, now + 0.16)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.22)
  }

  /** 立刻静默所有正在响的弦 */
  silence(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.activeVoices.forEach(({ source, gain }) => {
      gain.gain.cancelScheduledValues(now)
      gain.gain.setTargetAtTime(0, now, 0.02)
      try {
        source.stop(now + 0.15)
      } catch {
        /* 已经停止 */
      }
    })
    this.activeVoices.clear()
  }
}

/** 全局单例——整个应用共用一个 AudioContext */
export const audioEngine = new GuitarAudioEngine()
