// One file. Edit here to update the CV.
// Dates are display strings (e.g. "2023–2026 (expected)") so you can describe
// things like "ongoing", "expected", or ranges without fighting date types.

export interface Profile {
  name: string;
  tagline: string;
  location: string;
  email: string;
  site: string;
  connections: Connection[];
}

export interface Connection {
  label: string;
  url: string;
}

export interface Education {
  degree: string;
  institution: string;
  location?: string;
  dates: string;
  note?: string;
}

export interface Work {
  role: string;
  organization: string;
  url?: string;
  location?: string;
  dates: string;
  description: string;
}

export const profile: Profile = {
  name: 'Alfred Birkelund',
  tagline: 'Economics student and founder of Conviction.',
  location: 'Nakskov & Odense, Denmark',
  email: 'alfred@alfredbirkelund.com',
  site: 'alfredbirkelund.com',
  // Edit URLs to match your actual handles. Order here is the render order.
  // To remove a connection, delete the object. To add one (Twitter, Bluesky,
  // Scholar, ORCID, …), append another `{ label, url }` entry.
  connections: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/alfredbirkelund' },
    { label: 'GitHub', url: 'https://github.com/alfredbirkelund' },
  ],
};

export const education: Education[] = [
  {
    degree: 'BSc in Economics',
    institution: 'University of Southern Denmark (SDU)',
    location: 'Odense, Denmark',
    dates: '2023–2026 (expected)',
    note: 'Focus on econometrics, financial economics, and quantitative methods.',
  },
];

export const work: Work[] = [
  {
    role: 'Founder',
    organization: 'Conviction',
    url: 'https://convictioninvest.com',
    dates: '2024–present',
    description:
      'Investment research platform synthesizing insider transactions, institutional filings, political trading data, and company fundamentals into a single view for serious investors.',
  },
];
