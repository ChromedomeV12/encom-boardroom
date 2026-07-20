// Excerpt extraction: derive a plain-text summary from rendered HTML.
// Strips tags, collapses whitespace, and truncates to ~30 words or 240 chars,
// preferring a complete sentence boundary when possible.

/**
 * Build a plain-text excerpt from rendered post HTML.
 * Returns a string (possibly empty) suitable for meta descriptions and
 * list-item previews.
 */
export function buildExcerpt(html, description, maxWords = 30, maxChars = 240) {
  if (description && description.trim()) {
    return description.trim();
  }
  if (typeof html !== 'string' || !html) return '';
  // Strip headings and their text — we want body prose only.
  const bodyOnly = html
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!bodyOnly) return '';
  const words = bodyOnly.split(' ').filter(Boolean);
  if (words.length <= maxWords) return bodyOnly.slice(0, maxChars);
  let excerpt = words.slice(0, maxWords).join(' ');
  // Try to cut at a sentence end within the window.
  const sentenceEnd = excerpt.search(/[.!?]\s/);
  if (sentenceEnd > 20 && sentenceEnd < excerpt.length) {
    excerpt = excerpt.slice(0, sentenceEnd + 1);
  } else {
    excerpt += '…';
  }
  if (excerpt.length > maxChars) excerpt = excerpt.slice(0, maxChars - 1) + '…';
  return excerpt;
}