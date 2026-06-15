import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'content', 'obsidian');
const assetOutDir = path.join(root, 'blog-assets');
const outFile = path.join(root, 'js', 'blog-posts.js');
const markdownExtensions = new Set(['.md', '.mdx']);

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
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

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: source };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    const value = rawValue.trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (value === 'true' || value === 'false') {
      data[key] = value === 'true';
    } else {
      data[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  return { data, body: source.slice(match[0].length) };
}

function normalizeCallouts(source) {
  return source.replace(
    /^>\s*\[!([A-Za-z0-9_-]+)\]\+?\s*([^\r\n]*)$/gm,
    (_match, type, title) => `> **${title.trim() || type.toUpperCase()}**`
  );
}

function normalizeAssetPath(target) {
  return target.split('|')[0].trim().replaceAll('\\', '/');
}

function normalizeWikilinks(source, postSlugByTitle, sourceDir, diagnostics) {
  const outgoingLinksBySlug = new Map();
  const assets = [];

  const body = source
    .replace(/!\[\[([^\]]+)\]\]/g, (_match, target) => {
      const cleanTarget = normalizeAssetPath(target);
      const assetPath = path.join(sourceDir, cleanTarget);
      assets.push(cleanTarget);
      diagnostics.assetChecks.push({ target: cleanTarget, path: assetPath });
      return `![${cleanTarget}](blog-assets/${cleanTarget})`;
    })
    .replace(/\[\[([^\]]+)\]\]/g, (_match, raw) => {
      const [target, label = target] = raw.split('|').map((part) => part.trim());
      const linkedPost = postSlugByTitle.get(target.toLowerCase());
      const slug = linkedPost ? linkedPost.slug : slugify(target);
      if (linkedPost) {
        outgoingLinksBySlug.set(slug, { slug, title: linkedPost.title });
      } else {
        diagnostics.missingLinks.push(target);
      }
      return `[${label}](#post:${slug})`;
    });

  return {
    body,
    outgoingLinks: [...outgoingLinksBySlug.values()],
    assets
  };
}

function markdownToHtml(source) {
  const lines = source.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];
  let quote = [];

  function inline(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      html.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
      list = [];
    }
  }

  function flushQuote() {
    if (quote.length) {
      html.push(`<blockquote>${inline(quote.join('\n'))}</blockquote>`);
      quote = [];
    }
  }

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      flushParagraph(); flushList(); flushQuote();
      html.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^#\s+/.test(line)) {
      flushParagraph(); flushList(); flushQuote();
      html.push(`<h2>${inline(line.replace(/^#\s+/, ''))}</h2>`);
    } else if (/^>\s?/.test(line)) {
      flushParagraph(); flushList();
      quote.push(line.replace(/^>\s?/, ''));
    } else if (/^-\s+/.test(line)) {
      flushParagraph(); flushQuote();
      list.push(line.replace(/^-\s+/, ''));
    } else if (line.trim() === '') {
      flushParagraph(); flushList(); flushQuote();
    } else {
      flushList(); flushQuote();
      paragraph.push(line.trim());
    }
  }

  flushParagraph(); flushList(); flushQuote();
  return html.join('\n');
}

await mkdir(path.join(root, 'js'), { recursive: true });
await rm(assetOutDir, { recursive: true, force: true });
await mkdir(assetOutDir, { recursive: true });
await mkdir(sourceDir, { recursive: true });

const files = await walk(sourceDir);
const markdownFiles = files.filter((file) => markdownExtensions.has(path.extname(file).toLowerCase()));
const rawPosts = [];
const duplicateSlugs = new Set();
const seenSlugs = new Set();

for (const file of markdownFiles) {
  const source = await readFile(file, 'utf8');
  const { data, body } = parseFrontmatter(source);
  if (data.draft) continue;
  const title = data.title || path.basename(file, path.extname(file));
  const slug = data.slug || slugify(title);
  if (seenSlugs.has(slug)) duplicateSlugs.add(slug);
  seenSlugs.add(slug);
  rawPosts.push({ file, data, body, title, slug });
}

if (duplicateSlugs.size) {
  throw new Error(`Duplicate blog slug(s): ${[...duplicateSlugs].join(', ')}`);
}

const postSlugByTitle = new Map(rawPosts.map((post) => [post.title.toLowerCase(), {
  slug: post.slug,
  title: post.title
}]));
const diagnostics = {
  missingLinks: [],
  assetChecks: []
};

const posts = rawPosts.map((post) => {
  const normalized = normalizeWikilinks(normalizeCallouts(post.body), postSlugByTitle, sourceDir, diagnostics);
  const body = normalized.body;
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return {
    slug: post.slug,
    title: post.title,
    description: post.data.description || '',
    date: post.data.date || '',
    updated: post.data.updated || '',
    category: post.data.category || 'Notes',
    tags: post.data.tags || [],
    featured: Boolean(post.data.featured),
    readTime: Math.max(1, Math.ceil(words / 220)),
    outgoingLinks: normalized.outgoingLinks,
    backlinks: [],
    assets: normalized.assets,
    html: markdownToHtml(body)
  };
}).sort((left, right) => new Date(right.date) - new Date(left.date));

for (const check of diagnostics.assetChecks) {
  if (!(await exists(check.path))) {
    diagnostics.missingLinks.push(null);
    console.error(`Missing embedded asset "${check.target}"`);
  }
}

for (const target of diagnostics.missingLinks.filter(Boolean)) {
  console.error(`Missing wikilink target "${target}"`);
}

if (diagnostics.missingLinks.length) {
  process.exitCode = 1;
  throw new Error('Blog content validation failed.');
}

const postsBySlug = new Map(posts.map((post) => [post.slug, post]));

for (const post of posts) {
  for (const outgoing of post.outgoingLinks) {
    const target = postsBySlug.get(outgoing.slug);
    if (target) target.backlinks.push({ slug: post.slug, title: post.title });
  }
}

function pushIndex(index, key, slug) {
  if (!key) return;
  if (!index[key]) index[key] = [];
  index[key].push(slug);
}

const blogIndex = {
  postsBySlug: Object.fromEntries(posts.map((post) => [post.slug, post])),
  featuredPosts: posts.filter((post) => post.featured).map((post) => post.slug),
  latestPosts: posts.map((post) => post.slug),
  archiveByYear: {},
  tags: {},
  categories: {},
  backlinksBySlug: {}
};

for (const post of posts) {
  pushIndex(blogIndex.archiveByYear, String(post.date || '').slice(0, 4), post.slug);
  pushIndex(blogIndex.categories, post.category, post.slug);
  for (const tag of post.tags) pushIndex(blogIndex.tags, tag, post.slug);
  blogIndex.backlinksBySlug[post.slug] = post.backlinks.map((backlink) => backlink.slug);
}

for (const file of files.filter((file) => !markdownExtensions.has(path.extname(file).toLowerCase()))) {
  const relativePath = path.relative(sourceDir, file);
  const destination = path.join(assetOutDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(file, destination);
}

await writeFile(
  outFile,
  `window.BLOG_POSTS = ${JSON.stringify(posts, null, 2)};\nwindow.BLOG_INDEX = ${JSON.stringify(blogIndex, null, 2)};\n`,
  'utf8'
);

console.log(`Generated ${posts.length} post(s) into js/blog-posts.js.`);
