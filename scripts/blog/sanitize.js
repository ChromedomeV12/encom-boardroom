// HTML and URL sanitization for build-time markdown output.
// Content is author-owned (Obsidian vault), not user-submitted, so this
// focuses on the realistic XSS vectors a compromised or careless author
// could introduce: javascript:/data: URLs, event handlers, and dangerous
// elements. It does not strip benign presentation elements authors intend.

// Elements that can execute script or pull remote resources unsafely.
const DANGEROUS_ELEMENTS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'applet',
  'link', 'meta', 'base', 'form'
]);

// URL schemes that are safe to allow in href/src.
const SAFE_URL_SCHEMES = new Set([
  'http', 'https', 'mailto', 'tel', 'ftp', 'ftps'
]);


// Named references whose decoded values can affect URL parsing. The HTML
// standard has many typographic names; these ASCII/control names are the
// complete security-relevant subset for scheme and whitespace checks.
const NAMED_CHARACTER_REFERENCES = new Map([
  ['amp', '&'], ['apos', "'"], ['ast', '*'], ['bsol', '\\'],
  ['colon', ':'], ['comma', ','], ['commat', '@'], ['dollar', '$'],
  ['diacriticalgrave', '`'], ['equals', '='], ['excl', '!'],
  ['fjlig', 'fj'], ['grave', '`'], ['gt', '>'], ['hat', '^'],
  ['lbrace', '{'], ['lbrack', '['], ['lpar', '('], ['lt', '<'],
  ['lowbar', '_'], ['midast', '*'], ['nbsp', '\u00a0'], ['newline', '\n'],
  ['num', '#'], ['percnt', '%'], ['period', '.'], ['plus', '+'],
  ['quest', '?'], ['quot', '"'], ['rbrace', '}'], ['rbrack', ']'],
  ['rpar', ')'], ['semi', ';'], ['sol', '/'], ['tab', '\t'],
  ['underbar', '_'], ['verbar', '|'], ['vert', '|'], ['verticalline', '|']
]);

/**
 * Decode numeric and named HTML character references before URL parsing.
 * Multiple passes handle safely encoded ampersands such as "&amp;#x6a;".
 */
function decodeHtmlReferences(value) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    const next = decoded.replace(
      /&(#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);?/gi,
      (match, reference) => {
        if (reference[0] === '#') {
          const hexadecimal = /^#x/i.test(reference);
          const digits = hexadecimal ? reference.slice(2) : reference.slice(1);
          const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
          if (
            !Number.isFinite(codePoint) ||
            codePoint <= 0 ||
            codePoint > 0x10ffff ||
            (codePoint >= 0xd800 && codePoint <= 0xdfff)
          ) {
            changed = true;
            return '\ufffd';
          }
          changed = true;
          return String.fromCodePoint(codePoint);
        }
        const replacement = NAMED_CHARACTER_REFERENCES.get(reference.toLowerCase());
        if (replacement == null) return match;
        changed = true;
        return replacement;
      }
    );
    decoded = next;
    if (!changed) break;
  }
  return decoded;
}

/**
 * Normalize and validate a URL for use in href/src.
 * Returns the URL if safe, or '' (empty) if it would execute script.
 * Relative URLs, anchors, and absolute safe-scheme URLs pass through.
 */
export function sanitizeUrl(url) {
  if (url == null) return '';
  const str = String(url).trim();
  if (!str) return '';
  // Decode all HTML references that might hide a scheme.
  const decoded = decodeHtmlReferences(str);
  // Strip whitespace/control chars that can hide the scheme from parsers.
  const controlStripped = decoded.replace(/[\s\u0000-\u001f\u007f-\u009f]+/gu, '');
  const schemeMatch = controlStripped.match(/^([a-zA-Z][a-zA-Z0-9+.\-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (!SAFE_URL_SCHEMES.has(scheme)) return '';
  }
  // Block anything that looks like it's trying to be javascript: after
  // decoding even if the scheme regex did not catch it.
  if (/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i.test(controlStripped)) return '';
  if (/v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i.test(controlStripped)) return '';
  return str;
}

/**
 * Sanitize an HTML string produced by the markdown renderer.
 * Removes dangerous elements and event-handler attributes while
 * preserving the rest of the author's intended markup.
 *
 * Uses a regex-based walk over tags. This is safe for build-time output
 * because the input is already markdown-rendered (not arbitrary HTML)
 * and we only need to neutralize the specific vectors above.
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';
  // Remove HTML comments that could hide conditional-comment IE scripts.
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  // Remove dangerous elements entirely (including their content).
  const dangerRe = new RegExp(
    '<(' + [...DANGEROUS_ELEMENTS].join('|') + ')\\b[^>]*>[\\s\\S]*?</\\1\\s*>',
    'gi'
  );
  out = out.replace(dangerRe, '');
  // Also drop self-closing/dangling dangerous tags.
  out = out.replace(
    new RegExp('<(?:' + [...DANGEROUS_ELEMENTS].join('|') + ')\\b[^>]*/?>', 'gi'),
    ''
  );
  // Strip on* event handler attributes from every remaining tag.
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Sanitize href/src/cite/action/formaction/xlink:href URLs in attributes.
  out = out.replace(
    /((?:href|src|cite|action|formaction|xlink:href)\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi,
    (match, prefix, valueRaw) => {
      const value = valueRaw.replace(/^["']|["']$/g, '');
      const safe = sanitizeUrl(value);
      if (!safe) return '';
      return prefix + '"' + safe.replace(/"/g, '&quot;') + '"';
    }
  );
  return out;
}
