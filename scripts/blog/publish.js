// Static publication writer: consumes normalized posts + index and writes
// canonical article pages, discovery pages, RSS, sitemap, and a manifest.
// All outputs go under <outDir>/posts/<slug>/index.html etc. and are
// readable without WebGL or client-side JavaScript.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  renderArticlePage,
  renderIndexPage,
  renderRss,
  renderSitemap,
  renderManifest,
  sitePathname
} from './template.js';

async function writePage(dir, relPath, content) {
  const fullPath = path.join(dir, relPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf8');
}

/**
 * Publish all static outputs.
 * posts: array of normalized post objects (with html, toc, backlinks, etc.)
 * index: the BLOG_INDEX manifest object
 * options: { outDir, siteUrl, title, description }
 *
 * Writes:
 *   <outDir>/posts/<slug>/index.html   — canonical article pages
 *   <outDir>/index.html                — latest-posts landing
 *   <outDir>/featured/index.html       — featured posts
 *   <outDir>/tags/<tag>/index.html     — per-tag pages
 *   <outDir>/categories/<cat>/index.html — per-category pages
 *   <outDir>/archive/index.html        — year-grouped archive
 *   <outDir>/rss.xml                   — RSS feed
 *   <outDir>/sitemap.xml               — sitemap
 *   <outDir>/manifest.json             — discovery manifest
 *
 * Returns a summary { pages, posts, bytes } for diagnostics.
 */
export async function publish(posts, index, options) {
  const { outDir, siteUrl, title = 'ENCOM Archive', description = 'An Obsidian-powered blog in an ENCOM boardroom interface.' } = options;
  const bySlug = new Map(posts.map((p) => [p.slug, p]));

  // Resolve relatedPosts slugs to {slug,title} for article pages.
  const postsWithRelated = posts.map((p) => ({
    ...p,
    relatedPosts: (p.relatedPosts || []).map((slug) => ({
      slug,
      title: bySlug.get(slug)?.title || slug
    }))
  }));

  let pageCount = 0;
  let byteCount = 0;

  // 1. Canonical article pages
  for (const post of postsWithRelated) {
    const html = renderArticlePage(post, siteUrl);
    await writePage(outDir, `posts/${post.slug}/index.html`, html);
    pageCount++;
    byteCount += html.length;
  }

  // 2. Latest landing
  const latestPosts = (index.latestPosts || []).map((s) => bySlug.get(s)).filter(Boolean);
  const landingHtml = renderIndexPage('ENCOM Archive — Latest', latestPosts, `${siteUrl}/`, description, siteUrl);
  await writePage(outDir, 'index.html', landingHtml);
  pageCount++; byteCount += landingHtml.length;

  // 3. Featured
  const featuredPosts = (index.featuredPosts || []).map((s) => bySlug.get(s)).filter(Boolean);
  const featuredHtml = renderIndexPage(
    'Featured',
    featuredPosts,
    `${siteUrl}/featured/`,
    'Featured archive selections.',
    siteUrl
  );
  await writePage(outDir, 'featured/index.html', featuredHtml);
  pageCount++; byteCount += featuredHtml.length;

  // 4. Tag pages
  for (const [tag, slugs] of Object.entries(index.tags || {})) {
    const tagPosts = slugs.map((s) => bySlug.get(s)).filter(Boolean);
    const tagSlug = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untagged';
    const html = renderIndexPage(`Tag: ${tag}`, tagPosts, `${siteUrl}/tags/${tagSlug}/`, `Posts tagged ${tag}.`, siteUrl);
    await writePage(outDir, `tags/${tagSlug}/index.html`, html);
    pageCount++; byteCount += html.length;
  }

  // 5. Category pages
  for (const [cat, slugs] of Object.entries(index.categories || {})) {
    const catPosts = slugs.map((s) => bySlug.get(s)).filter(Boolean);
    const catSlug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'notes';
    const html = renderIndexPage(`Category: ${cat}`, catPosts, `${siteUrl}/categories/${catSlug}/`, `Posts in ${cat}.`, siteUrl);
    await writePage(outDir, `categories/${catSlug}/index.html`, html);
    pageCount++; byteCount += html.length;
  }

  // 6. Archive (year-grouped)
  const years = Object.keys(index.archiveByYear || {}).sort().reverse();
  let archiveItems = '';
  for (const year of years) {
    const yearPosts = (index.archiveByYear[year] || []).map((s) => bySlug.get(s)).filter(Boolean);
    const yearHtml = renderIndexPage(`Archive: ${year}`, yearPosts, `${siteUrl}/archive/${year}/`, `Posts from ${year}.`, siteUrl);
    await writePage(outDir, `archive/${year}/index.html`, yearHtml);
    pageCount++; byteCount += yearHtml.length;
    archiveItems += `<li><a href="${sitePathname(siteUrl, `archive/${year}/`)}">${year}</a> (${yearPosts.length})</li>`;
  }
  const archiveIndexHtml = renderIndexPage('Archive', [], `${siteUrl}/archive/`, 'All posts by year.', siteUrl)
    .replace('<p>No posts.</p>', `<ul>${archiveItems}</ul>`);
  await writePage(outDir, 'archive/index.html', archiveIndexHtml);
  pageCount++; byteCount += archiveIndexHtml.length;

  // 7. RSS
  const rss = renderRss(posts, siteUrl, title, description);
  await writePage(outDir, 'rss.xml', rss);
  pageCount++; byteCount += rss.length;

  // 8. Sitemap
  const discoveryUrls = [
    { url: `${siteUrl}/`, lastmod: '' },
    { url: `${siteUrl}/featured/`, lastmod: '' },
    { url: `${siteUrl}/archive/`, lastmod: '' }
  ];
  for (const tag of Object.keys(index.tags || {})) {
    const tagSlug = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untagged';
    discoveryUrls.push({ url: `${siteUrl}/tags/${tagSlug}/`, lastmod: '' });
  }
  for (const cat of Object.keys(index.categories || {})) {
    const catSlug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'notes';
    discoveryUrls.push({ url: `${siteUrl}/categories/${catSlug}/`, lastmod: '' });
  }
  for (const year of years) {
    discoveryUrls.push({ url: `${siteUrl}/archive/${year}/`, lastmod: '' });
  }
  const sitemap = renderSitemap(posts, siteUrl, discoveryUrls);
  await writePage(outDir, 'sitemap.xml', sitemap);
  pageCount++; byteCount += sitemap.length;

  // 9. Manifest
  const manifest = renderManifest(posts, index);
  await writePage(outDir, 'manifest.json', manifest);
  pageCount++; byteCount += manifest.length;

  return { pages: pageCount, posts: posts.length, bytes: byteCount };
}
