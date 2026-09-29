"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-16"><h1 className="text-3xl font-bold">Something went wrong.</h1><p role="alert" className="my-6">We couldn’t complete the request. Please try again.</p><button onClick={reset} className="underline">Try again</button></main>;
}
