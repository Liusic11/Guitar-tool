import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Fretboard, type Highlight } from './Fretboard'
import { RhythmBar } from './RhythmBar'
import { ScaleConnection } from './ScaleConnection'
import { ConceptCheatSheet } from './ConceptCheatSheet'
import { SCALES, scalePositions, scaleBoxes, scalePattern, PATTERNS, type ScaleDef, type ScaleNote, type PatternId } from '../lib/scales'
import { audioEngine } from '../lib/audio'
import { letterOf, type Tuning, type PitchClass } from '../lib/music'
import { sessionStore } from '../lib/session'

/** 半音 → 音阶级数名 */
const DEGREE_NAMES: Record<number, string> = {
  0: 'R',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♭5',
  7: '5',
  8: '♭6',
  9: '6',
  10: '♭7',
  11: '7',
}
const degreeName = (iv: number): string => DEGREE_NAMES[iv] ?? String(iv)

const ROOT_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** 弦号 6→1，用于把位形状卡 */
const STRING_ORDER = [6, 5, 4, 3, 2, 1]

type Mode = 'map' | 'follow' | 'pattern'

interface ScaleTrainerProps {
  tuning: Tuning
}

export function ScaleTrainer({ tuning }: ScaleTrainerProps) {
  // 贯通层：根音与音阶都从共享 store 初始化，跨模块跳转后能接上
  const [rootPc, setRootPc] = useState<PitchClass>(() => (sessionStore.get().rootPc as PitchClass) ?? 9)
  const [scaleId, setScaleId] = useState<string>(() => sessionStore.get().scaleId ?? 'minorPent')
  const [mode, setMode] = useState<Mode>('map')
  const [patternId, setPatternId] = useState<PatternId>('seq3')

  // 根音变化即同步到共享 store，让和弦页 / 音阶页感知到同一把钥匙
  useEffect(() => {
    sessionStore.setRoot(rootPc)
  }, [rootPc])

  const def = useMemo<ScaleDef>(
    () => SCALES.find((s) => s.id === scaleId) ?? SCALES[0],
    [scaleId],
  )

  const boxes = useMemo(
    () => scaleBoxes(tuning, rootPc, def.formula, 15, def.id),
    [tuning, rootPc, def],
  )

  const [boxIndex, setBoxIndex] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const isPenta = def.category === 'pentatonic' || def.category === 'blues'

  // 根音/音阶改变时，回到主形状（根音把位）；没有则回到最低把位
  useEffect(() => {
    const rootIdx = boxes.findIndex((b) => b.isRoot)
    setBoxIndex(rootIdx >= 0 ? rootIdx : 0)
    setShowAll(false)
  }, [tuning, rootPc, def, boxes])

  const currentRange: readonly [number, number] = useMemo(() => {
    if (showAll || boxes.length === 0) return [0, 15]
    const b = boxes[boxIndex]
    return [b.lo, b.hi]
  }, [showAll, boxes, boxIndex])

  const positions = useMemo(
    () => scalePositions(tuning, rootPc, def.formula, currentRange),
    [tuning, rootPc, def, currentRange],
  )

  // 「跟拍」模式：把当前把位内的音按音高升序排成一条连奏路线
  const run = useMemo<ScaleNote[]>(() => {
    const sorted = [...positions].sort((a, b) => a.midi - b.midi)
    const firstRoot = sorted.find((p) => p.degree === 0)
    const startIdx = firstRoot ? sorted.indexOf(firstRoot) : 0
    const len = def.formula.length * 2 + 1
    return sorted.slice(startIdx, startIdx + len)
  }, [positions, def])

  // 「模进」模式：把当前把位里的音阶音排成一条造句路线（3 音一组 / 八度跳 / 琶音 / blues）
  const patternRun = useMemo<ScaleNote[]>(
    () => scalePattern(positions, def.formula, patternId),
    [positions, def, patternId],
  )

  const [seqIdx, setSeqIdx] = useState(0)

  // 跟拍 / 模进（bar 联动）：把「当前序号 / 路线」放进 ref，避免 onBeat 闭包拿到旧值
  const activeRouteRef = useRef<ScaleNote[]>([])
  activeRouteRef.current = mode === 'follow' ? run : mode === 'pattern' ? patternRun : []
  const seqIdxRef = useRef(seqIdx)
  seqIdxRef.current = seqIdx

  // 演示：边播边高亮每个音
  const [demoActive, setDemoActive] = useState(false)
  const [demoIdx, setDemoIdx] = useState(-1)
  const demoActiveRef = useRef(false)
  demoActiveRef.current = demoActive
  const demoTimer = useRef<number | null>(null)
  const demoRoute = useMemo<ScaleNote[]>(() => {
    if (!demoActive) return []
    if (mode === 'pattern') return patternRun
    const sorted = [...positions].sort((a, b) => a.midi - b.midi)
    return [...sorted, ...sorted.slice().reverse()]
  }, [demoActive, mode, positions, patternRun])

  // 切换音阶 / 根音 / 模式 / 把位时复位练习状态
  useEffect(() => {
    setSeqIdx(0)
    setDemoActive(false)
    setDemoIdx(-1)
    if (demoTimer.current) window.clearTimeout(demoTimer.current)
  }, [rootPc, scaleId, mode, patternId, currentRange.join(',')])

  const playNote = useCallback((n: ScaleNote) => {
    audioEngine.pluck(n.midi, { stringNumber: n.string, velocity: 0.9 })
  }, [])

  // 底部节拍器每到一个四分音符拍 → 高亮并 pluck 当前音，再推进（循环）
  const advanceFollow = useCallback(() => {
    if (demoActiveRef.current) return
    const route = activeRouteRef.current
    const i = seqIdxRef.current
    const n = route[i]
    if (n) playNote(n)
    if (route.length) setSeqIdx((prev) => (prev + 1 >= route.length ? 0 : prev + 1))
  }, [playNote])

  const playDemo = useCallback(() => {
    if (demoTimer.current) window.clearTimeout(demoTimer.current)
    const sorted = [...positions].sort((a, b) => a.midi - b.midi)
    const route = mode === 'pattern' ? patternRun : [...sorted, ...sorted.slice().reverse()]
    if (route.length === 0) return
    void audioEngine.unlock()
    setDemoActive(true)
    setDemoIdx(0)
    let i = 0
    const step = () => {
      if (i >= route.length) {
        setDemoActive(false)
        setDemoIdx(-1)
        return
      }
      playNote(route[i])
      setDemoIdx(i)
      i++
      demoTimer.current = window.setTimeout(step, 320)
    }
    step()
  }, [positions, patternRun, mode, playNote])

  useEffect(() => {
    return () => {
      if (demoTimer.current) window.clearTimeout(demoTimer.current)
    }
  }, [])

  const highlights = useMemo<Highlight[]>(() => {
    // 演示：边播边高亮（最高优先级，覆盖练习高亮）
    if (demoActive) {
      return demoRoute.map((p, i) => ({
        string: p.string,
        fret: p.fret,
        kind: i < demoIdx ? 'done' : i === demoIdx ? 'answer' : 'ghost',
        label: degreeName(def.formula[p.degree]),
      }))
    }
    if (mode === 'map') {
      return positions.map((p) => ({
        string: p.string,
        fret: p.fret,
        kind: p.degree === 0 ? 'answer' : 'secondary',
        label: degreeName(def.formula[p.degree]),
      }))
    }
    if (mode === 'follow' || mode === 'pattern') {
      const route = mode === 'follow' ? run : patternRun
      return route.map((p, i) => ({
        string: p.string,
        fret: p.fret,
        kind: i < seqIdx ? 'done' : i === seqIdx ? 'answer' : 'ghost',
        label: degreeName(def.formula[p.degree]),
      }))
    }
    return positions.map((p) => ({
      string: p.string,
      fret: p.fret,
      kind: 'ghost' as const,
      label: degreeName(def.formula[p.degree]),
    }))
  }, [mode, positions, run, patternRun, seqIdx, demoActive, demoIdx, demoRoute, def])

  const handleFretClick = useCallback(
    (stringNumber: number, fret: number) => {
      void audioEngine.unlock()
      const clicked = positions.find((p) => p.string === stringNumber && p.fret === fret)

      if (mode === 'map') {
        if (clicked) playNote(clicked)
        return
      }

      // follow / pattern（跟拍、模进）：由底部节拍器自动推进，手动点只做试听
      if (mode === 'follow' || mode === 'pattern') {
        if (clicked) playNote(clicked)
        return
      }

      if (clicked) playNote(clicked)
    },
    [mode, positions, run, seqIdx, playNote],
  )

  const noteNames = def.formula.map((iv) => letterOf(((rootPc + iv) % 12 + 12) % 12))
  const scaleComplete = mode === 'follow' && seqIdx >= run.length
  const patternComplete = mode === 'pattern' && seqIdx >= patternRun.length
  const chordRootName = ROOT_LABELS[rootPc]

  // ── 老师口吻的左侧乐理提示（随音阶 / 把位变化）──
  const teacherTip = useMemo(() => {
    const root = chordRootName
    const shape = boxes[boxIndex]?.shapeName
    const isRootBox = boxes[boxIndex]?.isRoot ?? false

    const boxAdvice: Record<string, string> = {
      E: `这个 E 形把位是最经典的「主形状」，根音落在 6 弦和 1 弦的同品。先找到这两颗橙色根音，它们是你在这个把位里的「家」。`,
      D: `D 形把位的最低音是 5 级，所以听起来比 E 形更「飘」一点。注意根音在 4 弦和 2 弦上。`,
      C: `C 形跨度最大，手要稍微张开。它连接了低把位和高把位，练熟它你就能从 9 品顺滑地爬到 12 品。`,
      A: `A 形在 12 品附近，是 E 形的高八度。根音又回到 6 弦和 1 弦，和 Box 1 手指形状几乎一样。`,
      G: `G 形位置最低，经常会用到空弦。它是把 5 个形状「接回」琴枕的那一块，别忽略它。`,
    }

    const tips: Record<
      string,
      { why: string; ear: string; songs: string; box: string }
    > = {
      minorPent: {
        why: `${root} 小调五声是吉他手的第一把钥匙，也是 blues / rock solo 的「母语」。它只有 5 个音，却把最容易冲突的 4 级、7 级拿掉了，所以怎么弹都不太难听。`,
        ear: `闭上眼睛弹，你会发现它有一种「安全的暗色」——这是因为它没有半音张力，特别适合即兴时瞎摸也不会太歪。`,
        songs: `从《Back in Black》到《Stairway to Heaven》的 solo，再到无数 blues，都是它。你听到的「摇滚味道」多半来自这里。`,
        box: boxAdvice[shape ?? ''] ?? `先找到这个把位里的橙色根音，记住它们在哪几根弦上。根音是你的「落脚点」，其他音都是围着它转的。`,
      },
      blues: {
        why: `${root} 布鲁斯音阶 = 小调五声 + 一颗「蓝调音」（♭5）。这颗音故意不在调内，所以一出现就有种「悬而未决」的哭腔。`,
        ear: `蓝调音不要一直按着，像撒胡椒面一样轻轻带过，或者滑到 5 级解决掉。听感上它像是一个「问题」，5 级是「答案」。`,
        songs: `B.B. King《The Thrill Is Gone》、Jimi Hendrix《Red House》——这些眼泪和烟味，一半来自蓝调音。`,
        box: boxAdvice[shape ?? ''] ?? `在小调五声把位里找到那颗额外的 ♭5（比 5 级低半音），用手指轻轻点一下再滑开，体会那个「蓝」味。`,
      },
      majorPent: {
        why: `${root} 大调五声是小调五声的「阳光版」。有趣的是：它和关系小调五声共享同一套把位，只是根音换了一颗音。`,
        ear: `明亮、顺耳、没有尖锐冲突。你听到的「乡村/流行」solo 色彩，很多时候就是大调五声。`,
        songs: `Pink Floyd《Wish You Were Here》、大量乡村 solo。把小调五声的根音当成 ♭3，大调根音就在它上方小三度。`,
        box: boxAdvice[shape ?? ''] ?? `在这个把位里，找到大调根音（不是橙色那颗，而是比它高小三度的音），试着把这两颗音当成新的「家」。`,
      },
      major: {
        why: `${root} 自然大调是西方音乐的地基，所有调式都是从它「重新起算」得来的。先把大调在指板上走顺，后面调式只是换起点。`,
        ear: `记住那条幼儿园的旋律：Do Re Mi Fa Sol La Ti Do。大调的秘密就在 3-4 和 7-1 这两处半音，其他地方都是全音。`,
        songs: `从儿歌到古典到流行，无处不在。它是你理解「为什么这个和弦进行听起来这样」的入口。`,
        box: `这个 5 品窗口里，先找到 3-4 和 7-1 这两组半音。半音是音阶的「台阶转折点」，找到了，整条音阶就不会迷路。`,
      },
      minor: {
        why: `${root} 自然小调是大调的「暗面」。它和关系大调共享 7 个音，只是从不同的音开始数，所以色彩立刻沉了下来。`,
        ear: `比大调更内向、叙事感更强。把它想成「大调降了 3、6、7 级」，这三个降号就是小调悲伤的来源。`,
        songs: `很多金属 ballad、抒情摇滚，比如《Europa》的 solo 味道。它适合在 minor 和弦上走旋律。`,
        box: `在这个位置里，重点听 ♭3 和 ♭6 的音高。它们和大调版的 3、6 只差半音，但情绪差很多。`,
      },
      dorian: {
        why: `${root} 多利亚 = 自然小调把 6 级抬高半音。于是它既有小三度的暗，又有一个亮晶晶的 6 级——这是 funk / jazz minor 的灵魂。`,
        ear: `弹到 6 级的时候，会有一种「暗里透亮」的感觉。想让小调 solo 不那么悲，就多利亚。`,
        songs: `Santana《Oye Como Va》、Miles Davis《So What》。这些曲子的「异域感」很多来自多利亚。`,
        box: `在这个把位里，找到 6 级（它比自然小调的 ♭6 高半音）。来回弹 ♭3 → 4 → 5 → 6，体会那个「亮」点。`,
      },
      mixolydian: {
        why: `${root} 混合利底亚 = 自然大调把 7 级降半音。它和大调几乎一样，只差这一个 ♭7，但这正是属七和弦张力的来源。`,
        ear: `大调的明亮底色，加上 ♭7 的一点「悬」。在属七和弦上 solo 时，它是最自然的选择。`,
        songs: `Guns N' Roses《Sweet Child O' Mine》的 riff、Grateful Dead 很多 solo。听起来「亮但有点野」。`,
        box: `重点听 ♭7 这颗音。试着 1 → 2 → 3 → 4 → 5 → 6 → ♭7 → 1，感受它怎么「回家」。`,
      },
      phrygian: {
        why: `${root} 弗利几亚 = 自然小调把 2 级也压低成 ♭2。那个 ♭2 和主音只差半音，制造一股「异域、凶狠、悬疑」的暗色——弗拉门戈扫弦和金属 riff 的魂就是它。`,
        ear: `弹到 ♭2 时，注意它几乎「贴」着主音，那股压迫感就是弗利几亚的标志。对比一下自然小调的 2 级，差别一眼（耳）就懂。`,
        songs: `弗拉门戈几乎都用 E 弗利几亚（把 E 小调的根音挪到 E 的 ♭2 所在）；金属 riff 也爱它。听西班牙 / 暗潮金属就知道那味。`,
        box: `这个 5 品窗口里，先找到那个 ♭2（紧贴主音上方半音的音），来回弹 ♭2 → 根音，体会「一步跨上去又跌回来」的暗狠。`,
      },
      lydian: {
        why: `${root} 利底亚 = 自然大调把 4 级抬成 #4。那个 #4 悬在半空，制造「飘、梦幻、外星」的亮色——fusion / 前卫金属 / 配乐最爱。`,
        ear: `重点听 #4：它比普通大调的 4 级高半音，听感「亮得发飘」。和 Lydian 大七和弦（maj7）配在一起最对味。`,
        songs: `Dream Theater 类前卫金属、fusion、电影配乐的「希望感大调」多用它。`,
        box: `在这个窗口里，找到 #4（比 4 级高半音），弹 3 → #4 → 5，感受那个「悬浮不落地」的张力。`,
      },
      locrian: {
        why: `${root} 洛克里亚 = 自然小调把 2、5 级都压低（♭2·♭5）。它是七个调式里唯一主和弦是减和弦的，没有纯五度「锚」，所以一直在「要往哪去」、绝不落地。`,
        ear: `洛克里亚几乎没有「稳定感」——弹下去你会想赶紧离开它。这正是它作为 m7♭5 本命音阶的价值：永远在悬疑里。`,
        songs: `几乎不拿它写歌，但它是 jazz 标准曲 ii–V–I 里 ii 级（m7♭5）的本命音阶。`,
        box: `这个窗口里，先听主和弦（减的）有多「悬」，再找到 ♭2 和 ♭5——整条音阶都在制造紧张，别想把它当「家」。`,
      },
      harmonicMinor: {
        why: `${root} 和声小调 = 自然小调把 7 级抬高成 #7。那个 #7 与主音只差半音，制造一股「拼命想解决回主音」的张力——古典 / neoclassical 小调 solo 的暗色魂。`,
        ear: `重点听 #7：它紧贴主音上方半音，一股「急着回家」的拉力。对比自然小调的 ♭7，你就懂为什么它更「古典 / 中世纪」。`,
        songs: `Yngwie 类 neoclassical、古典、金属 riff 常用。听那种「暗潮又凶」的小调独奏。`,
        box: `这个窗口里，找到 #7（紧贴主音上方半音），弹 ♭6 → 7(主音) → #7，感受 #7 想冲回主音的推力。`,
      },
      melodicMinor: {
        why: `${root} 旋律小调 = 自然小调把 6、7 级都抬高。暗底里带一点爵士的亮，是 m7♭5 / m(maj7) 的母音阶——ii–V–I 的 ii 级上 solo 比自然小调顺太多。`,
        ear: `它的 6、7 都亮，所以不像自然小调那么悲，反而有点「现代、爵士」的暗带亮。和 locrian / 和声小调对比着听最清楚。`,
        songs: `jazz（jazz minor）、fusion、金属。听那种「小调但通透」的独奏。`,
        box: `这个窗口里，找到抬亮的 6、7 级，弹 ♭3 → 4 → 5 → 6 → 7，体会「暗里透亮」的流动感。`,
      },
      diminished: {
        why: `${root} 减音阶 = 半音、全音交替（whole-half），8 个音，全对称。它和小调减七和弦(dim7)完美咬合——一个把位 = 4 个不同根的减七，是离调 / 悬疑的踏板。`,
        ear: `整条音阶听起来「诡异、紧张、悬」，没有稳定点。别想把它当调，它是一块「去往别处的踏板」。`,
        songs: `古典 / 爵士的过渡桥、恐怖悬疑配乐。`,
        box: `这个窗口里，把相邻音级当成「踏板」来滑——它天生就是用来制造离调张力的，不是拿来 solo 的「家」。`,
      },
      wholeTone: {
        why: `${root} 全音阶 = 只由大二度堆叠，没有小二度、没有解决感，听起来「悬在半空、上不去下不来」。它和增和弦(aug)是绝配。`,
        ear: `整条音阶「飘」——没有一个音想落地。对比一下大调音阶的 3→4、7→1 半音台阶，你就懂全音阶为什么「无重力」。`,
        songs: `印象派（德彪西）、fusion、悬疑配乐的漂浮感。`,
        box: `这个窗口里，顺着大二度一格一格往上爬，体会「台阶一样高、永远不落地」的悬浮。`,
      },
      bebopDominant: {
        why: `${root} Bebop 属 = 混合利底亚 + 自然 7，8 个音。多出来的 7 音是「经过音」，让旋律在 swing 的 8 分里把和弦音钉在强拍——属七上的爵士标配。`,
        ear: `它比 Mixolydian 多一个自然 7，听感「更满、更流动」。在属七上 solo 时，这个 7 音是连到你下一个乐句的关键。`,
        songs: `Charlie Parker 类 bebop、swing 标准曲的属七 solo。`,
        box: `这个窗口里，找到那个额外的自然 7（在 ♭7 上方半音），试着把它放在弱拍、把和弦音放在强拍，体会 bebop 的「落点」。`,
      },
      bebopMajor: {
        why: `${root} Bebop 大调 = 大调 + 一个 ♭6 经过音，8 个音。和 bebop 属同理，多出来的音让旋律在 swing 里把和弦音落在强拍——大调 / maj7 上的爵士标配。`,
        ear: `它比大调音阶多一个 ♭6，听感「更顺滑地流动」。在 maj7 上 solo 时找找那个 ♭6 的位置。`,
        songs: `swing / bebop 里的大调 solo。`,
        box: `这个窗口里，找到 ♭6（在 5 和 6 之间），把它当「经过音」滑过，和弦音落在强拍——这就是 bebop 大调的流动感。`,
      },
    }

    const t = tips[def.id] ?? {
      why: `${root} ${def.label} 是一个有用的音阶。`,
      ear: def.color,
      songs: def.usage,
      box: `先找到根音位置，再顺着把位上下走。`,
    }

    const rawTags = [def.color.split(' / ')[0] ?? def.color, def.usage.split(/[、，,]/)[0] ?? def.usage]
    const tags = Array.from(new Set(rawTags.filter(Boolean)))

    return {
      ...t,
      headline: isRootBox ? `这个把位是「主形状」，建议从这里开始啃。` : `这个把位和相邻形状咬合，练熟它指板就连起来了。`,
      tags,
    }
  }, [def, chordRootName, boxes, boxIndex])

  // 把位形状卡：每根弦在当前把位里有哪些音，按品排列
  const shapeRows = useMemo(() => {
    const rows = STRING_ORDER.map((sn) => {
      const notes = positions.filter((n) => n.string === sn).sort((a, b) => a.fret - b.fret)
      return { string: sn, notes }
    })
    return rows
  }, [positions])

  // 跟拍 / 模进 / 演示：把「已弹奏 / 当前 / 未弹」的键集合算出来，给形状卡上色
  const inFollowMode = mode === 'follow' || mode === 'pattern' || demoActive
  const cardRoute = inFollowMode ? (demoActive ? demoRoute : mode === 'pattern' ? patternRun : run) : []
  const cardCursor = demoActive ? demoIdx : seqIdx
  const playedKeys = useMemo(() => {
    const set = new Set<string>()
    cardRoute.slice(0, cardCursor).forEach((n) => set.add(`${n.string}-${n.fret}`))
    return set
  }, [cardRoute, cardCursor])
  const currentKey = useMemo(() => {
    const n = cardRoute[cardCursor]
    return n ? `${n.string}-${n.fret}` : null
  }, [cardRoute, cardCursor])

  const boxLabel = useMemo(() => {
    if (showAll || boxes.length === 0) return '全指板'
    const b = boxes[boxIndex]
    const pos = boxIndex + 1
    const shape = b.shapeName ? ` · ${b.shapeName}形` : ''
    const root = b.isRoot ? ' · ★主形状' : ''
    return `位置 ${pos} / ${boxes.length}${shape}${root}（${b.lo}–${b.hi} 品）`
  }, [showAll, boxes, boxIndex])

  return (
    <main className="module-stage scale-stage">
      <div className="module-scroll">
        <div className="chord-panel scale-panel">
          {/* 控制区 */}
        <div className="scale-controls">
          <div className="field">
            <label className="field__label">根音</label>
            <div className="segmented" role="group" aria-label="根音">
              {ROOT_LABELS.map((n, i) => (
                <button
                  key={n}
                  className="segmented__item"
                  aria-pressed={rootPc === i}
                  onClick={() => setRootPc(i)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="field field--scale">
            <label className="field__label">音阶</label>
            <div className="segmented segmented--scale" role="group" aria-label="音阶类型">
              {SCALES.map((s) => (
                <button
                  key={s.id}
                  className="segmented__item"
                  aria-pressed={scaleId === s.id}
                  onClick={() => setScaleId(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field field--practice">
            <label className="field__label">练习方式</label>
            <div className="segmented" role="group" aria-label="练习方式">
              <button
                className="segmented__item"
                aria-pressed={mode === 'map'}
                onClick={() => setMode('map')}
              >
                地图
              </button>
              <button
                className="segmented__item"
                aria-pressed={mode === 'follow'}
                onClick={() => setMode('follow')}
              >
                跟拍
              </button>
              <button
                className="segmented__item"
                aria-pressed={mode === 'pattern'}
                onClick={() => setMode('pattern')}
              >
                模进
              </button>
            </div>
          </div>
        </div>

        {/* 把位导航 */}
        <div className="scale-box-bar">
          <button
            className="btn btn--sm btn--ghost"
            disabled={showAll || boxIndex <= 0}
            onClick={() => setBoxIndex((i) => Math.max(0, i - 1))}
          >
            ← 上一个位置
          </button>
          <span className="scale-box-bar__label">{boxLabel}</span>
          <button
            className="btn btn--sm btn--ghost"
            disabled={showAll || boxIndex >= boxes.length - 1}
            onClick={() => setBoxIndex((i) => Math.min(boxes.length - 1, i + 1))}
          >
            下一个位置 →
          </button>
          {boxes.some((b) => b.isRoot) && (
            <button
              className="btn btn--sm btn--ghost"
              disabled={!showAll && boxes[boxIndex]?.isRoot}
              onClick={() => {
                const i = boxes.findIndex((b) => b.isRoot)
                if (i >= 0) setBoxIndex(i)
              }}
              title="跳到根音把位（主形状）"
            >
              ★ 主形状
            </button>
          )}
          <button
            className={`btn btn--sm${showAll ? ' btn--primary' : ' btn--ghost'}`}
            onClick={() => setShowAll((v) => !v)}
            style={{ marginLeft: 'auto' }}
          >
            {showAll ? '看当前位置' : '看全指板'}
          </button>
        </div>

        {/* 模进子选择器（仅在「模进」模式下出现） */}
        {mode === 'pattern' && (
          <div className="scale-pattern-bar">
            <div className="segmented segmented--scale" role="group" aria-label="模进类型">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  className="segmented__item"
                  aria-pressed={patternId === p.id}
                  onClick={() => setPatternId(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="scale-progress">
              进度 {Math.min(seqIdx, patternRun.length)} / {patternRun.length}
              {patternComplete && <span className="scale-progress__done"> ✓ 完成一轮！</span>}
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => setSeqIdx(0)}
                style={{ marginLeft: '0.6rem' }}
              >
                重来
              </button>
            </div>
            <p className="scale-pattern-tip">
              {PATTERNS.find((p) => p.id === patternId)?.tip}
            </p>
          </div>
        )}

        {/* 主视图 */}
        <div className="scale-layout">
          <section className="chord-figure scale-figure" aria-label="音阶指板">
            <div className="chord-head">
              <span className="chord-head__name">
                {chordRootName} {def.label}
              </span>
              <span className="chord-head__type">{boxLabel}</span>
              <span className="chord-head__formula">{def.formula.join('·')}</span>
            </div>

            {mode === 'follow' ? (
              <div className="scale-progress">
                进度 {Math.min(seqIdx, run.length)} / {run.length}
                {scaleComplete && (
                  <span className="scale-progress__done"> ✓ 完成一轮！</span>
                )}
                <span className="scale-progress__follow">♪ 播放底部节拍器，每拍自动亮一个音</span>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => setSeqIdx(0)}
                  style={{ marginLeft: '0.6rem' }}
                >
                  重来
                </button>
              </div>
            ) : null}

            <Fretboard
              tuning={tuning}
              maxFret={15}
              highlights={highlights}
              targetString={null}
              scopeRange={currentRange}
              interactive
              showAllNotes={false}
              labelMode="letter"
              ringingString={null}
              onFretClick={handleFretClick}
            />

            {/* 组成音：移到指板下方 */}
            <div className="scale-composition">
              <span>组成音：</span>
              <span className="scale-composition__notes">{noteNames.join(' · ')}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--ink-3)' }}>
                {def.category === 'blues' ? '5 音 + 蓝调音' : `${def.formula.length} 音`}
              </span>
            </div>

            {/* 把位形状卡：更直观的「每根弦按哪几品」 */}
            <div className="scale-shape" aria-label="把位形状卡">
              <p className="scale-shape__title">
                把位形状{boxes[boxIndex]?.shapeName ? `（${boxes[boxIndex].shapeName}形）` : ''} · 每根弦上的音
              </p>
              <div className="scale-shape__grid">
                {shapeRows.map(({ string, notes }) => (
                  <div key={string} className="scale-shape__row">
                    <span className="scale-shape__string">{string}弦</span>
                    <div className="scale-shape__frets">
                      {notes.length === 0 ? (
                        <span className="scale-shape__empty">—</span>
                      ) : (
                        notes.map((n) => {
                          const k = `${n.string}-${n.fret}`
                          const noteCls = [
                            'scale-shape__note',
                            n.degree === 0 ? 'is-root' : '',
                            inFollowMode && k === currentKey ? 'is-current' : '',
                            inFollowMode && k !== currentKey && playedKeys.has(k) ? 'is-played' : '',
                            inFollowMode && k !== currentKey && !playedKeys.has(k) ? 'is-upcoming' : '',
                          ].join(' ').trim()
                          return (
                            <span key={k} className={noteCls}>
                              {n.fret}品
                              <small className="scale-shape__degree">
                                {degreeName(def.formula[n.degree])}
                              </small>
                            </span>
                          )
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </section>

          <section className="chord-theory scale-theory" aria-label="音阶乐理">
            <h3 className="chord-theory__title">为什么叫「{def.label}」</h3>
            <p className="chord-theory__lead">{def.theory}</p>

            <dl className="chord-theory__grid">
              <div>
                <dt>听感 / 色彩</dt>
                <dd>{def.color}</dd>
              </div>
              <div>
                <dt>常见用法</dt>
                <dd>{def.usage}</dd>
              </div>
            </dl>

            <div className="chord-theory__block">
              <h4 className="chord-theory__h">怎么练这个位置</h4>
              <p className="chord-theory__p">
                五声被拆成 {isPenta ? '5 个 CAGED 形状（E‑D‑C‑A‑G，彼此咬合覆盖全琴颈）' : '7 个位置'}，
                你正在看的是其中一个。1）先看形状卡，记住每根弦上
                <strong>根音（R，橙色）</strong>的位置；2）用「跟拍」模式跟着底部节拍器从低音到高音走一遍；
                3）闭上眼睛，凭肌肉记忆按出来。用顶部「上一个位置 / 下一个位置」顺着琴颈往上爬，
                把 {isPenta ? '5 个形状' : '7 个位置'} 都啃熟，整条指板就通了。
              </p>
            </div>

            <div className="chord-theory__block">
              <h4 className="chord-theory__h">跟节拍器</h4>
              <p className="chord-theory__p">
                打开底部节奏条，用 8 分音符稳练。先慢（60 BPM），每个音都卡在拍上；
                再提到 90 BPM。节奏稳了，音阶才真正属于你。
              </p>
            </div>

            {/* 老师提示：用 skill 老师口吻写的实战乐理，放在右侧填补空白 */}
            <aside className="scale-teacher-tip" aria-label="老师提示">
              <p className="scale-teacher-tip__head">老师提示 · {teacherTip.headline}</p>
              <div className="scale-teacher-tip__body">
                <p className="scale-teacher-tip__p">
                  <strong>为什么重要：</strong>
                  {teacherTip.why}
                </p>
                <p className="scale-teacher-tip__p">
                  <strong>耳朵记忆点：</strong>
                  {teacherTip.ear}
                </p>
                <p className="scale-teacher-tip__p">
                  <strong>在歌里：</strong>
                  {teacherTip.songs}
                </p>
                <p className="scale-teacher-tip__p">
                  <strong>这个把位怎么练：</strong>
                  {teacherTip.box}
                </p>
                <div className="scale-teacher-tip__tags">
                  {teacherTip.tags.map((tag, i) => (
                    <span key={i} className="scale-teacher-tip__tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </aside>

            <ScaleConnection rootPc={rootPc} scaleId={scaleId} />

            <ConceptCheatSheet
              filter={['basic', 'scale']}
              subtitle="音阶 / 调式页常蹦出来的黑话，老师给你翻译成大白话。看不懂时往下翻一翻。"
            />

            <button className="btn btn--primary scale-demo" onClick={playDemo} type="button">
              ▶ 演示这个把位（边播边高亮每个音）
            </button>
          </section>
        </div>
      </div>
      </div>

      <RhythmBar onBeat={advanceFollow} />
    </main>
  )
}
