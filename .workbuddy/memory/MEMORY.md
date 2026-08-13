# Fretboard Atlas 项目约定（前端吉他训练器）

## 设备与基准
- 练琴屏：1920×1080 / 16:9（1K）。开发屏（2240×1400、2560×1440）不用于练琴，布局不以开发屏为妥协基准。
- 用户目标风格：funk / blues / jazz / rock + jam。
- 用户当前水平（2026-08-11 多次自述修正）：非新手——已掌握前三品开放和弦、推揉(vibrato/bend)等技巧，能跟 tab/视频弹下 November Rain 等歌，现练 Santana《Europa》。自认节奏偏弱。核心诉求不是「从零识记」，而是：懂音乐「为什么」（乐理贯通）→ 内化成自己的语汇 → 最终能 jam、能创作。反感「搜谱子→弹一首」的浅层循环。目标风格 funk/blues/jazz/rock+jam。

## 设计铁律（用户明确）
1. 所有页面一页平铺，不滚动、不上下翻（1080p 全屏下两栏撑满视口高度，无底部空洞）。
2. 基准屏 1920×1080；响应式断点以全屏双栏为优先，不为开发屏降级。
3. 涉及吉他指板的内容（Fretboard、和弦图、音阶形状卡）必须相对较大、直观。
4. 乐理与练习设计必须参考真实音乐/乐理教学法（CAGED、五声 5 形状 E-D-C-A-G、调式 7 位置等），不自创体系。

## 补充约定（助理补充，已与用户方向一致）
5. 模块间共享「当前根音/调」上下文，切换和弦↔音阶不丢状态。（已实现：`src/lib/session.ts` 用 useSyncExternalStore + localStorage 共享 rootPc/scaleId/chordTypeId，并提供跨模块「跳过去」导航；和弦页与音阶页均从 store 初始化并双向同步根音）
6. 统一视觉符号：根音恒为同一颜色（橙 #BA7517），音级标注跨指板/和弦图/形状卡一致。
7. 参考与练习分离：解释/理论永远无评判、可随时看；出题/跟弹等练习为可选增强（和弦模块明确不要出题模式）。
8. 所有乐理必须锚定真实曲例（歌曲/riff），不用空泛术语堆砌。
9. 节奏器（RhythmBar）作为练习底座，练习交互应能跟拍；节奏已嵌入和弦/音阶页底部，非独立页。
10. 渲染清晰硬约束：系统黑体 + subpixel-antialiased，浅色背景上杜绝模糊（曾因全局 -webkit-font-smoothing:antialiased 发虚，改回 subpixel）。

## 前端设计语言（视觉系统，务必对齐）
目标：用户要「尽可能对齐、美观」——任何新增页面/组件都要复用这套语言，不要另起炉灶。

### 美学方向：复古制琴工坊（Vintage Luthier Workshop）
暖纸质地 · 玫瑰木 · 黄铜与镍银金属 · 炭火红点缀。质感优先，拒绝纯白/纯灰平铺。

### 设计令牌（src/index.css `@layer tokens`）
- **纸张/墨色**：`--paper` / `--paper-2` / `--paper-3` / `--paper-sunk` 四层纸感；`--ink` / `--ink-2` / `--ink-3` / `--ink-4` 四级文字灰。
- **木材**：`--rose`(深玫瑰木主色) / `--rose-hi` / `--rose-lo` / `--maple`(枫木亮) / `--bone`(骨白)。
- **金属**：`--nickel*`(镍银) / `--brass` / `--brass-lo`(黄铜)。
- **语义色**：`--ember`(炭火红，主 CTA / 强调 / 根音橙=oklch(55% 0.165 34))、 `--ember-soft`、`--ember-wash`(浅洗)、`--sage`(辅助绿)、`--clay`(砖红)。
- **字体栈**：`--font-display: 'Fraunces', 'Songti SC', serif`（标题/品牌，可变轴带 WONK 歪一点）；`--font-ui: 'Outfit', 'PingFang SC', 'Microsoft YaHei', system-ui`（正文）；`--font-mono: 'DM Mono', ui-monospace`（组成音/度数等代号）。
- **间距节奏**（非等比，制造呼吸感）：`--s-1`..`--s-7`；圆角 `--radius-sm/--radius/--radius-lg`；缓动用 expo/quart 曲线变量。

