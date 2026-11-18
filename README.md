# TerraVellia

A gardening idea-list blog whose traffic comes almost entirely from Pinterest.
Brand: **TerraVellia** — “Garden ideas worth pinning”.
Live domain: https://gardening.bilalmania.com · GitHub: `baseerunnisa345/TerraVellia` ·
Pinterest: https://www.pinterest.com/baseerunnisa345/

Static site, no framework, no PHP, no build step, no npm dependencies to deploy.
Pure HTML, CSS and vanilla JS. Vercel preset: **Other**, no build command, output directory `.`

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

```
index.html                  homepage (listings render from data/articles.json)
about/ contact/ privacy-policy/ terms/
category/<7 slugs>/        one page per category
articles/<slug>/           one folder per article
articles/_template.html    article template (noindex, not in sitemap)
articles/raised-bed-vegetable-garden-ideas/
                            SAMPLE article only — layout testing, noindex,
                            not in sitemap, not in any listing
admin/                     article generator dashboard (noindex, robots-disallowed)
assets/css/                base.css, components.css, article.css, admin.css (12.6KB total)
assets/js/                 site.js, listing.js, article.js, analytics.js (6.5KB total), admin.js
assets/img/                logo.svg, favicon set, og-default.jpg, placeholder-portrait.webp,
                           article images under /assets/img/<slug>/
data/articles.json         source of truth for all listings (currently no published articles)
sitemap.xml  robots.txt  vercel.json  404.html  site.webmanifest
```

## Publishing workflow (admin)

1. Open `/admin/` in a browser.
2. **Passphrase:** the gate compares a SHA-256 hash in `admin.js` (`PASS_HASH`).
   It currently holds the placeholder `REPLACE_WITH_YOUR_SHA256_HASH`, which lets
   anyone in — **Elora must set her own hash before relying on it.** Generate one
   with `echo -n "your-passphrase" | sha256sum` and paste the hex string.
   This gate is a **deterrent only, not real security** — the page is also
   `noindex` and disallowed in `robots.txt`. Never store real secrets in the repo.
3. Fill in the article form (title ≤60 chars, description ≤155, 25–40 ideas,
   7–8 FAQs, 3–5 takeaways). The pre-flight checklist must be all green before
   the export buttons enable.
4. Upload images per idea: the admin centre-crops to 2:3, resizes to 1000×1500
   and encodes WebP, stepping quality down (0.82 → 0.5) until the file is ≤100KB.
5. Download: article HTML, images ZIP, updated `articles.json`, regenerated
   `sitemap.xml`, and the listing snippet for the `LISTING:START/END` markers.
6. Unzip into the repo root, replace `articles.json` and `sitemap.xml`, paste the
   snippet, then `git add . && git commit -m "Add <slug>" && git push`.
   Vercel auto-deploys.

## Vercel setup

- Import the repo `baseerunnisa345/TerraVellia`, framework preset **Other**,
  no build command, output directory `.`
- Custom domain `gardening.bilalmania.com`: already added to the `terravellia`
  project. DNS: CNAME `gardening` → the `vercel-dns-017.com` address Vercel shows
  in the project (currently `d7a120dd2e2748ad.vercel-dns-017.com`).
- `vercel.json` sets `cleanUrls: true` and `trailingSlash: true`, security headers
  and cache headers (assets immutable 1 year, HTML revalidate, `articles.json`
  5 min + stale-while-revalidate, `/admin/` noindex header).

## Image guidelines

- Portrait only, **2:3 (1000×1500 px)**, WebP, **≤100KB** (target 60–90KB).
- Naming: `NN-descriptive-keywords.webp`, in `/assets/img/<article-slug>/`.
- Alt text: unique, descriptive, 8–16 words, naturally includes the idea name.
- Strip EXIF, use sRGB.
- **Sourcing rule:** only use images the owner has the rights to — own photos,
  licensed images, or AI-generated images with commercial rights.
- The sample article and template use generated gradient placeholders
  (`placeholder-portrait.webp` and the `raised-bed-vegetable-garden-ideas/`
  images). Replace them with real photos before publishing any real article.

## SEO checklist

- Title ≤60 chars, description ≤155 chars on every page (the admin enforces
  both with live counters and refuses export over the limits).
- One H1 per page, canonical on every page, `lang="en"`, `theme-color`.
- JSON-LD: `Article`, `FAQPage` (text identical to the visible FAQ),
  `BreadcrumbList`, `ItemList` of the numbered ideas.
- Validate with Google Rich Results Test and the Schema.org validator.
- `sitemap.xml` lists every public URL with `<lastmod>` and hero `<image:image>`
  entries; regenerate it from the admin after each new article.
- Slugs are lowercase-hyphenated and keyword-first, **without the number**,
  so titles can change later (e.g. 30 → 35) without breaking the URL.

## Adding a new category

1. Add the category to `data/articles.json` (`categories` array) and to the
   `CATEGORIES` list in `assets/js/admin.js`.
2. Copy an existing `category/<slug>/index.html`, update the title, description,
   intro (60–90 words, unique) and JSON-LD, and add the link to the site header
   and footer nav in every page (or regenerate with the admin).
3. Add the URL to `sitemap.xml` (or regenerate it from the admin).

## Performance targets

Lighthouse mobile: Performance ≥95, LCP <2.0s, CLS <0.02, INP <150ms.
Critical CSS is small and inlined where it matters; all public JS is deferred;
images carry explicit width/height and lazy-load below the fold; the LCP image
is preloaded with `fetchpriority="high"`. Asset URLs take a `?v=N` fingerprint
that is bumped manually when a file changes.

## Notes and open decisions (owner)

- The sample article is **not** a published article: it is `noindex`, excluded
  from the sitemap and all listings, and labelled on the page. Real article copy
  comes from the owner's pipeline (ChatGPT), not from this repo.
- Contact email is **bene6761@gmail.com** (mailto link, no form backend).
  There is no phone number, postal address or other social account on the site.
- The admin dashboard is publicly reachable by URL unless access control is
  added; the passphrase gate is only a deterrent.
- No analytics loads by default. To enable a privacy-friendly tool, set
  `window.TERRAVELLIA_ANALYTICS_URL` — see `assets/js/analytics.js`.
