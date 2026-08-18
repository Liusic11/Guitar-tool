/**
 * 说明书内容（tutorials）
 * ─────────────────────────────────────────────
 * 树状结构、由上至下拆解：每个节点是一句话「是什么」，
 * 术语节点带 plain 字段 = 点开看大白话解释（复用概念小抄的口吻）。
 * 先做 Jam，其他模块以后各自挂一份。
 */

export interface TutorialNode {
  id: string
  /** 节点标题（一句话） */
  label: string
  /** 术语的大白话解释；有值则可点开展开 */
  plain?: string
  children?: TutorialNode[]
}

export interface TutorialTree {
  id: string
  title: string
  subtitle: string
  roots: TutorialNode[]
}

export const JAM_TUTORIAL: TutorialTree = {
  id: 'jam',
  title: 'Jam 说明书',
  subtitle: 'Jam = 跟着鼓点，在和弦进行上弹「对」的音。看不懂的先点开，每个词都能展开。',
  roots: [
    {
      id: 'music-view',
      label: '【乐理视角】Jam 到底在干什么',
      children: [
        {
          id: 'progression',
          label: '① 进行：和弦的路线图',
          children: [
            {
              id: 'chord',
              label: '和弦 = 同时响的几个音',
              plain:
                '按一个和弦，就是同时弹响几个音。C 和弦 = C、E、G 三个音一起响（会按就行，先不用管为什么是这三个）。',
            },
            {
              id: 'degree',
              label: '级数 I / vi / IV / V = 这个调里第几个「家」',
              plain:
                '把音阶的音从 1 数到 7，每个音上能搭一个和弦，叫 1 级、2 级……在 C 大调里：1 级=C、6 级=Am、4 级=F、5 级=G。所以「1645」就是按第 1、6、4、5 个家一路走。',
            },
            {
              id: 'why-smooth',
              label: '为什么顺 = 顺阶和弦（一家人）',
              plain:
                '同一调里的和弦都只用自己的音（C 大调的 7 个音），所以怎么连都「顺」。换个调（比如 G 大调），级数还叫 1645，但具体和弦全变了——所以乐手都记级数不记死和弦。',
            },
          ],
        },
        {
          id: 'rhythm',
          label: '② 节奏：鼓点',
          children: [
            {
              id: 'bpm',
              label: 'BPM = 快慢',
              plain: '每分钟多少拍。60 = 一秒一拍，120 = 一秒两拍。慢练永远没错。',
            },
            {
              id: 'groove',
              label: 'Groove = 鼓的性格',
              plain:
                '同一速度下，鼓怎么打（底鼓踩哪、军鼓打哪）决定了音乐是 funk、bossa 还是摇滚。Jam 页底部可换鼓型。',
            },
            {
              id: 'follow',
              label: '跟拍 = 落在拍子上',
              plain: '弹的音要对上鼓点。先求「对得上」，再求「好听」。',
            },
          ],
        },
        {
          id: 'notes',
          label: '③ 弹什么音：音阶',
          children: [
            {
              id: 'scale',
              label: '音阶 = 一堆「合法音」',
              plain:
                '一段音乐里能用的音集合。1645 在 C 大调，整段的合法音就是 C 大调音阶（或它更安全的五声版）。指板高亮的就是这些合法音——点哪个都不「错」。',
            },
            {
              id: 'pent',
              label: '五声 = 最不容易难听',
              plain:
                '7 个合法音里拿掉 2 个「刺头」（4 和 7），剩 5 个，怎么乱点都不刺耳。吉他手第一把钥匙。',
            },
            {
              id: 'target',
              label: '落点 = 句尾落在和弦音上',
              plain:
                '即兴的秘密不在「用哪些音」，在「停在哪」。句尾落回当前和弦的 1 3 5（尤其 1 或 3），前面怎么晃都像音乐。参谋就是帮你标出这些落点。',
            },
          ],
        },
        {
          id: 'licks',
          label: '④ 怎么弹：乐句',
          children: [
            {
              id: 'lick',
              label: '乐句 = 别人排好队的合法音',
              plain:
                '一条短旋律：音怎么走、节奏怎么摆、最后落在哪，都是安排好的。你随机找音是「自己排」，抄乐句是「抄作业」——抄多了自己就会排了。',
            },
            {
              id: 'lick-shape',
              label: '乐句和位置无关 = 形状可平移',
              plain:
                '同一句换个调，就是把整个手型沿指板平移几品。这就是为什么乐句页教你「形状」而不是「死位置」。',
            },
          ],
        },
      ],
    },
    {
      id: 'ui-view',
      label: '【界面视角】页面分区走一遍',
      children: [
        {
          id: 'ui-top',
          label: '顶部：选进行 + 音阶模式',
          plain:
            '「进行」= 换一套和弦路线（1645、12 小节蓝调…）。「音阶模式」先只用「全局父音阶」（整段一个音阶），「每和弦换音阶」是进阶玩法，先不管。',
        },
        {
          id: 'ui-timeline',
          label: '中间时间轴：每格一个和弦',
          plain: '点鼓开始后，鼓点推着高亮一格一格走，走到哪个和弦就弹哪个。也可直接点某一格跳过去。',
        },
        {
          id: 'ui-fret',
          label: '指板：两个视图',
          plain:
            '「和弦形状」= 当前和弦手怎么放；「音阶音」= 当前能用的合法音全点亮。参谋开起来后，音阶音会精选成「落点 + 逼近音」。',
        },
        {
          id: 'ui-side',
          label: '右侧：为什么 + 参谋 + 乐句',
          plain:
            '「为什么」告诉你这条进行怎么来的、该用什么音阶；「参谋」告诉你现在具体往哪落；「乐句」是能直接抄的成品。',
        },
        {
          id: 'ui-bottom',
          label: '底部：鼓 / 速度 / backing / 扫弦型 / 预备拍',
          plain:
            '鼓型与 BPM 在这里调。「backing」开 = 程序自动帮你扫和弦当伴奏（合上眼只弹旋律），关 = 只听鼓。「扫弦型」= 换一种扫法当基础节奏（选定后自动开 backing）。「预备拍」= 开始前先空一小节 count-in，方便你开内录。',
        },
      ],
    },
  ],
}
