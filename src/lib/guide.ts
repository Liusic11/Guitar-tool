/**
 * 练习手册（乐理页数据层）
 * ─────────────────────────────────────────────
 * 这本应用「每个功能是什么、怎么练、练到什么程度、按什么顺序练」的完整说明书。
 * 三部分：
 *   ① 练习顺序总纲 ROADMAP_STAGES —— 技能阶梯：有序阶段 × 量化过关标准 × 对应模块
 *   ② 分模块详解 MODULE_GUIDES —— 每个模块的音乐解释 + 拆解分析 + 练法
 *   ③ 图示 DIAGRAMS —— 用应用自己的拟真指板画出来的教学图（八度形状 / 盒1 / 横按…）
 *
 * 顺序依据（2026-08 调研总结，多家来源交叉一致）：
 *   · JustinGuitar 初学者路线：和弦先行 → 一分钟换和弦（1 分钟 20 次）→
 *     节奏型 → 小调五声是第一条音阶 → 12 小节 blues 伴奏即兴；每天 15–20 分钟。
 *   · 指板记忆教程共识（musiciangoods / soundgate / eathealthy365 等）：
 *     先 6/5 弦自然音 → 八度形状投影全琴颈 → 地标品 3/5/7/9/12 →
 *     随机限时抽查（3 秒内答 / 60 秒 10 个 / 20 秒找一个音全部位置）→ 12 品一循环。
 *   · 中阶路线共识（perpetual.education / Kevin Nickens 十级 / cochranemusic）：
 *     五声全把位 → 横按 + 认全指板 → 大调音阶 → 顺阶和弦/级数 → 七和弦 →
 *     调式（Aeolian→Ionian→Dorian→…）+ 琶音；耳朵训练贯穿。
 * 「理解向」的姊妹地图在「路径」页（PATH_STAGES），两页互补：这里管怎么练，那里管懂什么。
 *
 * 全部确定性内容，不调 LLM。渲染层 components/TheoryGuide.tsx。
 */

import type { ViewKey } from './session'

/* ─────────────── 数据模型 ─────────────── */

/**
 * 图上的标记种类。渲染时映射到 Fretboard 的高亮样式：
 * root/start → 炭火橙大点；note → 柔橙普通点；accent → 黄铜金强调点；
 * ghost → 半透明虚点（「原来的位置」）；end → 鼠尾草绿（落点/完成）。
 */
export type MarkKind = 'root' | 'start' | 'note' | 'accent' | 'ghost' | 'end'

export interface DiagramMark {
  string: number
  fret: number
  kind: MarkKind
  /** 点里写的字（音名 / 级数 / 序号） */
  label?: string
}

export interface DiagramSpec {
  id: string
  /** 图题（老师口吻，说明这张图看什么） */
  caption: string
  /** 指板取景：范围外压暗 */
  scope: [number, number]
  /** 画几品（决定指板长度） */
  maxFret: number
  marks: DiagramMark[]
  /** 图例：颜色 → 含义 */
  legend?: { kind: MarkKind; text: string }[]
}

export type GuideBlock =
  | { type: 'p'; text: string }
  | { type: 'definition'; term: string; text: string }
  | { type: 'callout'; tone: 'ember' | 'sage' | 'brass'; title?: string; text: string }
  | { type: 'practice'; title: string; method: string; goal: string }
  | { type: 'steps'; title: string; items: string[] }
  | { type: 'chips'; title?: string; items: { label: string; sub?: string }[] }
  | { type: 'diagram'; diagram: string }
  | { type: 'relation'; text: string; to: { view: ViewKey; label: string } }

export interface RoadmapStage {
  id: string
  title: string
  /** 大致时长（可与其他阶段并行/穿插） */
  duration: string
  /** 是什么 & 为什么排在这个位置 */
  what: string
  /** 怎么练（可操作的动作清单） */
  method: string[]
  /** 量化过关标准：全达成才进下一阶段 */
  goals: string[]
  /** 用哪个模块练 */
  modules: { view: ViewKey; label: string }[]
  /** 本阶段顺序的依据 */
  basis: string
}

export interface ModuleGuide {
  id: string
  title: string
  icon: string
  /** 音乐上这是什么（大解释） */
  what: string
  /** 为什么要练它 */
  why: string
  blocks: GuideBlock[]
}

/* ─────────────── ① 练习顺序总纲 ─────────────── */

export const GUIDE_INTRO = {
  title: '练习手册',
  subtitle:
    '这一页回答三个问题：每个模块在音乐上是什么、具体怎么练、按什么顺序练。顺序不是拍脑袋——综合了 JustinGuitar 初学者路线、几份指板记忆教程和中阶教学共识（见总纲末尾），再对齐到本应用的功能。理解向的概念地图请配合「路径」页使用：这里管手上功夫，那里管脑子里的懂。',
}

