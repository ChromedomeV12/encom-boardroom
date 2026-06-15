import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

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

async function runBuild(root) {
  await execFileAsync(process.execPath, [buildScript], { cwd: root });
  const output = await readFile(path.join(root, 'js', 'blog-posts.js'), 'utf8');
  const jsonMatch = output.match(/window\.BLOG_POSTS = ([\s\S]*?);\nwindow\.BLOG_INDEX = ([\s\S]*?);\n/);
  assert.ok(jsonMatch, 'expected build output to define BLOG_POSTS and BLOG_INDEX');
  return {
    posts: JSON.parse(jsonMatch[1]),
    index: JSON.parse(jsonMatch[2])
  };
}

async function testBuildsBlogIndexAndBacklinks() {
  const root = await fixtureRoot('index');
  await mkdir(path.join(root, 'content', 'obsidian', 'attachments'), { recursive: true });
  await writeFile(path.join(root, 'content', 'obsidian', 'attachments', 'panel.svg'), '<svg />', 'utf8');

  await writePost(root, 'alpha.md', `
---
title: Alpha Signal
description: Alpha links to beta.
date: 2026-06-15
tags: [alpha, signals]
category: Dispatches
featured: true
---
This note links to [[Beta Signal|the beta note]] and embeds ![[attachments/panel.svg]].
`);

  await writePost(root, 'beta.md', `
---
title: Beta Signal
description: Beta receives a backlink.
date: 2026-06-14
tags: [beta]
category: Dispatches
---
Beta body.
`);

  const { posts, index } = await runBuild(root);
  const alpha = posts.find((post) => post.slug === 'alpha-signal');
  const beta = posts.find((post) => post.slug === 'beta-signal');

  assert.equal(posts.length, 2);
  assert.deepEqual(alpha.outgoingLinks, [{ slug: 'beta-signal', title: 'Beta Signal' }]);
  assert.deepEqual(alpha.assets, ['attachments/panel.svg']);
  assert.deepEqual(beta.backlinks, [{ slug: 'alpha-signal', title: 'Alpha Signal' }]);
  assert.deepEqual(index.featuredPosts, ['alpha-signal']);
  assert.deepEqual(index.latestPosts, ['alpha-signal', 'beta-signal']);
  assert.deepEqual(index.tags.alpha, ['alpha-signal']);
  assert.deepEqual(index.categories.Dispatches, ['alpha-signal', 'beta-signal']);
  assert.deepEqual(index.archiveByYear['2026'], ['alpha-signal', 'beta-signal']);
}

async function testFailsForMissingWikilinkAndAsset() {
  const root = await fixtureRoot('invalid');
  await writePost(root, 'broken.md', `
---
title: Broken Signal
date: 2026-06-15
---
This has [[Missing Signal]] and ![[missing.png]].
`);

  await assert.rejects(
    execFileAsync(process.execPath, [buildScript], { cwd: root }),
    (error) => {
      const output = `${error.stdout || ''}${error.stderr || ''}`;
      assert.match(output, /Missing wikilink target "Missing Signal"/);
      assert.match(output, /Missing embedded asset "missing\.png"/);
      return true;
    }
  );
}

await testBuildsBlogIndexAndBacklinks();
await testFailsForMissingWikilinkAndAsset();
console.log('blog data tests passed');
