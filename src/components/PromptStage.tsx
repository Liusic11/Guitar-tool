/**
 * 出题舞台（上半屏）
 * ─────────────────────────────────────────────
 * 三种任务三种形态：
 *   · find   找位置  —— 给你「弦 + 音名」，在指板点出来
 *   · name   认音名  —— 指板高亮一个位置，你在音名键盘上认出来
 *   · octave 找八度  —— 高亮一个位置并告诉音名，你把它的每个八度都标出来
 * 音名字号刻意做到极大——练习时视线在指板上，余光要能读到题目。
 */

import { memo } from 'react'
import { CountdownRing } from './CountdownRing'
import {
  ACCIDENTAL_PITCH_CLASSES,
  letterOf,
  NATURAL_PITCH_CLASSES,
  pitchClassOf,
  solfegeOf,
  stringNameCN,
  type PitchClass,
  type Question,
} from '../lib/music'
import type { Phase, PracticeMode, Verdict } from '../hooks/useQuizEngine'
import type { LabelMode } from './Fretboard'

interface PromptStageProps {
  phase: Phase
  mode: PracticeMode
  task: 'find' | 'name' | 'octave'
  question: Question | null
  verdict: Verdict
  cycleToken: number
  intervalSec: number
  labelMode: LabelMode
  /** name 模式：用户已选中的音级 */
  pickedNote: PitchClass | null
  /** octave 模式：已标记数 / 正确位置总数 */
  markedCount: number
  targetCount: number
  /** 是否展示升降号键盘 */
  showSharps: boolean
  onStart: () => void
  onReveal: () => void
  onNext: () => void
  onReplay: () => void
  onAnswerNote: (pc: PitchClass) => void
}

/** 把 C# 拆成主字母 + 升号，让升号能做成上标 */
const splitNote = (name: string): [string, string | null] =>
  name.length > 1 ? [name[0], '♯'] : [name, null]

/** 一行音名按钮 */
const NoteKeypad = ({
  pcs,
  picked,
  correctPc,
  revealed,
  onPick,
  labelMode,
}: {
  pcs: PitchClass[]
  picked: PitchClass | null
  correctPc: PitchClass
  revealed: boolean
  onPick: (pc: PitchClass) => void
  labelMode: LabelMode
}) => (
  <div className="keypad" role="group" aria-label="音名键盘">
    {pcs.map((pc) => {
      const [letter, sharp] = splitNote(letterOf(pc))
      const isPicked = picked === pc
      const isCorrect = revealed && pc === correctPc
      const isWrong = revealed && isPicked && pc !== correctPc
      return (
        <button
          key={pc}
          className={`key${isPicked ? ' key--picked' : ''}${isCorrect ? ' key--correct' : ''}${
            isWrong ? ' key--wrong' : ''
          }`}
          onClick={() => onPick(pc)}
          aria-pressed={isPicked}
        >
          <span className="key__letter">
            {letter}
            {sharp && <span className="key__sharp">♯</span>}
          </span>
          {labelMode !== 'letter' && <span className="key__solfege">{solfegeOf(pc)}</span>}
        </button>
      )
    })}
  </div>
)