export const ROADMAP_BASIS_NOTE =
  '顺序依据：① JustinGuitar 初学者路线（和弦先行、小调五声是第一条音阶、12 小节 blues 收尾、每天 15–20 分钟）；② 指板记忆教程共识（先 6/5 弦自然音 → 八度形状投影 → 地标品 → 限时抽查，12 品一循环）；③ 中阶教学共识（五声全把位 → 横按+认全指板 → 大调音阶 → 级数进行 → 调式琶音，耳朵贯穿）。阶段可并行穿插，但别跳级——每阶段的「过关标准」全达成再进下一个。'

export const DAILY_ROUTINE = {
  title: '每天怎么配（15–30 分钟，6 天 / 周）',
  items: [
    '指板 5 分钟 —— 指板训练随机抽查（音名 / 找位置 / 找八度轮着来）',
    '技术 10 分钟 —— 当前阶段的音阶 / 和弦 / 模进，节拍器开着',
    '音乐 10 分钟 —— 乐句、Jam、耳朵任选：练「像音乐」的东西，别全是体操',
  ],
  note: '每天 20 分钟 > 周末 3 小时。节拍器从 60bpm 起，干净了才 +5bpm——慢练是唯一的捷径。',
}

export const ROADMAP_STAGES: RoadmapStage[] = [
  {
    id: 'stage-0',
    title: '准备：调音与空弦',
    duration: '几天',
    what: '弹琴前先调音（App 帮不了你这步，用调音器或调音 App），并且把 6 根空弦的音名背到秒答：6 弦到 1 弦 = E A D G B E。这是整张指板地图的原点。',
    method: [
      '每次练琴第一件事：调音',
      '从 6 弦往 1 弦、再从 1 弦往 6 弦，口头报空弦音名，各 10 遍',
      '记口诀「EADGBE」（Eat All Day Get Big Easy）',
    ],
    goals: ['随机指一根弦，1 秒内说出空弦音名', '不看着琴也能按顺序报出 6 根弦'],
    modules: [],
    basis: '所有课程的第一课（JustinGuitar Grade 1 / 各路线 Level 0 都是空弦开始）',
  },
  {
    id: 'stage-1',
    title: '前 12 品音名：把网格刻进脑子',
    duration: '2–6 周',
    what: '这是本应用的核心训练，也是后面一切的地基。指板是 6 弦 × 12 品的网格，12 品一循环。记忆顺序有讲究：先啃 6 弦和 5 弦的自然音（它们承载绝大多数和弦根音），再用八度形状把知识「投影」到其余四根弦——不用一根根弦死背。',
    method: [
      '第一周只练 6 弦 + 5 弦自然音：边弹边念音名，上行 20 遍、下行 20 遍（B–C、E–F 之间没有升降号）',
      '用地标品当锚：3 / 5 / 7 / 9 / 12 品有琴颈标记点，先记住这些点上的音',
      '学两个八度形状（见「指板训练」模块详解）：6/5 弦上任一音，隔 2 根弦 +2 品（跨 B 弦则 +3 品）就是同名音',
      '打开指板训练：先在设置里把范围限死在前 5 品，「认音名」和「找位置」交替练，正确率 95% 再一格一格扩',
      '八度形状熟了以后，用「找八度」模式把 6/5 弦的知识铺满全琴颈',
    ],
    goals: [
      '随机指一个前 12 品的位置，2 秒内说出音名（这就是你要的「2 秒反应」）',
      '60 秒内随机抽查 10 个音全部答对',
      '任选一个音（比如 F），20 秒内找出它在前 12 品的所有位置',
    ],
    modules: [
      { view: 'train', label: '指板训练 · 认音名 / 找位置 / 找八度' },
    ],
    basis: '指板记忆教程共识（musiciangoods 30 天计划 / soundgate / eathealthy365：E·A 弦先行 → 八度投影 → 限时抽查）',
  },
  {
    id: 'stage-2',
    title: '开放和弦 + 一分钟换和弦',
    duration: '2–4 周（可与阶段 1 并行）',
    what: '会按 E A D G C Em Am 七个开放和弦，并且能在它们之间「干净地换」。换和弦是初学的第一堵墙——唯一有效的解法是计量化的「一分钟换和弦」：掐表数次数，让进步看得见。',
    method: [
      '先在和弦参考里看每个和弦的构成音（根 / 三音 / 五音），别只背手指形状',
      '挑两个和弦（比如 C→G），掐表 1 分钟，能换几次算几次，每天 5 组组合',
      '换的时候盯三音：大三和弦亮、小三和弦暗，差的只有那半音',
    ],
    goals: ['任意两个已学和弦，1 分钟内换 20 次且声音干净（JustinGuitar 的量化标准）'],
    modules: [
      { view: 'chords', label: '和弦参考 · 切换训练' },
    ],
    basis: 'JustinGuitar 初学者路线 Stage 1–2（一分钟换和弦法是它的招牌练习）',
  },
  {
    id: 'stage-3',
    title: '小调五声盒 1 + 节拍器',
    duration: '2–4 周',
    what: '你说的「跟着节奏练 scale」就是这一步：第一条音阶是小调五声（只 5 个音，怎么弹都不难听），第一个把位是「盒 1」。从这一刻起，所有音阶练习都必须开节拍器——节奏是音阶的灵魂，不是伴奏。',
    method: [
      '音阶页选小调五声、根音 A，只练盒 1（E 形）：先不开节拍器把 12 个音的位置摸熟',
      '开节拍器 60bpm，8 分音符上下行各一遍算 1 组，交替拨弦（下上下上），弹 3 组',
      '每组都干净才 +5bpm；卡了就退回去——永远只提速到「还干净」的速度',
    ],
    goals: ['60bpm 8 分音符上下行连续 3 遍不出错', '提速到 90bpm 仍然干净', '闭眼能从根音走完盒 1 再走回来'],
    modules: [
      { view: 'scales', label: '音阶 · 小调五声盒 1' },
    ],
    basis: 'JustinGuitar Stage 5（小调五声 = 第一条音阶）；chordly 路线（60bpm 起、+5bpm 递进）',
  },
  {
    id: 'stage-4',
    title: '节奏型与横按：打开整个琴颈',
    duration: '4–8 周',
    what: '两条线并行：右手练扫弦节奏型（从「下 下上 上下上」这个万能型开始），左手攻强力和弦与横按。横按是「一块形状换 12 个调」的钥匙——按住 E 形横按，根音在哪就是什么和弦。',
    method: [
      '先单和弦练节奏型，右手不下意识了再叠加换和弦',
      '强力和弦：5 弦 / 6 弦根音各练一块形状，沿琴颈平移滑着走（Seven Nation Army 就是一个形状）',
      '横按从 F 大三和弦（1 品 E 形）开始，每次只按住保持 5–10 秒的干净发声，肌肉是慢慢长的',
      '和弦参考里把同一和弦的开放位 / E 形 / A 形都点开对比——同一组和弦音，不同排布',
    ],
    goals: [
      'E 形 / A 形横按，随机报一个大三和弦，3 秒内按出',
      '「下 下上 上下上」节奏型跟 80bpm 稳定弹满 4 小节不乱',
    ],
    modules: [
      { view: 'chords', label: '和弦参考 · 多把位对比' },
    ],
    basis: 'perpetual.education Level 3（横按 + 认全指板 + 开始跟伴奏 solo）；JustinGuitar Stage 3–4（节奏型在换和弦稳了之后才加）',
  },
  {
    id: 'stage-5',
    title: '蓝调音 + 模进：把音阶练「活」',
    duration: '2–4 周',
    what: '盒 1 熟了以后加料：蓝调音（♭5）给它「脏」味；模进（3 音一组 / 琶音 / 八度跳）把死形状练成手指会自动流出的线条。模进是手指体操——不为好听，为的是即兴时手比脑子快。',
    method: [
      '音阶页切到布鲁斯音阶，专练 ♭5：弹到它立刻滑向 5 级，绝不落脚',
      '模进选「3 音一组」：1-2-3、2-3-4、3-4-5…… 60bpm 走顺，再换八度跳、琶音',
      '琶音只弹和弦音（根·3·5·7）——这是「为什么这个音阶配这个和弦」的答案',
    ],
    goals: ['任一模进在盒 1 连续走 2 遍不卡', '闭眼找到当前把位里的所有和弦音', '蓝调音只当经过音，不停留'],
    modules: [
      { view: 'scales', label: '音阶 · 模进' },
    ],
    basis: 'guitarfreaks（把音名/音阶立刻用进音乐）；本应用 PATTERNS 数据即四类标准模进',
  },
  {
    id: 'stage-6',
    title: '乐句：从单词表到说话',
    duration: '长期（每天 1 条）',
    what: '音阶是单词表，乐句是别人写好的句子。抄好句 → 提速 → 改一改变成自己的，这是从「会弹音阶」到「会说话」唯一的桥。本应用乐句库里每条都标了级数、讲了为什么好听，而且能整体平移到 12 个根音。',
    method: [
      '从难度 1 的 blues 乐句开始，3 步法：60bpm 照谱弹对 → 每次 +5~10bpm → 改一两个音据为己有',
      '每条至少转调到 3 个根音弹（乐句页选根音，形状整体平移）',
      '读每条的「为什么好听」：哪几个音是和弦音、哪个是蓝调音、哪个动作是风格签名',
    ],
    goals: ['当前乐句能脱谱弹', '能移到 3 个不同根音', '能在 jam 里把它当一句「回答」接进去'],
    modules: [
      { view: 'licks', label: '乐句库' },
    ],
    basis: '教学共识（lick 是即兴的词汇来源）；本应用 LICKS 数据锚定 blues/funk/jazz/rock 四风格',
  },
  {
    id: 'stage-7',
    title: 'Jam：跟真音乐用出来',
    duration: '长期（与 5/6 穿插）',
    what: '会的东西不在音乐里用出来，等于没会。Jam 页放真实进行（1645 / 12 小节 blues / ii–V–I），你把练过的五声、乐句、落点扔进去。即兴的第一原则：先听和弦，再糊音阶。',
    method: [
      '三步走：① 每个和弦只弹和弦音（落点）② 换成五声随便走，但句尾落和弦音 ③ 塞乐句 + 主动留白',
      '听得出和弦切换再开始弹——跟着 1645 数换和弦，数稳了再上手',
      '录下来回听，你会听到自己弹时听不到的问题',
    ],
    goals: ['连续即兴 4 小节不冷场、不跑调', '能主动留白（不是每拍都弹）', '能用「问句–答句」结构弹满 8 小节'],
    modules: [
      { view: 'jam', label: 'Jam · 1645 / 12 小节 blues' },
    ],
    basis: 'JustinGuitar Stage 6（12 小节 blues 伴奏收尾初学段）；perpetual Level 3（跟 backing track 开始 solo）',
  },
  {
    id: 'stage-8',
    title: '大小调全家桶 + 全把位',
    duration: '4–8 周',
    what: '把「调」的地图补齐：关系大小调（C 大调 = A 小调，同音不同家）、平行大小调（同根音，3·6·7 级各降半音）、大调音阶的 7 个位置、五声 5 个形状串起来覆盖全琴颈。到这一步，指板从「一堆格子」变成「一组能平移的图形」。',
    method: [
      '音阶页：小调五声 5 个形状（E-D-C-A-G）逐个过，再用「上 / 下一个把位」串着走',
      '同一根音，用「一键平行转换」在大 / 小调间切换，闭眼听 ♭3 的明暗差',
      '换关系大调根音（A 小调五声 ↔ C 大调五声），看同一堆音怎么换味道',
      '自然大调 / 自然小调用 7 位置系统各过一遍',
    ],
    goals: [
      '5 个五声形状从琴枕串到高把位中途不出错',
      '随机听一段，能判断大调还是小调，并指出是 ♭3 造成的',
    ],
    modules: [
      { view: 'scales', label: '音阶 · 平行转换 / 形状导航' },
    ],
    basis: 'cochranemusic（五声熟了才进大调音阶和调式）；本应用音阶页 16 条音阶 + CAGED 形状系统',
  },
  {
    id: 'stage-9',
    title: '耳朵：把懂的变成听得出的',
    duration: '贯穿全程，每天 3–5 分钟',
    what: '乐理写在纸上是知识，听得出来才是能力。耳朵训练按「音程 → 和弦色彩 → 进行级数」递进：先分清单个音的距离，再听和弦的明暗，最后听整条进行往哪走。',
    method: [
      '音程从大小三度、纯四纯五起步（这三个决定和弦色彩），10 题一组',
      '和弦：先分大三 / 小三，再加属七的「紧张感」',
      '进行：专门听 V→I 的「回家」感，然后去 Jam 页验证',
      '错的题隔天重听——耳朵是慢功夫，急不来',
    ],
    goals: ['音程 10 题对 7 以上', '大三 / 小三 / 属七听辨 10 题对 7 以上', '能听出 1645 里每次换和弦'],
    modules: [
      { view: 'ear', label: '耳朵训练' },
    ],
    basis: '十级路线共识（ear training 是中段必修）；本应用耳朵页三级递进正好对应',
  },
  {
    id: 'stage-10',
    title: '调式与创造：按和弦选味道',
    duration: '进阶，长期',
    what: '最后的自由是「每个和弦配一种味道」：小七和弦上用多利亚（暗里带亮 6 级的 funk 味），属七上用混合利底亚（亮里带张力的 ♭7）。加上乐句变奏、动机发展，即兴开始像「作曲的现场版」。',
    method: [
      '调式顺序按共识来：先 Aeolian（自然小调）、Ionian（自然大调），再 Dorian、Mixolydian，其余慢慢来',
      'Jam 页开 per-chord 模式：每个和弦换推荐音阶，感受「对味」',
      '乐句学完做变奏：改节奏、改落点、留半句',
    ],
    goals: ['m7 和弦上自然用 Dorian、属七上自然用 Mixolydian，两者不混', '一段 jam 里至少用 2 个音阶视角'],
    modules: [
      { view: 'scales', label: '音阶 · 调式' },
      { view: 'jam', label: 'Jam · per-chord' },
    ],
    basis: 'cochranemusic（调式推荐顺序 Aeolian→Ionian→Dorian→Phrygian→Lydian→Mixolydian→Locrian）',
  },
]

