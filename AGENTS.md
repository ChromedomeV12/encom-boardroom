# AGENTS.md

## Project
This is an Obsidian-powered blog built on top of `arscan/encom-boardroom`. Preserve the original ENCOM boardroom animations and visualizations unless the user explicitly asks to replace them.

## Workflow
- Make small, reviewable changes and keep git history updated after stable milestones.
- Before risky visual experiments, create a git checkpoint.
- Do not remove or hide original globe, cube, swirls, keyboard, or ENCOM motion systems unless explicitly requested.
- Prefer additive blog UI layers over replacing the original boardroom interface.
- For rejected experiments, revert only the experiment, not the whole blog migration.

## Blog Direction
- Obsidian Markdown lives in `content/obsidian`.
- Run `node scripts/build-blog-data.mjs` after changing Obsidian content.
- Generated output is `js/blog-posts.js` plus copied assets under `blog-assets`.
- Article readability wins over screen-accurate glow: body text should be off-white, calm, and constrained.
- The stream should become a scrollable blog surface integrated into the ENCOM UI, while preserving surrounding visualizations.

## Verification
Run these before handing off changes:

```powershell
node scripts\test-blog-data.mjs
node scripts\test-blog-runtime.mjs
```

For visual checks, prefer the in-app browser at the local server URL. Standalone Playwright is not a reliable visual/WebGL signal for this project in the current Windows environment.

## Local Server
Use:

```powershell
node scripts\serve-static.mjs 4322
```

Then open:

```text
http://127.0.0.1:4322/
```
