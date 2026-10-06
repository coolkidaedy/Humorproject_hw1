import Link from "next/link";
import { connection } from "next/server";
import { getSupabase } from "@/lib/supabase";

type Restaurant = { id: number; name: string; neighborhood: string; cuisine: string };

export default async function Home() {
  // Read the latest rows on each visit instead of freezing the list at build time.
  await connection();
  let restaurants: Restaurant[] = [];
  let failed = false;
  try {
    const { data, error } = await getSupabase()
      .from("restaurants")
      .select("id, name, neighborhood, cuisine")
      .order("id", { ascending: true });
    if (error) throw error;
    restaurants = data ?? [];
  } catch (error) {
    console.error("Could not load restaurants from Supabase:", error);
    failed = true;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <header className="mb-12 border-b border-current/15 pb-10">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">NYC Restaurant List</p>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">A taste of New York.</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">A small collection of places to eat across the city. Find your next stop by neighborhood and cuisine.</p>
      <Link href="/captions" className="mt-6 inline-block rounded-full bg-emerald-800 px-5 py-3 text-sm font-semibold text-white">Turn your NYC adventure into a caption →</Link>
      </header>
      {failed ? (
        <section role="alert" className="rounded-2xl border border-amber-400/50 bg-amber-100/30 p-8">
          <h2 className="text-xl font-semibold">The restaurant list is unavailable.</h2>
          <p className="mt-2">We couldn’t load the collection. Please try again in a moment.</p>
          <form action="/" method="get"><button type="submit" className="mt-5 cursor-pointer font-semibold underline underline-offset-4">Try again</button></form>
        </section>
      ) : restaurants.length === 0 ? (
        <section className="rounded-2xl border border-current/15 p-8">
          <h2 className="text-xl font-semibold">Your next favorite spot is on its way.</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">No restaurants have been added yet. Check back soon.</p>
        </section>
      ) : (
        <>
          <p className="mb-5 text-sm text-zinc-500">{restaurants.length} restaurants in the collection</p>
          <ul className="grid gap-5 sm:grid-cols-2">
            {restaurants.map((restaurant) => (
              <li key={restaurant.id} className="rounded-2xl border border-zinc-200 bg-white p-7 dark:border-zinc-800 dark:bg-zinc-950">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{restaurant.cuisine}</span>
                <h2 className="mt-5 text-xl font-semibold leading-8">{restaurant.name}</h2>
                <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">{restaurant.neighborhood}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      <footer className="mt-12 text-sm text-zinc-500">New York City, one table at a time.</footer>
    </main>
  );
}
