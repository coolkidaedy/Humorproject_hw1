import Link from "next/link";
import { requireUser } from "@/lib/auth";
export default async function Protected() {
  const { profile } = await requireUser(true);
  return <main className="mx-auto w-full max-w-5xl px-6 py-16"><p className="mb-4 text-sm font-semibold uppercase tracking-widest text-emerald-700">Members</p><h1 className="text-4xl font-bold">Welcome, {profile!.first_name}.</h1><p className="my-6">Your session has been verified on the server.</p><Link href="/profile" className="underline underline-offset-4">Edit your profile</Link></main>;
}