/* ─────────────── ③ 图示（标准调弦、绝对品位） ─────────────── */

export const DIAGRAMS: Record<string, DiagramSpec> = {
  'natural-65': {
    id: 'natural-65',
    caption:
      '先啃这两根弦：6 弦与 5 弦的自然音（0–12 品）。金色的三个品（5 / 7 / 12）是琴颈标记点，当地标背。12 品之后全部重复。',
    scope: [0, 12],
    maxFret: 12,
    marks: [
      { string: 6, fret: 0, kind: 'note', label: 'E' },
      { string: 6, fret: 1, kind: 'note', label: 'F' },
      { string: 6, fret: 3, kind: 'note', label: 'G' },
      { string: 6, fret: 5, kind: 'accent', label: 'A' },
      { string: 6, fret: 7, kind: 'accent', label: 'B' },
      { string: 6, fret: 8, kind: 'note', label: 'C' },
      { string: 6, fret: 10, kind: 'note', label: 'D' },
      { string: 6, fret: 12, kind: 'accent', label: 'E' },
      { string: 5, fret: 0, kind: 'note', label: 'A' },
      { string: 5, fret: 2, kind: 'note', label: 'B' },
      { string: 5, fret: 3, kind: 'note', label: 'C' },
      { string: 5, fret: 5, kind: 'accent', label: 'D' },
      { string: 5, fret: 7, kind: 'accent', label: 'E' },
      { string: 5, fret: 8, kind: 'note', label: 'F' },
      { string: 5, fret: 10, kind: 'note', label: 'G' },
      { string: 5, fret: 12, kind: 'accent', label: 'A' },
    ],
    legend: [
      { kind: 'note', text: '自然音（B–C、E–F 之间没有升降号）' },
      { kind: 'accent', text: '地标品 5 / 7 / 12（琴颈有标记点）' },
    ],
  },
  octaves: {
    id: 'octaves',
    caption:
      '两个八度形状铺满全琴颈：橙色 = 根音，金色 = 同名音（高八度）。形状①：隔 2 根弦 +2 品（如 6 弦 3 品 G → 4 弦 5 品 G）；形状②跨 B 弦要 +3 品（如 4 弦 3 品 F → 2 弦 6 品 F）。背下 6/5 弦 + 这两个形状 = 全琴颈的音名。',
    scope: [0, 12],
    maxFret: 12,
    marks: [
      { string: 6, fret: 3, kind: 'root', label: 'G' },
      { string: 4, fret: 5, kind: 'accent', label: 'G' },
      { string: 5, fret: 3, kind: 'root', label: 'C' },
      { string: 3, fret: 5, kind: 'accent', label: 'C' },
      { string: 4, fret: 3, kind: 'root', label: 'F' },
      { string: 2, fret: 6, kind: 'accent', label: 'F' },
      { string: 3, fret: 2, kind: 'root', label: 'A' },
      { string: 1, fret: 5, kind: 'accent', label: 'A' },
    ],
    legend: [
      { kind: 'root', text: '根音（在 6/5 弦上先记住）' },
      { kind: 'accent', text: '同名音 · 高八度（隔 2 弦 +2 品；跨 B 弦 +3 品）' },
    ],
  },
  'pent-box1': {
    id: 'pent-box1',
    caption:
      'A 小调五声 · 盒 1（E 形）：你的第一条音阶、第一个把位。橙色 = 根音 A（6 弦 5 品起），点是级数（1 · ♭3 · 4 · 5 · ♭7）。整块形状沿琴颈平移就是别的调。',
    scope: [4, 9],
    maxFret: 9,
    marks: [
      { string: 6, fret: 5, kind: 'root', label: '1' },
      { string: 6, fret: 8, kind: 'note', label: '♭3' },
      { string: 5, fret: 5, kind: 'note', label: '4' },
      { string: 5, fret: 7, kind: 'note', label: '5' },
      { string: 4, fret: 5, kind: 'note', label: '♭7' },
      { string: 4, fret: 7, kind: 'root', label: '1' },
      { string: 3, fret: 5, kind: 'note', label: '♭3' },
      { string: 3, fret: 7, kind: 'note', label: '4' },
      { string: 2, fret: 5, kind: 'note', label: '5' },
      { string: 2, fret: 8, kind: 'note', label: '♭7' },
      { string: 1, fret: 5, kind: 'root', label: '1' },
      { string: 1, fret: 8, kind: 'note', label: '♭3' },
    ],
    legend: [
      { kind: 'root', text: '根音 A（盒子的「家」）' },
      { kind: 'note', text: '其余四音：♭3 · 4 · 5 · ♭7' },
    ],
  },
  'barre-F': {
    id: 'barre-F',
    caption:
      'E 形横按 · F 大三和弦（1 品）：食指横按 1 品，其余手指摆的是开放 E 和弦的形状。金色那个音是三音 A——它决定这个和弦「大（亮）」，把它降半音就是小三和弦。整块形状平移 = 12 个调的大三和弦。',
    scope: [0, 5],
    maxFret: 5,
    marks: [
      { string: 6, fret: 1, kind: 'root', label: '根' },
      { string: 5, fret: 3, kind: 'note', label: '5' },
      { string: 4, fret: 3, kind: 'root', label: '根' },
      { string: 3, fret: 2, kind: 'accent', label: '3' },
      { string: 2, fret: 1, kind: 'note', label: '5' },
      { string: 1, fret: 1, kind: 'root', label: '根' },
    ],
    legend: [
      { kind: 'root', text: '根音 F（决定叫什么）' },
      { kind: 'accent', text: '三音 A（决定大 / 小——就差这半音）' },
      { kind: 'note', text: '五音 C（决定稳不稳）' },
    ],
  },
  parallel: {
    id: 'parallel',
    caption:
      '平行转换拆解：同一条 2 弦上，C 大调 → C 小调只挪 3 个音。灰点是 3、6、7 级的大调原位；金色点是小调把它们各降半音后的新位（♭3、♭6、♭7）。其中 ♭3 是「小调为什么悲伤」的直接来源。',
    scope: [0, 13],
    maxFret: 13,
    marks: [
      { string: 2, fret: 1, kind: 'root', label: '1' },
      { string: 2, fret: 3, kind: 'note', label: '2' },
      { string: 2, fret: 5, kind: 'note', label: '3' },
      { string: 2, fret: 4, kind: 'accent', label: '♭3' },
      { string: 2, fret: 6, kind: 'note', label: '4' },
      { string: 2, fret: 8, kind: 'note', label: '5' },
      { string: 2, fret: 10, kind: 'note', label: '6' },
      { string: 2, fret: 11, kind: 'accent', label: '♭6' },
      { string: 2, fret: 12, kind: 'note', label: '7' },
      { string: 2, fret: 13, kind: 'accent', label: '♭7' },
    ],
    legend: [
      { kind: 'root', text: '主音 C（不动）' },
      { kind: 'note', text: '大调台阶（3 / 6 / 7 是要挪的）' },
      { kind: 'accent', text: '小调新位：♭3 · ♭6 · ♭7（各降半音）' },
    ],
  },
  'lick-open': {
    id: 'lick-open',
    caption:
      '乐句拆解 ·「开门句」（A 根音）：数字是弹奏顺序。从根音（橙）滑到 ♭3 再落回根音（绿）——布鲁斯最经典的开场句，用的只有盒 1 的三个音（1-♭3-5 骨架）。',
    scope: [4, 9],
    maxFret: 9,
    marks: [
      { string: 6, fret: 5, kind: 'start', label: '1' },
      { string: 6, fret: 8, kind: 'note', label: '2' },
      { string: 5, fret: 7, kind: 'note', label: '3' },
      { string: 5, fret: 5, kind: 'note', label: '4' },
      { string: 4, fret: 7, kind: 'note', label: '5' },
      { string: 4, fret: 5, kind: 'end', label: '6' },
    ],
    legend: [
      { kind: 'start', text: '起点 = 根音 A' },
      { kind: 'note', text: '经过音（滑音方向沿 6 弦）' },
      { kind: 'end', text: '落点 = 回到根音 A（收束）' },
    ],
  },
}

