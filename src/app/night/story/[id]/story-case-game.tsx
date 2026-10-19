'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { Clue, StoryCaseState } from '@/lib/night/types';
import { playStoryCase } from '../../actions';

function Artifact({ clue, index }: { clue: Clue; index: number }) {
  return <article className={`afterstory-clue artifact-${clue.kind}`}><header><span>EXHIBIT {String(index + 1).padStart(2, '0')}</span><time>{clue.time}</time></header><div className="afterstory-clue-label">{clue.label}</div>{clue.kind === 'message' ? <div className="afterstory-chat">{clue.text.split('\n').filter(Boolean).map((line, i) => <p className={i % 2 ? 'reply' : ''} key={i}>{line}</p>)}</div> : <p className="afterstory-clue-text">{clue.text}</p>}<footer>RECOVERED FROM THE STORY <span>↗</span></footer></article>;
}

export function StoryCaseGame({ initial }: { initial: StoryCaseState }) {
  const [state, setState] = useState(initial);
  const [active, setActive] = useState(Math.max(0, initial.revealed - 1));
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('');
  const [confirmGiveup, setConfirmGiveup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  function move(action: 'reveal' | 'guess' | 'giveup') {
    setMessage('');
    startTransition(async () => {
      const result = await playStoryCase(state.storyId, action, guess);
      if (result.error) { setMessage(result.error); return; }
      if (result.state) { setState(result.state); setActive(result.state.revealed - 1); if (action === 'guess') setGuess(''); }
      setMessage(result.message || ''); setConfirmGiveup(false);
    });
  }
  async function share() {
    try { await navigator.clipboard.writeText(`${state.title}\nA mystery inspired by @${state.author}'s story. Can you find the spot?\n${window.location.href}`); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { setMessage('Copy failed. Share the address in your browser.'); }
  }
  const potential = state.solved ? state.score : Math.max(100, 1000 - (state.revealed - 1) * 200 - state.wrong * 100);
  return <main className="afterstory-page">
    <section className="afterstory-hero"><div className="afterstory-origin"><span>COMMUNITY CASE / STORY → GAME</span><p>INSPIRED BY <b>@{state.author}</b></p></div><h1>{state.title}</h1><p className="afterstory-brief">{state.brief}</p><div className="afterstory-source"><span>THE ORIGINAL ALIBI</span><blockquote>“{state.storyTitle}”</blockquote><Link href="/#stories">Read it after you solve →</Link></div><div className="afterstory-scroll">FOLLOW THE PAPER TRAIL ↓</div></section>
    <section className="afterstory-workspace"><div className="afterstory-evidence"><div className="afterstory-tabs" role="tablist" aria-label="Story evidence">{Array.from({ length: 4 }, (_, i) => <button key={i} role="tab" aria-selected={active === i} disabled={i >= state.clues.length} onClick={() => setActive(i)}>{i >= state.clues.length ? 'LOCKED' : `0${i + 1}`}</button>)}</div><Artifact clue={state.clues[active]} index={active}/><p className="fiction-note">Built from a player’s fictional reconstruction. One real NYC answer.</p></div>
      <aside className="afterstory-deduction">{state.finished ? <div className="afterstory-result"><span>{state.solved ? 'STORY SOLVED' : 'ENDING REVEALED'}</span><p>THE NIGHT ENDED AT</p><h2>{state.answer}</h2><p>{state.explanation}</p><div className="afterstory-score"><strong>{state.score}</strong><small>COMMUNITY<br/>CASE POINTS</small></div><button className="primary-button" onClick={share}>{copied ? 'Case link copied ✓' : 'Challenge someone →'}</button><Link className="text-button" href="/#stories">Back to the story room</Link></div> : <><div className="afterstory-points"><span>POINTS STILL ON THE TABLE</span><strong>{potential}</strong><small>PTS</small></div><form onSubmit={event => { event.preventDefault(); move('guess'); }}><label htmlFor="story-case-guess">Where did this story happen?</label><div><span>⌖</span><input id="story-case-guess" value={guess} onChange={event => setGuess(event.target.value)} maxLength={120} autoComplete="off" required disabled={pending} placeholder="Name the NYC spot…"/></div><button className="primary-button" disabled={pending || !guess.trim()}>{pending ? 'Checking the story…' : 'Lock in my guess'} <span>→</span></button></form><div className="afterstory-attempts"><span>{3 - state.wrong} GUESSES LEFT</span><span>{state.revealed}/4 CLUES OPEN</span></div><button className="afterstory-reveal" disabled={pending || state.revealed >= 4} onClick={() => move('reveal')}>{state.revealed >= 4 ? 'All evidence is open' : 'Open the next exhibit · −200'}</button>{confirmGiveup ? <div className="afterstory-giveup"><p>Reveal the ending for 0 points?</p><button onClick={() => move('giveup')}>Reveal it</button><button onClick={() => setConfirmGiveup(false)}>Keep looking</button></div> : <button className="afterstory-giveup-link" onClick={() => setConfirmGiveup(true)}>I need the ending.</button>}</>}<p className="action-feedback" role="status">{message}</p></aside>
    </section>
    <section className="afterstory-loop"><span>THE STORY DOESN’T END. IT BECOMES THE NEXT CASE.</span><h2>Solve it. Write it.<br/><em>Pass it on.</em></h2><Link className="primary-button" href="/">Play tonight’s original →</Link></section>
  </main>;
}
