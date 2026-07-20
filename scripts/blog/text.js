// Small shared text helpers used across blog build modules.

/** Strip a leading UTF-8 BOM if present. */
export function stripBom(text) {
  if (typeof text !== 'string') return '';
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Normalize CRLF/CR to LF. */
export function normalizeNewlines(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\r\n?/g, '\n');
}
