import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { readProfile, profileComplete } from "@/lib/profile";
import { ProfileForm } from "./profile-form";
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let profile;
  try { profile = await readProfile(supabase, user.id); }
  catch { return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-4xl font-bold">Profile unavailable</h1><p role="alert" className="my-6">We couldn’t load your profile. Please retry before editing.</p><a href="/profile" className="underline">Try again</a></main>; }
  const { error } = await searchParams;
  let photoUrl: string | null = null;
  let photoError = "";
  const storedPhoto = profile?.avatar_url;
  if (storedPhoto) {
    try {
      const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
      let path = storedPhoto;
      if (/^https?:/i.test(storedPhoto)) {
        const saved = new URL(storedPhoto);
        const prefix = "/storage/v1/object/public/avatars/";
        if (saved.origin !== base.origin || !saved.pathname.startsWith(prefix)) throw new Error("Unsupported photo URL");
        path = decodeURIComponent(saved.pathname.slice(prefix.length));
      }
      // Authenticated reads also support a bucket that was left private.
      const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) throw new Error("Photo unavailable");
      photoUrl = data.signedUrl;
    } catch {
      photoError = "Your photo is saved, but it could not be loaded. Check the avatars bucket’s read policy or try uploading again.";
    }
  }
  return <main className="mx-auto w-full max-w-xl px-6 py-16"><h1 className="text-4xl font-bold">Your profile</h1>
    {!profileComplete(profile) && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">Complete your first and last names to continue.</p>}
    {error === "logout" && <p role="alert" className="mt-6">Logout failed. Please try again.</p>}
    <ProfileForm profile={profile} photoUrl={photoUrl} photoError={photoError} />
  </main>;
}