### 排版与渲染硬约束
- 正文 ≥16px（0.95–1.05rem 起）；标题用 display 字体做戏剧化字号跳跃。
- **清晰度铁律**：全局 `body` 用 `subpixel-antialiased` + `text-rendering:auto`，浅色背景上禁用 `antialiased`（曾发虚）；乐理/指板图 SVG 用 `crispEdges` + `font-weight:700`。
- 绝不纯白/纯灰背景；用 `--paper` 渐变 + 极细噪点 SVG 营造纵深。
- **React hooks 铁律**：组件内不要写 `if (mode === 'x') return <Other/>` 这种位于 `useMemo`/`useEffect` 等 hook **之前**的 early return——不同分支 hook 数量不一致会触发 `Rendered fewer hooks than expected`、整页白屏（无错误边界时连顶栏都消失）。多模式共用组件（如 `ChordLibrary`）应**无条件调用全部 hook**，再在 `return` 处用三元 `mode==='x' ? <A/> : <B/>` 分支；或把子模式拆成独立子组件自带 hook。
- **空白页诊断法**：遇到「某页空白」别先猜旧 bundle，用 `puppeteer-core`（项目已装）+ 系统 Chrome（如 `C:/Program Files/Google/Chrome/Application/chrome.exe`）跑无头脚本，导航到该页抓 `pageerror`/`console`——React 崩溃会打印 `Rendered fewer hooks` 或具体组件名。受管 node 跑：`NODE_PATH=<项目>/node_modules <受管node> probe.cjs`。
- **缩放适配铁律**：大图/和弦图等**不要**用锁死的视口单位（如 `width: clamp(300px,32vw,440px)`）来定尺寸——27寸 1080p 的 PPI≈82 很低，Windows 会把「显示缩放」自动设 125%~150%，把逻辑视口从 1920 压到 1536~1280（高 864~720），锁 vw 的大图在变窄/变矮的逻辑视口里会相对过大、贴边甚至顶破卡片。正确做法：把大图包一层 `flex:1 1 auto; min-height:140px` 的 wrap，SVG 用 `width:100%; height:100%; max-width:NNNpx; max-height:100%` + viewBox/preserveAspectRatio meet 占据卡片**剩余空间**，矮屏下自动成比例缩小、不顶破、不塌缩。诊断用 puppeteer 模拟 100/125/150/200% 逻辑视口（viewport 1920/1536/1280/960 × 1080/864/720/540）实测 overflow/顶破。

### 布局原则
- 单页平铺、两栏撑满视口（`.app` = `grid-template-rows: auto / 1fr / auto`；`height:100dvh`）。
- 内容区 `.module-scroll` → `.chord-panel/.scale-panel`（flex column，`flex:1`）→ `.chord-layout/.scale-layout`（grid，`stretch` + `min-height:0`），形成垂直撑满链，无底部空洞。
- 双栏优先级断点统一 **1024px**（1080p 必走双栏）；次级断点 1180 / 860 / 720 / 680。
- 指板相关（Fretboard/和弦图/形状卡）占左大栏，介绍/乐理占右小栏（音阶页 `2.2fr / 0.95fr`）。

