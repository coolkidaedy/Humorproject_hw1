import Link from "next/link";
import { ShareButton, VoteForm } from "./forms";

export type Caption = { id: string; content: string; situation: string; tone: string; created_at: string };
export function CaptionCard({ caption, loggedIn, vote }: { caption: Caption; loggedIn: boolean; vote?: number }) {
  return <article className="rounded-2xl border border-current/15 p-6 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500"><span>{caption.tone} · AI generated</span><time dateTime={caption.created_at}>{new Date(caption.created_at).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</time></div>
    <Link href={`/captions/${caption.id}`} className="mt-5 block whitespace-pre-wrap break-words text-2xl font-semibold leading-relaxed">{caption.content}</Link>
    <details className="my-5 text-sm text-zinc-500"><summary className="cursor-pointer">The situation</summary><p className="mt-2 whitespace-pre-wrap break-words">{caption.situation}</p></details>
    {loggedIn ? <VoteForm id={caption.id} vote={vote} /> : <Link href="/login" className="text-sm font-semibold underline underline-offset-4">Log in to vote</Link>}
    <div className="mt-4"><ShareButton id={caption.id} /></div>
  </article>;
}
