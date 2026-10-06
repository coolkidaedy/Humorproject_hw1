import Link from "next/link";
import { notFound } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { voteInput } from "@/lib/caption-validation";
import { CaptionCard } from "../caption-card";

export default async function CaptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!voteInput(id, "1")) notFound();
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: caption, error } = await supabase.from("captions").select("id,content,situation,tone,created_at").eq("id", id).maybeSingle();
  if (error) throw new Error("The caption could not be loaded. Please try again.");
  if (!caption) notFound();
  const vote = user ? await supabase.from("caption_votes").select("value").eq("caption_id", id).eq("user_id", user.id).maybeSingle() : null;
  return <main className="mx-auto w-full max-w-2xl px-6 py-12"><Link href="/captions" className="mb-6 inline-block underline">← Campus captions</Link><h1 className="mb-6 text-3xl font-bold">A New York moment.</h1><CaptionCard caption={caption} loggedIn={Boolean(user)} vote={vote?.data?.value} />{vote?.error && <p role="alert">Your saved vote could not be loaded.</p>}</main>;
}
