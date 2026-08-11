/**
 * 拨弦音色引擎
 * ─────────────────────────────────────────────
 * 用 Karplus-Strong 物理建模实时合成吉他的拨弦音，全程零音频资源依赖——
 * 任何品位、任何调弦都能即时发声。
 *
 * 信号链：
 *   KS 弦模型 buffer → 弦级 gain（含 attack/release 包络）→ 音色档位链
 *     → 干路 ─┬─→ master → destination
 *            └─→ 卷积混响（算法房间脉冲响应）→ master
 *
 * 音色档位（tone profile）控制「琴体 EQ + 亮度 + 混响 + 过载饱和」，
 * 可在运行时切换：原声木吉他 / 电吉他清音 / 电吉他过载。
 * KS 弦模型内核保持不动——真实吉他也是同一根弦、不同的琴/箱/音箱在塑形。
 */

import { frequencyOf } from './music'

export type ToneProfileId = 'acoustic' | 'electric-clean' | 'electric-overdrive'

interface EqBand {
  type: BiquadFilterType
  freq: number
  Q: number
  gain: number
}

export interface ToneProfile {
  id: ToneProfileId
  label: string
  /** 琴体 / 音箱共鸣段，串联成塑造音色的核心链 */
  bands: EqBand[]
  /** 滚掉琴弦以下的轰鸣 */
  highpass: number
  /** 混响干湿比（传给 setReverbMix 的 0..1） */
  reverb: number
  /** 过载饱和量 0..1，0 = 完全干净 */
  drive: number
  /** 拨弦低通基准频率（力度 0 时） */
  toneBase: number
  /** 力度对亮度的增量 */
  toneScale: number
  /** 单音增益倍率，补偿不同档位的响度差异 */
  voiceGain: number
}

