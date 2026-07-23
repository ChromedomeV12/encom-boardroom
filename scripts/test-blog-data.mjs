import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { sanitizeUrl } from './blog/sanitize.js';


const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = path.join(repoRoot, 'scripts', 'build-blog-data.mjs');

async function fixtureRoot(name) {
  return mkdtemp(path.join(os.tmpdir(), `encom-blog-${name}-`));
}

async function writePost(root, filename, source) {
  const filePath = path.join(root, 'content', 'obsidian', filename);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, source.trimStart(), 'utf8');
}

async function writeFileRaw(root, relPath, content) {
  const filePath = path.join(root, relPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function runBuild(root) {
  await execFileAsync(process.execPath, [buildScript], { cwd: root });
  const output = await readFile(path.join(root, 'js', 'blog-posts.js'), 'utf8');
  const jsonMatch = output.match(/window\.BLOG_POSTS = ([\s\S]*?);\nwindow\.BLOG_INDEX = ([\s\S]*?);\n/);
  assert.ok(jsonMatch, 'expected build output to define BLOG_POSTS and BLOG_INDEX');
  const metadata = JSON.parse(jsonMatch[1]);
  const posts = await Promise.all(metadata.map(async (post) => {
    const payloadPath = path.join(
      root,
      ...post.contentPath.replace(/^\//, '').split('/').map(decodeURIComponent)
    );
    return JSON.parse(await readFile(payloadPath, 'utf8'));
  }));
  return { posts, metadata, index: JSON.parse(jsonMatch[2]) };
}

async function runBuildFails(root) {
  try {
    await execFileAsync(process.execPath, [buildScript], { cwd: root });
    assert.fail('build should have failed but exited 0');
  } catch (error) {
    return `${error.stdout || ''}${error.stderr || ''}`;
  }
}

// --- Test 1: Index, backlinks, derived metadata ---------------------------
async function testBuildsBlogIndexAndBacklinks() {
  const root = await fixtureRoot('index');
  await writeFileRaw(root, 'content/obsidian/attachments/panel.svg', '<svg />');

  await writePost(root, 'alpha.md', `
---
title: Alpha Signal
description: Alpha links to beta.
date: 2026-06-15
updated: 2026-06-15
tags: [alpha, signals]
category: Dispatches
featured: true
---
This note links to [[Beta Signal|the beta note]] and [[Beta Signal#Beta Heading|the beta section]] and embeds ![[attachments/panel.svg]].

## Practical Defaults

- Body copy is off-white.
- Motion respects reduced-motion.
`);

  await writePost(root, 'beta.md', `
---
title: Beta Signal
description: Beta receives a backlink.
date: 2026-06-14
tags: [beta]
category: Dispatches
---
## Beta Heading

Beta body.
`);

  const { posts, metadata, index } = await runBuild(root);
  const alpha = posts.find((p) => p.slug === 'alpha-signal');
  const beta = posts.find((p) => p.slug === 'beta-signal');

  assert.equal(posts.length, 2);
  assert.equal(metadata.length, 2);
  assert.ok(metadata.every((post) => !Object.hasOwn(post, 'html')), 'startup metadata excludes article HTML');
  assert.ok(
    metadata.every((post) => post.contentPath.startsWith('blog-data/posts/')),
    'lazy payload URLs should resolve from local root or a deployment subpath'
  );
  assert.deepEqual(alpha.outgoingLinks, [{ slug: 'beta-signal', title: 'Beta Signal' }]);
  assert.deepEqual(alpha.assets, ['attachments/panel.svg']);
  assert.deepEqual(beta.backlinks, [{ slug: 'alpha-signal', title: 'Alpha Signal' }]);
  assert.deepEqual(index.featuredPosts, ['alpha-signal']);
  assert.deepEqual(index.latestPosts, ['alpha-signal', 'beta-signal']);
  assert.deepEqual(index.tags.alpha, ['alpha-signal']);
  assert.deepEqual(index.categories.Dispatches, ['alpha-signal', 'beta-signal']);
  assert.deepEqual(index.archiveByYear['2026'], ['alpha-signal', 'beta-signal']);
  assert.deepEqual(index.archiveByMonth['2026-06'], ['alpha-signal', 'beta-signal']);

  // Derived metadata
  assert.ok(alpha.wordCount > 0, 'alpha should have a word count');
  assert.ok(alpha.readTime >= 1, 'read time >= 1');
  assert.equal(alpha.linkDegree, 1, 'alpha link degree = 1 outgoing');
  assert.ok(alpha.excerpt, 'alpha should have an excerpt');
  assert.ok(alpha.headings.length >= 1, 'alpha should have headings');
  assert.equal(alpha.headings[0].id, 'practical-defaults');
  assert.ok(alpha.html.includes('id="practical-defaults"'), 'heading id injected');
  assert.match(alpha.html, /href="\/posts\/beta-signal\/"/, 'cross-post wikilinks use canonical article routes');
  assert.match(alpha.html, /href="\/posts\/beta-signal\/#beta-heading"/, 'cross-post heading links use valid fragments');
  assert.doesNotMatch(alpha.html, /#post:/, 'legacy runtime-only cross-post fragments must not leak into published HTML');
  assert.match(alpha.html, /src="\/blog-assets\/attachments\/panel\.svg"/, 'embedded assets use root-relative URLs');
  assert.ok(alpha.html.includes('<ul>'), 'list rendered');
  assert.ok(index.relatedBySlug['beta-signal'].includes('alpha-signal'));
  assert.equal(index.totalCount, 2);
  assert.ok(index.wordCount > 0);
}

// --- Test 2: Missing wikilink + missing asset fail the build --------------
async function testFailsForMissingWikilinkAndAsset() {
  const root = await fixtureRoot('invalid');
  await writePost(root, 'broken.md', `
---
title: Broken Signal
date: 2026-06-15
---
This has [[Missing Signal]] and ![[missing.png]].
`);
  const output = await runBuildFails(root);
  assert.match(output, /Wikilink target "Missing Signal" is not a published post/);
  assert.match(output, /Embedded asset "missing\.png" not found/);
}

// --- Test 3: Unicode and spaces in filenames + slugs ----------------------
async function testUnicodeSlugsAndFilenames() {
  const root = await fixtureRoot('unicode');
  await writeFileRaw(root, 'content/obsidian/attachments/café panel.svg', '<svg />');
  await writePost(root, 'Café Notes.md', `
---
title: Café Notes
date: 2026-06-15
---
Embed ![[attachments/café panel.svg]].
`);
  const { posts } = await runBuild(root);
  const post = posts[0];
  assert.equal(post.slug, 'café-notes', 'Unicode slug preserved');
  assert.deepEqual(post.assets, ['attachments/café panel.svg'], 'asset with space+unicode kept');
  assert.ok(post.html.includes('blog-assets/attachments/café panel.svg'), 'embed src preserves space');
}

// --- Test 4: Duplicate slugs fail -----------------------------------------
async function testDuplicateSlugsFail() {
  const root = await fixtureRoot('dup');
  await writePost(root, 'a.md', `---\ntitle: Same Slug\ndate: 2026-06-15\n---\nA.`);
  await writePost(root, 'b.md', `---\ntitle: Same Slug\ndate: 2026-06-16\n---\nB.`);
  const output = await runBuildFails(root);
  assert.match(output, /Duplicate slug "same-slug"/);
}

// --- Test 5: Invalid dates are flagged ------------------------------------
async function testInvalidDateFails() {
  const root = await fixtureRoot('baddate');
  await writePost(root, 'd.md', `---\ntitle: Bad Date\ndate: not-a-date\n---\nBody.`);
  const output = await runBuildFails(root);
  assert.match(output, /Invalid date "not-a-date"/);
}

// --- Test 6: Path traversal in embeds is blocked --------------------------
async function testPathTraversalBlocked() {
  const root = await fixtureRoot('traversal');
  await writeFileRaw(root, 'content/obsidian/secret.txt', 'TOP SECRET');
  await writePost(root, 'evil.md', `---\ntitle: Evil\ndate: 2026-06-15\n---\n![[../secret.txt]]`);
  const output = await runBuildFails(root);
  assert.match(output, /resolves outside the vault|Wikilink target|not found/i);
}

// --- Test 7: Unsafe URLs are sanitized from rendered HTML -----------------
async function testUnsafeUrlsSanitized() {
  const root = await fixtureRoot('xss');
  await writePost(root, 'xss.md', `
---
title: XSS Test
date: 2026-06-15
---
[click](javascript:alert(1)) and <a href="javascript:alert(1)">x</a> and <script>alert(1)</script> text.
`);
  const { posts } = await runBuild(root);
  const html = posts[0].html;
  assert.doesNotMatch(html, /javascript:/i, 'javascript: URLs must be stripped');
  assert.doesNotMatch(html, /<script/i, 'script tags must be removed');
}

// --- Test 8: Complete HTML references are decoded before URL checks --------
async function testEncodedUnsafeUrlsSanitized() {
  assert.equal(sanitizeUrl('jav&#x61;script&#x3a;alert(1)'), '');
  assert.equal(sanitizeUrl('j&Tab;av&#x61;script&colon;alert(1)'), '');
  assert.equal(sanitizeUrl('data&#x74;&#x61;&#x3a;text/html,<svg>'), '');
}


// --- Test 8: Drafts are skipped but valid posts build ---------------------
async function testDraftsSkipped() {
  const root = await fixtureRoot('drafts');
  await writePost(root, 'published.md', `---\ntitle: Live\ndate: 2026-06-15\n---\nLive body.`);
  await writePost(root, 'draft.md', `---\ntitle: Draft\ndate: 2026-06-15\ndraft: true\n---\nDraft body.`);
  const { posts } = await runBuild(root);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].slug, 'live');
}

// --- Test 9: GFM tables, task lists, ordered lists, nested lists ----------
async function testGfmConstructs() {
  const root = await fixtureRoot('gfm');
  await writePost(root, 'gfm.md', `
---
title: GFM Constructs
date: 2026-06-15
---
| Col A | Col B |
|-------|-------|
| 1     | 2     |

1. First
2. Second

- [ ] Task
- [x] Done

- top
  - nested
`);
  const { posts } = await runBuild(root);
  const html = posts[0].html;
  assert.ok(html.includes('<table>'), 'table rendered');
  assert.ok(html.includes('<ol>'), 'ordered list rendered');
  assert.match(html, /type="checkbox"/, 'task list rendered as checkboxes');
  assert.ok(html.includes('<ul>'), 'unordered list rendered');
}

// --- Test 10: Heading IDs and TOC -----------------------------------------
async function testHeadingIdsAndToc() {
  const root = await fixtureRoot('toc');
  await writePost(root, 'toc.md', `
---
title: TOC Test
date: 2026-06-15
---
# Top

## Section One

### Sub One

## Section Two

Text.
`);
  const { posts } = await runBuild(root);
  const post = posts[0];
  assert.ok(post.headings.length >= 4, 'all headings extracted');
  const ids = post.headings.map((h) => h.id);
  assert.ok(ids.includes('top'));
  assert.ok(ids.includes('section-one'));
  assert.ok(ids.includes('section-two'));
  assert.ok(ids.includes('sub-one'));
  // TOC tree nesting: "top" (h1) contains "section-one" (h2) which contains "sub-one" (h3)
  const top = post.toc.find((n) => n.id === 'top');
  assert.ok(top, 'top heading in toc tree');
  const sectionOne = top.children.find((c) => c.id === 'section-one');
  assert.ok(sectionOne, 'section-one nested under top');
  assert.ok(sectionOne.children.some((c) => c.id === 'sub-one'), 'sub-one nested under section-one');
}

// --- Test 11: YAML edge cases (multiline, nested, quoted) -----------------
async function testYamlEdgeCases() {
  const root = await fixtureRoot('yaml');
  await writePost(root, 'yaml.md', `
---
title: "YAML Edge Cases"
description: |
  A multiline
  description.
date: 2026-06-15
tags:
  - alpha
  - beta
aliases:
  - "Old Title"
  - Another Alias
location:
  lat: 37.7749
  lng: -122.4194
  label: San Francisco
---
Body.
`);
  const { posts } = await runBuild(root);
  const post = posts[0];
  assert.deepEqual(post.tags, ['alpha', 'beta']);
  assert.deepEqual(post.aliases, ['Old Title', 'Another Alias']);
  assert.ok(post.description.includes('A multiline'), 'multiline description preserved');
  assert.ok(post.location, 'location parsed');
  assert.equal(post.location.lat, 37.7749);
  assert.equal(post.location.lng, -122.4194);
  assert.equal(post.location.label, 'San Francisco');
}

// --- Test 12: Aliases resolve wikilinks -----------------------------------
async function testAliasWikilinks() {
  const root = await fixtureRoot('alias');
  await writePost(root, 'real.md', `
---
title: Real Post
date: 2026-06-15
aliases: [Old Name]
---
Body.
`);
  await writePost(root, 'linker.md', `
---
title: Linker
date: 2026-06-15
---
Links to [[Old Name]].
`);
  const { posts } = await runBuild(root);
  const linker = posts.find((p) => p.slug === 'linker');
  assert.equal(linker.outgoingLinks.length, 1);
  assert.equal(linker.outgoingLinks[0].slug, 'real-post');
}

// --- Test 13: Deterministic output (same input -> same output) ------------
async function testDeterministicOutput() {
  const rootA = await fixtureRoot('det-a');
  const rootB = await fixtureRoot('det-b');
  for (const r of [rootA, rootB]) {
    await writePost(r, 'a.md', `---\ntitle: Alpha\ndate: 2026-06-15\ntags: [x, y]\n---\nBody links [[Beta]].`);
    await writePost(r, 'b.md', `---\ntitle: Beta\ndate: 2026-06-14\ntags: [x]\n---\nBeta body links [[Alpha]].`);
  }
  const a = await runBuild(rootA);
  const b = await runBuild(rootB);
  assert.deepEqual(a.posts, b.posts, 'posts must be identical across rebuilds');
  assert.deepEqual(a.index, b.index, 'index must be identical across rebuilds');
}

// --- Test 14: Deterministic slug fallback to filename ---------------------
async function testSlugFallbackToFilename() {
  const root = await fixtureRoot('slugfallback');
  await writePost(root, 'my-post-file.md', `---\ndate: 2026-06-15\n---\nNo title in frontmatter.`);
  const { posts } = await runBuild(root);
  assert.equal(posts[0].slug, 'my-post-file', 'slug falls back to filename');
}

// --- Test 15: Explicit slugs normalize to one safe URL segment -------------
async function testExplicitSlugIsCanonicalSegment() {
  const root = await fixtureRoot('explicit-slug');
  await writePost(root, 'unsafe.md', `---
title: Unsafe Route
slug: ../Section/Unsafe?x=1#frag
date: 2026-06-15
---
Body.`);
  const { posts } = await runBuild(root);
  assert.equal(posts[0].slug, 'section-unsafe-x-1-frag');
  assert.doesNotMatch(posts[0].slug, /[/\\?#]/, 'explicit slug must remain one safe path segment');
}

// --- Test 16: A frontmatter-only hero is validated and copied ------------
async function testFrontmatterHeroAsset() {
  const root = await fixtureRoot('hero');
  await writeFileRaw(root, 'content/obsidian/covers/hero image.svg', '<svg />');
  await writePost(root, 'hero.md', `---
title: Hero Signal
date: 2026-06-15
hero: covers\\hero image.svg
---
Body without an embedded image.`);
  const { posts, metadata } = await runBuild(root);
  assert.equal(posts[0].hero, 'covers/hero image.svg', 'hero path should be normalized');
  assert.ok(posts[0].assets.includes('covers/hero image.svg'), 'hero should be part of the copied asset set');
  assert.equal(metadata[0].hero, 'covers/hero image.svg', 'runtime metadata should expose the normalized hero');
  assert.equal(
    await readFile(path.join(root, 'blog-assets', 'covers', 'hero image.svg'), 'utf8'),
    '<svg />',
    'hero should be copied even when it is not embedded in Markdown'
  );
}

// --- Test 17: A missing frontmatter-only hero fails the build -------------
async function testMissingFrontmatterHeroFails() {
  const root = await fixtureRoot('missing-hero');
  await writePost(root, 'hero.md', `---
title: Missing Hero
date: 2026-06-15
hero: covers/missing.png
---
Body.`);
  const output = await runBuildFails(root);
  assert.match(output, /Embedded asset "covers\/missing\.png" not found/);
}

// --- Test 19: Object-form locations enforce geographic ranges ------------
async function testObjectLocationRanges() {
  const root = await fixtureRoot('location-ranges');
  await writePost(root, 'invalid-latitude.md', `---
title: Invalid Latitude
date: 2026-06-15
location:
  lat: 90.0001
  lng: 0
---
Body.`);
  await writePost(root, 'invalid-longitude.md', `---
title: Invalid Longitude
date: 2026-06-15
location:
  lat: 0
  lng: -180.0001
---
Body.`);

  const output = await runBuildFails(root);
  assert.equal(
    (output.match(/Location coordinates out of range/g) || []).length,
    2,
    'both object-form latitude and longitude violations should fail the build',
  );
}


await testBuildsBlogIndexAndBacklinks();
await testFailsForMissingWikilinkAndAsset();
await testUnicodeSlugsAndFilenames();
await testDuplicateSlugsFail();
await testInvalidDateFails();
await testPathTraversalBlocked();
await testUnsafeUrlsSanitized();
await testEncodedUnsafeUrlsSanitized();
await testDraftsSkipped();
await testGfmConstructs();
await testHeadingIdsAndToc();
await testYamlEdgeCases();
await testAliasWikilinks();
await testDeterministicOutput();
await testSlugFallbackToFilename();
await testExplicitSlugIsCanonicalSegment();
await testFrontmatterHeroAsset();
await testMissingFrontmatterHeroFails();
await testObjectLocationRanges();
console.log('blog data tests passed (19 tests)');
