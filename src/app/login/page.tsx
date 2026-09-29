import { LoginButton } from "./login-button";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="mx-auto w-full max-w-xl px-6 py-16"><h1 className="text-4xl font-bold">Welcome back.</h1><p className="my-6 text-zinc-500">Sign in to manage your profile.</p>{error && <p role="alert" className="mb-6 text-amber-700">Sign-in could not be completed. The link may have expired or permission was declined. Try Google login again in this browser.</p>}<LoginButton /></main>;
}
