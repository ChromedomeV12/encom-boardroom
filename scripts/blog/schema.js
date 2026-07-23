// Normalized metadata schema and validation for ENCOM archive posts.
// This is the shared contract every other scripts/blog/ module depends on.
import slugify from './slug.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Coerce a raw frontmatter value into a string array.
 * Accepts: string, array of strings, comma-separated string.
 */
function toStringArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const str = String(value).trim();
  if (!str) return [];
  // js-yaml may leave a flow-style string like "[a, b]" if the user quoted it.
  if (str.startsWith('[') && str.endsWith(']')) {
    return str
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  return [str];
}

function toBool(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const str = String(value).trim().toLowerCase();
  if (str === 'true' || str === 'yes' || str === '1') return true;
  if (str === 'false' || str === 'no' || str === '0') return false;
  return fallback;
}

function toValidDate(value, diagnostics, context) {
  if (value == null || value === '') return '';
  // js-yaml may parse bare dates into Date objects.
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (DATE_RE.test(str)) return str;
  // Accept full ISO datetimes by taking the date portion.
  const iso = Date.parse(str);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
  diagnostics.push({
    type: 'invalid-date',
    message: `Invalid date "${str}" in ${context}`,
    context
  });
  return '';
}

function toOptionalString(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * Validate and normalize a single post's raw frontmatter + file metadata.
 * Returns { post, diagnostics } where `post` is the normalized metadata
 * (no html/excerpt/derived fields yet — those are added by later stages).
 */
export function normalizePostMeta(raw, fileMeta, diagnostics) {
  const ctx = fileMeta.relPath || fileMeta.slug || 'post';
  const title = toOptionalString(raw.title) || fileMeta.basename || 'Untitled';
  const explicitSlug = toOptionalString(raw.slug);
  const generatedSlug = slugify(title) || slugify(fileMeta.basename);
  // Slugs are path segments, not arbitrary route fragments. Normalize explicit
  // values through the same Unicode-aware slugifier used for title fallbacks.
  const slug = explicitSlug ? slugify(explicitSlug) || generatedSlug : generatedSlug;

  const date = toValidDate(raw.date, diagnostics, ctx);
  const updated = toValidDate(raw.updated, diagnostics, ctx);

  const tags = toStringArray(raw.tags);
  const aliases = toStringArray(raw.aliases);
  const redirectFrom = toStringArray(raw.redirectFrom);

  const draft = toBool(raw.draft, false);
  const featured = toBool(raw.featured, false);

  const category = toOptionalString(raw.category) || 'Notes';
  const description = toOptionalString(raw.description);
  const hero = toOptionalString(raw.hero);
  const series = toOptionalString(raw.series);
  const themeColor = toOptionalString(raw.themeColor);

  // location: either "lat, lng" string or {lat, lng} map
  let location = null;
  if (raw.location != null) {
    if (typeof raw.location === 'object' && !Array.isArray(raw.location)) {
      const lat = Number(raw.location.lat);
      const lng = Number(raw.location.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          location = { lat, lng, label: toOptionalString(raw.location.label) || '' };
        } else {
          diagnostics.push({ type: 'invalid-location', message: `Location coordinates out of range in ${ctx}`, context: ctx });
        }
      } else {
        diagnostics.push({ type: 'invalid-location', message: `Invalid location object in ${ctx}`, context: ctx });
      }
    } else {
      const str = String(raw.location).trim();
      const m = str.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
      if (m) {
        const lat = Number(m[1]);
        const lng = Number(m[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          location = { lat, lng, label: '' };
        } else {
          diagnostics.push({ type: 'invalid-location', message: `Location coordinates out of range in ${ctx}`, context: ctx });
        }
      } else {
        diagnostics.push({ type: 'invalid-location', message: `Unparseable location "${str}" in ${ctx}`, context: ctx });
      }
    }
  }

  const id = slug;

  return {
    id,
    slug,
    title,
    description,
    date,
    updated,
    tags,
    category,
    featured,
    draft,
    aliases,
    hero,
    series,
    location,
    redirectFrom,
    themeColor,
    // file provenance (relative only — keeps output deterministic across build roots)
    relPath: fileMeta.relPath || ''
  };
}

/**
 * Validate that a normalized post has the minimum required fields.
 * Adds diagnostics for hard errors and returns true if the post is usable.
 */
export function validateRequired(post, diagnostics) {
  let ok = true;
  const ctx = post.relPath || post.slug;
  if (!post.slug) {
    diagnostics.push({ type: 'missing-slug', message: `Post has no resolvable slug: ${ctx}`, context: ctx });
    ok = false;
  }
  if (!post.title) {
    diagnostics.push({ type: 'missing-title', message: `Post has no title: ${ctx}`, context: ctx });
    ok = false;
  }
  if (!post.date) {
    diagnostics.push({ type: 'missing-date', message: `Post has no valid date: ${ctx}`, context: ctx });
    ok = false;
  }
  return ok;
}
