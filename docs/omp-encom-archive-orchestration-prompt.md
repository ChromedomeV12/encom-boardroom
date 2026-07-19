# OMP ENCOM Archive Orchestration Prompt

Recommended role configuration:

```yaml
modelRoles:
  default: Kimi K2.7 Code
  smol: GLM 4.7 Flash
  slow: DeepSeek V4 Pro (Thinking)
  vision: GLM 4.6V
  designer: Kimi K2.5
  commit: Qwen3 Coder 30B A3B Instruct
  tiny: Phi 4 Mini
  task: Devstral 2 123B
```

Copy everything inside the following block into OMP:

```text
orchestrate the complete implementation of the ENCOM Obsidian blog transformation described below.

You are the lead engineering agent. Do not stop after creating another plan: inspect the repository, validate the assumptions, delegate bounded work to suitable agents, implement the transformation in reviewable milestones, test it, visually verify it, and finish with a clear handoff.

PROJECT

Repository:
C:\Users\chrom\Desktop\Coding\WebDev\encom-obsidian-blog

This project is an Obsidian-powered Markdown blog built on top of arscan/encom-boardroom.

Read AGENTS.md completely before taking action. Also inspect README.md, package.json, index.html, the current Git state, src/, js/blog-adapter.js, css/blog.css, scripts/, and the sample Markdown under content/obsidian.

NON-NEGOTIABLE PRODUCT DIRECTION

Transform the application into an "ENCOM Archive Operating System":

1. The ENCOM light table and boardroom are the immersive discovery, navigation, and visualization surfaces.
2. Markdown articles are canonical, readable web documents that work without WebGL and preferably without client-side JavaScript.
3. Preserve the original globe, cube, swirls, keyboard, terminal, charts, media panels, blinkies, timers, clocks, transitions, animations, and surrounding ENCOM identity as much as technically possible.
4. Do not replace the original boardroom with a conventional blog theme.
5. Do not fabricate telemetry. Widgets must display real derived content data, optional author metadata, honest system/archive status, or clearly ambient information.
6. Article readability wins over excessive glow. Body text must remain calm, off-white, constrained, and comfortable for long reading.

GIT AND CHANGE-HISTORY STRATEGY

- Inspect `git status`, the current branch, remotes, and recent log before editing.
- The repository must be clean before implementation begins. If it is not clean, do not discard, overwrite, stash, or absorb unknown changes; report them first.
- Create and work on a dedicated branch named `omp/encom-archive-os`. Do not implement directly on `master`.
- Treat the starting `master` commit as the immutable comparison baseline.
- Create a baseline/checkpoint commit before risky visual or lifecycle experimentation if any preparatory changes are needed.
- Commit each stable feature milestone separately. Do not combine unrelated milestones in one commit.
- Suggested commit sequence:
  1. `build: establish safe markdown content pipeline`
  2. `feat: generate canonical blog publication outputs`
  3. `refactor: unify blog controller and routing`
  4. `feat: complete archive discovery and commands`
  5. `feat: connect archive signals to ENCOM widgets`
  6. `feat: preserve ENCOM experience responsively`
  7. `docs: document authoring and release workflow`
- Run the relevant tests before every milestone commit.
- Stage only files belonging to that milestone. Inspect the staged diff before committing.
- Do not amend, squash, rebase, or rewrite completed milestone commits during the task. Add follow-up fix commits when necessary so review history remains legible.
- Do not push, modify `origin`, force-update refs, or create a pull request.
- At completion, report:
  - `git log --oneline master..HEAD`
  - `git diff --stat master...HEAD`
  - the commit corresponding to each feature milestone
  - any intentionally uncommitted files
- Preserve rejected experiments by reverting only their dedicated commit or files, never by resetting the entire migration.

WORKING RULES

- Preserve any user-owned changes.
- Make small, reviewable changes.
- Do not rewrite or remove the original ENCOM rendering systems.
- Prefer adapters, controllers, and derived content signals over invasive widget rewrites.
- Keep the current `window.BLOG_POSTS` contract working until its consumers have been deliberately migrated.
- Source changes under src/ must be reflected in the served Browserify bundle.
- Do not allow agents to edit overlapping files concurrently. Parallelize audits, tests, fixtures, and disjoint modules; integrate centrally.
- When an assumption is uncertain, inspect the implementation instead of guessing.

USE AGENT ROLES INTENTIONALLY

- Use `smol` for repository reconnaissance, dependency/API research within available local context, and fixture inventories.
- Use `slow` for architecture review, security review, difficult debugging, and milestone code review.
- Use `designer` for responsive layout, reader UX, ENCOM-native navigation, and visual refinement.
- Use `vision` for screenshot comparison and desktop/mobile visual QA when browser imagery is available.
- Use `task` for bounded implementation work with clearly separated file ownership.
- Keep final integration, conflict resolution, acceptance decisions, and Git milestones under the lead agent.

TARGET ARCHITECTURE

A. Build-time content system

Replace the proof-of-concept parser with a standards-based, build-time Markdown pipeline while keeping modern packages out of the legacy browser runtime.

Support:

- Real YAML frontmatter
- Schema validation and normalized metadata
- Markdown/GFM headings h1-h6
- Heading IDs and table of contents
- Ordered, unordered, nested, and task lists
- Fenced code blocks and inline code
- Tables, blockquotes, emphasis, and footnotes where practical
- Obsidian wikilinks, aliases, embeds, callouts, and heading links
- Backlinks and outgoing links
- Deterministic slugs and dates
- Draft handling
- Safe URL and HTML sanitization
- Traversal-safe, referenced-only asset copying
- Filenames containing spaces and Unicode
- Clear diagnostics for unsupported or invalid content

Suggested normalized metadata includes:

- id
- slug
- title
- description
- date
- updated
- tags[]
- category
- featured
- draft
- aliases[]
- hero
- series
- location/coordinates
- redirectFrom[]
- optional themeColor

Derived metadata should include:

- excerpt
- wordCount
- readTime
- headings/TOC
- outgoingLinks
- backlinks
- link degree/popularity
- referenced assets
- publication buckets
- related posts

Split responsibilities into focused modules under scripts/blog/ where appropriate. Keep scripts/build-blog-data.mjs as the public orchestrator.

B. Static publication and progressive enhancement

Generate:

- A lightweight metadata/index manifest
- Per-post data or HTML payloads
- Canonical `/posts/<slug>/index.html` article pages
- Tag/category/archive pages as appropriate
- RSS or Atom
- sitemap.xml
- Correct per-post title, description, canonical URL, Open Graph data, and Article structured data

The main ENCOM page remains the immersive entry point. Direct article pages must remain readable if WebGL fails or JavaScript is unavailable, and should offer an "Open in Boardroom" path.

C. Unified runtime

Remove the competing post renderers and timing-dependent repeated boot writes currently split between Boardroom.js and blog-adapter.js.

Create one authoritative blog controller/store/router responsible for:

- Current discovery lens
- Selected post
- Reader state
- Search/filter state
- URL/history state
- Post loading
- Boardroom-ready lifecycle
- Widget signal dispatch

Replace retry timers with an explicit lifecycle event or callback.

Use one consistent URL model. Opening posts should create usable browser history. Closing or navigating back must restore the correct URL, focus, selection, and scroll position.

D. Complete ENCOM-native information architecture

Light-table folders:

1. Featured
2. Latest
3. Topics
4. Archive
5. Search/Index

Boardroom feed:

- Semantic, keyboard-accessible article list
- Title
- Description/excerpt
- Category
- Date
- Reading time
- Tags
- Selected state
- Proper archive grouping rather than simply reversing the sort order

Terminal and keyboard:

- Real accessible command/search input
- Commands such as `help`, `latest`, `featured`, `tags`, `tag <name>`, `year <year>`, `search <query>`, `open <slug>`, and `back`
- Preserve the simulated ENCOM command sequences when folders are clicked
- Do not globally intercept keystrokes in ways that break browser or assistive behavior

Article reader:

- Canonical route
- Breadcrumb/back to current lens
- Description and complete metadata
- Heading TOC
- Previous/next within the current lens
- Outgoing links
- Backlinks
- Related posts
- Escape close
- Dialog semantics when overlayed
- Focus transfer, trapping, restoration, and background inert behavior
- Scroll locking/restoration

E. BlogSignal / archive replay

Build an adapter around the original Boardroom message/update path.

Convert each post into a deterministic archive signal containing appropriate fields such as title, category, primary tag, read time, word count, link degree, hero/first asset, date, and optional geographic metadata.

On boardroom entry, replay archive signals at a short controlled cadence. Label this honestly as `ARCHIVE REPLAY`, not `LIVE FEED`.

Selection, filtering, opening a post, following a wikilink, and changing topics should emit additional signals so the surrounding dashboard reacts to actual reader activity.

F. Preserve and activate widgets

Map real content data to the original systems:

- Interaction stream: article results
- Globe: optional geographic posts; ambient archive relays otherwise
- Location sliders: geographic filters or top categories/tags
- Cube: recency, article depth/read time, and link density
- Swirls: category/tag pulses
- Growth chart: publication cadence, words, or archive growth
- Mini charts: posts, words, links, media, and tags
- Media panels: hero images, attachments, and related artwork
- Blinkies: tag frequency, backlink density, and validation state
- Timer: archive session or time since latest publication
- World clocks: preserve as ambient functionality
- Timer trees: publication timeline
- WebGL waveform/datalink: content build, asset, and link health
- Dynamic logo: BLOG plus current lens/category where suitable
- Footer: back, info, search/keyboard, effects, fullscreen, configured social links, and RSS

Remove upstream placeholder copy from active blog panels.

G. Responsive preservation and motion

Do not solve mobile by permanently hiding the original systems.

Design a mobile model using a compact horizontal instrument shelf, carousel, tabs, or collapsible telemetry cards. Article content is primary, but the original capabilities and visual identity remain reachable.

Add:

- Correct viewport metadata
- Stable phone and tablet layouts
- Reduced-motion support
- Reduced-effects/performance mode
- Pausing or throttling offscreen WebGL
- Pausing expensive dashboard animation while the reader fully covers it
- No forced device rotation for normal article reading

IMPLEMENTATION MILESTONES

Milestone 0 — Baseline

- Read project guidance and inspect Git state.
- Run current tests.
- Capture desktop and mobile baseline behavior.
- Identify the exact Browserify/build procedure.
- Create the dedicated feature branch and establish the comparison baseline.

Milestone 1 — Content contract and safe parser

- Introduce normalized schemas.
- Upgrade YAML and Markdown processing.
- Add deterministic normalization and sanitization.
- Make referenced asset handling traversal-safe.
- Preserve compatibility output.
- Add comprehensive fixtures and tests.

Milestone 2 — Static publication

- Generate canonical article pages and metadata.
- Generate manifest, feeds, sitemap, and discovery pages.
- Verify direct articles without WebGL.

Milestone 3 — Unified controller and routing

- Consolidate renderers and lifecycle.
- Correct history, closing, focus, and deep links.
- Remove repeated retry writes.
- Add runtime/unit tests.

Milestone 4 — Complete discovery

- Implement all five folders.
- Add topics, archive grouping, search/index, terminal commands, and keyboard navigation.

Milestone 5 — Archive signals and widgets

- Implement BlogSignal/archive replay.
- Activate each retained widget from honest content-derived telemetry.
- Preserve original renderers and animation identity.

Milestone 6 — Responsive, accessibility, and effects

- Replace mobile hiding with compact preservation.
- Complete semantic navigation and reader accessibility.
- Add reduced-motion/effects and performance management.

Milestone 7 — Documentation and release verification

- Update README with the actual Obsidian authoring/build workflow.
- Add useful npm scripts for build, test, serve, and content validation.
- Ensure generated outputs cannot silently become stale.
- Run the complete verification suite.
- Perform final desktop/mobile visual QA.
- Ask `slow` to review the integrated implementation and address material findings.

TESTING REQUIREMENTS

At minimum, preserve and run:

node scripts\test-blog-data.mjs
node scripts\test-blog-runtime.mjs

Expand testing to cover:

- YAML edge cases
- Unicode, empty, and duplicate slugs
- Invalid dates
- Aliases and redirects
- Heading links
- Draft-link policy
- Unsafe URLs and HTML
- Path traversal attempts
- Assets with spaces and Unicode
- Markdown/GFM constructs
- Deterministic generated output
- Router/history behavior
- Reader keyboard and focus behavior
- No-WebGL article access
- Responsive preservation
- Reduced-motion mode
- Approximately 100 and 1,000 post performance cases where practical

Use the project's preferred browser-testing surface for visual/WebGL checks. Do not treat standalone Playwright rendering as authoritative if AGENTS.md says otherwise.

DEFINITION OF DONE

The work is complete only when:

- Obsidian Markdown is processed by a safe, capable, tested pipeline.
- Articles have canonical, directly readable pages.
- Featured, Latest, Topics, Archive, and Search/Index work.
- Reader routing, history, focus, and accessibility behave correctly.
- The original ENCOM systems remain present and have meaningful blog/archive roles.
- Mobile retains access to the instruments instead of deleting the experience.
- Reduced-motion and reduced-effects behavior exists.
- Placeholder/realtime-feed claims are removed or honestly relabelled.
- Tests pass.
- Desktop and mobile visual inspection passes.
- Generated bundles and content artifacts are current.
- Stable milestones have been committed locally on `omp/encom-archive-os`.
- Nothing has been pushed.
- The final response summarizes architecture, files changed, tests, visual checks, commits, remaining limitations, exact authoring/build commands, and the feature-by-feature Git comparison commands.

Begin by reading AGENTS.md and auditing the existing repository. Then execute the milestones. Do not merely restate this prompt.
```
