"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { buildPrompt, generationInput, voteInput } from "@/lib/caption-validation";
import { geminiError } from "@/lib/gemini-error";

export type CaptionState = { error?: string; success?: string; captionId?: string };

export async function generateCaption(_state: CaptionState, form: FormData): Promise<CaptionState> {
  const input = generationInput(form.get("prompt"), form.get("tone"));
  if (!input) return { error: "Describe your situation in 10–600 characters and choose a tone." };
  try {
    const supabase = await serverSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "Log in before generating a caption." };
    const key = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim().replace(/^models\//, "") || "gemini-3.5-flash";
    if (!key) return { error: "Caption generation is not configured yet. Please try again later." };
    // Database-backed reservation serializes concurrent requests across server instances.
    const { data: allowed, error: limitError } = await supabase.rpc("reserve_caption_generation");
    if (limitError) return { error: "Generation is temporarily unavailable. Please try again later." };
    if (!allowed) return { error: "You’ve used today’s 10 generation attempts. Come back tomorrow (UTC)." };
    const prompt = buildPrompt(input.prompt, input.tone);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } }),
      signal: AbortSignal.timeout(40000),
      cache: "no-store",
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const error = geminiError(response.status, body);
      console.error("Gemini generation failed", { httpStatus: response.status, diagnosis: error });
      return { error };
    }
    const result = await response.json();
    const candidate = result.candidates?.[0];
    const content = candidate?.content?.parts?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === "string").map((part: { text: string }) => part.text).join("").trim();
    if (candidate?.finishReason !== "STOP" || !content || content.length > 1000) return { error: "The AI couldn’t finish a suitable caption. Try another situation." };
    const { data, error } = await supabase.from("captions").insert({ user_id: user.id, situation: input.prompt, tone: input.tone, prompt, content, model }).select("id").single();
    if (error) return { error: "Your caption could not be saved. Please try again later." };
    revalidatePath("/captions");
    return { success: "Your caption is live. Share it or see how people vote!", captionId: data.id };
  } catch {
    return { error: "Generation was interrupted. Please try again later." };
  }
}

export async function voteCaption(_state: CaptionState, form: FormData): Promise<CaptionState> {
  const input = voteInput(form.get("caption_id"), form.get("value"));
  if (!input) return { error: "Choose an upvote or downvote for a valid caption." };
  try {
    const supabase = await serverSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "Log in before voting." };
    const { error } = await supabase.from("caption_votes").upsert({ user_id: user.id, caption_id: input.id, value: input.value }, { onConflict: "user_id,caption_id" });
    if (error) return { error: "Your vote could not be saved. Please try again." };
    revalidatePath("/captions");
    revalidatePath(`/captions/${input.id}`);
    return { success: "Vote saved." };
  } catch {
    return { error: "Connection interrupted. Please try voting again." };
  }
}
