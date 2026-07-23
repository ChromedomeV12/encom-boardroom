// HTML/XML templates for static publication of ENCOM archive posts.
// All templates produce standalone, readable HTML that works without
// WebGL and without client-side JavaScript. Article pages carry a
// canonical URL, Open Graph data, and Article structured data.

const READABLE_CSS = `
:root{--ink:#d8e1dd;--dim:#6fc0ba;--hot:#ffcc00;--bg:#05090a}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font:17px/1.72 Inconsolata,ui-monospace,monospace;margin:0;padding:0;-webkit-font-smoothing:antialiased}
article{max-width:72ch;margin:0 auto;padding:32px 24px 96px}
a{color:var(--hot);text-decoration:none;border-bottom:1px solid rgba(255,204,0,.4)}
a:hover{color:#fff;border-bottom-color:#fff}
h1{color:#f2f7f4;font-size:clamp(28px,5vw,44px);line-height:1.1;margin:8px 0 18px;border:0}
h2,h3,h4,h5,h6{color:#aed4cf;margin:32px 0 12px;line-height:1.25}
h2{font-size:24px}h3{font-size:20px}
p{margin:18px 0}
.meta{color:var(--dim);font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 24px}
img{display:block;max-width:100%;height:auto;margin:24px auto;border:1px solid rgba(111,192,186,.4)}
blockquote{border-left:2px solid var(--dim);color:#edf4f0;margin:22px 0;padding:6px 0 6px 18px;background:rgba(0,238,238,.04)}
code{background:rgba(0,238,238,.1);padding:1px 5px;border-radius:2px;font-size:15px}
pre{background:rgba(0,0,0,.5);border:1px solid rgba(111,192,186,.25);padding:16px;overflow:auto;border-radius:4px}
pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;margin:22px 0}
th,td{border:1px solid rgba(111,192,186,.3);padding:8px 12px;text-align:left}
th{color:var(--dim)}
hr{border:0;border-top:1px solid rgba(111,192,186,.25);margin:32px 0}
.toc{border:1px solid rgba(111,192,186,.2);padding:14px 20px;margin:24px 0 32px;border-radius:2px}
.toc h2{font-size:13px;color:var(--dim);margin:0 0 10px;text-transform:uppercase;letter-spacing:.08em}
.toc ul{margin:0;padding-left:18px}
.toc li{margin:4px 0}
.crumb{font-size:13px;color:var(--dim);margin:0 0 4px}
.crumb a{color:var(--dim);border:0}
.boardroom-link{display:inline-block;margin:24px 0 0;padding:8px 16px;border:1px solid var(--dim);color:var(--dim);font-size:13px;text-transform:uppercase;letter-spacing:.06em}
.boardroom-link:hover{color:var(--bg);background:var(--dim)}
.related,.links{border-top:1px solid rgba(111,192,186,.2);margin-top:32px;padding-top:18px}
.related h2,.links h2{color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px}
.related ul,.links ul{list-style:none;margin:0;padding:0}
.related li,.links li{margin:6px 0}
footer{border-top:1px solid rgba(111,192,186,.2);margin-top:48px;padding-top:18px;color:var(--dim);font-size:13px}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media(max-width:620px){article{padding:20px 16px 64px}h1{font-size:28px}}
`;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Return a root-relative URL that retains the configured deployment path.
// `siteUrl` may be an origin root or a project site such as
// https://example.github.io/project.
export function sitePathname(siteUrl, relativePath = '') {
  const pathname = new URL(siteUrl).pathname.replace(/\/+$/, '');
  const relative = String(relativePath).replace(/^\/+/, '');
  return `${pathname || ''}/${relative}`;
}

function rebasePostHtml(html, siteUrl) {
  const basePath = sitePathname(siteUrl).replace(/\/$/, '');
  if (!basePath) return String(html || '');
  return String(html || '').replace(
    /\b(href|src)="\/(posts|blog-assets)\//g,
    `$1="${basePath}/$2/`
  );
}


