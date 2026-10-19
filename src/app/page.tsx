import { loadNight, loadCommunity } from '@/lib/night/server';
import { NightGame } from './night/night-game';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export default async function Home() {
  const { state, loggedIn, playerId } = await loadNight();
  const community = await loadCommunity(state.day);
  return <NightGame key={playerId || 'guest'} playerId={playerId} initial={state} initialCommunity={community} loggedIn={loggedIn} />;
}
