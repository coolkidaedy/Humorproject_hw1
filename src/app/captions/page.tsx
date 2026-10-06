import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";
import { dailyPrompt } from "@/lib/caption-validation";
import { CaptionCard } from "./caption-card";
import { GenerateForm } from "./forms";

export const maxDuration = 60;
export const metadata = { title: "Campus captions | A taste of New York" };

export default async function CaptionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page || "1", 10) || 1));
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: captions, error } = await supabase.from("captions").select("id,content,situation,tone,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 12, page * 12);
  const shown = captions?.slice(0, 12) || [];
  const votes = user && shown.length ? await supabase.from("caption_votes").select("caption_id,value").eq("user_id", user.id).in("caption_id", shown.map(c => c.id)) : null;
  const byCaption = new Map(votes?.data?.map(v => [v.caption_id, v.value]));
  return <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-20">
    <header className="mb-10"><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Off campus. Online.</p><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">The city is a bit.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-500">Turn your NYC adventures into AI captions. Vote for the ones that get it. Come back tomorrow for a fresh idea.</p></header>
    <section aria-labelledby="generate-title" className="mb-12 rounded-2xl border border-current/15 p-6 sm:p-8"><h2 id="generate-title" className="mb-5 text-2xl font-semibold">Your story. AI’s punchline.</h2>{user ? <GenerateForm challenge={dailyPrompt()} /> : <><p className="mb-4 leading-7">Today’s inspiration: {dailyPrompt()}</p><Link href="/login" className="inline-block rounded-full bg-emerald-800 px-5 py-3 font-semibold text-white">Log in to create a caption</Link></>}</section>
    <h2 className="mb-5 text-2xl font-semibold">Fresh from the feed</h2>
    {error ? <p role="alert" className="rounded-xl border border-amber-400 p-6">The caption feed is unavailable. Please try again later.</p> : shown.length === 0 ? <p className="rounded-xl border border-current/15 p-6">No captions here yet. Start the conversation with your first NYC moment.</p> : <div className="grid items-start gap-5 md:grid-cols-2">{shown.map(caption => <CaptionCard key={caption.id} caption={caption} loggedIn={Boolean(user)} vote={byCaption.get(caption.id)} />)}</div>}
    {votes?.error && <p role="alert" className="mt-4">Your saved votes couldn’t be loaded. Refresh before voting again.</p>}
    <nav aria-label="Caption pages" className="mt-8 flex gap-6">{page > 1 && <Link className="underline" href={`/captions?page=${page - 1}`}>Newer captions</Link>}{captions && captions.length > 12 && <Link className="underline" href={`/captions?page=${page + 1}`}>Older captions</Link>}</nav>
  </main>;
}