function renderTocInline(tocTree) {
  if (!tocTree || !tocTree.length) return '';
  const renderList = (items) => {
    const lis = items.map((item) => {
      const nested = item.children && item.children.length ? renderList(item.children) : '';
      return '<li><a href="#' + escapeHtml(item.id) + '">' + escapeHtml(item.text) + '</a>' + nested + '</li>';
    });
    return '<ul>' + lis.join('') + '</ul>';
  };
  return '<nav class="toc"><h2>Contents</h2>' + renderList(tocTree) + '</nav>';
}

function renderLinkList(label, links, siteUrl) {
  if (!links || !links.length) return '';
  const lis = links.map((l) =>
    '<li><a href="' + escapeHtml(sitePathname(siteUrl, `posts/${l.slug}/`)) + '">' + escapeHtml(l.title) + '</a></li>'
  ).join('');
  return '<section class="links"><h2>' + escapeHtml(label) + '</h2><ul>' + lis + '</ul></section>';
}

/**
 * Render a canonical article page.
 * post: the normalized post object (with html, headings, toc, backlinks,
 * outgoingLinks, relatedPosts resolved to {slug,title}).
 * siteUrl: absolute base URL (no trailing slash).
 */
export function renderArticlePage(post, siteUrl) {
  const canonical = `${siteUrl}/posts/${post.slug}/`;
  const ogImage = post.hero ? `${siteUrl}/blog-assets/${post.hero}` : '';
  const dateISO = post.date ? new Date(post.date).toISOString() : '';
  const related = (post.relatedPosts || [])
    .map((item) => {
      if (typeof item === 'string') return { slug: item, title: item };
      if (!item || typeof item !== 'object') return null;
      const slug = String(item.slug || '').trim();
      if (!slug) return null;
      return { slug, title: String(item.title || slug) };
    })
    .filter(Boolean);
  const backlinkTitles = post.backlinks || [];
  const outgoingTitles = post.outgoingLinks || [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || post.description || '',
    datePublished: dateISO,
    dateModified: post.updated ? new Date(post.updated).toISOString() : dateISO,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    url: canonical,
    author: { '@type': 'Organization', name: 'ENCOM Archive' },
    publisher: { '@type': 'Organization', name: 'ENCOM Archive' }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(post.title)} — ENCOM Archive</title>
<meta name="description" content="${escapeHtml(post.excerpt || post.description || '')}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(post.title)}">
<meta property="og:description" content="${escapeHtml(post.excerpt || post.description || '')}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:site_name" content="ENCOM Archive">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${escapeJsonForHtml(jsonLd)}</script>
<style>${READABLE_CSS}</style>
</head>
<body>
<article>
<p class="crumb"><a href="${escapeHtml(sitePathname(siteUrl))}">← Archive</a> / ${escapeHtml(post.category || 'Notes')}</p>
<p class="meta">${escapeHtml(post.category || 'Notes')} // ${escapeHtml(String(post.readTime || '?'))} MIN READ // ${escapeHtml(post.date || '')}</p>
<h1>${escapeHtml(post.title)}</h1>
${post.description ? `<p class="meta">${escapeHtml(post.description)}</p>` : ''}
${renderTocInline(post.toc)}
${rebasePostHtml(post.html, siteUrl)}
${renderLinkList('Links Out', outgoingTitles, siteUrl)}
${renderLinkList('Linked From', backlinkTitles, siteUrl)}
${related.length ? renderLinkList('Related', related, siteUrl) : ''}
<a class="boardroom-link" href="${escapeHtml(sitePathname(siteUrl))}?post=${encodeURIComponent(post.slug)}">Open in Boardroom →</a>
<footer>
<p>ENCOM Archive — ${escapeHtml(String(post.wordCount || ''))} words // ${escapeHtml(post.date || '')}</p>
</footer>
</article>
</body>
</html>`;
}

/**
 * Render an index/discovery page (latest, featured, tag, category, archive).
 * title, posts (array of {slug,title,excerpt,date,category,readTime,tags}),
 * canonicalUrl.
 */
export function renderIndexPage(title, posts, canonicalUrl, description = '', siteUrl = canonicalUrl) {
  const items = posts.map((p) => {
    const href = sitePathname(siteUrl, `posts/${p.slug}/`);
    return `<article style="border-bottom:1px solid rgba(111,192,186,.15);padding:18px 0;margin:0">
<p class="meta">${escapeHtml(p.category || 'Notes')} // ${escapeHtml(String(p.readTime || '?'))}m // ${escapeHtml(p.date || '')}</p>
<h2 style="margin:4px 0 6px;font-size:20px"><a href="${href}" style="border:0;color:#f2f7f4">${escapeHtml(p.title)}</a></h2>
<p style="color:#b8c4c0;margin:4px 0 0;font-size:15px">${escapeHtml(p.excerpt || p.description || '')}</p>
</article>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — ENCOM Archive</title>
<meta name="description" content="${escapeHtml(description || title)}">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description || title)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta property="og:site_name" content="ENCOM Archive">
<style>${READABLE_CSS}</style>
</head>
<body>
<article>
<p class="crumb"><a href="${escapeHtml(sitePathname(siteUrl))}">← Archive</a></p>
<h1>${escapeHtml(title)}</h1>
${description ? `<p style="color:#b8c4c0">${escapeHtml(description)}</p>` : ''}
${items || '<p>No posts.</p>'}
<footer><p><a href="${escapeHtml(sitePathname(siteUrl))}?featured=1">Open Boardroom →</a></p></footer>
</article>
</body>
</html>`;
}

/**
 * Render an RSS 2.0 feed.
 * posts: array of normalized posts (newest first). siteUrl, title, description.
 */
export function renderRss(posts, siteUrl, title, description) {
  const items = posts.map((p) => {
    const url = `${siteUrl}/posts/${p.slug}/`;
    const pubDate = p.date ? new Date(p.date).toUTCString() : '';
    return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(p.excerpt || p.description || '')}</description>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <category>${escapeXml(p.category || 'Notes')}</category>
    </item>`;
  }).join('\n');

  let lastBuildTime = 0;
  posts.forEach((post) => {
    const timestamp = Date.parse(post.updated || post.date || '');
    if (Number.isFinite(timestamp) && timestamp > lastBuildTime) lastBuildTime = timestamp;
  });
  const lastBuildDate = lastBuildTime ? new Date(lastBuildTime).toUTCString() : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

