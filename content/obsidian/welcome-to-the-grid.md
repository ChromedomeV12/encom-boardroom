---
title: Welcome to the Grid
description: A sample post showing readable ENCOM styling, wikilinks, callouts, and Obsidian image embeds.
date: 2026-06-15
updated: 2026-06-15
tags: [interface, obsidian, notes]
category: Design Log
featured: true
draft: false
---

This sample note lives in Obsidian and is mirrored into the website before each build.
It links to [[Readable Interface Notes]] using Obsidian wikilink syntax.

> [!note] Reader-first rule
> The interface can glow, pulse, and feel cinematic, but the article body should remain quiet and readable.

## Publish Folder

Keep only posts meant for the public website in `content/obsidian`. Drafts can stay in your private vault, or they can use `draft: true` if you need them nearby.

## Local Assets

Obsidian image embeds also work:

![[attachments/signal-panel.svg]]

The validation script checks that embedded assets exist before a production build.