### 组件模式（复用，勿重写）
- **分段控制器 `.segmented`**：内联 flex、3px padding、`--paper-sunk` 底 + 内阴影；`.segmented__item` 选中态 `aria-pressed=true` → `--ink` 底 `--paper` 字；`white-space:nowrap`；需要换行时加 `.segmented--wrap`。
- **控制字段 `.field`**：label 在上、控件在下（`flex-direction:column`）；同组字段 label 顶部对齐。
- **顶部控制栏三列单行**（音阶页 `.scale-controls` 范本）：`grid-template-columns: auto 1fr auto` = 根音 | 音阶类型 | 练习方式；每列 `.segmented` 强制 `nowrap`；音阶 chip 最多，统一缩小 padding(`0.35rem 0.55rem`)/字号(`0.78rem`)。
- **底部节奏条 `.rhythm-bar`**：静态 `flex-shrink:0`（非 sticky 覆盖）；左控制区自适应、右 16 步条 `clamp(120px,18vw,220px)`。
- **设置抽屉 `.drawer`**：宽度应足够容纳内容，不出现底部横向滚动条；当前 `min(520px, 95vw)`。
- **节奏预设共享**：`src/lib/rhythmStore.ts` 存全局 `bpm/presetId`；任何带节拍器的练习模块（RhythmBar、ScaleTrainer、ChordChanges）都应读取同一 preset，保持律动一致。
- **乐理卡（老师口吻）**：右侧 `.scale-theory` / `.chord-theory`，小字号多档、内边距收紧、底部用 `margin-top:auto` 沉底，无溢出。

### 可访问性 / 动效
- 所有交互元素 `:focus-visible` 有 `2px --ember` 焦点环；语义化 `main/section/aside`。
- 尊重 `prefers-reduced-motion`（全局 transition/duration 压到 0.01ms）。

## 已完成模块
- 指板音名训练（SRS 出题）：✅
- 和弦参考浏览器（9 类和弦 + 竖框和弦图 + 把位切换 + 试听 + 乐理）：✅
- 音阶训练器（CAGED 5 形状 / 七声 7 位置，按琴颈从 0 品升序；跟弹/听音/地图/模进；演示）：✅
- 节奏条 RhythmBar（嵌入和弦/音阶页底部）：✅
- 模进训练（Patterns）：在音阶页加「模进」练习方式——3 音一组 / 八度跳 / 琶音 / 锚定 CAGED 的 blues lick，跟弹 + 演示：✅
- 乐理贯通层（WHY）：✅ 新增 `src/lib/harmony.ts`（和弦→音阶映射、音阶→顺阶和弦/进行，全确定性规则，参考真实教学法不自创）+ `src/lib/session.ts`（共享根音/调上下文与跨模块导航）。和弦页右栏 `ChordConnection` 告诉你「这和弦上弹什么音阶、为什么」并可一键跳音阶页；音阶页右栏 `ScaleConnection` 告诉你「这音阶含哪些顺阶和弦、常见进行为什么成立」并可一键跳和弦页。
- 和弦切换训练（Chord Changes）：✅ 在和弦页加「切换训练」模式——计时换把。可锁把位（E形/A形/D形/开放/不限）逼定位；按 BPM 节拍每 N 拍切换，重音提示换把点，空格/按钮记「已就位」并统计卡拍率；右栏复用 `ChordConnection` 实时标出当前和弦所属音阶（把 WHY 焊进练习）。复用和弦库 + audioEngine 节拍器，自带底部传输条。

## 待建（方向：确定性、规则可算的练习，不做 LLM agent / 自动拆歌等「智能过头」功能）
- 和弦识记训练（主动回忆和弦形状）——优先级下调：用户已会开放和弦，此模块非刚需。
- 节奏律动训练深化（把 RhythmBar 升级为可练：扫弦型、节奏模仿/跟奏）——待定，用户自认节奏弱，仍可考虑。
- ~~乐理贯通层（WHY）：已在 2026-08-11 完成（harmony.ts + session.ts + 两页贯通面板）~~
- ~~模进训练（Patterns）：已在 2026-08-11 完成~~
- ~~歌曲拆解 / Song Workout（自动拆歌为智能过头功能，已砍）~~
- 耳朵训练独立模块、Jam 伴侣、练习路线/打卡页（更后期）

## 范围红线（用户 2026-08-11 明确）
- 工具是确定性练习器，不是 agent；不做需要实时调用 LLM 的智能拆歌 / 自适应教学。
