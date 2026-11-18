/* TerraVellia — admin.js (client-side only; generates files the owner commits).
   Security note: the passphrase gate is a deterrent, not real security.
   The admin page is noindex and disallowed in robots.txt. Never store
   real secrets here. */
(function () {
  "use strict";
  /* ===== CONFIG ===== */
  var PASS_HASH = "REPLACE_WITH_YOUR_SHA256_HASH"; // Elora: set your own SHA-256 hash here
  var CATEGORIES = [
    ["vegetable-gardening", "Vegetable Gardening"],
    ["container-gardening", "Container Gardening"],
    ["raised-beds", "Raised Beds"],
    ["herb-gardens", "Herb Gardens"],
    ["flower-beds", "Flower Beds"],
    ["indoor-plants", "Indoor Plants"],
    ["seasonal-planting-guides", "Seasonal Planting Guides"]
  ];
  var SITE_URL = "https://gardening.bilalmania.com";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }
  function words(s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function download(name, blob) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function sha256hex(str) {
    if (!crypto.subtle) return Promise.resolve(null);
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
    });
  }

  /* ===== STATE ===== */
  var S = {
    title: "", slug: "", meta: "", category: "raised-beds", published: today(),
    modified: today(), keyword: "", intro: "", heroAlt: "",
    ideas: [], takeaways: ["", "", ""], faqs: [{ q: "", a: "" }],
    related: [], make500: false
  };
  var ARTICLES = { categories: CATEGORIES.map(function (c) { return { slug: c[0], name: c[1] }; }), articles: [] };
  var draftKey = "terravellia-admin-draft-v1";

  /* ===== GATE ===== */
  var gate = $("#gate"), app = $("#app");
  function unlock() {
    if (PASS_HASH === "REPLACE_WITH_YOUR_SHA256_HASH") {
      // No passphrase configured yet: allow in, but warn clearly.
      $("#gate-note").textContent = "No passphrase is set yet (placeholder hash). Set PASS_HASH in admin.js — see README. This gate is a deterrent only.";
      gate.hidden = true; app.hidden = false; init();
      return;
    }
    var pw = $("#gate-pass").value;
    sha256hex(pw).then(function (h) {
      if (h && h === PASS_HASH) { gate.hidden = true; app.hidden = false; init(); }
      else $("#gate-error").textContent = "Wrong passphrase. Try again.";
    });
  }
  $("#gate-unlock").addEventListener("click", unlock);
  $("#gate-pass").addEventListener("keydown", function (e) { if (e.key === "Enter") unlock(); });

  /* ===== INIT ===== */
  var inited = false;
  function init() {
    if (inited) return; inited = true;
    fetch("/data/articles.json").then(function (r) { return r.json(); }).then(function (j) {
      ARTICLES = j; renderRelated();
    }).catch(function () {});
    // date defaults
    $("#f-published").value = S.published; $("#f-modified").value = S.modified;
    bindFields(); renderIdeas(); renderTakeaways(); renderFaqs(); updateAll();
    loadDraft();
  }

  function bindFields() {
    var map = [["f-title", "title"], ["f-slug", "slug"], ["f-meta", "meta"], ["f-category", "category"],
      ["f-published", "published"], ["f-modified", "modified"], ["f-keyword", "keyword"],
      ["f-intro", "intro"], ["f-heroalt", "heroAlt"]];
    map.forEach(function (pair) {
      $("#" + pair[0]).addEventListener("input", function (e) {
        S[pair[1]] = e.target.value;
        if (pair[1] === "title" && !$("#f-slug").dataset.touched) {
          S.slug = slugify(S.title); $("#f-slug").value = S.slug;
        }
        updateAll();
      });
    });
    $("#f-slug").addEventListener("change", function () { this.dataset.touched = "1"; });
    $("#f-make500").addEventListener("change", function (e) { S.make500 = e.target.checked; });
    $("#btn-add-idea").addEventListener("click", function () { addIdea(); });
    $("#btn-bulk").addEventListener("click", applyBulk);
    $("#btn-add-takeaway").addEventListener("click", function () {
      if (S.takeaways.length < 5) { S.takeaways.push(""); renderTakeaways(); updateAll(); }
    });
    $("#btn-add-faq").addEventListener("click", function () {
      if (S.faqs.length < 8) { S.faqs.push({ q: "", a: "" }); renderFaqs(); updateAll(); }
    });
    $("#btn-save-draft").addEventListener("click", saveDraft);
    $("#btn-clear-draft").addEventListener("click", function () {
      try { localStorage.removeItem(draftKey); } catch (e) {}
      location.reload();
    });
    $("#btn-export-draft").addEventListener("click", function () {
      download("terravellia-draft.json", new Blob([JSON.stringify(serialize(), null, 2)], { type: "application/json" }));
    });
    $("#file-import-draft").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { try { applyState(JSON.parse(r.result)); } catch (err) { alert("Draft file could not be read."); } };
      r.readAsText(f);
    });
    $("#btn-preview").addEventListener("click", renderPreview);
    $$("[data-preview-width]").forEach(function (b) {
      b.addEventListener("click", function () { $("#preview-frame").style.width = b.getAttribute("data-preview-width"); });
    });
    $("#btn-export-html").addEventListener("click", function () {
      download("index.html", new Blob([buildArticleHTML()], { type: "text/html" }));
    });
    $("#btn-export-zip").addEventListener("click", exportZip);
    $("#btn-export-json").addEventListener("click", function () {
      download("articles.json", new Blob([JSON.stringify(updatedArticlesJSON(), null, 2)], { type: "application/json" }));
    });
    $("#btn-export-sitemap").addEventListener("click", function () {
      download("sitemap.xml", new Blob([buildSitemap(updatedArticlesJSON())], { type: "application/xml" }));
    });
    $("#btn-copy-listings").addEventListener("click", function () {
      $("#out-listings").value = listingSnippet();
      $("#out-listings").select();
      if (navigator.clipboard) navigator.clipboard.writeText($("#out-listings").value);
    });
  }

  /* ===== IDEAS REPEATER ===== */
  function addIdea(data) {
    S.ideas.push(data || { title: "", desc: "", alt: "", blob: null, url: "", size: 0, name: "" });
    renderIdeas(); updateAll();
  }
  function renderIdeas() {
    var box = $("#ideas"); box.innerHTML = "";
    S.ideas.forEach(function (idea, i) {
      var card = document.createElement("div");
      card.className = "idea-card";
      card.innerHTML =
        "<h3>Idea " + (i + 1) + " of " + S.ideas.length + "</h3>" +
        '<label>Title <input type="text" data-f="title" value="' + esc(idea.title) + '"></label>' +
        '<label>Description (40–90 words) <textarea data-f="desc">' + esc(idea.desc) + "</textarea></label>" +
        '<label>Image (portrait, auto-cropped to 2:3, WebP ≤100KB) <input type="file" accept="image/*" data-f="file"></label>' +
        '<div class="thumb-grid"></div>' +
        '<label>Alt text (8–16 words) <input type="text" data-f="alt" value="' + esc(idea.alt) + '"></label>' +
        '<p class="counter">' + (idea.size ? "Image: " + (idea.size / 1024).toFixed(0) + " KB " + (idea.size <= 100000 ? '<span class="badge badge--ok">≤100KB ✓</span>' : '<span class="badge badge--bad">&gt;100KB ✗</span>') : "No image yet") + "</p>" +
        '<div class="actions">' +
        '<button type="button" class="secondary" data-act="up">↑ Up</button>' +
        '<button type="button" class="secondary" data-act="down">↓ Down</button>' +
        '<button type="button" class="secondary" data-act="dup">Duplicate</button>' +
        '<button type="button" class="secondary" data-act="del">Remove</button></div>';
      var thumb = card.querySelector(".thumb-grid");
      if (idea.url) {
        thumb.innerHTML = '<div class="thumb"><img src="' + idea.url + '" alt=""><p>' + esc(idea.name) + "</p></div>";
      }
      $$("input[data-f],textarea[data-f]", card).forEach(function (inp) {
        inp.addEventListener("input", function () {
          idea[inp.getAttribute("data-f")] = inp.value;
          if (inp.getAttribute("data-f") === "title") renumberThumbs();
          updateAll();
        });
        if (inp.getAttribute("data-f") === "file") {
          inp.addEventListener("change", function () { processImage(idea, inp.files[0], thumb); });
        }
      });
      $$("[data-act]", card).forEach(function (b) {
        b.addEventListener("click", function () {
          var act = b.getAttribute("data-act");
          if (act === "up" && i > 0) { var t = S.ideas[i - 1]; S.ideas[i - 1] = S.ideas[i]; S.ideas[i] = t; }
          if (act === "down" && i < S.ideas.length - 1) { var u = S.ideas[i + 1]; S.ideas[i + 1] = S.ideas[i]; S.ideas[i] = u; }
          if (act === "dup") S.ideas.splice(i + 1, 0, Object.assign({}, S.ideas[i], { blob: null, url: "", size: 0 }));
          if (act === "del") S.ideas.splice(i, 1);
          renderIdeas(); updateAll();
        });
      });
      box.appendChild(card);
    });
    $("#idea-count").textContent = S.ideas.length + " of 25–40 ideas";
  }
  function renumberThumbs() {
    S.ideas.forEach(function (idea, i) {
      if (idea.blob) idea.name = String(i + 1).padStart(2, "0") + "-" + slugify(idea.title || "idea") + ".webp";
    });
  }
  function applyBulk() {
    var text = $("#bulk-text").value;
    text.split(/\n+/).forEach(function (line) {
      var m = line.match(/^\s*\d+[.)]\s*(.+?)\s*\|\s*(.+)\s*$/);
      if (m) addIdea({ title: m[1].trim(), desc: m[2].trim(), alt: "", blob: null, url: "", size: 0, name: "" });
    });
    renderIdeas(); updateAll();
  }

  /* ===== IMAGE PROCESSING (Canvas) ===== */
  function processImage(idea, file, thumbBox) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var targetRatio = 2 / 3, srcRatio = w / h, sw, sh, sx, sy;
        if (srcRatio > targetRatio) { sh = h; sw = h * targetRatio; sx = (w - sw) / 2; sy = 0; }
        else { sw = w; sh = w / targetRatio; sx = 0; sy = (h - sh) / 2; }
        var canvas = document.createElement("canvas");
        canvas.width = 1000; canvas.height = 1500;
        canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, 1000, 1500);
        var qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
        var qi = 0;
        (function tryQ() {
          canvas.toBlob(function (blob) {
            if (!blob) { alert("Image could not be processed."); return; }
            if (blob.size > 100000 && qi < qualities.length - 1) { qi++; tryQ(); return; }
            idea.blob = blob; idea.size = blob.size;
            idea.url = URL.createObjectURL(blob);
            renumberThumbs();
            thumbBox.innerHTML = '<div class="thumb"><img src="' + idea.url + '" alt=""><p>' + esc(idea.name) + " — " + (idea.size / 1024).toFixed(0) + " KB " + (idea.size <= 100000 ? "✓" : "✗ too big") + "</p></div>";
            updateAll();
          }, "image/webp", qualities[qi]);
        })();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ===== TAKEAWAYS & FAQS ===== */
  function renderTakeaways() {
    var box = $("#takeaways"); box.innerHTML = "";
    S.takeaways.forEach(function (t, i) {
      var row = document.createElement("div");
      row.innerHTML = '<label>Takeaway ' + (i + 1) + ' <input type="text" value="' + esc(t) + '"></label>';
      row.querySelector("input").addEventListener("input", function (e) { S.takeaways[i] = e.target.value; updateAll(); });
      box.appendChild(row);
    });
    $("#takeaway-count").textContent = S.takeaways.filter(Boolean).length + " of 3–5 takeaways";
  }
  function renderFaqs() {
    var box = $("#faqs"); box.innerHTML = "";
    S.faqs.forEach(function (f, i) {
      var card = document.createElement("div");
      card.className = "idea-card";
      card.innerHTML = "<h3>FAQ " + (i + 1) + "</h3>" +
        '<label>Question <input type="text" data-f="q" value="' + esc(f.q) + '"></label>' +
        '<label>Answer (40–80 words) <textarea data-f="a">' + esc(f.a) + "</textarea></label>" +
        '<p class="counter">' + words(f.a) + ' words</p>' +
        '<button type="button" class="secondary" data-act="del">Remove</button>';
      $$("[data-f]", card).forEach(function (inp) {
        inp.addEventListener("input", function () { f[inp.getAttribute("data-f")] = inp.value; updateAll(); });
      });
      card.querySelector("[data-act=del]").addEventListener("click", function () {
        S.faqs.splice(i, 1); renderFaqs(); updateAll();
      });
      box.appendChild(card);
    });
    $("#faq-count").textContent = S.faqs.length + " of 7–8 FAQs";
  }
  function renderRelated() {
    var box = $("#related"); if (!box) return;
    var same = (ARTICLES.articles || []).filter(function (a) { return a.category === S.category && a.slug !== S.slug; });
    box.innerHTML = same.length
      ? same.slice(0, 6).map(function (a) {
          return '<label><input type="checkbox" value="' + esc(a.slug) + '"' + (S.related.indexOf(a.slug) >= 0 ? " checked" : "") + "> " + esc(a.title) + "</label>";
        }).join("")
      : "<p class='note'>No published articles in this category yet — related links will be suggested once articles exist.</p>";
    $$("input[type=checkbox]", box).forEach(function (c) {
      c.addEventListener("change", function () {
        S.related = $$("input[type=checkbox]:checked", box).map(function (x) { return x.value; });
        updateAll();
      });
    });
  }

  /* ===== PRE-FLIGHT ===== */
  function checks() {
    var slugUnique = !(ARTICLES.articles || []).some(function (a) { return a.slug === S.slug; });
    var html = "";
    try { html = buildArticleHTML(); } catch (e) { html = ""; }
    var ldOk = false;
    try {
      var m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
      ldOk = m.length >= 2 && m.every(function (s) { JSON.parse(s.replace(/<script[^>]*>/, "").replace(/<\/script>/, "")); return true; });
    } catch (e) { ldOk = false; }
    var h1s = (html.match(/<h1/g) || []).length;
    return [
      ["Title ≤ 60 characters (" + S.title.length + ")", S.title.length > 0 && S.title.length <= 60],
      ["Description ≤ 155 characters (" + S.meta.length + ")", S.meta.length > 0 && S.meta.length <= 155],
      ["25–40 ideas (" + S.ideas.length + ")", S.ideas.length >= 25 && S.ideas.length <= 40],
      ["Every idea has an image ≤100KB with alt text", S.ideas.length > 0 && S.ideas.every(function (i) { return i.blob && i.size <= 100000 && i.alt.trim().length > 0; })],
      ["7–8 FAQs (" + S.faqs.length + ")", S.faqs.length >= 7 && S.faqs.length <= 8],
      ["3–5 takeaways (" + S.takeaways.filter(Boolean).length + ")", S.takeaways.filter(Boolean).length >= 3 && S.takeaways.filter(Boolean).length <= 5],
      ["Slug unique against articles.json", S.slug.length > 0 && slugUnique],
      ["JSON-LD blocks parse", ldOk],
      ["Exactly one H1 (" + h1s + ")", h1s === 1],
      ["Intro written (60–120 words, currently " + words(S.intro) + ")", words(S.intro) >= 40]
    ];
  }
  function updateAll() {
    var t = $("#f-title"), m = $("#f-meta");
    $("#c-title").textContent = t.value.length + "/60";
    $("#c-title").classList.toggle("over", t.value.length > 60);
    $("#c-meta").textContent = m.value.length + "/155";
    $("#c-meta").classList.toggle("over", m.value.length > 155);
    $("#idea-count").textContent = S.ideas.length + " of 25–40 ideas";
    var list = checks();
    var box = $("#checklist"); box.innerHTML = "";
    var allOk = true;
    list.forEach(function (c) {
      var li = document.createElement("li");
      li.textContent = c[0]; li.className = c[1] ? "ok" : "";
      if (!c[1]) allOk = false;
      box.appendChild(li);
    });
    ["btn-export-html", "btn-export-zip", "btn-export-json", "btn-export-sitemap"].forEach(function (id) {
      var b = document.getElementById(id); if (b) b.disabled = !allOk;
    });
    $("#export-note").textContent = allOk
      ? "All checks green — exports are enabled."
      : "Exports unlock when every check above is green.";
  }

  /* ===== ARTICLE HTML BUILDER ===== */
  function catName(slug) {
    var c = CATEGORIES.filter(function (x) { return x[0] === slug; })[0];
    return c ? c[1] : slug;
  }
  function pinUrl(page, media, desc) {
    return "https://www.pinterest.com/pin/create/button/?url=" + encodeURIComponent(page) +
      "&media=" + encodeURIComponent(media) + "&description=" + encodeURIComponent(desc);
  }
  function buildArticleHTML() {
    var pageUrl = SITE_URL + "/articles/" + S.slug + "/";
    var hero = "/assets/img/" + S.slug + "/01-" + slugify(S.ideas[0] ? S.ideas[0].title : "hero") + ".webp";
    var faqs = S.faqs.filter(function (f) { return f.q.trim() && f.a.trim(); });
    var takeaways = S.takeaways.filter(Boolean);
    var sections = S.ideas.map(function (idea, i) {
      var img = "/assets/img/" + S.slug + "/" + (idea.name || ("0" + (i + 1) + "-idea.webp"));
      var pinDesc = (idea.title + " — " + S.title).slice(0, 190);
      var keep = (i + 1) % 5 === 0
        ? '<aside class="keep-exploring"><div><h3>Keep exploring</h3><p>More ' + esc(catName(S.category).toLowerCase()) + ' ideas are waiting in this category.</p></div><a class="btn btn--ghost" href="/category/' + S.category + '/">See all →</a></aside>' : "";
      return '<section class="idea" id="idea-' + (i + 1) + '">' +
        '<header class="idea__head"><span class="idea__num" aria-hidden="true">' + (i + 1) + "</span><h2>" + esc(idea.title) + "</h2></header>" +
        '<p class="idea__micro">Idea ' + (i + 1) + " of " + S.ideas.length + "</p>" +
        '<figure class="idea__fig"><img src="' + img + '" width="1000" height="1500" alt="' + esc(idea.alt) + '" loading="lazy" decoding="async" data-pin-description="' + esc(pinDesc) + '">' +
        '<a class="pin-btn" href="' + pinUrl(pageUrl, SITE_URL + img, pinDesc) + '" target="_blank" rel="noopener">Save</a></figure>' +
        "<p>" + esc(idea.desc) + "</p></section>" + keep;
    }).join("\n");
    var toc = S.ideas.map(function (idea, i) {
      return '<li><a href="#idea-' + (i + 1) + '">' + (i + 1) + ". " + esc(idea.title) + "</a></li>";
    }).join("");
    var faqHtml = faqs.map(function (f) {
      return "<details><summary>" + esc(f.q) + "</summary><p>" + esc(f.a) + "</p></details>";
    }).join("\n");
    var faqJson = faqs.map(function (f) {
      return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
    });
    var related = S.related.map(function (slug) {
      var a = (ARTICLES.articles || []).filter(function (x) { return x.slug === slug; })[0];
      if (!a) return "";
      return '<article class="card"><a class="card-link" href="/articles/' + a.slug + '/"><span class="card-thumb"><img src="' + a.hero + '" alt="' + esc(a.heroAlt) + '" width="500" height="750" loading="lazy" decoding="async"><span class="card-num">' + a.count + ' Ideas</span></span><span class="card-body"><span class="card-cat">' + esc(catName(a.category)) + "</span><h3>" + esc(a.title) + "</h3></span></a></article>";
    }).join("");
    var ld = {
      "@context": "https://schema.org", "@type": "Article",
      headline: S.title, description: S.meta,
      image: [SITE_URL + hero, SITE_URL + hero, SITE_URL + hero],
      datePublished: S.published + "T09:00:00+05:00", dateModified: S.modified + "T09:00:00+05:00",
      author: { "@type": "Organization", name: "TerraVellia Editors", url: SITE_URL },
      publisher: { "@type": "Organization", name: "TerraVellia", url: SITE_URL, logo: { "@type": "ImageObject", url: SITE_URL + "/assets/img/logo.svg" } },
      mainEntityOfPage: pageUrl, articleSection: catName(S.category), inLanguage: "en"
    };
    var breadcrumb = {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
        { "@type": "ListItem", position: 2, name: catName(S.category), item: SITE_URL + "/category/" + S.category + "/" },
        { "@type": "ListItem", position: 3, name: S.title, item: pageUrl }
      ]
    };
    var faqPage = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqJson };
    var itemList = {
      "@context": "https://schema.org", "@type": "ItemList",
      itemListElement: S.ideas.map(function (idea, i) {
        return { "@type": "ListItem", position: i + 1, name: idea.title, url: pageUrl + "#idea-" + (i + 1) };
      })
    };
    return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n" +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      "<title>" + esc(S.title) + "</title>\n" +
      '<meta name="description" content="' + esc(S.meta) + '">\n' +
      '<meta name="robots" content="index, follow, max-image-preview:large">\n' +
      '<meta name="theme-color" content="#1f3a2b">\n' +
      '<meta name="pinterest-rich-pin" content="true">\n' +
      '<link rel="canonical" href="' + pageUrl + '">\n' +
      '<meta property="og:type" content="article">\n<meta property="og:title" content="' + esc(S.title) + '">\n' +
      '<meta property="og:description" content="' + esc(S.meta) + '">\n' +
      '<meta property="og:url" content="' + pageUrl + '">\n<meta property="og:site_name" content="TerraVellia">\n' +
      '<meta property="og:image" content="' + SITE_URL + hero + '">\n<meta property="og:image:width" content="1000">\n<meta property="og:image:height" content="1500">\n' +
      '<meta property="og:image:alt" content="' + esc(S.heroAlt || (S.ideas[0] ? S.ideas[0].alt : S.title)) + '">\n' +
      '<meta property="article:published_time" content="' + S.published + 'T09:00:00+05:00">\n' +
      '<meta property="article:modified_time" content="' + S.modified + 'T09:00:00+05:00">\n' +
      '<meta property="article:section" content="' + esc(catName(S.category)) + '">\n' +
      '<meta name="twitter:card" content="summary_large_image">\n' +
      '<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">\n' +
      '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">\n' +
      '<link rel="preload" as="image" href="' + hero + '" imagesrcset="' + hero + ' 1000w" fetchpriority="high">\n' +
      '<link rel="stylesheet" href="/assets/css/base.css">\n<link rel="stylesheet" href="/assets/css/components.css">\n<link rel="stylesheet" href="/assets/css/article.css">\n' +
      '<script type="application/ld+json">' + JSON.stringify(ld) + "</script>\n" +
      '<script type="application/ld+json">' + JSON.stringify(breadcrumb) + "</script>\n" +
      '<script type="application/ld+json">' + JSON.stringify(faqPage) + "</script>\n" +
      '<script type="application/ld+json">' + JSON.stringify(itemList) + "</script>\n</head>\n<body>\n" +
      '<div class="progress" data-progress></div>\n<a class="skip-link" href="#main">Skip to content</a>\n' +
      '<header class="site-header"><div class="header-inner">' +
      '<a class="logo" href="/"><svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#2f6b47"/><ellipse cx="16" cy="16" rx="7" ry="10" fill="#fbf8f2"/><path d="M16 7v18" stroke="#2f6b47" stroke-width="1.6"/></svg>TerraVellia</a>' +
      '<input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Toggle navigation"><label for="nav-toggle" class="nav-toggle-btn">☰ Menu</label>' +
      '<nav class="main-nav" aria-label="Categories"><ul>' +
      CATEGORIES.map(function (c) { return '<li><a href="/category/' + c[0] + '/">' + c[1] + "</a></li>"; }).join("") +
      "</ul></nav></div></header>\n<main id=\"main\">\n" +
      '<nav class="breadcrumb wrap" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/category/' + S.category + '/">' + esc(catName(S.category)) + "</a> › " + esc(S.title) + "</nav>\n" +
      '<div class="article-layout"><article class="article"><h1>' + esc(S.title) + "</h1>\n" +
      '<p class="meta-line"><a class="chip" href="/category/' + S.category + '/">' + esc(catName(S.category)) + "</a><span>Updated " + esc(S.modified) + '</span><span>By TerraVellia Editors</span></p>\n' +
      '<p class="article-intro">' + esc(S.intro) + "</p>\n" +
      '<figure class="hero-img article-hero"><img src="' + hero + '" width="1000" height="1500" alt="' + esc(S.heroAlt || (S.ideas[0] ? S.ideas[0].alt : S.title)) + '" loading="eager" fetchpriority="high" data-pin-description="' + esc(S.meta) + '">' +
      '<a class="pin-btn" href="' + pinUrl(pageUrl, SITE_URL + hero, S.meta) + '" target="_blank" rel="noopener">Save</a></figure>\n' +
      '<details class="toc" open><summary>Jump to an idea</summary><ol>' + toc + "</ol></details>\n" +
      sections +
      '<section class="takeaway"><h2>Key Takeaways</h2><ul>' + takeaways.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>\n" +
      '<section class="faq"><h2>Frequently Asked Questions</h2>' + faqHtml + "</section>\n" +
      (related ? '<section><h2>You might also love</h2><div class="related-grid">' + related + '</div></section>' : "") +
      '<p style="text-align:center"><a class="btn" href="/category/' + S.category + '/">Browse all ' + esc(catName(S.category)) + "</a></p>\n" +
      "</article></div>\n</main>\n" +
      '<div class="share-bar" data-share-bar><a class="btn btn--clay" href="' + pinUrl(pageUrl, SITE_URL + hero, S.meta) + '" target="_blank" rel="noopener">Save to Pinterest</a><button class="btn btn--ghost" type="button" data-share>Share</button></div>\n' +
      '<footer class="site-footer"><div class="wrap"><div class="footer-grid"><div><h2>TerraVellia</h2><p>Garden ideas worth pinning — practical, beautiful ideas for home gardeners.</p></div>' +
      '<div><h3>Explore</h3><ul>' + CATEGORIES.map(function (c) { return '<li><a href="/category/' + c[0] + '/">' + c[1] + "</a></li>"; }).join("") + "</ul></div>" +
      '<div><h3>More</h3><ul><li><a href="/about/">About</a></li><li><a href="/contact/">Contact</a></li><li><a href="/privacy-policy/">Privacy Policy</a></li><li><a href="/terms/">Terms</a></li><li><a href="https://www.pinterest.com/baseerunnisa345/">Pinterest</a></li></ul></div></div>' +
      '<p class="footer-note">© <span data-year></span> TerraVellia · Images on this site are used with permission or created by TerraVellia.</p></div></footer>\n' +
      '<script src="/assets/js/site.js" defer></script>\n<script src="/assets/js/article.js" defer></script>\n<script src="/assets/js/analytics.js" defer></script>\n' +
      "</body>\n</html>\n";
  }

  /* ===== ZIP (store writer, no compression) ===== */
  function crc32(buf) {
    var table = crc32.t || (crc32.t = (function () {
      var t = [], c, n, k;
      for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
      return t;
    })());
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zipStore(files) {
    // files: [{name, data: Uint8Array}]
    var parts = [], central = [], offset = 0;
    function u16(n) { return new Uint8Array([n & 255, (n >> 8) & 255]); }
    function u32(n) { return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]); }
    function str(s) { return new TextEncoder().encode(s); }
    files.forEach(function (f) {
      var name = str(f.name), crc = crc32(f.data);
      var local = new Uint8Array(30 + name.length + f.data.length);
      var dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0, true);
      dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, f.data.length, true); dv.setUint32(22, f.data.length, true);
      dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
      local.set(name, 30); local.set(f.data, 30 + name.length);
      parts.push(local);
      var c = new Uint8Array(46 + name.length);
      var cd = new DataView(c.buffer);
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
      cd.setUint16(8, 0, true); cd.setUint16(10, 0, true); cd.setUint16(12, 0, true); cd.setUint16(14, 0, true);
      cd.setUint32(16, crc, true); cd.setUint32(20, f.data.length, true); cd.setUint32(24, f.data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      c.set(name, 46);
      central.push(c);
      offset += local.length;
    });
    var cdSize = central.reduce(function (a, c) { return a + c.length; }, 0);
    var end = new Uint8Array(22);
    var ed = new DataView(end.buffer);
    ed.setUint32(0, 0x06054b50, true); ed.setUint16(8, files.length, true); ed.setUint16(10, files.length, true);
    ed.setUint32(12, cdSize, true); ed.setUint32(16, offset, true);
    var all = parts.concat(central, [end]);
    var total = all.reduce(function (a, p) { return a + p.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return new Blob([out], { type: "application/zip" });
  }
  function exportZip() {
    var files = [];
    var html = buildArticleHTML();
    files.push({ name: "articles/" + S.slug + "/index.html", data: new TextEncoder().encode(html) });
    var pending = S.ideas.filter(function (i) { return i.blob; }).map(function (idea, idx) {
      return idea.blob.arrayBuffer().then(function (buf) {
        files.push({ name: "assets/img/" + S.slug + "/" + (idea.name || ("0" + (idx + 1) + "-idea.webp")), data: new Uint8Array(buf) });
      });
    });
    Promise.all(pending).then(function () {
      download(S.slug + "-article.zip", zipStore(files));
    });
  }

  /* ===== ARTICLES.JSON / SITEMAP / LISTINGS ===== */
  function updatedArticlesJSON() {
    var entry = {
      slug: S.slug, title: S.title, metaDescription: S.meta, category: S.category,
      count: S.ideas.length,
      hero: "/assets/img/" + S.slug + "/" + (S.ideas[0] && S.ideas[0].name ? S.ideas[0].name : "01-hero.webp"),
      heroAlt: S.heroAlt || (S.ideas[0] ? S.ideas[0].alt : S.title),
      published: S.published, modified: S.modified, featured: false
    };
    var arts = (ARTICLES.articles || []).filter(function (a) { return a.slug !== S.slug; });
    arts.push(entry);
    arts.sort(function (a, b) { return b.published.localeCompare(a.published); });
    return { site: { name: "TerraVellia", url: SITE_URL }, categories: ARTICLES.categories || [], articles: arts };
  }
  function buildSitemap(data) {
    var urls = [
      { loc: SITE_URL + "/", lastmod: today() },
      { loc: SITE_URL + "/about/", lastmod: today() },
      { loc: SITE_URL + "/contact/", lastmod: today() },
      { loc: SITE_URL + "/privacy-policy/", lastmod: today() },
      { loc: SITE_URL + "/terms/", lastmod: today() }
    ];
    (data.categories || []).forEach(function (c) { urls.push({ loc: SITE_URL + "/category/" + c.slug + "/", lastmod: today() }); });
    (data.articles || []).forEach(function (a) {
      urls.push({ loc: SITE_URL + "/articles/" + a.slug + "/", lastmod: a.modified || a.published, image: SITE_URL + a.hero, imageTitle: a.title });
    });
    var body = urls.map(function (u) {
      var img = u.image ? '    <image:image><image:loc>' + u.image + "</image:loc><image:title>" + esc(u.imageTitle || "") + "</image:title></image:image>\n" : "";
      return "  <url>\n    <loc>" + u.loc + "</loc>\n    <lastmod>" + u.lastmod + "</lastmod>\n" + img + "  </url>";
    }).join("\n");
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + body + "\n</urlset>\n";
  }
  function listingSnippet() {
    var a = (updatedArticlesJSON().articles || []).filter(function (x) { return x.slug === S.slug; })[0];
    if (!a) return "";
    return '<!-- LISTING:START -->\n<article class="card"><a class="card-link" href="/articles/' + a.slug + '/">' +
      '<span class="card-thumb"><img src="' + a.hero + '" alt="' + esc(a.heroAlt) + '" width="500" height="750" loading="lazy" decoding="async">' +
      '<span class="card-num">' + a.count + ' Ideas</span></span>' +
      '<span class="card-body"><span class="card-cat">' + esc(catName(a.category)) + "</span><h3>" + esc(a.title) + "</h3></span></a></article>\n<!-- LISTING:END -->";
  }

  /* ===== PREVIEW & DRAFTS ===== */
  function renderPreview() {
    var frame = $("#preview-frame");
    frame.srcdoc = buildArticleHTML();
  }
  function serialize() {
    return {
      title: S.title, slug: S.slug, meta: S.meta, category: S.category,
      published: S.published, modified: S.modified, keyword: S.keyword,
      intro: S.intro, heroAlt: S.heroAlt,
      ideas: S.ideas.map(function (i) { return { title: i.title, desc: i.desc, alt: i.alt }; }),
      takeaways: S.takeaways, faqs: S.faqs, related: S.related
    };
  }
  function applyState(d) {
    Object.keys(d).forEach(function (k) {
      if (k === "ideas") { S.ideas = d.ideas.map(function (i) { return Object.assign({ blob: null, url: "", size: 0, name: "" }, i); }); }
      else if (k in S) S[k] = d[k];
    });
    ["f-title", "f-slug", "f-meta", "f-category", "f-published", "f-modified", "f-keyword", "f-intro", "f-heroalt"].forEach(function (id) {
      var map = { "f-title": "title", "f-slug": "slug", "f-meta": "meta", "f-category": "category", "f-published": "published", "f-modified": "modified", "f-keyword": "keyword", "f-intro": "intro", "f-heroalt": "heroAlt" };
      var el = document.getElementById(id); if (el) el.value = S[map[id]] || "";
    });
    renderIdeas(); renderTakeaways(); renderFaqs(); renderRelated(); updateAll();
  }
  function saveDraft() {
    try { localStorage.setItem(draftKey, JSON.stringify(serialize())); $("#draft-note").textContent = "Draft saved at " + new Date().toLocaleTimeString() + "."; }
    catch (e) { $("#draft-note").textContent = "Draft could not be saved (browser storage unavailable)."; }
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(draftKey);
      if (raw) applyState(JSON.parse(raw));
    } catch (e) {}
  }
  // Expose a couple of helpers for debugging from the console
  window.TERRAVELLIA_ADMIN = { state: S, buildArticleHTML: buildArticleHTML, checks: checks };
})();
