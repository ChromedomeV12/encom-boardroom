// Traversal-safe asset handling for the ENCOM archive build.
// Copies only assets that are referenced by a post's embeds/hero, and
// refuses to read outside the content directory (no path traversal).
import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB per asset

/**
 * Resolve a raw embed target (e.g. "attachments/panel.svg" or
 * "attachments/panel.svg|500") to a clean relative path within the vault.
 * Strips Obsidian display aliases (the part after |).
 */
export function normalizeAssetTarget(target) {
  if (!target) return '';
  return String(target)
    .split('|')[0]
    .trim()
    .replaceAll('\\', '/');
}

/**
 * Resolve a raw wikilink target (e.g. "Notes/Readable Interface Notes#Section")
 * to a title and optional heading anchor.
 * Returns { title, anchor }.
 */
export function normalizeWikilinkTarget(target) {
  if (!target) return { title: '', anchor: '' };
  const [main, anchor] = String(target).split('#');
  return { title: main.trim(), anchor: (anchor || '').trim() };
}

/**
 * Given a source directory and a relative asset path, ensure the path
 * stays inside the source directory (no traversal via ../ or absolute paths).
 * Returns the absolute, traversal-safe filesystem path, or null if unsafe.
 */
export function resolveSafeAssetPath(sourceDir, relPath) {
  if (!relPath) return null;
  const clean = normalizeAssetTarget(relPath);
  if (!clean) return null;
  // Reject absolute and UNC paths outright.
  if (path.isAbsolute(clean)) return null;
  // Normalize and resolve, then verify it's under sourceDir.
  const resolved = path.resolve(sourceDir, clean);
  const normalizedSource = path.resolve(sourceDir);
  const rel = path.relative(normalizedSource, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return resolved;
}

/**
 * Copy a single referenced asset into the output directory, preserving
 * its relative path. Enforces a size limit. Skips silently if the source
 * is missing (the diagnostics pass reports missing assets separately).
 *
 * Returns { relPath, copied, bytes } or { relPath, copied: false, reason }.
 */
export async function copyAsset(sourceDir, outDir, relPath) {
  const src = resolveSafeAssetPath(sourceDir, relPath);
  if (!src) return { relPath, copied: false, reason: 'traversal-blocked' };
  try {
    const s = await stat(src);
    if (!s.isFile()) return { relPath, copied: false, reason: 'not-a-file' };
    if (s.size > MAX_ASSET_BYTES) return { relPath, copied: false, reason: 'too-large' };
    const dest = path.join(outDir, normalizeAssetTarget(relPath));
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest);
    return { relPath: normalizeAssetTarget(relPath), copied: true, bytes: s.size };
  } catch {
    return { relPath, copied: false, reason: 'missing' };
  }
}

/**
 * Check whether an asset exists without copying. Used for validation.
 */
export async function assetExists(sourceDir, relPath) {
  const src = resolveSafeAssetPath(sourceDir, relPath);
  if (!src) return false;
  try {
    const s = await stat(src);
    return s.isFile();
  } catch {
    return false;
  }
}

export { MAX_ASSET_BYTES };
