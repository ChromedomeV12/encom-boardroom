// GFM markdown rendering using marked, with Obsidian callout normalization,
// heading ID injection, and HTML/URL sanitization.
// This is build-time only; the runtime never loads marked.
import { marked } from 'marked';
import { injectHeadingIds, extractHeadings, buildTocTree } from './toc.js';
import { sanitizeHtml } from './sanitize.js';
import { normalizeCallouts } from './obsidian.js';

// Configure marked once: GFM + breaks for Obsidian-style soft breaks.
marked.setOptions({
  gfm: true,
  breaks: false,
  taskLists: true
});

/**
 * Render markdown source to sanitized HTML with heading IDs.
 * Obsidian callouts are normalized to blockquotes first.
 *
 * Returns { html, headings, toc } where:
 * - html: sanitized HTML string with id attributes on headings
 * - headings: flat [{ id, level, text }] for the manifest
 * - toc: nested tree [{ id, text, level, children }]
 */
export function renderMarkdown(source) {
  if (typeof source !== 'string' || !source.trim()) {
    return { html: '', headings: [], toc: [] };
  }
  const preprocessed = normalizeCallouts(source);
  const rawHtml = marked.parse(preprocessed);
  const withIds = injectHeadingIds(rawHtml);
  const sanitized = sanitizeHtml(withIds);
  const headings = extractHeadings(sanitized);
  const toc = buildTocTree(headings);
  return { html: sanitized, headings, toc };
}

/** Count words in a markdown body (rough: split on whitespace, drop markup). */
export function countWords(markdown) {
  if (typeof markdown !== 'string') return 0;
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')      // fenced code blocks
    .replace(/`[^`]+`/g, ' ')              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ')  // links -> keep label? no, drop
    .replace(/[#>*_~\-]/g, ' ')            // markdown punctuation
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

/** Estimate reading time in minutes at ~220 wpm, minimum 1. */
export function estimateReadTime(wordCount) {
  if (!wordCount || wordCount <= 0) return 1;
  return Math.max(1, Math.ceil(wordCount / 220));
}