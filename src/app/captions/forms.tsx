"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { generateCaption, voteCaption } from "./actions";
import { tones } from "@/lib/caption-validation";

const button = "rounded-full border border-current/20 px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-4";

export function GenerateForm({ challenge }: { challenge: string }) {
  const [state, action, pending] = useActionState(generateCaption, {});
  const [prompt, setPrompt] = useState("");
  return <form action={action} className="space-y-5">
    <div className="rounded-xl bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
      <p className="text-xs font-bold uppercase tracking-widest">Today’s inspiration</p>
      <p className="mt-2 leading-7">{challenge}</p>
      <button type="button" disabled={pending} onClick={() => setPrompt(challenge)} className="mt-2 cursor-pointer text-sm font-semibold underline underline-offset-4">Use this idea</button>
    </div>
    <div><label htmlFor="prompt" className="block font-semibold">What happened?</label>
      <textarea id="prompt" name="prompt" required minLength={10} maxLength={600} rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Tell us about your latest campus or NYC adventure…" className="mt-2 w-full rounded-xl border border-current/25 bg-transparent p-3" />
      <p className="text-xs text-zinc-500">{prompt.length}/600 · Your situation and caption will be public.</p>
    </div>
    <div><label htmlFor="tone" className="mr-3 font-semibold">Make it</label><select name="tone" id="tone" className="rounded-lg border border-current/25 bg-white p-2 text-zinc-900">{tones.map(tone => <option key={tone}>{tone}</option>)}</select></div>
    <button disabled={pending} className={`${button} bg-emerald-800 text-white`}>{pending ? "Writing your caption…" : "Generate & publish"}</button>
    <p className="text-xs text-zinc-500">AI-generated humor · 10 attempts per day · Resets at midnight UTC</p>
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
    {state.success && <p role="status" className="text-sm">{state.success} <Link className="underline" href={`/captions/${state.captionId}`}>Open caption</Link></p>}
  </form>;
}

export function VoteForm({ id, vote }: { id: string; vote?: number }) {
  const [state, action, pending] = useActionState(voteCaption, {});
  return <form action={action}>
    <input type="hidden" name="caption_id" value={id} />
    <div className="flex flex-wrap gap-2">
      {[{ value: 1, label: "↑ Funny" }, { value: -1, label: "↓ Try again" }].map(option => <button key={option.value} name="value" value={option.value} aria-pressed={vote === option.value} disabled={pending} className={`${button} ${vote === option.value ? "bg-emerald-800 text-white" : ""}`}>{option.label}</button>)}
    </div>
    <p aria-live="polite" className="mt-2 text-xs text-zinc-500">{pending ? "Saving…" : state.error || state.success || (vote ? "Your vote is selected. You can change it." : "One vote per person. Make it count.")}</p>
  </form>;
}

export function ShareButton({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  return <span><button className="cursor-pointer text-sm underline underline-offset-4" onClick={async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/captions/${id}`); setMessage("Link copied!"); }
    catch { setMessage("Open the caption and copy its address to share."); }
  }}>Copy link</button><span role="status" className="ml-2 text-xs">{message}</span></span>;
}
