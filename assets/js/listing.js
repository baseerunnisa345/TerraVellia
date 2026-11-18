/* TerraVellia — listing.js: renders article cards from /data/articles.json.
   Public listings are also hard-coded in the HTML between LISTING markers,
   so pages are crawlable and complete with JavaScript disabled. This script
   only fills containers that are empty and powers "Load more". */
(function () {
  "use strict";
  function card(a) {
    var el = document.createElement("article");
    el.className = "card";
    el.innerHTML =
      '<a class="card-link" href="/articles/' + a.slug + '/">' +
      '<span class="card-thumb"><img src="' + a.hero + '" alt="' + esc(a.heroAlt) +
      '" width="500" height="750" loading="lazy" decoding="async">' +
      '<span class="card-num">' + a.count + " Ideas</span></span>" +
      '<span class="card-body"><span class="card-cat">' + esc(a.categoryName || a.category) +
      "</span><h3>" + esc(a.title) + "</h3></span></a>";
    return el;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function render(list, grid) {
    if (!grid) return;
    // A hard-coded empty state sits next to the grid for no-JS/crawlability;
    // remove it once real cards exist.
    var empty = document.querySelector('[data-empty-for="' + grid.id + '"]');
    if (list.length && empty) empty.remove();
    if (!list.length) return; // keep the hard-coded empty state visible
    grid.innerHTML = "";
    list.forEach(function (a) { grid.appendChild(card(a)); });
  }
  document.addEventListener("DOMContentLoaded", function () {
    var grids = document.querySelectorAll("[data-listing]");
    if (!grids.length) return;
    fetch("/data/articles.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var cats = {};
        (data.categories || []).forEach(function (c) { cats[c.slug] = c.name; });
        var arts = (data.articles || []).map(function (a) {
          a.categoryName = cats[a.category] || a.category;
          return a;
        });
        grids.forEach(function (grid) {
          var cat = grid.getAttribute("data-listing-category");
          var list = cat ? arts.filter(function (a) { return a.category === cat; }) : arts.slice();
          var limit = parseInt(grid.getAttribute("data-listing-limit") || "0", 10);
          if (limit > 0) list = list.slice(0, limit);
          // Only fill grids that have no hard-coded cards yet
          if (grid.children.length === 0) {
            render(list, grid);
          }
        });
        // Load-more: reveal any further cards rendered from JSON (category pages)
        document.querySelectorAll("[data-load-more]").forEach(function (btn) {
          var grid = document.querySelector(btn.getAttribute("data-load-more"));
          if (!grid) return;
          btn.addEventListener("click", function () {
            var cat = grid.getAttribute("data-listing-category");
            var list = cat ? arts.filter(function (a) { return a.category === cat; }) : arts.slice();
            var shown = grid.querySelectorAll(".card").length;
            list.slice(shown, shown + 12).forEach(function (a) { grid.appendChild(card(a)); });
            if (grid.querySelectorAll(".card").length >= list.length) btn.remove();
          });
        });
      })
      .catch(function () { /* listings stay as hard-coded HTML */ });
  });
})();
