import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publishScript = path.join(repoRoot, 'scripts', 'publish-blog.mjs');

async function fixtureRoot(name) {
  return mkdtemp(path.join(os.tmpdir(), `encom-pub-${name}-`));
}

async function writePost(root, filename, source) {
  const filePath = path.join(root, 'content', 'obsidian', filename);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, source.trimStart(), 'utf8');
}

async function writeFileRaw(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function runPublish(root, siteUrl = 'https://archive.example.com') {
  const outDir = path.join(root, 'dist');
  await execFileAsync(process.execPath, [
    publishScript, `--site-url=${siteUrl}`, `--out=${outDir}`
  ], { cwd: root });
  return outDir;
}

async function readDir(dir) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...await readDir(full));
    else results.push(full);
  }
  return results;
}

function toPosixRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

async function testSiteUrlRequired() {
  const root = await fixtureRoot('site-url-required');
  await assert.rejects(
    execFileAsync(process.execPath, [publishScript, `--out=${path.join(root, 'dist')}`], {
      cwd: root,
      env: { ...process.env, BLOG_SITE_URL: '' }
    }),
    /A canonical site URL is required/
  );
}

async function testRootMetadataKeepsOwnershipSeparateFromAttribution() {
  const html = await readFile(path.join(repoRoot, 'index.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="\.\/"\s*\/>/);
  assert.doesNotMatch(
    html,
    /<link rel="canonical"[^>]+(?:robscanlon\.com|github\.com\/arscan)/i,
    'the personal deployment must not claim an upstream URL as canonical'
  );
  assert.match(
    html,
    /This was created by <a href="https:\/\/twitter\.com\/arscan"/,
    'upstream attribution remains visible separately from canonical ownership'
  );
}

// --- Test 1: Canonical article pages are generated and JS-free -----------
async function testArticlePagesGenerated() {
  const root = await fixtureRoot('article');
  await mkdir(path.join(root, 'content', 'obsidian', 'attachments'), { recursive: true });
  await writeFile(path.join(root, 'content', 'obsidian', 'attachments', 'panel.svg'), '<svg />', 'utf8');
  await writePost(root, 'alpha.md', `
---
title: Alpha Signal
description: Alpha post.
date: 2026-06-15
tags: [alpha]
category: Dispatches
featured: true
---
Alpha links to [[Beta Signal]] and embeds ![[attachments/panel.svg]].

## Section

Body text.
`);
  await writePost(root, 'beta.md', `
---
title: Beta Signal
description: Beta post.
date: 2026-06-14
tags: [beta]
category: Notes
---
Beta body.
`);

  const outDir = await runPublish(root);
  const alphaHtml = await readFile(path.join(outDir, 'posts', 'alpha-signal', 'index.html'), 'utf8');

  // Canonical URL
  assert.match(alphaHtml, /<link rel="canonical" href="https:\/\/archive\.example\.com\/posts\/alpha-signal\/">/);
  // Open Graph
  assert.match(alphaHtml, /<meta property="og:type" content="article">/);
  assert.match(alphaHtml, /<meta property="og:title" content="Alpha Signal">/);
  assert.match(alphaHtml, /<meta property="og:url" content="https:\/\/archive\.example\.com\/posts\/alpha-signal\/">/);
  // Article structured data
  assert.match(alphaHtml, /"@type":"BlogPosting"/);
  assert.match(alphaHtml, /"headline":"Alpha Signal"/);
  // Viewport
  assert.match(alphaHtml, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  // Heading IDs + TOC
  assert.match(alphaHtml, /id="section"/);
  assert.match(alphaHtml, /<nav class="toc">/);
  // Body content rendered
  assert.match(alphaHtml, /Body text\./);
  // Embed resolved
  assert.match(alphaHtml, /blog-assets\/attachments\/panel\.svg/);
  assert.match(alphaHtml, /src="\/blog-assets\/attachments\/panel\.svg"/, 'nested article assets use root-relative URLs');
  assert.doesNotMatch(alphaHtml, /\[object Object\]/, 'resolved related posts must not be wrapped twice');
  assert.match(alphaHtml, /href="\/posts\/beta-signal\/">Beta Signal<\/a>/, 'related posts use canonical article links');
  // Open in Boardroom link
  assert.match(alphaHtml, /\/\?post=alpha-signal/);
  // NO external script tags (JSON-LD is allowed; no runtime JS)
  const scriptTags = alphaHtml.match(/<script\b[^>]*>/gi) || [];
  const nonJsonLdScripts = scriptTags.filter((t) => !/application\/ld\+json/.test(t));
  assert.equal(nonJsonLdScripts.length, 0, 'article page must not load runtime JavaScript');
  // Backlinks section (beta links from alpha, so alpha has no backlinks;
  // but beta should show alpha as a backlink)
  const betaHtml = await readFile(path.join(outDir, 'posts', 'beta-signal', 'index.html'), 'utf8');
  assert.match(betaHtml, /Linked From/);
  assert.match(betaHtml, /alpha-signal/);
}

// --- Test 2: JSON-LD is escaped for an HTML script context ---------------
async function testJsonLdEscapesScriptContext() {
  const root = await fixtureRoot('jsonld-escape');
  const title = '</script><script>alert(1)</script>';
  await writePost(root, 'ld.md', `---
title: '${title}'
date: 2026-06-15
---
Body.`);
  const outDir = await runPublish(root);
  const html = await readFile(path.join(outDir, 'posts', 'script-script-alert-1-script', 'index.html'), 'utf8');
  const scriptStart = '<script type="application/ld+json">';
  const start = html.indexOf(scriptStart);
  assert.ok(start >= 0, 'JSON-LD script must be present');
  const payloadStart = start + scriptStart.length;
  const end = html.indexOf('</script>', payloadStart);
  assert.ok(end > payloadStart, 'JSON-LD script must have a closing tag');
  const payload = html.slice(payloadStart, end);
  assert.doesNotMatch(payload, /</, 'JSON-LD must not contain raw less-than characters');
  assert.equal(JSON.parse(payload).headline, title);
}

// --- Test 2: RSS feed is valid XML with items ----------------------------
async function testRssFeedValid() {
  const root = await fixtureRoot('rss');
  await writePost(root, 'a.md', `---\ntitle: Post A\ndate: 2026-06-15\ndescription: A desc.\n---\nBody A.`);
  await writePost(root, 'b.md', `---\ntitle: Post B\ndate: 2026-06-14\ndescription: B desc.\n---\nBody B.`);
  const outDir = await runPublish(root);
  const rss = await readFile(path.join(outDir, 'rss.xml'), 'utf8');
  assert.match(rss, /<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(rss, /<rss version="2.0">/);
  assert.match(rss, /<title>ENCOM Archive<\/title>/);
  assert.match(rss, /<title>Post A<\/title>/);
  assert.match(rss, /<title>Post B<\/title>/);
  assert.match(rss, /https:\/\/archive\.example\.com\/posts\/post-a\//);
  assert.match(rss, /<lastBuildDate>Mon, 15 Jun 2026 00:00:00 GMT<\/lastBuildDate>/,
    'RSS build date should derive from content for deterministic output');
  // Both items present
  const itemCount = (rss.match(/<item>/g) || []).length;
  assert.equal(itemCount, 2);
}

// --- Test 3: Sitemap includes posts + discovery pages --------------------
async function testSitemapComplete() {
  const root = await fixtureRoot('sitemap');
  await writePost(root, 'a.md', `---\ntitle: Post A\ndate: 2026-06-15\ntags: [x]\ncategory: Cat\n---\nBody A.`);
  const outDir = await runPublish(root);
  const sitemap = await readFile(path.join(outDir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<\?xml version="1.0"/);
  assert.match(sitemap, /https:\/\/archive\.example\.com\/posts\/post-a\//);
  assert.match(sitemap, /https:\/\/archive\.example\.com\//);
  assert.match(sitemap, /https:\/\/archive\.example\.com\/featured\//);
  assert.match(sitemap, /https:\/\/archive\.example\.com\/tags\/x\//);
  assert.match(sitemap, /https:\/\/archive\.example\.com\/categories\/cat\//);
}

// --- Test 4: Tag, category, and archive discovery pages ------------------
async function testDiscoveryPagesGenerated() {
  const root = await fixtureRoot('discovery');
  await writePost(root, 'a.md', `---\ntitle: Post A\ndate: 2026-06-15\ntags: [alpha, beta]\ncategory: Dispatches\n---\nBody A.`);
  await writePost(root, 'b.md', `---\ntitle: Post B\ndate: 2025-06-15\ntags: [beta]\ncategory: Notes\n---\nBody B.`);
  const outDir = await runPublish(root);
  const allFiles = await readDir(outDir);
  const relativeFiles = allFiles.map((filePath) => toPosixRelative(outDir, filePath));

  // Tag pages
  assert.ok(relativeFiles.includes('tags/alpha/index.html'), 'alpha tag page exists');
  assert.ok(relativeFiles.includes('tags/beta/index.html'), 'beta tag page exists');
  const alphaTag = await readFile(path.join(outDir, 'tags', 'alpha', 'index.html'), 'utf8');
  assert.match(alphaTag, /Tag: alpha/);
  assert.match(alphaTag, /Post A/);
  assert.match(alphaTag, /<link rel="canonical" href="https:\/\/archive\.example\.com\/tags\/alpha\/">/);

  // Category pages
  assert.ok(relativeFiles.includes('categories/dispatches/index.html'), 'dispatches category page exists');
  const dispatches = await readFile(path.join(outDir, 'categories', 'dispatches', 'index.html'), 'utf8');
  assert.match(dispatches, /Post A/);
  assert.match(dispatches, /<link rel="canonical" href="https:\/\/archive\.example\.com\/categories\/dispatches\/">/);

  // Archive year pages
  assert.ok(relativeFiles.includes('archive/2026/index.html'), '2026 archive page exists');
  assert.ok(relativeFiles.includes('archive/2025/index.html'), '2025 archive page exists');
  const archiveIndex = await readFile(path.join(outDir, 'archive', 'index.html'), 'utf8');
  assert.match(archiveIndex, /2026/);
  assert.match(archiveIndex, /2025/);
  assert.match(archiveIndex, /<link rel="canonical" href="https:\/\/archive\.example\.com\/archive\/">/);
  const featured = await readFile(path.join(outDir, 'featured', 'index.html'), 'utf8');
  assert.match(featured, /<link rel="canonical" href="https:\/\/archive\.example\.com\/featured\/">/);
  const landing = await readFile(path.join(outDir, 'index.html'), 'utf8');
  assert.match(landing, /<link rel="canonical" href="https:\/\/archive\.example\.com\/">/);
}

// --- Test 5: Manifest is valid JSON with discovery data ------------------
async function testManifestValid() {
  const root = await fixtureRoot('manifest');
  await writePost(root, 'a.md', `---\ntitle: Post A\ndate: 2026-06-15\ntags: [x]\nfeatured: true\n---\nBody A.`);
  const outDir = await runPublish(root);
  const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.site, 'ENCOM Archive');
  assert.equal(manifest.totalCount, 1);
  assert.deepEqual(manifest.featuredPosts, ['post-a']);
  assert.deepEqual(manifest.latestPosts, ['post-a']);
  assert.equal(manifest.posts[0].title, 'Post A');
  assert.equal(manifest.posts[0].featured, true);
  assert.ok(manifest.tags.x);
}

// --- Test 6: Article page is readable without JS (no script deps) --------
async function testNoJsReadability() {
  const root = await fixtureRoot('nojs');
  await writePost(root, 'a.md', `
---
title: No JS Test
date: 2026-06-15
description: Must be readable.
---
# Heading

Paragraph with **bold** and *italic* and \`code\`.

- List item 1
- List item 2

> Quote.

| A | B |
|---|---|
| 1 | 2 |
`);
  const outDir = await runPublish(root);
  const html = await readFile(path.join(outDir, 'posts', 'no-js-test', 'index.html'), 'utf8');
  // Content is server-rendered in the HTML — no client JS needed to see it.
  assert.match(html, /<h1[^>]*>No JS Test<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<table>/);
  // No runtime <script src> tags
  assert.doesNotMatch(html, /<script\s+src=/i);
}

// --- Test 10: Project-site publication retains the configured pathname ---
async function testProjectSubpathLinks() {
  const root = await fixtureRoot('project-subpath');
  await writeFileRaw(root, 'content/obsidian/attachments/panel.svg', '<svg />');
  await writePost(root, 'alpha.md', `---
title: Alpha Signal
date: 2026-06-15
tags: [alpha]
category: Dispatches
featured: true
---
Links to [[Beta Signal]] and embeds ![[attachments/panel.svg]].`);
  await writePost(root, 'beta.md', `---
title: Beta Signal
date: 2025-06-14
category: Notes
---
Beta body.`);

  const siteUrl = 'https://chromedomev12.github.io/encom-boardroom/';
  const outDir = await runPublish(root, siteUrl);
  const alpha = await readFile(path.join(outDir, 'posts', 'alpha-signal', 'index.html'), 'utf8');
  const landing = await readFile(path.join(outDir, 'index.html'), 'utf8');
  const archive = await readFile(path.join(outDir, 'archive', 'index.html'), 'utf8');
  const rss = await readFile(path.join(outDir, 'rss.xml'), 'utf8');
  const sitemap = await readFile(path.join(outDir, 'sitemap.xml'), 'utf8');

  assert.match(alpha, /href="\/encom-boardroom\/posts\/beta-signal\/"/,
    'article and related links should retain the project path');
  assert.match(alpha, /src="\/encom-boardroom\/blog-assets\/attachments\/panel\.svg"/,
    'article assets should retain the project path');
  assert.match(alpha, /href="\/encom-boardroom\/\?post=alpha-signal"/,
    'boardroom links should return to the project root');
  assert.match(alpha, /href="\/encom-boardroom\/">← Archive<\/a>/,
    'article breadcrumbs should return to the project root');
  assert.match(landing, /href="\/encom-boardroom\/posts\/alpha-signal\/"/,
    'discovery article links should retain the project path');
  assert.match(landing, /href="\/encom-boardroom\/\?featured=1"/,
    'discovery boardroom links should retain the project path');
  assert.match(archive, /href="\/encom-boardroom\/archive\/2026\/"/,
    'archive year links should retain the project path');
  assert.match(rss, /https:\/\/chromedomev12\.github\.io\/encom-boardroom\/posts\/alpha-signal\//,
    'RSS article URLs should retain the project path');
  assert.match(sitemap, /https:\/\/chromedomev12\.github\.io\/encom-boardroom\/featured\//,
    'sitemap discovery URLs should retain the project path');
  assert.doesNotMatch(alpha, /(?:href|src)="\/(?:posts|blog-assets)\//,
    'project publication should not leak origin-root article or asset links');
}

await testSiteUrlRequired();
await testRootMetadataKeepsOwnershipSeparateFromAttribution();
await testArticlePagesGenerated();
await testJsonLdEscapesScriptContext();
await testRssFeedValid();
await testSitemapComplete();
await testDiscoveryPagesGenerated();
await testManifestValid();
await testNoJsReadability();
await testProjectSubpathLinks();
console.log('blog publication tests passed (10 tests)');