export const PromptStage = memo(function PromptStage({
  phase,
  mode,
  task,
  question,
  verdict,
  cycleToken,
  intervalSec,
  labelMode,
  pickedNote,
  markedCount,
  targetCount,
  showSharps,
  onStart,
  onReveal,
  onNext,
  onReplay,
  onAnswerNote,
}: PromptStageProps) {
  /* ── 待机：告诉用户这是什么、怎么开始 ── */
  if (phase === 'idle' || !question) {
    return (
      <div className="empty">
        <p className="prompt__eyebrow">指板音记忆训练</p>
        <h1 className="empty__title">
          先听见那个音，
          <br />
          再想起它住在哪一品。
        </h1>
        <p className="empty__text">
          三种练法随便切：<b>找位置</b> 给音名你点位置；<b>认音名</b> 高亮一个位置你说出音；
          <b>找八度</b> 把同一个音在指板上的每个位置都标出来。智能抽题会优先把你最不熟的地方反复练。
        </p>
        <button className="btn btn--primary btn--lg" onClick={onStart}>
          开始练习
        </button>
        <div className="empty__hints">
          <span className="empty__hint">
            <kbd>空格</kbd> 揭示 / 下一题
          </span>
          <span className="empty__hint">
            <kbd>R</kbd> 重听
          </span>
          <span className="empty__hint">
            <kbd>F</kbd>/<kbd>N</kbd>/<kbd>O</kbd> 切换任务
          </span>
          <span className="empty__hint">悬停指板可查看任意音名</span>
        </div>
      </div>
    )
  }

  const pc = question.pitchClass
  const [letter, sharp] = splitNote(letterOf(pc))
  const revealed = phase === 'revealed'
  const showSolfege = labelMode !== 'letter'
  const posLabel = `${stringNameCN(question.string)} ${question.fret} 品`

  /* ───────────── name：认音名 ───────────── */
  if (task === 'name') {
    return (
      <div className="prompt">
        <p className="prompt__eyebrow">认音名</p>
        <div className="prompt__body" key={question.id}>
          <span className="prompt__string">{posLabel}</span>
          <span className="prompt__hint-sm">这个位置弹的是什么音？</span>
        </div>

        <NoteKeypad
          pcs={NATURAL_PITCH_CLASSES}
          picked={pickedNote}
          correctPc={pc}
          revealed={revealed}
          onPick={onAnswerNote}
          labelMode={labelMode}
        />
        {showSharps && (
          <NoteKeypad
            pcs={ACCIDENTAL_PITCH_CLASSES}
            picked={pickedNote}
            correctPc={pc}
            revealed={revealed}
            onPick={onAnswerNote}
            labelMode={labelMode}
          />
        )}

        {revealed && (
          <div className={`reveal${verdict === 'miss' ? ' reveal--miss' : ''}`}>
            <span>{verdict === 'hit' ? '答对' : '再看一眼'}</span>
            <span className="reveal__pos">
              {letter}
              {sharp}
              {showSolfege ? ` · ${solfegeOf(pc)}` : ''}
            </span>
          </div>
        )}

        {!revealed && (
          <div className="row" style={{ marginTop: '0.3rem' }}>
            <button className="btn btn--ghost" onClick={onReplay} title="重听（R）">
              ♪ 重听
            </button>
            <button className="btn" onClick={onReveal}>
              揭示答案
            </button>
          </div>
        )}
        {revealed && (
          <div className="row" style={{ marginTop: '0.3rem' }}>
            <button className="btn btn--ghost" onClick={onReplay} title="重听（R）">
              ♪ 重听
            </button>
            {mode === 'manual' ? (
              <button className="btn btn--primary" onClick={onNext}>
                下一题 →
              </button>
            ) : (
              <button className="btn btn--ghost" onClick={onNext}>
                跳过等待 →
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ───────────── octave：找八度 ───────────── */
  if (task === 'octave') {
    return (
      <div className="prompt">
        <p className="prompt__eyebrow">找八度</p>
        <div className="prompt__body" key={question.id}>
          <span className="prompt__string">{posLabel}</span>
          <span className="prompt__note">
            {letter}
            {sharp && <span className="prompt__accidental">{sharp}</span>}
          </span>
          {showSolfege && <span className="prompt__solfege">{solfegeOf(pc)}</span>}
          <span className="prompt__hint-sm">在指板上标出它的每一个位置</span>
        </div>

        {!revealed && (
          <>
            {mode === 'auto' && <CountdownRing duration={intervalSec} token={cycleToken} />}
            <div className="octave-progress" aria-live="polite">
              <span className="octave-progress__count">
                {markedCount}
                <span className="octave-progress__sep"> / {targetCount}</span>
              </span>
              <span className="octave-progress__label">已标记</span>
            </div>
            <div className="row" style={{ marginTop: '0.3rem' }}>
              <button className="btn btn--ghost" onClick={onReplay} title="重听（R）">
                ♪ 重听
              </button>
              <button className="btn" onClick={onReveal}>
                确认{markedCount > 0 ? `（${markedCount}/${targetCount}）` : ''}
              </button>
            </div>
          </>
        )}

        {revealed && (
          <>
            <div className={`reveal${verdict === 'miss' ? ' reveal--miss' : ''}`}>
              <span>{verdict === 'hit' ? '全中' : verdict === 'miss' ? '差一点' : '在这里'}</span>
              <span className="reveal__pos">共 {targetCount} 个位置</span>
            </div>
            <div className="row" style={{ marginTop: '0.3rem' }}>
              <button className="btn btn--ghost" onClick={onReplay} title="重听（R）">
                ♪ 重听
              </button>
              {mode === 'manual' ? (
                <button className="btn btn--primary" onClick={onNext}>
                  下一题 →
                </button>
              ) : (
                <button className="btn btn--ghost" onClick={onNext}>
                  跳过等待 →
                </button>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  /* ───────────── find：找位置（原逻辑）───────────── */
  const revealed2 = revealed
  return (
    <div className="prompt">
      <p className="prompt__eyebrow">
        {revealed2 ? '答案' : mode === 'auto' ? '自动出题' : '找到它'}
      </p>

      <div className="prompt__body" key={question.id}>
        <span className="prompt__string">{stringNameCN(question.string)}</span>

        <span className="prompt__note">
          {letter}
          {sharp && <span className="prompt__accidental">{sharp}</span>}
        </span>

        {showSolfege && <span className="prompt__solfege">{solfegeOf(pc)}</span>}

        <span className="prompt__shorthand">{question.string}-{letterOf(pc)}</span>
      </div>

      {revealed2 && (
        <div className={`reveal${verdict === 'miss' ? ' reveal--miss' : ''}`}>
          <span>{verdict === 'hit' ? '答对' : verdict === 'miss' ? '再看一眼' : '在这里'}</span>
          <span className="reveal__pos">{question.answers.map((f) => `${f} 品`).join(' · ')}</span>
        </div>
      )}

      {!revealed2 && mode === 'auto' && (
        <CountdownRing duration={intervalSec} token={cycleToken} />
      )}

      <div className="row" style={{ marginTop: '0.35rem' }}>
        <button className="btn btn--ghost" onClick={onReplay} title="重听这个音（R）">
          ♪ 重听
        </button>
        {mode === 'manual' &&
          (revealed2 ? (
            <button className="btn btn--primary" onClick={onNext}>
              下一题 →
            </button>
          ) : (
            <button className="btn" onClick={onReveal}>
              揭示答案
            </button>
          ))}
        {mode === 'auto' && revealed2 && (
          <button className="btn btn--ghost" onClick={onNext}>
            跳过等待 →
          </button>
        )}
      </div>
    </div>
  )
})

/** 把 pitch class 渲染成带唱名的完整称呼，无障碍播报用 */
export const spokenNoteName = (pc: number): string =>
  `${letterOf(pitchClassOf(pc))} ${solfegeOf(pitchClassOf(pc))}`
