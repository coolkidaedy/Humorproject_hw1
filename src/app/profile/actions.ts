"use server";
import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { MAX_PHOTO_BYTES, photoExtension, validateNames } from "@/lib/profile-validation";
export type ProfileState = { error?: string; success?: string };
export async function saveProfile(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  const names = validateNames(form.get("first_name"), form.get("last_name"));
  if (!names) return { error: "Enter both names, using 1–100 characters each." };
  const photo = form.get("photo");
  let path: string | undefined;
  const supabase = await serverSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Your session has expired. Log in again before saving." };
  try {
    if (photo !== null && typeof photo !== "string" && photo.size > 0) {
      if (photo.size > MAX_PHOTO_BYTES) return { error: "Choose a photo no larger than 2 MB." };
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const extension = photoExtension(bytes, photo.type);
      if (!extension) return { error: "Choose a valid JPEG, PNG, or WebP image." };
      path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: photo.type, upsert: false });
      if (error) return { error: "Photo upload failed. Check the avatars bucket and upload policies, then try again. Your profile was not changed." };
    }
    const avatar = path ? supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl : undefined;
    // Only the verified user's ID is accepted. Omitted avatar preserves the existing photo.
    // Upsert repairs a missing profile for users who predate the signup trigger.
    const { data: saved, error } = await supabase.from("profiles").upsert({ id: user.id, ...names, ...(avatar ? { avatar_url: avatar } : {}) }, { onConflict: "id" }).select("avatar_url").single();
    if (error || (avatar && saved?.avatar_url !== avatar)) {
      if (path) await supabase.storage.from("avatars").remove([path]);
      return { error: "Your profile could not be saved. Please try again. If this persists, check profiles table permissions." };
    }
    revalidatePath("/", "layout");
    return { success: avatar ? "Profile and photo saved." : "Names saved. No new photo was uploaded. Choose a photo and click Save profile to upload it." };
  } catch {
    if (path) await supabase.storage.from("avatars").remove([path]).catch(() => undefined);
    return { error: "The connection failed. Please try again." };
  }
}
