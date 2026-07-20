// Obsidian-specific markdown normalization that runs before the GFM
// renderer. Converts Obsidian callout syntax into standard markdown
// blockquotes so marked can render them without a custom extension.

// Matches Obsidian callout blocks: "> [!type]+ title"
const CALLOUT_RE = /^>\s*\[!([A-Za-z0-9_-]+)\](\+?)\s*(.*)$/gm;

/**
 * Normalize Obsidian callouts into labeled blockquotes.
 *   > [!note] Reader-first rule
 *   > The body text...
 * becomes:
 *   > **Reader-first rule**
 *   > The body text...
 *
 * If the title is empty, the callout type is used as the label uppercased.
 * The trailing callout body lines (those starting with "> ") are preserved
 * as blockquote continuation.
 */
export function normalizeCallouts(source) {
  if (typeof source !== 'string') return '';
  return source.replace(CALLOUT_RE, (_match, type, _plus, title) => {
    const label = title.trim() || type.toUpperCase();
    return `> **${label}**`;
  });
}