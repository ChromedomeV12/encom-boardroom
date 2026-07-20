// Obsidian wikilink and embed resolution.
// Converts [[Wikilinks]], [[Wikilinks|Alias]], [[#Heading]], and ![[embeds]]
// into standard markdown links/images, collecting outgoing links and
// referenced assets for later validation and backlink computation.
import { normalizeAssetTarget, normalizeWikilinkTarget, resolveSafeAssetPath } from './assets.js';
import slugify from './slug.js';

/**
 * Process the raw markdown body to resolve Obsidian wikilink syntax.
 * - ![[asset.png]] and ![[asset.png|alt]]  -> ![alt](blog-assets/asset.png)
 * - [[Note]] and [[Note|alias]]            -> [alias](#post:<slug>)
 * - [[#Heading]]                            -> [Heading](#<heading-slug>)  (same-doc anchor)
 * - [[Note#Heading]]                        -> [Heading](#post:<slug>)     (cross-note anchor resolved later)
 *
 * `postByTitle` is a Map of lowercased-title -> { slug, title } for
 * resolving which note a wikilink points at.
 *
 * Returns { body, outgoingLinks, assets } where outgoingLinks is a
 * de-duplicated array of { slug, title } and assets is an array of
 * relative asset paths (already normalized, alias-stripped).
 *
 * `diagnostics` receives entries for missing targets.
 */
export function resolveWikilinks(source, postByTitle, sourceDir, diagnostics) {
  if (typeof source !== 'string') return { body: '', outgoingLinks: [], assets: [] };

  const outgoing = new Map();
  const assets = [];

  // Embeds first: ![[target]] or ![[target|alt]]
  let body = source.replace(/!\[\[([^\]]+)\]\]/g, (match, raw) => {
    const target = normalizeAssetTarget(raw);
    const alt = raw.includes('|') ? raw.split('|')[1].trim() : target;
    // Safety: refuse to resolve traversal/absolute paths as embeds.
    const safe = resolveSafeAssetPath(sourceDir, target);
    if (!safe) {
      diagnostics.error({
        type: 'unsafe-embed',
        message: `Embed "${target}" resolves outside the vault and was blocked.`,
        context: target
      });
      return match;
    }
    assets.push(target);
    return `![${alt}](blog-assets/${target})`;
  });

  // Wikilinks: [[target]] or [[target|alias]]
  body = body.replace(/\[\[([^\]]+)\]\]/g, (match, raw) => {
    const [targetPart, alias] = raw.split('|').map((p) => p.trim());
    const { title, anchor } = normalizeWikilinkTarget(targetPart);

    // Same-document heading link: [[#Heading]]
    if (!title && anchor) {
      return `[${alias || anchor}](#${slugify(anchor)})`;
    }

    const linked = postByTitle.get(title.toLowerCase());
    if (linked) {
      outgoing.set(linked.slug, { slug: linked.slug, title: linked.title });
      const label = alias || (anchor ? anchor : linked.title);
      // Cross-note heading anchor: point at the post, browser scrolls to anchor later.
      if (anchor) {
        return `[${label}](#post:${linked.slug}:${slugify(anchor)})`;
      }
      return `[${label}](#post:${linked.slug})`;
    }

    // Not found. Emit a diagnostic, but still produce a link so the doc
    // is usable; the href points at a slugified placeholder.
    diagnostics.error({
      type: 'missing-wikilink',
      message: `Wikilink target "${title}" is not a published post.`,
      context: title
    });
    const fallbackSlug = slugify(title) || 'unknown';
    return `[${alias || title}](#post:${fallbackSlug})`;
  });

  return {
    body,
    outgoingLinks: [...outgoing.values()],
    assets
  };
}
