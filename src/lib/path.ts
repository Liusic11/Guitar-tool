/**
 * 学习路径（Learning Path）· 课程地图
 * ─────────────────────────────────────────────
 * 纯静态内容：把「学吉他要先学什么、再学什么」拆成 7 个阶段，
 * 每阶段给出 目标 / 概念 / 练习（映射到现有模块，可一键跳转）/ 自检标准 / 常见坑。
 *
 * 面向对象（用户自述水平）：前三品开放和弦、简单弹唱扫弦、C 大调音阶都 OK。
 * 目标不是「会弹」，而是「懂弹 + 能创造」：
 *   ① 我在弹什么 —— 音名、级数、构成音
 *   ② 我为什么这么弹 —— 和弦功能、进行逻辑、音阶选择
 *   ③ 我能弹什么 —— 可用音阶、落点音、乐句词汇、替代选项
 * 因此路径从「把肌肉记忆翻译成理解」开始，而不是从持琴开始。
 *
 * 设计立场：这是地图，不是课程表。工具只负责指路，不追踪、不提醒、不替你安排。
 * 自检勾选只存本机，纯属用户自己的记录。
 *
 * 练习项里的 seed 是「贯通层」跳转参数：点「去练」时写入 sessionStore，
 * 目标模块挂载时自动接上（与和弦页→音阶页的跳转同一套机制）。
 * 标注「✦ 待补」的练习项对应尚未实现的功能（见 README / 建议清单）。
 */

import type { ViewKey } from './session'

/** 跳转前写入共享上下文的目标状态（与各模块挂载时读取的字段一一对应） */
export interface PathSeed {
  rootPc?: number
  scaleId?: string
  chordTypeId?: string
  lickId?: string
  keyPc?: number
  keyQuality?: 'major' | 'minor'
  jamPresetId?: string
}

export interface PathPractice {
  /** 练习内容描述 */
  label: string
  /** 跳转目标模块；缺省 = 该能力尚未实现（界面显示「✦ 待补」） */
  view?: ViewKey
  /** 跳转前写入的贯通参数 */
  seed?: PathSeed
}

export interface PathStage {
  id: string
  num: number
  title: string
  /** 大致时长，如「4–8 周」 */
  duration: string
  /** 本阶段目标（一句话） */
  goal: string
  /** 先要懂的概念 */
  concepts: string[]
  /** 去练什么（映射到模块） */
  practices: PathPractice[]
  /** 自检标准：全勾 = 本阶段完成（自己判断，工具不判） */
  checks: string[]
  /** 常见坑 */
  pitfalls: string[]
}

