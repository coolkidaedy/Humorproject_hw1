'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { Clue, Community, NightState, Story } from '@/lib/night/types';
import { deductionScore, newYorkDay, validStory } from '@/lib/night/rules';
import { generateNewPracticeCase, generateNightReconstruction, playNight, prepareStoryCase, refreshCommunity, submitNightStory, voteNightStory } from './actions';

type SymbolName = 'arrow' | 'pin' | 'lock' | 'star' | 'check' | 'clock';
function Symbol({ name, size = 20 }: { name: SymbolName; size?: number }) {
  const paths = { arrow: 'M4 12h16m-6-6 6 6-6 6', pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0', lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4', star: 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z', check: 'm4 12 5 5L20 6', clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function Countdown() {
  const [remaining, setRemaining] = useState('—:—:—');
  useEffect(() => {
    const tick = () => {
      const now = Date.now(), today = newYorkDay(new Date(now));
      let low = now, high = now + 27 * 3600000;
      while (high - low > 1000) { const middle = Math.floor((high + low) / 2); if (newYorkDay(new Date(middle)) === today) low = middle; else high = middle; }
      const total = Math.max(0, Math.floor((high - now) / 1000));
      setRemaining([Math.floor(total / 3600), Math.floor(total % 3600 / 60), total % 60].map(n => String(n).padStart(2, '0')).join(':'));
    };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, []);
  return <span className="countdown">{remaining}</span>;
}
function CityMap() {
  return <svg className="city-map" viewBox="0 0 620 560" fill="none" aria-hidden="true">
    <defs><pattern id="street-grid" width="36" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-27)"><path d="M0 0H36V24" stroke="#adbfc4" strokeOpacity=".12" strokeWidth="1" /></pattern><linearGradient id="map-fade" x1="0" y1="0" x2="620" y2="560" gradientUnits="userSpaceOnUse"><stop stopColor="#243e44"/><stop offset="1" stopColor="#182d36"/></linearGradient></defs>
    <rect width="620" height="560" fill="url(#map-fade)"/><path d="M267-30 414 8 190 527 109 573 82 521Z" fill="#48616a" fillOpacity=".25"/><path d="m424 135 196 13v412H285l-46-72Z" fill="#48616a" fillOpacity=".2"/><path d="M0 0h182L53 355 0 393Z" fill="#48616a" fillOpacity=".2"/><rect width="620" height="560" fill="url(#street-grid)"/>
    <g stroke="#9dadaf" strokeOpacity=".18"><path d="m196 110 174 89M174 159l176 88M144 216l180 85M114 280l181 87M91 337l184 91M251 11 175 90"/><path d="m262 12-159 434M302 33 132 468M342 53 162 468M382 69 186 498"/></g>
    <path d="m359 123-29 74-74 38-30 87 45 55-41 88" stroke="#d4f369" strokeWidth="3" strokeDasharray="7 8" className="route-line"/>
    <g fill="#d4f369"><circle cx="359" cy="123" r="5"/><circle cx="256" cy="235" r="5"/><circle cx="271" cy="377" r="5"/></g><circle className="map-pulse" cx="230" cy="465" r="20" stroke="#d4f369"/><circle cx="230" cy="465" r="8" fill="#d4f369"/>
    <g fontFamily="monospace" fontSize="10" letterSpacing="3" fill="#b9c5c6" opacity=".55"><text x="137" y="194" transform="rotate(-66 137 194)">MANHATTAN</text><text x="432" y="405" transform="rotate(-27 432 405)">BROOKLYN</text><text x="425" y="211" transform="rotate(-65 425 211)">EAST RIVER</text></g>
  </svg>;
}
function EvidenceBoard({ firstClue }: { firstClue: Clue }) {
  return <div className="evidence-board"><CityMap/><div className="map-topline"><span><i/> SOMEWHERE IN NEW YORK</span><span>EXHIBIT A—D</span></div><div className="board-cross cross-one">+</div><div className="board-cross cross-two">+</div>
    <div className="evidence-receipt"><span className="tape"/><div className="receipt-mini-head">NIGHT SHIFT™</div><span className="receipt-small">NEW YORK, NY · AFTER HOURS</span><div className="receipt-rule"/><div className="receipt-item"><span>Clues recovered</span><span>04</span></div><div className="receipt-item"><span>Places to find</span><span>01</span></div><div className="receipt-item"><span>Versions of events</span><span>??</span></div><div className="receipt-rule"/><strong className="receipt-total">WHERE DID WE END UP?</strong><div className="barcode"/><span className="receipt-small">KEEP THIS. YOU’LL NEED IT.</span></div>
    <div className="evidence-message"><div className="message-top"><span className="chat-avatar">M</span><div><b>the usual suspects</b><small>3 people · 0 good ideas</small></div><span>•••</span></div><div className="chat-bubble">{firstClue.text.split('\n')[0]?.replace(/^[A-Z]+: /, '')}</div><div className="chat-bubble outgoing">where the hell are we?</div><small className="message-read">Delivered. Unfortunately.</small></div>
    <div className="map-sticker"><Symbol name="pin" size={26}/><span>LAST SEEN<br/><b>Making it worse.</b></span></div><div className="board-bottomline">A REAL PLACE. A QUESTIONABLE NIGHT.</div>
  </div>;
}
function Evidence({ clue, index }: { clue: Clue; index: number }) {
  return <article className={`clue-artifact artifact-${clue.kind}`} key={index}><div className="artifact-heading"><span>0{index + 1} / {clue.label}</span><time>{clue.time}</time></div>{clue.kind === 'message' ? <div className="clue-chat">{clue.text.split('\n').filter(Boolean).map((line, i) => <p key={i} className={i % 2 ? 'reply' : ''}>{line}</p>)}</div> : <p className="artifact-text">{clue.text}</p>}<div className="artifact-foot">{clue.kind === 'receipt' ? 'FOUND: LEFT COAT POCKET' : clue.kind === 'note' ? 'RECOVERED DRAFT · NEVER SENT' : clue.kind === 'dispatch' ? 'LOCATION SIGNAL RECOVERED' : 'SCREENSHOT ADDED TO EVIDENCE'}<span>↗</span></div></article>;
}
export function NightGame({ initial, initialCommunity, loggedIn, playerId }: { initial: NightState; initialCommunity: Community; loggedIn: boolean; playerId: string | null }) {
  const router = useRouter();
  const [night, setNight] = useState(initial);
  const [community, setCommunity] = useState(initialCommunity);
  const [started, setStarted] = useState(initial.finished || initial.revealed > 1 || initial.wrong > 0);
  const [activeClue, setActiveClue] = useState(initial.revealed - 1);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState('');
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [alias, setAlias] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const autoDraftAttempted = useRef(false);
  const [storyMessage, setStoryMessage] = useState('');
  const [voteMessage, setVoteMessage] = useState('');
  const [caseMessage, setCaseMessage] = useState('');
  const [caseGenerating, setCaseGenerating] = useState<string | null>(null);
  const [rankPeriod, setRankPeriod] = useState<'daily' | 'all'>('daily');
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [newCaseGenerating, setNewCaseGenerating] = useState(false);
  const gameRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLDialogElement>(null);
  const storageKey = `wth-draft-v2-${playerId || 'guest'}-${night.mode}-${night.day}`;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const guestKey = `wth-draft-v2-guest-${night.mode}-${night.day}`;
        const value = JSON.parse(localStorage.getItem(storageKey) || (loggedIn ? localStorage.getItem(guestKey) : '') || 'null');
        if (value) { setTitle(value.title || ''); setBody(value.body || ''); setAlias(value.alias || ''); setGenerated(Boolean(value.generated)); }
      } catch { /* Storage may be blocked. */ }
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey, loggedIn, night.mode, night.day]);
  useEffect(() => {
    if (!draftReady) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ title, body, alias, generated })); } catch { /* Explicit save reports unavailable storage. */ }
  }, [title, body, alias, generated, draftReady, storageKey]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') startTransition(async () => { setCommunity(await refreshCommunity(night.day)); }); };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [night.day]);
  const ownStory = community.stories.find(story => story.mine);
  const generateDraft = useCallback(async () => {
    setGenerating(true); setStoryMessage('');
    try {
      const result = await generateNightReconstruction(night.day, night.mode);
      if (result.error) setStoryMessage(result.error);
      else if (result.draft) {
        setTitle(result.draft.title); setBody(result.draft.body); setGenerated(true);
        setStoryMessage(result.fallback ? 'Gemini was unavailable, so your clues were used to build this editable draft.' : '');
      }
    } catch { setStoryMessage('The story writer lost the thread. Your current draft is unchanged.'); }
    finally { setGenerating(false); }
  }, [night.day, night.mode]);
  function requestStoryDraft() {
    storyRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    void generateDraft();
  }
  useEffect(() => {
    if (!night.finished || !draftReady || !loggedIn || body || title || ownStory || autoDraftAttempted.current) return;
    autoDraftAttempted.current = true;
    void generateDraft();
  }, [night.finished, draftReady, loggedIn, body, title, ownStory, generateDraft]);
  function begin() { setStarted(true); setTimeout(() => gameRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }), 40); }
  function move(action: 'reveal' | 'guess' | 'giveup') {
    setFeedback('');
    startTransition(async () => {
      const result = await playNight(action, guess, night.mode, night.day);
      if (result.error) { setFeedback(result.error); return; }
      if (result.state) { setNight(result.state); setActiveClue(result.state.revealed - 1); if (action === 'guess') setGuess(''); if (result.state.finished) setCommunity(await refreshCommunity(result.state.day)); }
      setFeedback(result.message || ''); setConfirmReveal(false);
    });
  }
  function replayPractice() {
    startTransition(async () => {
      const result = await playNight('restart', '', 'practice', night.day);
      if (result.error) { setFeedback(result.error); return; }
      if (result.state) { setNight(result.state); setActiveClue(0); setStarted(false); autoDraftAttempted.current = false; setFeedback(''); setGuess(''); setConfirmReveal(false); }
    });
  }
  async function generateNewCase() {
    setNewCaseGenerating(true); setFeedback('');
    try {
      const result = await generateNewPracticeCase();
      if (result.error) { setFeedback(result.error); return; }
      if (result.state) {
        setNight(result.state); setActiveClue(0); setStarted(true); setGuess(''); setConfirmReveal(false);
        setTitle(''); setBody(''); setGenerated(false); setStoryMessage(''); autoDraftAttempted.current = false;
        try { localStorage.removeItem(storageKey); } catch { /* The new case still works without local storage. */ }
        setFeedback(result.message || 'New NYC case generated.');
      }
    } finally { setNewCaseGenerating(false); }
  }
  function clearPracticeDraft() {
    try { localStorage.removeItem(storageKey); } catch { /* Still clear the current editor. */ }
    autoDraftAttempted.current = true; setTitle(''); setBody(''); setAlias(''); setGenerated(false); setStoryMessage('Draft cleared.');
  }
  function publish(e: React.FormEvent) {
    e.preventDefault(); setStoryMessage('');
    if (!validStory(title, body, alias)) { setStoryMessage('Add a title, 80–1,200 characters of story, and a valid handle. Blank space doesn’t count.'); return; }
    if (!loggedIn) {
      try { localStorage.setItem(storageKey, JSON.stringify({ title, body, alias, generated })); } catch { /* The visible editor still keeps the draft. */ }
      router.push('/login');
      return;
    }
    startTransition(async () => { const result = await submitNightStory(night.day, title, body, alias, night.mode); if (result.error) setStoryMessage(result.error); else { setCommunity(await refreshCommunity(night.day)); setStoryMessage('Your version is posted. Let the city decide.'); } });
  }
  function vote(id: string) {
    setVoteMessage(''); startTransition(async () => { const result = await voteNightStory(id); if (result.error) setVoteMessage(result.error); else { setCommunity(await refreshCommunity(night.day)); setVoteMessage('Vote saved. You can change your pick until midnight ET.'); } });
  }
  async function openStoryCase(story: Story) {
    if (!loggedIn) { router.push('/login'); return; }
    setCaseMessage(''); setCaseGenerating(story.id);
    try {
      const result = await prepareStoryCase(story.id);
      if (result.error) setCaseMessage(result.error);
      else if (result.href) router.push(result.href);
    } catch { setCaseMessage('The case file got lost in transit. Please try again.'); }
    finally { setCaseGenerating(null); }
  }
  const stories = community.stories.filter(story => filter === 'all' || story.mine);
  const leaders = rankPeriod === 'daily' ? community.dailyLeaders || [] : community.leaders;
  const potential = deductionScore(night.revealed, night.wrong, true);
  return <main className="night-site">
    <section className="night-hero"><div className="hero-copy"><div className="eyebrow"><span className="live-dot"/>{night.mode === 'live' ? `THE DAILY MYSTERY / NO. ${String(night.number).padStart(3, '0')}` : 'AI-GENERATED NYC CASE'}</div><h1>Good night.<br/>Bad decisions.<br/><span>No idea <em>where.</em></span></h1><p className="hero-description">Find the spot. Tell your version.<br/><strong>Let the city pick the best story.</strong></p><div className="hero-actions"><button className="primary-button" onClick={begin}>{night.finished ? 'Back to your night' : started ? 'Continue the night' : 'Find out where'}<Symbol name="arrow"/></button><button className="text-button" onClick={() => howRef.current?.showModal()}><span className="play-ring">▷</span> How to play</button></div></div><EvidenceBoard firstClue={night.clues[0]}/></section>
    <div className="night-ticker"><span className="ticker-label">THE CITY NEVER GETS ITS STORY STRAIGHT.</span><span className="ticker-right"><Symbol name="clock" size={15}/> NEXT NIGHT IN <Countdown/><span className="timezone">MIDNIGHT ET</span></span></div>
    <section className="case-section" ref={gameRef} id="the-case" aria-labelledby="case-title"><div className="section-kicker"><span>01 — THE EVIDENCE</span></div><div className="case-heading"><div><h2 id="case-title">{night.title}</h2><p>{night.brief}</p></div><div className="case-number">CASE <b>{night.mode === 'practice' ? 'AI' : String(night.number).padStart(3, '0')}</b></div></div>
      {!started ? <div className="sealed-case"><div className="sealed-art"><span>CONFIDENTIAL</span><b>✳</b><small>OPEN AT YOUR OWN RISK</small></div><div><h3>Someone knows what happened.<br/>It might as well be you.</h3><p>Open the evidence. Every extra clue costs 200 points.<br/>Three guesses. Trust your gut. Or don’t.</p><button className="text-button open-file" onClick={begin}>Open the case file <Symbol name="arrow"/></button></div><div className="sealed-stamp">N.Y.C.<br/><span>NIGHT DIVISION</span></div></div> : <div className="game-layout"><div className="evidence-workspace"><div className="clue-tabs" role="tablist" aria-label="Evidence"><span className="small-label">EXHIBITS</span>{Array.from({ length: 4 }, (_, i) => <button role="tab" aria-selected={activeClue === i} aria-controls="clue-panel" id={`clue-tab-${i}`} key={i} aria-label={`Clue ${i + 1}${i >= night.clues.length ? ", locked" : ""}`} disabled={i >= night.clues.length} tabIndex={activeClue === i ? 0 : -1} onKeyDown={e => {
  let next = i;
  if (e.key === 'ArrowRight') next = (i + 1) % night.clues.length;
  else if (e.key === 'ArrowLeft') next = (i - 1 + night.clues.length) % night.clues.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = night.clues.length - 1;
  else return;
  e.preventDefault(); setActiveClue(next); document.getElementById(`clue-tab-${next}`)?.focus();
}} onClick={() => setActiveClue(i)} className={activeClue === i ? 'selected' : ''}>{i >= night.clues.length ? <Symbol name="lock" size={13}/> : String(i + 1).padStart(2, '0')}</button>)}</div><div role="tabpanel" id="clue-panel" aria-labelledby={`clue-tab-${activeClue}`}><Evidence clue={night.clues[activeClue]} index={activeClue}/></div></div><div className="deduction-panel">{night.finished ? <div className="solved-panel"><span className="result-stamp">{night.solved ? 'CASE CRACKED' : 'CASE CLOSED'}</span><p className="small-label">YOU ENDED UP AT</p><h3>{night.answer}</h3><p>{night.explanation}</p>{night.source && <a className="source-link" href={night.source} target="_blank" rel="noreferrer">The real-world evidence ↗</a>}<div className="score-result"><strong>{night.score}</strong><span>POINTS</span></div><button type="button" className="primary-button" disabled={generating} onClick={requestStoryDraft}>{generating ? 'Gemini is writing…' : generated ? 'Write another story' : 'Generate my story'} <Symbol name="arrow"/></button></div> : <><div className="score-meter"><span className="small-label">POSSIBLE SCORE</span><strong key={potential}>{potential.toLocaleString()}<span>PTS</span></strong><div className="score-bars">{Array.from({ length: 10 }, (_, i) => <i className={i < potential / 100 ? 'filled' : ''} key={i}/>)}</div></div><form onSubmit={e => { e.preventDefault(); move('guess'); }}><label htmlFor="location-guess">Where did we end up?</label><div className="guess-input"><Symbol name="pin" size={19}/><input id="location-guess" value={guess} onChange={e => setGuess(e.target.value)} placeholder="Name the NYC spot…" required maxLength={120} disabled={pending} autoComplete="off"/></div><button disabled={pending || !guess.trim()} className="primary-button guess-button">{pending ? 'Checking…' : 'Lock in my guess'}<Symbol name="arrow"/></button></form><div className="guess-count"><span>{3 - night.wrong} guesses left · −100 each</span></div><div className="next-clue"><button className="text-button" disabled={pending || night.revealed >= 4} onClick={() => move('reveal')}>{night.revealed >= 4 ? 'All clues revealed' : 'Reveal another clue'}{night.revealed < 4 && <span className="cost-chip">−200</span>}</button></div>{confirmReveal ? <div className="give-up-confirm"><p>Reveal the answer for 0 points?</p><button disabled={pending} onClick={() => move('giveup')}>Reveal it</button><button onClick={() => setConfirmReveal(false)}>Keep guessing</button></div> : <button className="give-up" onClick={() => setConfirmReveal(true)}>Reveal the answer</button>}</>}<p className="action-feedback" role="status">{feedback}</p></div></div>}
      {night.mode === 'practice' && <div className="practice-notice"><button className="practice-replay" disabled={pending || newCaseGenerating} onClick={() => void generateNewCase()}>{newCaseGenerating ? 'Generating…' : 'New AI case ✳'}</button>{night.finished && <button className="practice-replay" disabled={pending || newCaseGenerating} onClick={replayPractice}>Replay ↻</button>}</div>}
    </section>
    <section className={`story-section ${night.finished ? 'unlocked' : ''}`} id="stories" aria-labelledby="stories-title"><div className="section-kicker"><span>02 — YOUR STORY</span></div><div className="stories-heading"><h2 id="stories-title">Okay. <em>Explain yourself.</em></h2><p>Gemini writes. You edit. Players vote.</p></div>
      {!night.finished ? <div className="stories-locked"><div className="locked-note"><span className="small-label">A NOTE FROM THE NIGHT SHIFT</span><h3>What happened in New York<br/>doesn’t have to stay in New York.</h3><p>Finish the case and AI turns your guesses into a story.<br/>Edit your version. The most eventful night wins the room.</p><span className="handwritten">Make it a night worth explaining. ↗</span></div><div className="story-lock"><Symbol name="lock" size={30}/><h3>First, find the spot.</h3><p>Stories unlock when you finish the case.<br/>No spoilers. No borrowed alibis.</p><button onClick={begin} className="text-button">{started ? 'Back to the evidence' : 'Start investigating'} <Symbol name="arrow"/></button></div></div> : <div className="story-unlocked"><div className="story-editor" id="write-story" ref={storyRef}>
          {ownStory ? <div className="published-confirmation"><Symbol name="check" size={30}/><h3>Your story is in.</h3><p>“{ownStory.title}” is out there. Read the other reconstructions, vote, or turn one into the next mystery.</p><Link className="story-case-inline" href={`/night/story/${ownStory.id}`} onClick={event => { if (!ownStory.playable) { event.preventDefault(); void openStoryCase(ownStory); } }}>{caseGenerating === ownStory.id ? 'Writing the clues…' : ownStory.playable ? 'Play the case it inspired →' : 'Turn this story into a game ✳'}</Link><span>Published versions stay fixed once voting begins.</span></div> : <>
            <div className="reconstruction-intro">
              <div className="guess-trail" aria-label="Your guess trail">
                {(night.guesses || []).length ? night.guesses.map((attempt, i) => <span key={i} className={attempt.correct ? 'correct' : ''}>{attempt.place}<b aria-label={attempt.correct ? 'correct' : 'wrong'}>{attempt.correct ? '✓' : '×'}</b></span>) : <span>No guesses recorded</span>}
              </div>
              <div className="generation-tools">
                <button type="button" className="generate-story-button" disabled={generating || pending} onClick={requestStoryDraft}>
                  <span className={generating ? 'writing-star' : ''}>✳</span>{generating ? 'Gemini is writing…' : generated ? 'Write another version' : 'Generate my story'}
                </button>
              </div>
            </div>
            {generating && <div className="story-writing" role="status"><i/><i/><i/><span>Writing a new version…</span></div>}
            <form onSubmit={publish} aria-busy={generating}>
              <label htmlFor="story-title" className="sr-only">Story title</label>
              <input className="story-title-input" id="story-title" placeholder="Your AI story title lands here…" minLength={3} maxLength={80} required disabled={generating || pending} value={title} onChange={e => setTitle(e.target.value)}/>
              <label htmlFor="story-body" className="sr-only">Edit your reconstruction</label>
              <textarea id="story-body" placeholder="Generate your reconstruction, then edit any part of it. Your wrong guesses become the detours. The clues tie it all together." minLength={80} maxLength={1200} rows={7} required disabled={generating || pending} value={body} onChange={e => setBody(e.target.value)}/>
              <div className="editor-meta"><span>{body.length}/1,200</span></div>
              <div className="editor-bottom"><div className="handle-input"><label htmlFor="story-alias">@</label><input id="story-alias" aria-label="Public handle" placeholder="your_handle" pattern="[a-zA-Z0-9_]{3,20}" minLength={3} maxLength={20} required disabled={generating || pending} value={alias} onChange={e => setAlias(e.target.value)}/></div><button className="primary-button" disabled={pending || generating || !body.trim()}>{pending ? 'Posting…' : loggedIn ? 'Post my version' : 'Sign in to post'}<Symbol name="arrow" size={17}/></button></div>
            </form>
          </>}
          <p className="action-feedback" role="status">{storyMessage}</p>
          {night.mode === 'practice' && body && <button className="clear-draft" disabled={generating} onClick={clearPracticeDraft}>Clear draft</button>}
        </div><div className="voting-explainer"><span className="outline-star">✳</span><h3>The city<br/>gets the last word.</h3><p>Vote for the best story. Every vote gives its author 50 points.</p></div></div>}
      {night.finished && <div className="community-stories"><div className="feed-top"><div className="feed-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Everyone’s version <span>{community.stories.length}</span></button><button className={filter === 'mine' ? 'active' : ''} onClick={() => setFilter('mine')}>My story</button></div><button className="refresh-button" disabled={pending} onClick={() => startTransition(async () => setCommunity(await refreshCommunity(night.day)))}>Refresh ↻</button></div><p role="status" className="action-feedback">{voteMessage || caseMessage}</p>{stories.length ? <div className="story-grid">{stories.map(story => <article className="player-story" key={story.id}><div className="player-story-top"><span>@{story.alias}</span><span>{story.mine ? 'YOUR VERSION' : story.sourceKind === 'generated' ? 'AI CASE STORY' : 'DAILY STORY'}</span></div><h3>{story.title}</h3><p>{story.body}</p><button className="story-to-case" disabled={Boolean(caseGenerating)} onClick={() => void openStoryCase(story)}><span>{caseGenerating === story.id ? 'GENERATING EVIDENCE' : story.playable ? 'COMMUNITY CASE READY' : 'AI CASE BUILDER'}</span><b>{caseGenerating === story.id ? 'Turning this night into clues…' : story.playable ? 'Play this story →' : 'Turn this story into a game ✳'}</b></button><div className="player-story-bottom"><span>{story.votes} {story.votes === 1 ? 'vote' : 'votes'} · {story.votes * 50} pts</span><button disabled={pending || story.mine || !loggedIn} aria-pressed={story.voted} onClick={() => vote(story.id)} className={story.voted ? 'voted' : ''}><Symbol name="star" size={16}/>{story.voted ? 'Your best night' : story.mine ? 'Your story' : loggedIn ? 'Best night' : 'Sign in to vote'}</button></div></article>)}</div> : <div className="empty-feed"><span>“ ”</span><h3>{filter === 'mine' ? 'Your version is still unwritten.' : 'Every legendary night needs a first storyteller.'}</h3><p>{community.available ? 'Post your version. Come back to read the other stories and cast your vote.' : community.error}</p></div>}</div>}
    </section>
    <section className="leaderboard-section" id="leaderboard" aria-labelledby="leaderboard-title"><div className="leaderboard-intro"><div className="section-kicker">03 — LOCAL LEGENDS</div><h2 id="leaderboard-title">Know the city.<br/><em>Own the night.</em></h2><p>Good detective work gets you points.<br/>A great story gets you remembered.</p><div className="scoring-note"><span>UP TO <b>1,000</b> FOR SOLVING</span><span><b>+50</b> PER STORY VOTE</span></div></div><div className="leaderboard-table"><div className="leaderboard-caption"><span>THE LEADERBOARD</span><div className="rank-period"><button aria-pressed={rankPeriod === 'daily'} onClick={() => setRankPeriod('daily')}>Tonight</button><button aria-pressed={rankPeriod === 'all'} onClick={() => setRankPeriod('all')}>All time</button></div></div><div className="rank-head"><span>RANK / PLAYER</span><span>NIGHTS</span><span>POINTS</span></div>{leaders.length ? leaders.map((leader, i) => <div className={`rank-row ${leader.mine ? 'my-rank' : ''}`} key={leader.alias}><span><b>{String(i + 1).padStart(2, '0')}</b>@{leader.alias}{leader.mine && <small> YOU</small>}</span><span>{leader.nights}</span><strong>{leader.points.toLocaleString()}</strong></div>) : <div className="empty-leaderboard"><span className="empty-crown">♜</span><h3>The city’s next legend<br/>hasn’t clocked in yet.</h3><p>{community.available ? 'Post a story or finish a ranked night to claim your place.' : 'Community rankings will appear here when the feed reconnects.'}</p><button className="text-button" onClick={begin}>Start with tonight <Symbol name="arrow" size={17}/></button></div>}<div className="leaderboard-foot">REAL PLAYERS. QUESTIONABLE ALIBIS.</div></div></section>
    <footer className="night-footer"><Link href="/" className="footer-brand">WHERE THE HELL ARE WE<span>?</span></Link><div><span>MADE FOR THE CITY THAT SHOULD PROBABLY GO TO BED.</span><nav aria-label="Footer navigation"><Link href="/restaurants">The original NYC spots ↗</Link><button onClick={() => howRef.current?.showModal()}>The rules</button><span>NEW YORK, ALWAYS.</span></nav></div></footer>
    <dialog ref={howRef} aria-label="How to play Where the hell are we" className="rules-dialog" onClick={e => { if (e.target === e.currentTarget) howRef.current?.close(); }}><div className="dialog-top"><span className="small-label">THE NIGHT SHIFT HANDBOOK</span><button onClick={() => howRef.current?.close()} aria-label="Close rules">✕</button></div><h2>Here’s the<br/><em>story.</em></h2><ol><li><b>Find the spot.</b><p>Four clues point to one real NYC location. Everyone plays the same daily. You get three guesses.</p></li><li><b>Spend your clues wisely.</b><p>Start with 1,000 possible points. Each extra clue costs 200. Each wrong guess costs 100. Solving earns at least 100; revealing the answer earns 0.</p></li><li><b>Reconstruct the night.</b><p>After the reveal, AI writes a personalized story from your guesses and the clues. Edit anything before publishing. One public story per player, per night.</p></li><li><b>Pass the story on.</b><p>Turn any published reconstruction into a new four-clue community case. Everyone plays the same generated version, then comes back to vote.</p></li></ol><p className="rules-fineprint">The daily case and voting reset at midnight in New York. Generated-case stories join the public vote after sign-in. Daily stories stay hidden until you finish.</p><button className="primary-button" onClick={() => { howRef.current?.close(); begin(); }}>Got it. Let’s get lost. <Symbol name="arrow"/></button></dialog>
  </main>;
}
