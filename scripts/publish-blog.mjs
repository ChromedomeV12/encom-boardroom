// Public publication orchestrator for the ENCOM archive blog.
// Runs the content build (if needed), then generates canonical article
// pages, discovery pages, RSS, sitemap, and a manifest under dist/.
//
// Usage:
//   node scripts/publish-blog.mjs [--site-url=https://example.com] [--out=dist]
//
// The generated pages are readable without WebGL or client-side JavaScript.
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { publish } from './blog/publish.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = path.join(repoRoot, 'scripts', 'build-blog-data.mjs');

function parseArgs(argv) {
  const args = { 'site-url': 'http://127.0.0.1:4322', out: 'dist' };
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([a-z-]+)=(.*)$/i);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function loadPosts() {
  const raw = await readFile(path.join(process.cwd(), 'js', 'blog-posts.js'), 'utf8');
  const match = raw.match(/window\.BLOG_POSTS = ([\s\S]*?);\nwindow\.BLOG_INDEX = ([\s\S]*?);\n/);
  if (!match) throw new Error('js/blog-posts.js is missing or malformed. Run build-blog-data first.');
  return { posts: JSON.parse(match[1]), index: JSON.parse(match[2]) };
}

const args = parseArgs(process.argv);
const siteUrl = args['site-url'].replace(/\/$/, '');
const outDir = path.resolve(repoRoot, args.out);

// 1. Run the content build to ensure js/blog-posts.js is current.
console.log('Building blog content...');
await execFileAsync(process.execPath, [buildScript], { cwd: process.cwd() });

// 2. Load the freshly built posts.
const { posts, index } = await loadPosts();
if (!posts.length) {
  console.error('No posts to publish. Add Markdown to content/obsidian/ first.');
  process.exitCode = 1;
  process.exit(1);
}

// 3. Clean and publish.
await rm(outDir, { recursive: true, force: true });
console.log(`Publishing ${posts.length} post(s) to ${path.relative(repoRoot, outDir)}/ ...`);
const summary = await publish(posts, index, { outDir, siteUrl });

console.log(`Published ${summary.pages} pages (${(summary.bytes / 1024).toFixed(1)} KB) to ${path.relative(repoRoot, outDir)}/.`);
console.log(`  Article pages: ${summary.posts}`);
console.log(`  RSS: ${path.relative(repoRoot, outDir)}/rss.xml`);
console.log(`  Sitemap: ${path.relative(repoRoot, outDir)}/sitemap.xml`);
console.log(`  Manifest: ${path.relative(repoRoot, outDir)}/manifest.json`);