export const PATH_STAGES: PathStage[] = [
  {
    id: 'notes-degrees',
    num: 0,
    title: '音名与级数：把「弹的」翻译成「懂的」',
    duration: '2–4 周',
    goal: '指板上任意音，能同时说出「音名」和「在调内的级数」——这是从肌肉记忆走向理解的第一步。',
    concepts: ['音名 vs 级数（C 大调里 D 是 2 级，不管它在指板哪个位置）', '调性 = 移动的 Do', '指板音名规律（6 弦与 5 弦同音隔 2 品）'],
    practices: [
      {
        label: '指板训练 · 认音名（前三品起步，逐步全指板）',
        view: 'train',
        seed: { rootPc: 0 },
      },
      {
        label: '指板训练 · 找位置（先说音名，再在指板上找）',
        view: 'train',
        seed: { rootPc: 0 },
      },
      { label: '级数训练：给一个音问「在 C 大调是几级」（新题型）' },
    ],
    checks: [
      '随机指一个前三品的音，1 秒内说出音名',
      '说出音名后能立刻补出它在 C 大调的级数（D=2、F=4、B=7…）',
      'C 大调 7 个级数能 1–7 背出来',
    ],
    pitfalls: ['只记指形不记音名', '把音名和级数混为一谈', '只练 C 调不换调'],
  },
  {
    id: 'chord-why',
    num: 1,
    title: '和弦的为什么：从「按会」到「懂会」',
    duration: '3–6 周',
    goal: '每个常用和弦都知道「由哪几个音构成、为什么听着顺 / 暗 / 紧张」。',
    concepts: ['三度叠置：根音 · 三音 · 五音（叠三层是七和弦）', '大三 vs 小三：差别只在三音那半音', '属七（G7）的 ♭7 想解决到哪'],
    practices: [
      {
        label: '和弦参考 · 看每个和弦的构成音（点开指法，注意音名标注）',
        view: 'chords',
        seed: { rootPc: 0, chordTypeId: 'maj' },
      },
      {
        label: '和弦参考 · 理论卡（顺阶、属七解决都在里面）',
        view: 'chords',
        seed: { rootPc: 0, chordTypeId: 'dom7' },
      },
      { label: '和弦切换 · 换和弦时嘴里念出它的构成音', view: 'chords', seed: { rootPc: 0, chordTypeId: 'maj' } },
    ],
    checks: [
      '能说出 C、G、Am、F 各自由哪三个音构成',
      '能说出大三 / 小三和弦的差别在哪个音',
      '知道 G7 里的 ♭7（F）为什么想落到 C',
    ],
    pitfalls: ['只背指法不看构成音', '把「好听」当理由，不问三音决定大/小', '跳过七和弦（属七是流行乐的发动机）'],
  },
  {
    id: 'keys-progressions',
    num: 2,
    title: '调性与进行：我在弹什么调',
    duration: '3–6 周',
    goal: '看到一组和弦，能说出「这是什么调、几级进行、为什么顺」。',
    concepts: ['顺阶和弦：一个调里天然的一家人', '级数进行：I–vi–IV–V 是无数歌的骨架', '关系大小调：C 大调 = A 小调（同音不同家）'],
    practices: [
      {
        label: 'Jam · 1645 预设（先读「为什么成立」再跟弹）',
        view: 'jam',
        seed: { keyPc: 0, keyQuality: 'major', jamPresetId: '1-6-4-5' },
      },
      {
        label: '和弦切换 · 开放位（跟拍换把时看每拍的级数）',
        view: 'chords',
        seed: { rootPc: 0, chordTypeId: 'maj' },
      },
      { label: '进行级数解析：任意一组和弦 → 猜调、标级数（新工具）' },
    ],
    checks: [
      '看到 C–Am–F–G 能立刻说出 I–vi–IV–V（C 大调）',
      '知道 G7→C 为什么是「回家」',
      '能在 Jam 里换 2 个调弹同一组进行',
    ],
    pitfalls: ['记和弦不记级数——换个调就懵', '以为进行「就是好听」，不追问为什么', '只练 C 调'],
  },
  {
    id: 'what-can-scales',
    num: 3,
    title: '我能弹什么：音阶与落点',
    duration: '4–8 周',
    goal: '面对一个进行，能列出「我能弹什么」：可用音阶、安全落点、要避开的音。',
    concepts: ['五声音阶：怎么弹都不太难听（拿掉 4、7 级）', '和弦音 vs 经过音', '目标音：落点和弦音，怎么弹都「对」'],
    practices: [
      {
        label: '音阶 · A 小调五声 + C 大调（看它们在指板上的形状）',
        view: 'scales',
        seed: { rootPc: 9, scaleId: 'minorPent' },
      },
      { label: '即兴参谋：选一个进行 → 列出可用音阶 / 落点音 / 乐句（新工具）' },
      {
        label: 'Jam · 1645 上只落和弦音，再试经过音，听差别',
        view: 'jam',
        seed: { keyPc: 0, keyQuality: 'major', jamPresetId: '1-6-4-5' },
      },
    ],
    checks: [
      '面对 C–Am–F–G，能说出父音阶是 A 小调五声',
      '能说出每个和弦的落点音（C 的和弦音是 C E G…）',
      'Jam 里故意落错再落对，能听出差别',
    ],
    pitfalls: ['只会上下行跑音阶', '以为「音阶 = solo」', '不练耳朵只听手'],
  },
  {
    id: 'licks-vocab',
    num: 4,
    title: '我能弹什么：乐句词汇',
    duration: '长期',
    goal: '学乐句时知道「这条在弹什么、为什么好听、能挪到哪」，积累可复用的语汇。',
    concepts: ['乐句 = 动机 + 节奏 + 落点', '转调 = 整条沿指板平移', '技巧词汇：bend、滑音、幽灵音'],
    practices: [
      {
        label: '乐句库 · blues / rock 各 1 条（先读 degree 标注和讲解再上手）',
        view: 'licks',
        seed: { lickId: 'blues-open', rootPc: 9 },
      },
      { label: '乐句库 · 学会后转调弹（看看它换了几个把位）', view: 'licks', seed: { lickId: 'blues-open', rootPc: 9 } },
      { label: 'Jam · 把学过的乐句塞进进行里用', view: 'jam', seed: { keyPc: 0, keyQuality: 'major', jamPresetId: '1-6-4-5' } },
    ],
    checks: [
      '能说出学过的乐句里哪些是和弦音、哪些是经过音',
      '每条乐句能在 2 个调上弹',
      '能拆出乐句的开头动机，自己接一句',
    ],
    pitfalls: ['只记手位不记音', '整条硬背不拆解', '不转调、不换调'],
  },
  {
    id: 'ear-brain',
    num: 5,
    title: '耳朵与脑子的连接',
    duration: '4 周（可与 3/4 穿插）',
    goal: '把「懂的」变成「听得出的」——音程、和弦、进行都能靠耳朵认。',
    concepts: ['音程听感：大小三度、纯四五度、八度', '和弦色彩：大三明亮、小三暗淡、属七紧张', '级数听辨：听出 V→I 的「回家」'],
    practices: [
      { label: '耳朵 · 音程（大小三度、纯四五度起步）', view: 'ear' },
      { label: '耳朵 · 和弦（大三 / 小三 → 属七）', view: 'ear' },
      { label: '耳朵 · 进行（听进行猜级数）', view: 'ear' },
    ],
    checks: [
      '音程 10 题对 7 以上',
      '大三 / 小三和弦 10 题对 7 以上',
      '能听出 V→I 的回家感',
    ],
    pitfalls: ['瞎猜不先听根音', '只练音程不练和弦 / 进行', '急于求成——耳朵是慢功夫'],
  },
  {
    id: 'create',
    num: 6,
    title: '创造：把懂的用出去',
    duration: '终身功课',
    goal: '在 Jam 里把「懂」用出去：选音阶、盯落点、用乐句、发展动机。',
    concepts: ['动机发展：重复 / 变化 / 问答', '空间感：不弹也是音乐', 'per-chord 换音阶：每和弦一个「对味」的音阶'],
    practices: [
      {
        label: 'Jam · per-chord 模式（每和弦换推荐音阶，感受「对味」）',
        view: 'jam',
        seed: { keyPc: 0, keyQuality: 'major', jamPresetId: '1-6-4-5' },
      },
      { label: '即兴参谋：一个进行三种弹法对比（新工具）' },
      { label: '乐句库 · 学完即兴变奏（改节奏、改落点）', view: 'licks' },
    ],
    checks: [
      'Jam 里能主动留白（不是每拍都弹）',
      '能用「问句–答句」结构弹满 8 小节',
      '能在一个进行里用至少 2 个不同的音阶视角',
    ],
    pitfalls: ['弹太多不停', '只会五声音阶一个视角', '不录音回听自己'],
  },
]
