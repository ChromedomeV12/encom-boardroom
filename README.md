# ENCOM Archive OS

This repository turns the original [ENCOM Boardroom](https://github.com/arscan/encom-boardroom) into an Obsidian-powered archive and blog. The light table, globe, cube, swirls, keyboard, charts, and other boardroom systems remain part of the interface. Markdown articles also get canonical static pages that work without WebGL or client-side JavaScript.

![Boardroom light table](https://raw.github.com/arscan/encom-boardroom/master/images/screenshot_lighttable.jpg "Boardroom light table")

![Boardroom screen](https://raw.github.com/arscan/encom-boardroom/master/images/screenshot.jpg "Boardroom screen")

## Requirements

- Node.js and npm
- A browser with WebGL for the boardroom view
- WebGL is not required for pages under `dist/posts/`

Install dependencies once:

```sh
npm install
```

## Authoring posts

Public Obsidian notes live in `content/obsidian`. The build reads `.md` and `.mdx` files recursively. Keep attachments in that directory too, usually under `content/obsidian/attachments`.

A post needs a valid `date`. The title defaults to the file name, and the slug defaults to a normalized title, but setting both explicitly makes URLs stable.

```yaml
---
title: Welcome to the Grid
description: A short summary used for excerpts and metadata.
date: 2026-06-15
updated: 2026-06-20
slug: welcome-to-the-grid
tags: [interface, obsidian]
category: Design Log
featured: true
draft: false
aliases: [Grid introduction]
hero: attachments/signal-panel.svg
series: Archive notes
location:
  lat: 42.3601
  lng: -71.0589
  label: Boston
redirectFrom: [/old-grid-path/]
themeColor: "#00eeee"
---
```

Supported fields:

- `title`: Post title. Falls back to the file name.
- `date`: Required publication date. Use `YYYY-MM-DD` or a valid ISO date.
- `slug`: Canonical URL segment. Falls back to the normalized title.
- `description`: Preferred excerpt and page description.
- `updated`: Optional update date.
- `tags`: String or YAML list.
- `category`: Defaults to `Notes`.
- `featured`, `draft`: Boolean flags. Drafts are omitted from all output.
- `aliases`: Alternate Obsidian titles used when resolving wikilinks.
- `hero`: Path to a local image or attachment.
- `series`: Optional series name.
- `location`: Either `lat, lng` or an object with `lat`, `lng`, and optional `label`.
- `redirectFrom`: String or list of prior paths retained in metadata.
- `themeColor`: Optional article theme color.

Use Obsidian wikilinks for internal links:

```md
See [[Readable Interface Notes]].
See [[Readable Interface Notes|the readability notes]].
```

Use Obsidian embeds for local assets:

```md
![[attachments/signal-panel.svg]]
```

The build rejects duplicate slugs, unresolved wikilinks, invalid dates or locations, path traversal, and missing referenced assets. It also derives excerpts, heading IDs and TOCs, backlinks, related posts, word counts, reading times, tags, categories, and yearly archive data.

## Build and generated output

Build content data only:

```sh
npm run build:content
```

This writes:

- `js/blog-posts.js`, containing lightweight post metadata and the `window.BLOG_INDEX` discovery contract
- `blog-data/posts/<slug>.json`, containing article bodies loaded only when a reader opens
- Referenced files under `blog-assets/`

Publish canonical pages by supplying the real public base URL:

```sh
node scripts/publish-blog.mjs --site-url=https://chromedomev12.github.io/encom-boardroom --out=dist
```

This fork is prepared for the free GitHub Pages project URL at `https://chromedomev12.github.io/encom-boardroom/`. The runtime and generated article links retain the `/encom-boardroom/` deployment path.

The `Deploy GitHub Pages` workflow publishes the interactive boardroom at the project root and overlays the generated canonical routes (`posts`, `tags`, `categories`, `archive`, and `featured`) into the same Pages artifact. It runs for this development branch and `master`, and can also be started manually from GitHub Actions.

The publication command rebuilds content first, then replaces `dist/` with:

- `dist/posts/<slug>/index.html`
- `dist/featured/index.html`
- `dist/tags/<tag>/index.html`
- `dist/categories/<category>/index.html`
- `dist/archive/index.html` and yearly archive pages
- `dist/rss.xml`
- `dist/sitemap.xml`
- `dist/manifest.json`

The publisher intentionally has no default canonical URL. You can alternatively set `BLOG_SITE_URL` before running `npm run build:publication`; the build stops rather than emitting localhost or upstream ownership metadata when no URL is configured.

For a disposable local publication preview only, pass the local server URL explicitly:

```sh
node scripts/publish-blog.mjs --site-url=http://127.0.0.1:4322 --out=dist
```

Rebuild the Browserify application bundle after changing files under `src/`:

```sh
npm run build:bundle
```

Run the complete production build after setting `BLOG_SITE_URL`:

```sh
npm run build
```

`js/blog-posts.js`, `blog-data/`, `blog-assets/`, `dist/`, and `build/encom-boardroom.js` are generated and tracked. Do not edit them by hand. Regenerate and commit them with the source or content change that produced them.

## Validation and tests

Validate content data:

```sh
npm run validate:content
```

Run every build and test:

```sh
npm test
```

Focused commands are also available:

```sh
npm run test:blog-data
npm run test:blog-publication
npm run test:blog-router
npm run test:blog-runtime
npm run test:motion-policy
```

The project handoff checks are `node scripts/test-blog-data.mjs` and `node scripts/test-blog-runtime.mjs`. Publication, router, and motion policy tests cover the added static and interactive contracts.

## Local server

Serve the repository on the standard development port:

```sh
npm run serve
```

Open `http://127.0.0.1:4322/` for the ENCOM interface. Canonical generated pages are available under `http://127.0.0.1:4322/dist/`.

The legacy realtime stream server remains available through `npm start`. The archive blog does not require it.

## Archive controls

The five light-table folders open Featured, Latest, Archive, Topics, and Search / Index views. They support pointer and keyboard activation.

The accessible terminal accepts the same command parser as the simulated ENCOM keyboard:

```text
help
featured
latest
tags
tag <name>
year <yyyy>
search <query>
open <slug>
back
```

Article rows are keyboard accessible. The overlay reader supports Escape, trapped focus, background inert behavior, scroll restoration, and browser history. Canonical article pages remain the fallback when boardroom effects or WebGL are unavailable.

Use the `Reduced Effects` control in the boardroom footer for a persistent 4 fps performance mode. The app also respects `prefers-reduced-motion`, pauses expensive rendering while the document or boardroom is offscreen, and pauses boardroom animation while the reader covers it.

## Upstream project

Robert Scanlon created the original ENCOM Boardroom as an HTML5 recreation of the boardroom scene from *Tron: Legacy*. The globe is also available as the standalone [ENCOM Globe](https://github.com/arscan/encom-globe) library. This project is not associated with Tron: Legacy or Disney.

Notable upstream dependencies include Node.js, Three.js, ENCOM Globe, Hexasphere.js, Quadtree2.js, and pleaserotate.js.

## License

The MIT License (MIT)

Copyright (c) 2014-2017 Robert Scanlon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
