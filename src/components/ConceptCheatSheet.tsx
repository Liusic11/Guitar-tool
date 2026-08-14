/**
 * 概念小抄（老师口吻的术语表）
 * ─────────────────────────────────────────────
 * 用户乐理基础偏弱，右侧「老师口吻」内容里反复出现一堆黑话
 * （三度叠置、顺阶和弦、调式、II–V–I、属七解决、五声 / 蓝调音、groove…）。
 * 这个小组件把最常见的术语用大白话讲一遍，常驻在和弦 / 音阶 / 耳朵页右侧，
 * 随时可查——相当于随身带一张「老师写的概念便利贴」。
 *
 * 内容全部是确定性的标准乐理，不调用 LLM、不猜测；以真实用法 / 曲例锚定。
 */

type GroupId = 'basic' | 'chord' | 'scale' | 'rhythm'

interface Concept {
  term: string
  plain: string
}

interface Group {
  id: GroupId
  title: string
  items: Concept[]
}

const GROUPS: Group[] = [
  {
    id: 'basic',
    title: '基础 · 先搞懂这几个词',
    items: [
      {
        term: '音级 / 级数',
        plain:
          '把一条音阶里的音从根音开始数 1、2、3… 就叫「音级」。乐理里说「♭3」「♭7」「5 级」，都是在数音级——它是描述音阶和和弦的通用坐标。',
      },
      {
        term: '音程',
        plain:
          '两个音之间的距离，用「半音个数」算。吉他手最常听的是：纯八度(12 半音，同音高低差)、纯五度(7)、纯四度(5)、大三度(4，亮)、小三度(3，暗)。先记住这五个的「感觉」，比背数字有用。',
      },
      {
        term: '三度叠置',
        plain:
          '和弦不是随便挑的音，而是从根音「隔一个音叠一个音」建出来的：根→三音→五音→七音……叠两层是三和弦(根·3·5)，叠三层是七和弦(根·3·5·7)。这是所有和弦的出生方式。',
      },
      {
        term: '根音 · 三音 · 五音',
        plain:
          '和弦的骨架三颗音：根音决定「这是哪个和弦」；三音决定「大还是小(亮还是暗)」——只差这半音；五音决定「稳不稳」。听和弦先抓这三颗。',
      },
    ],
  },
  {
    id: 'chord',
    title: '和弦 · 为什么进行「顺」',
    items: [
      {
        term: '顺阶和弦',
        plain:
          '在一个音阶里，只从「音阶内的音」叠三度得到的和弦，就叫作这个调的「顺阶和弦」。它们是这个调里天然的一家人，所以随便怎么连听起来都顺——流行歌的进行几乎都来自这里。',
      },
      {
        term: '属七 (V7) 与解决',
        plain:
          '属七和弦(如 G7)里那个 ♭7 音特别「想走」，最想回到主和弦(如 C)。「V→I」是音乐里最经典的「提问→回答」，你听到的「紧张→落地」多半就是它。blues/funk 的发动机。',
      },
      {
        term: 'II–V–I',
        plain:
          'jazz 最经典的「回家路」：ii(小七，制造一点悬) → V(属七，拉满张力) → I(主和弦，落地)。练会它就懂了什么叫「紧张→解决」，也是 jam 时最不会错的保险走法。',
      },
      {
        term: '可移动横按把位',
        plain:
          '吉他上很多和弦是「同一块手指形状」沿琴颈平移换调的(比如 E 形横按)。记住形状、平移根音，比死记每个和弦的指法轻松得多——这就是「横按和弦」的妙处。',
      },
    ],
  },
  {
    id: 'scale',
    title: '音阶 / 调式 · 味道从哪来',
    items: [
      {
        term: '关系大小调',
        plain:
          '大调和小调常常共用同一套音(C 大调 = A 小调)，只是把哪个音当「家」不同。所以 A 小调五声和 C 大调五声是同一堆音——你练熟小调五声，换根音就有大调五声可用。',
      },
      {
        term: '五声音阶',
        plain:
          '只留 5 个音(把最刺的 4 级、7 级拿掉)，所以怎么弹都不太难听，是吉他手的第一把钥匙。rock / blues / pop 的 solo 主粮。',
      },
      {
        term: '蓝调音 (♭5)',
        plain:
          '在小调五声里多塞一个「不在调内」的音(比纯五度低半音)，听感「悬、幽怨、带哭腔」。它是 blues 的魂，也是 jazz 爱玩的「外围音」。',
      },
      {
        term: '调式 = 换个起点',
        plain:
          '同一条大调音阶，从不同的音开始数，就得到不同的「调式」(Dorian / Mixolydian / Lydian…)。音还是那几个，但「家」变了，味道就变了——本质就是挪一下起点。',
      },
      {
        term: '把位与形状',
        plain:
          '吉他上音阶被切成几个「把位 / 形状」，整块沿琴颈平移就能换调。吃透形状，指板在你眼里就是一组能平移的图形，而不是散点。',
      },
    ],
  },
  {
    id: 'rhythm',
    title: '节奏 · groove 是什么',
    items: [
      {
        term: 'Groove / 律动',
        plain:
          '不只是「快慢(BPM)」，更是鼓各件怎么分布：底鼓踩哪、军鼓打哪、踩镲多密。同一拍速，funk 和 bossa 是两种性格——groove 决定一段音乐的「身体」。',
      },
      {
        term: '反拍 / 切分',
        plain:
          '不踩在正拍上，而是落在两拍之间(反拍)，制造「摇摆 / 放克」的弹性。雷鬼故意不踩第 1 拍，funk 把重音甩到反拍——这就是「律动感」的来源。',
      },
      {
        term: 'Swing / 摇摆',
        plain:
          '把规整的 8 分音符「拉长前一个、缩短后一个」，像「哒—嗒 哒—嗒」而不是「哒哒哒哒」。jazz / blues 的招牌弹性，听着就「摇」起来了。',
      },
    ],
  },
]

interface ConceptCheatSheetProps {
  /** 只显示指定分组；不传则显示全部 */
  filter?: GroupId[]
  /** 卡片标题，默认「概念小抄」 */
  title?: string
  /** 副标题（一句话说明用途） */
  subtitle?: string
}

export function ConceptCheatSheet({ filter, title = '概念小抄', subtitle }: ConceptCheatSheetProps) {
  const groups = filter ? GROUPS.filter((g) => filter.includes(g.id)) : GROUPS

  return (
    <section className="concept-sheet" aria-label={title}>
      <div className="concept-sheet__head">
        <h4 className="concept-sheet__title">📌 {title}</h4>
        {subtitle && <p className="concept-sheet__subtitle">{subtitle}</p>}
      </div>

      {groups.map((g) => (
        <div key={g.id} className="concept-sheet__group">
          <h5 className="concept-sheet__group-title">{g.title}</h5>
          <dl className="concept-sheet__list">
            {g.items.map((c) => (
              <div key={c.term} className="concept-sheet__item">
                <dt className="concept-sheet__term">{c.term}</dt>
                <dd className="concept-sheet__p">{c.plain}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  )
}
