// Heading extraction and table-of-contents generation.
// Uses github-slugger so heading IDs match GitHub/Obsidian conventions
// and are deterministic across rebuilds. Duplicate headings get -1, -2, ...
import GithubSlugger from 'github-slugger';

/**
 * Extract headings from rendered HTML.
 * Returns an array of { id, level, text } entries for h1-h6.
 * The HTML must already contain heading tags (from the markdown renderer).
 */
export function extractHeadings(html) {
  if (typeof html !== 'string') return [];
  const slugger = new GithubSlugger();
  const headings = [];
  const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = headingRe.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    // Strip any tags inside the heading text (e.g. <code>foo</code>).
    const rawText = match[2].replace(/<[^>]+>/g, '').trim();
    if (!rawText) continue;
    const id = slugger.slug(rawText);
    headings.push({ id, level, text: rawText });
  }
  return headings;
}

/**
 * Inject id attributes into heading tags in rendered HTML so in-page
 * anchor links and the TOC resolve. Must run before sanitizeHtml in the
 * pipeline so the ids are present, but slug ids are safe (alphanumeric+hyphens).
 */
export function injectHeadingIds(html) {
  if (typeof html !== 'string') return '';
  const slugger = new GithubSlugger();
  return html.replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, level, attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (!text) return match;
      const id = slugger.slug(text);
      // If an id is already present, leave it alone.
      if (/\sid\s*=/.test(attrs)) return match;
      return '<h' + level + attrs + ' id="' + id + '">' + inner + '</h' + level + '>';
    }
  );
}

/**
 * Build a nested TOC structure from a flat headings array.
 * Returns a tree of { id, text, level, children: [] }.
 * Headings are nested under the nearest preceding lower-level heading.
 */
export function buildTocTree(headings) {
  if (!headings || !headings.length) return [];
  const root = [];
  // Stack of { node, level } for the current nesting path.
  const stack = [];
  for (const h of headings) {
    const node = { id: h.id, text: h.text, level: h.level, children: [] };
    // Pop the stack until we find a parent with a strictly lower level.
    while (stack.length && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    if (stack.length) {
      stack[stack.length - 1].node.children.push(node);
    } else {
      root.push(node);
    }
    stack.push({ node, level: h.level });
  }
  return root;
}

/**
 * Render a TOC tree as a nested <ul> of anchor links.
 * Returns an HTML string (or '' if no headings).
 */
export function renderTocHtml(tocTree) {
  if (!tocTree || !tocTree.length) return '';
  const renderList = (items) => {
    const lis = items.map((item) => {
      const nested = item.children && item.children.length
        ? renderList(item.children)
        : '';
      return '<li><a href="#' + item.id + '">' + escapeToc(item.text) + '</a>' + nested + '</li>';
    });
    return '<ul>' + lis.join('') + '</ul>';
  };
  return renderList(tocTree);
}

function escapeToc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