/**
 * Render a sitemap.xml from all post URLs plus discovery pages.
 * posts: array of normalized posts. siteUrl. extraUrls: array of {url,lastmod?}.
 */
export function renderSitemap(posts, siteUrl, extraUrls = []) {
  const postUrls = posts.map((p) => ({
    url: `${siteUrl}/posts/${p.slug}/`,
    lastmod: p.updated || p.date || ''
  }));
  const allUrls = [...postUrls, ...extraUrls];
  const entries = allUrls.map((entry) => {
    const lastmod = entry.lastmod
      ? `<lastmod>${new Date(entry.lastmod).toISOString().slice(0, 10)}</lastmod>`
      : '';
    return `  <url><loc>${escapeXml(entry.url)}</loc>${lastmod}</url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

/**
 * Render a lightweight metadata manifest (JSON) for the runtime to consume
 * without loading the full per-post HTML. This is the discovery payload.
 */
export function renderManifest(posts, index) {
  return JSON.stringify({
    site: 'ENCOM Archive',
    totalCount: index.totalCount,
    wordCount: index.wordCount,
    featuredPosts: index.featuredPosts,
    latestPosts: index.latestPosts,
    tags: index.tags,
    categories: index.categories,
    archiveByYear: index.archiveByYear,
    archiveByMonth: index.archiveByMonth,
    posts: posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      date: p.date,
      category: p.category,
      tags: p.tags,
      readTime: p.readTime,
      wordCount: p.wordCount,
      featured: p.featured,
      location: p.location || null
    }))
  }, null, 2);
}
