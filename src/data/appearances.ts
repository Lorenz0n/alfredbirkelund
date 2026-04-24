// Talks, podcasts, interviews, and essays published elsewhere.
// Currently not rendered on any page — this is scaffolding, ready to wire
// up when there's a destination (dedicated page, homepage section, etc.).

export type AppearanceKind = 'Talk' | 'Podcast' | 'Interview' | 'Essay';

export interface Appearance {
  kind: AppearanceKind;
  title: string;
  venue: string;
  date: string;
  url?: string;
  note?: string;
}

export const appearances: Appearance[] = [
  // Example entry format — delete this comment and add your own:
  // {
  //   kind: 'Essay',
  //   title: 'The case for patient capital',
  //   venue: 'Berlingske',
  //   date: '2026-05-14',
  //   url: 'https://www.berlingske.dk/...',
  // },
];