/* ─────────────── ② 分模块详解 ─────────────── */

export const MODULE_GUIDES: ModuleGuide[] = [
  {
    id: 'm-train',
    title: '指板训练',
    icon: '🎯',
    what: '把「音在哪」练成条件反射。音乐上：吉他把 12 个音平铺成 6 弦 × 12 品的网格，12 品一循环；同一个音名有多个位置（互差八度）。记忆的唯一通路是主动回忆——被提问、限时作答，而不是看着图认。这个模块就是一台出题机。',
    why: '音名是所有上层建筑的坐标系：和弦的根音、音阶的落点、乐句的转调全靠它。不认识音名，你就永远只能背形状，一辈子被形状困在盒子里。',
    blocks: [
      { type: 'diagram', diagram: 'natural-65' },
      {
        type: 'definition',
        term: '八度形状（指板的乘法口诀）',
        text: '6/5 弦上任一音，隔 2 根弦、高 2 品就是同名音；如果跨过 B 弦（2 弦），改成高 3 品。背熟 6/5 弦 + 这两个形状，全琴颈的音名不用死背——全是推出来的。',
      },
      { type: 'diagram', diagram: 'octaves' },
      {
        type: 'steps',
        title: '每日 5 分钟三步（轮着来）',
        items: [
          '「认音名」：给位置答音名——先在设置里把范围限死前 5 品，95% 正确率再扩大',
          '「找位置」：给音名在指定弦上找位置——这是反向调用，更接近实战',
          '「找八度」：标出所有同名音——专练八度形状的投影能力',
        ],
      },
      {
        type: 'callout',
        tone: 'ember',
        title: '最忌一次性全指板开火',
        text: '把范围限小、练到接近全对、再扩一格——每一次扩圈都是建立在已巩固的地盘上。出题偏好设成 Do/Fa/Sol 偏向，让最重要的三个音（主/下属/属）出现得更频繁。',
      },
      {
        type: 'practice',
        title: '过关标准',
        method: '每天 5 分钟随机抽查，认音名 / 找位置 / 找八度交替；错题自然重练（引擎会按掌握度加权出题）。',
        goal: '随机点位 2 秒内说出音名；60 秒 10 个全对；任选一个音 20 秒内找全前 12 品的所有位置。',
      },
      { type: 'relation', text: '准备好了就去练 ——', to: { view: 'train', label: '去指板训练' } },
    ],
  },
  {
    id: 'm-chords',
    title: '和弦参考',
    icon: '🧱',
    what: '和弦在音乐上是「三度叠置」：从根音隔一个音叠一个音，得到根·三音·五音（叠三层是七和弦）。根音决定叫什么，三音决定大还是小（只差半音！），五音决定稳不稳。吉他上多数和弦是「同一块形状沿琴颈平移换调」——横按系统。',
    why: '和弦是伴奏的全部、即兴的落点。懂构成音之后，你看到的不再是手指形状，而是「哪三个音在响、为什么亮为什么暗」。',
    blocks: [
      { type: 'diagram', diagram: 'barre-F' },
      {
        type: 'definition',
        term: '横按 = 12 个调一块形状',
        text: 'E 形横按：食指横按当「移动琴枕」，其余手指摆 E 和弦形状——根音在 6 弦哪一品，就是什么调和弦。A 形同理（根音在 5 弦）。所以背 2 块形状 + 6/5 弦音名 = 24 个和弦。',
      },
      {
        type: 'steps',
        title: '一分钟换和弦法（JustinGuitar 招牌练习）',
        items: [
          '挑两个和弦（先 C→G），掐表 1 分钟，能换几次算几次，记下数字',
          '每天 5 组组合，专攻最难的配对',
          '目标线：1 分钟 20 次且声音干净——达到这条线，扫弦才不会崩',
        ],
      },
      {
        type: 'callout',
        tone: 'brass',
        title: '页内玩法',
        text: '参考浏览器里点开任意和弦的多把位（开放 / E 形 / A 形 / D 形），看同一组和弦音的不同排布；「切换训练」模式就是计量化的一分钟换和弦。',
      },
      {
        type: 'practice',
        title: '过关标准',
        method: '学和弦时必看构成音（页内有标注），换和弦时嘴里念出三个音的名字。',
        goal: '任意两个开放和弦 1 分钟换 20 次干净；能说出 C / G / Am / F 各由哪三个音构成。',
      },
      { type: 'relation', text: '去和弦参考看构成音、练切换 ——', to: { view: 'chords', label: '去和弦参考' } },
    ],
  },
  {
    id: 'm-scales',
    title: '音阶',
    icon: '🪜',
    what: '音阶是从根音按固定「台阶」排的一串音；吉他手把它切成「把位」来练（五声有 5 个 CAGED 形状：E-D-C-A-G 彼此咬合覆盖全琴颈；七声音阶有 7 个位置）。这一页集齐了 16 条音阶、把位导航、模进和一键平行转换。',
    why: '音阶是 solo 的词汇库。但死背形状 = 背了单词表不会说话——所以要配合模进（手指体操）和落点意识（弹到和弦音上）。',
    blocks: [
      { type: 'diagram', diagram: 'pent-box1' },
      {
        type: 'steps',
        title: '节拍器上楼法（每个把位都这么练）',
        items: [
          '不开节拍器，把把位里的音从低到高摸熟（嘴里念级数：1 ♭3 4 5 ♭7…）',
          '开 60bpm，8 分音符上下行各一遍 = 1 组，交替拨弦，弹 3 组',
          '全部干净才 +5bpm；一卡就退回去——只提速到「还干净」的速度',
        ],
      },
      {
        type: 'definition',
        term: '模进（Pattern）',
        text: '把把位里的音排成固定路线：3 音一组（1-2-3 / 2-3-4…）、八度跳、琶音（只弹根·3·5·7）、blues 句式。它是把零散词汇练成「手指自动流出」的关键，页内「模进」按钮一键生成。',
      },
      {
        type: 'definition',
        term: '关系大小调 vs 平行大小调',
        text: '关系大小调「换家不换音」：C 大调和 A 小调用同一套音，只是把哪个音当家不同——练熟小调五声，根音挪到关系大调就有大调五声。平行大小调「换音不换家」：同一根音，小调把大调的 3·6·7 级各降半音。',
      },
      { type: 'diagram', diagram: 'parallel' },
      {
        type: 'callout',
        tone: 'sage',
        title: '页内玩法',
        text: '形状导航「上 / 下一个把位」沿琴颈爬全部形状；「一键平行转换」在同根音的大 / 小调间切换，练耳朵抓那半音的明暗差。',
      },
      {
        type: 'practice',
        title: '过关标准',
        method: '每条音阶先盒 1 后其余形状；模进每天一种；平行转换配合耳朵（闭眼听辨再对照）。',
        goal: '当前把位 90bpm 8 分音 3 遍不出错；任一模进连续 2 遍不卡；听得出大 / 小调并指出 ♭3。',
      },
      { type: 'relation', text: '去音阶页开节拍器 ——', to: { view: 'scales', label: '去音阶页' } },
    ],
  },
  {
    id: 'm-ear',
    title: '耳朵训练',
    icon: '👂',
    what: '乐理写在纸上是知识，听得出来才是能力。这个模块练三层听辨：音程（两个音差多远）、和弦色彩（大三亮 / 小三暗 / 属七紧张）、进行级数（听得出和弦往哪走、什么时候「回家」）。',
    why: '你能复制的东西，上限就是你听得懂的东西。扒歌、即兴、纠错，全靠耳朵——手只是耳朵的执行器。',
    blocks: [
      {
        type: 'steps',
        title: '递进路线（别跳）',
        items: [
          '第一层 · 音程：大小三度、纯四纯五起步——这几个直接决定和弦色彩',
          '第二层 · 和弦：先分大三 / 小三，熟了再加属七的紧张感',
          '第三层 · 进行：听 V→I 的「回家」感，再听整条 1645 的每次切换',
        ],
      },
      {
        type: 'callout',
        tone: 'ember',
        title: '耳朵是慢功夫',
        text: '每天 3–5 分钟、10 题一组就够；错的题隔天重听。连对几组别得意，隔一周还能对才算真的会。练完立刻去 Jam 页验证：听得出 V→I，弹的时候就敢在 V 上制造张力。',
      },
      {
        type: 'practice',
        title: '过关标准',
        method: '每天一组，按音程 → 和弦 → 进行顺序推进；不确定就先在脑子里唱根音再判断。',
        goal: '音程 10 题对 7；大三 / 小三 / 属七 10 题对 7；能听出 1645 的每次换和弦。',
      },
      { type: 'relation', text: '去耳朵训练 ——', to: { view: 'ear', label: '去耳朵训练' } },
    ],
  },
  {
    id: 'm-jam',
    title: 'Jam',
    icon: '🎛️',
    what: '跟真实进行伴奏即兴。进行（progression）= 和弦按顺序讲故事：从「家」（I 级）出发、路过别人家（其他级）、最后回家。页内预设都是经典句式：1645 是华语流行的半壁江山，12 小节 blues 是即兴的操场，ii–V–I 是爵士的回家路。',
    why: '会的东西不在音乐里用出来等于没会。Jam 是所有模块的考场：音名帮你找落点，音阶给你词汇，乐句给你句子，耳朵帮你听懂伴奏在说什么。',
    blocks: [
      {
        type: 'chips',
        title: '1645 进行地图（C 大调）',
        items: [
          { label: 'C', sub: 'I · 主 · 家' },
          { label: 'Am', sub: 'vi · 小 · 出走' },
          { label: 'F', sub: 'IV · 下属 · 离家' },
          { label: 'G', sub: 'V · 属 · 想回家' },
        ],
      },
      {
        type: 'steps',
        title: '即兴三步走',
        items: [
          '第一步 · 只弹和弦音：每个和弦换成什么，就只弹它的根·3·5——永远「对」，先建立落点意识',
          '第二步 · 五声自由行：音阶随便走，但句尾一定落回当前和弦的和弦音',
          '第三步 · 乐句 + 留白：塞学过的乐句当「回答」，敢整小节不弹——空间也是音乐',
        ],
      },
      {
        type: 'callout',
        tone: 'brass',
        title: '页内玩法',
        text: '先跟拍数换和弦（听清进行再上手）；per-chord 模式每个和弦换推荐音阶，感受「对味」；转调换 key 检验你是不是真懂了级数。',
      },
      {
        type: 'practice',
        title: '过关标准',
        method: '每次 jam 先空手听 2 遍数和弦，再按三步走弹；录下来回听。',
        goal: '连续即兴 4 小节不冷场不跑调；能用「问句–答句」弹满 8 小节；敢主动留白。',
      },
      { type: 'relation', text: '去 Jam 页开一段进行 ——', to: { view: 'jam', label: '去 Jam' } },
    ],
  },
  {
    id: 'm-licks',
    title: '乐句库',
    icon: '🗣️',
    what: '乐句（lick）= 别人写好的、真实语感的「句子」：一小段有头有尾有味道的旋律，锚定在某个根音某个把位。库里有 20 条，分蓝调 / Funk / 爵士 / 摇滚四风格，每条标了级数、讲了「为什么好听」、给了练法提示，而且能整体平移到 12 个根音——练会一条等于会 12 条。',
    why: '音阶是单词表，乐句是造句示范。只背音阶的人 solo 像背字典；抄过好句的人张口就是人话。',
    blocks: [
      { type: 'diagram', diagram: 'lick-open' },
      {
        type: 'steps',
        title: '乐句 3 步法',
        items: [
          '慢练：60bpm 照谱把音和节奏都弹对（先弹对，再弹快）',
          '提速：每次 +5~10bpm，直到原曲速度还干净',
          '改一改：挪一两个音、换根音、接自己的句子——把它变成你的',
        ],
      },
      {
        type: 'callout',
        tone: 'ember',
        title: '最忌照谱死弹一遍就过',
        text: '每句至少提速一次、转调一次、改一个音——否则它永远是别人的句子。读讲解时盯住：哪些音是和弦音（安全落点）、哪个是风格签名音（蓝调音 / ♭7 / 6 级）。',
      },
      {
        type: 'practice',
        title: '过关标准',
        method: '每天 1 条，从难度 1 开始；学完立刻去 Jam 里当「回答」用掉。',
        goal: '脱谱弹出；移到 3 个根音；能在 jam 里接一句不突兀。',
      },
      { type: 'relation', text: '去乐句库挑一句开始抄 ——', to: { view: 'licks', label: '去乐句库' } },
    ],
  },
]
