const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
export function newYorkDay(date = new Date()) {
  return dayFormatter.format(date);
}
export function normalizeAnswer(answer: string) {
  return answer.toLowerCase().replace(/[^a-z0-9]/g, '');
}
export function deductionScore(revealed: number, wrong: number, solved: boolean) {
  return solved ? Math.max(100, 1000 - (revealed - 1) * 200 - wrong * 100) : 0;
}
export function validStory(title: unknown, body: unknown, alias: unknown) {
  if (typeof title !== 'string' || typeof body !== 'string' || typeof alias !== 'string') return null;
  const result = { title: title.trim(), body: body.trim(), alias: alias.trim() };
  if (result.title.length < 3 || result.title.length > 80 || result.body.length < 80 || result.body.length > 1200 || !/^[a-zA-Z0-9_]{3,20}$/.test(result.alias)) return null;
  return result;
}
