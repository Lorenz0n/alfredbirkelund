// Approximate reading time from raw MDX body. Strips imports, JSX/HTML tags,
// fenced and inline code, and markdown punctuation, then divides word count
// by an average reading pace of 220 wpm (a common long-form benchmark).

const WORDS_PER_MINUTE = 220;

export function readingMinutes(body: string): number {
  const cleaned = body
    .replace(/^import\s.+$/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[#*_~>]/g, '');
  const words = cleaned.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
