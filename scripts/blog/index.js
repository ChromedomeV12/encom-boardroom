// Derived index computation: backlinks, link degree/popularity, related
// posts, publication buckets, tag/category/year indexes, and the full
// BLOG_INDEX manifest consumed by the runtime adapter.
import slugify from './slug.js';

/**
 * Given an array of normalized posts (each already carrying outgoingLinks
 * and assets), compute backlinks and link degree in place.
 * Mutates posts: each post gets backlinks=[{slug,title}] and linkDegree=N.
 */
export function computeBacklinks(posts) {
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  // Reset / initialize.
  for (const p of posts) {
    p.backlinks = [];
  }
  for (const p of posts) {
    for (const out of p.outgoingLinks || []) {
      const target = bySlug.get(out.slug);
      if (target) {
        target.backlinks.push({ slug: p.slug, title: p.title });
      }
    }
  }
  // Link degree = outgoing + incoming.
  for (const p of posts) {
    p.linkDegree = (p.outgoingLinks?.length || 0) + (p.backlinks?.length || 0);
  }
}

/**
 * Compute related posts for a given post.
 * Relatedness = shared tags (weight 2) + shared category (weight 1) +
 * backlink relationship (weight 3). Returns up to `limit` slugs.
 */
export function computeRelated(post, posts, limit = 4) {
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  const scores = new Map();
  for (const other of posts) {
    if (other.slug === post.slug) continue;
    let score = 0;
    const postTags = new Set(post.tags || []);
    const otherTags = new Set(other.tags || []);
    for (const t of otherTags) if (postTags.has(t)) score += 2;
    if (post.category && post.category === other.category) score += 1;
    const backlinkSlugs = new Set((post.backlinks || []).map((b) => b.slug));
    if (backlinkSlugs.has(other.slug)) score += 3;
    const outgoingSlugs = new Set((post.outgoingLinks || []).map((o) => o.slug));
    if (outgoingSlugs.has(other.slug)) score += 3;
    if (score > 0) scores.set(other.slug, score);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug]) => ({ slug, title: bySlug.get(slug)?.title || slug }));
}

/**
 * Build the full BLOG_INDEX manifest consumed by the runtime.
 * Includes postsBySlug, featuredPosts, latestPosts, archiveByYear,
 * tags, categories, backlinksBySlug, relatedBySlug, and series.
 */
export function buildIndex(posts) {
  const sortedLatest = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

  const pushIndex = (index, key, slug) => {
    if (!key) return;
    if (!index[key]) index[key] = [];
    index[key].push(slug);
  };

  const blogIndex = {
    postsBySlug: {},
    featuredPosts: [],
    latestPosts: [],
    archiveByYear: {},
    archiveByMonth: {},
    tags: {},
    categories: {},
    backlinksBySlug: {},
    relatedBySlug: {},
    series: {},
    totalCount: posts.length,
    wordCount: 0
  };

  for (const p of sortedLatest) {
    blogIndex.postsBySlug[p.slug] = {
      slug: p.slug,
      title: p.title,
      date: p.date,
      category: p.category,
      tags: p.tags,
      excerpt: p.excerpt,
      readTime: p.readTime,
      wordCount: p.wordCount,
      featured: p.featured
    };
    blogIndex.latestPosts.push(p.slug);
    if (p.featured) blogIndex.featuredPosts.push(p.slug);
    pushIndex(blogIndex.archiveByYear, String(p.date || '').slice(0, 4), p.slug);
    pushIndex(blogIndex.archiveByMonth, String(p.date || '').slice(0, 7), p.slug);
    pushIndex(blogIndex.categories, p.category, p.slug);
    for (const tag of p.tags) pushIndex(blogIndex.tags, tag, p.slug);
    if (p.series) pushIndex(blogIndex.series, p.series, p.slug);
    blogIndex.backlinksBySlug[p.slug] = (p.backlinks || []).map((b) => b.slug);
    blogIndex.relatedBySlug[p.slug] = computeRelated(p, sortedLatest).map((r) => r.slug);
    blogIndex.wordCount += p.wordCount || 0;
  }

  // Sort archive groups chronologically (latest first within each bucket).
  for (const key of Object.keys(blogIndex.archiveByYear)) {
    blogIndex.archiveByYear[key].sort((a, b) =>
      new Date(byDate(posts, b)) - new Date(byDate(posts, a)));
  }
  for (const key of Object.keys(blogIndex.archiveByMonth)) {
    blogIndex.archiveByMonth[key].sort((a, b) =>
      new Date(byDate(posts, b)) - new Date(byDate(posts, a)));
  }

  return blogIndex;
}

function byDate(posts, slug) {
  const p = posts.find((x) => x.slug === slug);
  return p?.date || '1970-01-01';
}

