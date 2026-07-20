// Deterministic, Unicode-aware slug generation for ENCOM archive posts.
// Goals: stable across rebuilds, safe in URLs and filenames, handles
// spaces, Unicode, apostrophes, and collapses separators.
import { stripBom } from './text.js';

/**
 * Convert a title or label into a URL-safe slug.
 * - Lowercases
 * - Strips apostrophes/quotes
 * - Replaces any run of non-alphanumeric characters with a single hyphen
 * - Trims leading/trailing hyphens
 * - Returns empty string if nothing remains
 *
 * Unicode letters/digits are preserved (NFC-normalized) so non-ASCII
 * titles keep meaningful characters rather than being fully stripped.
 */
export default function slugify(value) {
  if (value == null) return '';
  const text = stripBom(String(value))
    .normalize('NFC')
    .toLowerCase()
    .replace(/['"`’]/g, '')
    // collapse any run of chars that are NOT letters, numbers, or marks
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return text;
}
