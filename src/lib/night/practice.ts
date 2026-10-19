import 'server-only';
import type { Clue } from './types';
// Editorial practice episode. Never represented as a live AI-generated daily.
export const practiceNight = {
  title: 'We said one quick stop.',
  brief: 'A missed train. A very public secret. Four pieces of evidence from a night that got away from us.',
  answer: 'Grand Central Terminal',
  aliases: ['Grand Central Terminal', 'Grand Central', 'Grand Central Station', 'GCT'],
  explanation: 'The whispering gallery carries voices between opposite corners. Upstairs, the information booth sits under the famous four-faced clock. The last clue places you at 42nd Street.',
  source: 'https://grandcentralterminal.com/what-to-see/',
  clues: [
    { kind: 'message', time: '11:38 PM', label: 'THE GROUP CHAT', text: 'MAYA: he just confessed his love to a wall\nJULES: please tell me that is a metaphor\nMAYA: no. i’m in the opposite corner and i heard every word.' },
    { kind: 'receipt', time: '11:46 PM', label: 'RECOVERED FROM A POCKET', text: 'NIGHT OUT / DAMAGE REPORT\n1 missed train         tragic\n2 opposite corners     suspicious\n1 accidental confession  overdue\n----------------------------\nTOTAL                  no way home\nMeet us by the clock upstairs.' },
    { kind: 'note', time: '11:52 PM', label: 'UNSENT NOTES APP APOLOGY', text: 'In my defense, I thought the tiled arches would keep a secret. The clock has four faces and somehow I am still the most two-faced thing in this building.' },
    { kind: 'dispatch', time: '12:04 AM', label: 'LAST KNOWN LOCATION', text: 'Manhattan. East 42nd Street. A landmark railway terminal with a whispering gallery. Someone finally looks up from the group chat.' },
  ] satisfies Clue[],
};
