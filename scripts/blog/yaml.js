// YAML frontmatter parsing using js-yaml (standards-based).
// Separates frontmatter from the markdown body and parses it safely.
import yaml from 'js-yaml';
import { stripBom, normalizeNewlines } from './text.js';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse a raw markdown source into { data, body }.
 * - data: parsed frontmatter object (empty {} if none)
 * - body: the markdown body after frontmatter
 *
 * Throws a typed error if frontmatter is present but invalid YAML,
 * so the orchestrator can attach it to diagnostics with file context.
 */
export function parseFrontmatter(source) {
  const cleaned = normalizeNewlines(stripBom(source));
  const match = cleaned.match(FRONTMATTER_RE);
  if (!match) return { data: {}, body: cleaned };
  const rawYaml = match[1];
  let data;
  try {
    data = yaml.load(rawYaml, { schema: yaml.DEFAULT_SAFE_SCHEMA }) || {};
  } catch (err) {
    const wrapped = new Error(`YAML parse error: ${err.message}`);
    wrapped.yamlError = err;
    throw wrapped;
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    const wrapped = new Error('Frontmatter must be a YAML mapping (object), not a scalar or sequence.');
    wrapped.yamlError = wrapped;
    throw wrapped;
  }
  return { data, body: cleaned.slice(match[0].length) };
}
