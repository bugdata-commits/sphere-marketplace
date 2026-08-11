# Sphere Marketplace

A single-file, dependency-free static site (dark theme, glassmorphism, teal accent)
built for GitHub Pages. No build step required — `index.html` *is* the deploy artifact,
and it's duplicated into `dist/` so either path works with a standard Pages setup.

## What's inside
- `index.html` — the entire site: HTML, CSS, and JS in one file (fonts load from Google Fonts CDN at runtime; everything else is self-contained, including inline SVG icons — no external image assets to break on a subpath)
- `dist/index.html` — identical copy, in case your Pages workflow expects a `dist/` output folder

## Deploy to bugdata-commits.github.io/sphere-marketplace/

1. Create (or reuse) the repo `bugdata-commits/sphere-marketplace` on GitHub.
2. Push these files to the repo. Simplest layout — put `index.html` at the repo root:
   ```
   git init
   git add index.html README.md
   git commit -m "Sphere Marketplace launch"
   git branch -M main
   git remote add origin https://github.com/bugdata-commits/sphere-marketplace.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch.**
   Branch: `main`, folder: `/ (root)`. Save.
4. GitHub builds and serves it at `https://bugdata-commits.github.io/sphere-marketplace/`
   (usually live within a minute or two).

If you'd rather serve from `dist/` (e.g. to mirror a typical Vite workflow), pick folder
`/dist` in step 3 instead and push the `dist/` folder too — content is identical either way.

## Editing later
Everything lives in one file for easy hand-editing: `<style>` in the `<head>` for all
design tokens/CSS, markup in `<body>`, and a small `<script>` at the bottom for the
mobile menu toggle and scroll-reveal animations. Colors, spacing, and type scale are
CSS custom properties at the top of the `<style>` block (`:root { ... }`) — change once,
applies everywhere.

## Note on stack
The original brief specified React + Vite + Tailwind + Framer Motion. This build
achieves the same visual result (glassmorphism cards, teal accents, fadeUp/stagger
scroll animations, responsive hamburger nav) as plain HTML/CSS/JS instead, since no
npm registry access was available in the session that built this. It's a drop-in
replacement for the static output that stack would have produced — same look and
behavior, zero build tooling required. If you want the actual React/Vite/Tailwind
source later, it can be scaffolded on a machine with npm access using this file as
the design/content reference.