export const TONE_PROFILES: Record<ToneProfileId, ToneProfile> = {
  acoustic: {
    id: 'acoustic',
    label: '原声木吉他',
    bands: [
      { type: 'peaking', freq: 104, Q: 1.1, gain: 4.5 }, // 音孔亥姆霍兹共鸣
      { type: 'peaking', freq: 218, Q: 1.6, gain: 3 }, // 面板主共振
      { type: 'peaking', freq: 430, Q: 1.1, gain: -2.5 }, // 箱声凹陷，避免发闷
      { type: 'peaking', freq: 2600, Q: 0.9, gain: 2 }, // 指甲触弦的颗粒感
      { type: 'highshelf', freq: 6200, Q: 0.7, gain: -7 }, // 收掉过亮高频
    ],
    highpass: 62,
    reverb: 0.44,
    drive: 0,
    toneBase: 1800,
    toneScale: 5200,
    voiceGain: 1,
  },
  'electric-clean': {
    id: 'electric-clean',
    label: '电吉他清音',
    bands: [
      { type: 'peaking', freq: 150, Q: 1.0, gain: 1.5 }, // 一点点低身
      { type: 'peaking', freq: 1000, Q: 1.0, gain: 1 }, // 低中频实体
      { type: 'peaking', freq: 3000, Q: 0.9, gain: 3 }, // 拨片攻击的亮度
      { type: 'highshelf', freq: 7000, Q: 0.7, gain: 2 }, // 琴弦光泽
    ],
    highpass: 70,
    reverb: 0.14,
    drive: 0,
    toneBase: 3500,
    toneScale: 6000,
    voiceGain: 1,
  },
  'electric-overdrive': {
    id: 'electric-overdrive',
    label: '电吉他过载',
    bands: [
      { type: 'peaking', freq: 150, Q: 1.0, gain: 2 }, // 厚实的低频
      { type: 'peaking', freq: 900, Q: 1.0, gain: 2 }, // 中频突出，rock 的咬音
      { type: 'peaking', freq: 2800, Q: 0.9, gain: 2.5 },
      { type: 'highshelf', freq: 6500, Q: 0.7, gain: 1 },
    ],
    highpass: 70,
    reverb: 0.16,
    drive: 0.5,
    toneBase: 3000,
    toneScale: 5500,
    voiceGain: 1.15,
  },
}

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
  private convolver: ConvolverNode | null = null
  private bodyChainInput: AudioNode | null = null
  /** 当前音色档位下的琴体链节点，切换档位时整体断开重建 */
  private bodyNodes: AudioNode[] = []
  private profile: ToneProfile = TONE_PROFILES['electric-clean']

  /** midi → 合成好的弦振动波形，LRU 淘汰 */
  private bufferCache = new Map<number, AudioBuffer>()
  /** 每根弦当前正在响的声音，用于掐断 */
  private activeVoices = new Map<number, VoiceHandle>()

  private _muted = false
  private _volume = 0.75

  /* ─────────────────────── 生命周期 ─────────────────────── */

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
   * 切换音色档位。若音频上下文已建立，立即重建琴体链并调整混响；
   * 否则仅记录，待首次解锁时 build() 采用。
   */
  setProfile(id: ToneProfileId): void {
    this.profile = TONE_PROFILES[id]
    if (this.ctx) {
      this.buildBodyChain(this.profile)
      this.setReverbMix(this.profile.reverb)
    }
  }

  getProfile(): ToneProfileId {
    return this.profile.id
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

    // ── 输出总线（持久，切档位时不重建）
    const dry = ctx.createGain()
    dry.gain.value = 0.82
    const wet = ctx.createGain()
    wet.gain.value = 0.24
    this.dry = dry
    this.wet = wet

    const convolver = ctx.createConvolver()
    convolver.buffer = this.createRoomImpulse(ctx, 1.7, 2.6)
    this.convolver = convolver

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

    // ── 按当前档位搭建琴体链
    this.buildBodyChain(this.profile)
  }

  /**
   * 用给定档位重建「琴体 EQ → 过载饱和 → 高通」链，并接入干/湿两路。
   * 旧节点整体断开，避免泄漏或重复连接。
   */
  private buildBodyChain(profile: ToneProfile): void {
    if (!this.ctx || !this.dry || !this.convolver) return

    for (const node of this.bodyNodes) {
      try {
        node.disconnect()
      } catch {
        /* 已断开 */
      }
    }
    this.bodyNodes = []

    const filters = profile.bands.map((b) => {
      const f = this.ctx!.createBiquadFilter()
      f.type = b.type
      f.frequency.value = b.freq
      f.Q.value = b.Q
      f.gain.value = b.gain
      return f
    })

    const sat = this.ctx.createWaveShaper()
    sat.curve = this.makeDriveCurve(profile.drive)
    sat.oversample = '4x'

    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = profile.highpass
    hp.Q.value = 0.7

    for (let i = 0; i < filters.length; i++) {
      this.bodyNodes.push(filters[i])
      if (i > 0) filters[i - 1].connect(filters[i])
    }
    const last = filters[filters.length - 1]
    last.connect(sat)
    this.bodyNodes.push(sat)
    sat.connect(hp)
    this.bodyNodes.push(hp)

    this.bodyChainInput = filters[0]
    hp.connect(this.dry)
    hp.connect(this.convolver)
  }

  /** 生成过载饱和曲线：amount=0 为纯线性（透明），>0 为 tanh 软削波 */
  private makeDriveCurve(amount: number) {
    const n = 1024
    const curve = new Float32Array(n)
    const k = amount * 6
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      if (amount <= 0.001) {
        curve[i] = x
      } else {
        curve[i] = Math.tanh(x * (1 + k)) / Math.tanh(1 + k)
      }
    }
    return curve
  }

  /* ─────────────────── 算法混响脉冲响应 ─────────────────── */

  private createRoomImpulse(ctx: AudioContext, seconds: number, curve: number): AudioBuffer {
    const rate = ctx.sampleRate
    const length = Math.floor(rate * seconds)
    const impulse = ctx.createBuffer(2, length, rate)

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const progress = i / length
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - progress, curve)
      }
      const reflections = [0.011, 0.019, 0.031, 0.047, 0.063]
      reflections.forEach((time, index) => {
        const pos = Math.floor(rate * time * (channel === 0 ? 1 : 1.07))
        if (pos < length) data[pos] += (0.6 - index * 0.1) * (channel === 0 ? 1 : -1)
      })
    }
    return impulse
  }

  /* ─────────────────── Karplus-Strong 弦模型 ─────────────────── */

  private synthesize(midi: number): AudioBuffer {
    const ctx = this.ctx!
    const rate = ctx.sampleRate
    const freq = frequencyOf(midi)

    const t60 = Math.min(4.2, Math.max(1.9, 4.2 - Math.log2(freq / 82.4) * 0.62))
    const duration = t60 + 0.35
    const totalSamples = Math.ceil(rate * duration)

    const delayLength = rate / freq
    const N = Math.max(2, Math.floor(delayLength))
    const frac = delayLength - N

    const line = new Float32Array(N + 1)
    const softness = 0.28
    let lp = 0
    for (let i = 0; i < line.length; i++) {
      const white = Math.random() * 2 - 1
      lp = lp * softness + white * (1 - softness)
      line[i] = lp
    }

    const pickPos = Math.max(1, Math.round(N / 5))
    const excited = new Float32Array(line.length)
    for (let i = 0; i < line.length; i++) {
      excited[i] = line[i] - line[(i - pickPos + line.length) % line.length] * 0.7
    }

    let mean = 0
    for (let i = 0; i < excited.length; i++) mean += excited[i]
    mean /= excited.length
    let peak = 1e-6
    for (let i = 0; i < excited.length; i++) {
      excited[i] -= mean
      peak = Math.max(peak, Math.abs(excited[i]))
    }
    for (let i = 0; i < excited.length; i++) excited[i] /= peak

    const loopsPerSecond = freq
    const decay = Math.pow(0.001, 1 / (loopsPerSecond * t60))
    const damping = 0.5 + Math.min(0.12, Math.log2(freq / 82.4) * 0.035)

    const buffer = ctx.createBuffer(1, totalSamples, rate)
    const out = buffer.getChannelData(0)

    let idx = 0
    const attackSamples = Math.floor(rate * 0.002)
    const releaseSamples = Math.floor(rate * 0.12)

    for (let i = 0; i < totalSamples; i++) {
      const current = excited[idx]
      const next = excited[(idx + 1) % excited.length]
      out[i] = current + frac * (next - current)
      excited[idx] = (current * damping + next * (1 - damping)) * decay
      idx = (idx + 1) % excited.length

      if (i < attackSamples) out[i] *= i / attackSamples
      const tail = totalSamples - i
      if (tail < releaseSamples) out[i] *= tail / releaseSamples
    }

    return buffer
  }

  private getBuffer(midi: number): AudioBuffer {
    const cached = this.bufferCache.get(midi)
    if (cached) {
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

  pluck(midi: number, options: PluckOptions = {}): void {
    void this.unlock()
    if (!this.ctx || !this.bodyChainInput || this._muted) return

    const ctx = this.ctx
    const { velocity = 0.8, stringNumber, delay = 0 } = options
    const startAt = ctx.currentTime + delay
    const { toneBase, toneScale, voiceGain } = this.profile

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
    gain.gain.value = 0.34 * Math.pow(Math.min(1, Math.max(0.05, velocity)), 1.4) * voiceGain

    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = toneBase + velocity * toneScale
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
   * 扫弦 —— 用于和弦试听。
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

  /** 当前音频时钟（秒），用于节奏训练器的精确调度 */
  get currentTime(): number {
    return this.ctx?.currentTime ?? 0
  }

  /**
   * 精确节拍 click —— 节奏训练器的节拍器用。
   * 直接在 AudioContext 时间轴上排程，避免 setTimeout 抖动。
   * @param at   期望发声的音频时钟时间（默认立即）
   * @param accent 是否重拍（重拍更高更响）
   * @param freq 自定义频率，用于区分音色（如 funk 的闷音 chuck 用低频）
   */
  click(at?: number, accent = false, freq?: number): void {
    void this.unlock()
    if (!this.ctx || !this.master || this._muted) return
    const ctx = this.ctx
    const t = at ?? ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq ?? (accent ? 2000 : 1300), t)
    const gain = ctx.createGain()
    const peak = (accent ? 0.16 : 0.09) * Math.min(1, this._volume / 0.75 + 0.2)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.06)
  }
}

/** 全局单例——整个应用共用一个 AudioContext */
export const audioEngine = new GuitarAudioEngine()
