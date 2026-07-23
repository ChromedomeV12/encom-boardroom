// Public build orchestrator for the ENCOM archive blog.
// Reads content/obsidian, validates + normalizes Markdown, computes derived
// metadata, copies referenced assets, and emits a lightweight runtime
// manifest plus one lazily loaded JSON payload per published post.
//
// Modules under scripts/blog/ do the real work; this file is the glue.
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseFrontmatter } from './blog/yaml.js';
import { normalizePostMeta, validateRequired } from './blog/schema.js';
import { resolveWikilinks } from './blog/links.js';
import { computeBacklinks, computeRelated, buildIndex } from './blog/index.js';
import { renderMarkdown, countWords, estimateReadTime } from './blog/markdown.js';
import { buildExcerpt } from './blog/excerpt.js';
import { copyAsset, assetExists, normalizeAssetTarget } from './blog/assets.js';
import { Diagnostics } from './blog/diagnostics.js';

const root = process.cwd();
const sourceDir = path.join(root, 'content', 'obsidian');
const assetOutDir = path.join(root, 'blog-assets');
const outFile = path.join(root, 'js', 'blog-posts.js');
const payloadOutDir = path.join(root, 'blog-data', 'posts');
const markdownExtensions = new Set(['.md', '.mdx']);

async function exists(filePath) {
  try { await stat(filePath); return true; } catch { return false; }
}

async function walk(dir) {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const diag = new Diagnostics();

// --- 1. Discover markdown files -------------------------------------------
await mkdir(sourceDir, { recursive: true });
const allFiles = await walk(sourceDir);
const markdownFiles = allFiles.filter((f) => markdownExtensions.has(path.extname(f).toLowerCase()));

// --- 2. Parse frontmatter + normalize metadata ----------------------------
const rawPosts = [];
const seenSlugs = new Map(); // slug -> first relPath (for duplicate detection)
for (const file of markdownFiles) {
  const source = await readFile(file, 'utf8');
  let data, body;
  try {
    ({ data, body } = parseFrontmatter(source));
  } catch (err) {
    diag.error({ type: 'yaml', message: err.message, context: path.relative(sourceDir, file) });
    continue;
  }
  if (data.draft) continue; // drafts are skipped entirely
  const relPath = path.relative(sourceDir, file);
  const basename = path.basename(file, path.extname(file));
  const schemaDiag = [];
  const meta = normalizePostMeta(data, { sourcePath: file, relPath, basename }, schemaDiag);
  for (const d of schemaDiag) diag.error(d);
  const reqDiag = [];
  if (!validateRequired(meta, reqDiag)) {
    for (const d of reqDiag) diag.error(d);
    continue;
  }
  if (seenSlugs.has(meta.slug)) {
    diag.error({
      type: 'duplicate-slug',
      message: `Duplicate slug "${meta.slug}" in ${relPath} (first seen in ${seenSlugs.get(meta.slug)}).`,
      context: meta.slug
    });
    continue;
  }
  seenSlugs.set(meta.slug, relPath);
  rawPosts.push({ meta, body, relPath });
}

// --- 3. Build the title->slug index for wikilink resolution ---------------
const postByTitle = new Map();
for (const rp of rawPosts) {
  postByTitle.set(rp.meta.title.toLowerCase(), { slug: rp.meta.slug, title: rp.meta.title });
  for (const alias of rp.meta.aliases || []) {
    postByTitle.set(alias.toLowerCase(), { slug: rp.meta.slug, title: rp.meta.title });
  }
}

// --- 4. Resolve wikilinks/embeds, render markdown, compute derived --------
const posts = [];
for (const rp of rawPosts) {
  const { body: resolvedBody, outgoingLinks, assets: embeddedAssets } =
    resolveWikilinks(rp.body, postByTitle, sourceDir, diag);
  const hero = normalizeAssetTarget(rp.meta.hero);
  const assets = [...new Set([...embeddedAssets, ...(hero ? [hero] : [])])];
  const { html, headings, toc } = renderMarkdown(resolvedBody);
  const wordCount = countWords(resolvedBody);
  const readTime = estimateReadTime(wordCount);

  // Validate referenced assets exist (copying happens once, after rm, in step 6).
  for (const assetRel of assets) {
    if (!(await assetExists(sourceDir, assetRel))) {
      diag.error({
        type: 'missing-asset',
        message: `Embedded asset "${assetRel}" not found in ${rp.relPath}.`,
        context: assetRel
      });
    }
  }

  const excerpt = buildExcerpt(html, rp.meta.description);

  posts.push({
    ...rp.meta,
    hero,
    excerpt,
    wordCount,
    readTime,
    headings,
    toc,
    outgoingLinks,
    backlinks: [],       // filled by computeBacklinks
    linkDegree: 0,      // filled by computeBacklinks
    relatedPosts: [],   // filled below
    assets,
    html
  });
}

// --- 5. Backlinks, link degree, related posts, and the index --------------
computeBacklinks(posts);
for (const p of posts) {
  p.relatedPosts = computeRelated(p, posts).map((r) => r.slug);
}

const blogIndex = buildIndex(posts);

// --- 6. Emit lightweight metadata + per-post reader payloads -------------
await mkdir(path.join(root, 'js'), { recursive: true });
await rm(assetOutDir, { recursive: true, force: true });
await rm(payloadOutDir, { recursive: true, force: true });
await mkdir(assetOutDir, { recursive: true });
await mkdir(payloadOutDir, { recursive: true });
// Copy only referenced assets (traversal-safe; missing ones were flagged above).
for (const p of posts) {
  for (const assetRel of p.assets) {
    await copyAsset(sourceDir, assetOutDir, assetRel);
  }
}

// Discovery, search, archive replay, and boardroom widgets only need post
// metadata. Keep article HTML/TOC/link details out of the startup payload.
const runtimePosts = posts.map((post) => {
  const {
    html, headings, toc, outgoingLinks, backlinks, assets,
    ...metadata
  } = post;
  return {
    ...metadata,
    // Relative to the boardroom entry page so the same artifact works both
    // at localhost `/` and a GitHub Pages project path such as
    // `/encom-boardroom/`.
    contentPath: `blog-data/posts/${encodeURIComponent(post.slug)}.json`
  };
});

for (const post of posts) {
  await writeFile(
    path.join(payloadOutDir, `${post.slug}.json`),
    `${JSON.stringify(post, null, 2)}\n`,
    'utf8'
  );
}

await writeFile(
  outFile,
  `window.BLOG_POSTS = ${JSON.stringify(runtimePosts, null, 2)};\nwindow.BLOG_INDEX = ${JSON.stringify(blogIndex, null, 2)};\n`,
  'utf8'
);

console.log(`Generated ${posts.length} post metadata record(s) and lazy reader payload(s).`);
const exitCode = diag.finalize('Blog content build');
if (exitCode) process.exitCode = exitCode;
