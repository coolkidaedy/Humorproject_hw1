"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/profile";
import { saveProfile } from "./actions";
import { MAX_PHOTO_BYTES } from "@/lib/profile-validation";
export function ProfileForm({ profile, photoUrl, photoError }: { profile: Profile | null; photoUrl: string | null; photoError: string }) {
  const [fileError, setFileError] = useState("");
  const [selected, setSelected] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(async (previous: Awaited<ReturnType<typeof saveProfile>>, form: FormData) => {
    const result = await saveProfile(previous, form);
    if (result.success) { setSelected(null); setPreview(null); }
    return result;
  }, {});
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const image = selected ? preview : photoUrl;
  const inputClass = "mt-2 w-full rounded-xl border border-current/20 bg-transparent px-4 py-3 font-normal focus:outline-2 focus:outline-emerald-600";
  return <form action={action} className="mt-8 space-y-7">
    <section aria-label="Profile photo" className="rounded-2xl border border-current/15 p-5">
      <div className="flex items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-2xl font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {image && failedImage !== image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={selected ? "Selected photo preview" : "Your profile photo"} width={80} height={80} className="h-full w-full object-cover" onError={() => setFailedImage(image)} />
          ) : <span aria-label="Profile placeholder">{profile?.first_name?.[0] || "?"}{profile?.last_name?.[0] || ""}</span>}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">Profile photo</h2>
          <button type="button" disabled={pending} onClick={() => input.current?.click()} className="mt-2 rounded-full border border-current/25 px-4 py-2 text-sm font-semibold hover:bg-emerald-50 hover:text-emerald-900 disabled:opacity-50">Choose photo</button>
          <p id="photo-help" className="mt-2 text-xs text-zinc-500">JPG, PNG or WebP · Max 2 MB</p>
        </div>
      </div>
      <input ref={input} type="file" name="photo" aria-label="Choose profile photo" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help" className="hidden" onChange={event => {
        const file = event.target.files?.[0] ?? null;
        const invalid = file && (file.size > MAX_PHOTO_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type));
        setFileError(invalid ? "Choose a JPEG, PNG, or WebP photo no larger than 2 MB." : "");
        if (invalid) { event.target.value = ""; setSelected(null); }
        else { setSelected(file); setPreview(file ? URL.createObjectURL(file) : null); }
      }} />
      {selected && <p className="mt-4 break-all text-sm text-zinc-500">Selected: {selected.name}. Click Save profile to upload.</p>}
      <p className="mt-4 text-xs text-zinc-500">Optional. Uploaded photos may be publicly viewable.</p>
      {(photoError || (image && failedImage === image)) && <p role="alert" className="mt-3 text-sm text-amber-700 dark:text-amber-400">{photoError || "The photo could not be displayed. Try a different image or reload the page."}</p>}
    </section>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block text-sm font-semibold">First name<input name="first_name" autoComplete="given-name" required maxLength={100} defaultValue={profile?.first_name ?? ""} className={inputClass} /></label>
      <label className="block text-sm font-semibold">Last name<input name="last_name" autoComplete="family-name" required maxLength={100} defaultValue={profile?.last_name ?? ""} className={inputClass} /></label>
    </div>
    {(fileError || state.error) && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{fileError || state.error}</p>}
    {state.success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{state.success}</p>}
    <button disabled={pending || Boolean(fileError)} className="rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}
