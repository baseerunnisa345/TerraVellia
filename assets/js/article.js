/* TerraVellia — article.js: progress bar, share bar, TOC highlight, pin buttons */
(function () {
  "use strict";
  var bar = document.querySelector("[data-progress]");
  var shareBar = document.querySelector("[data-share-bar]");
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY || 0;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar && max > 0) bar.style.width = Math.min(100, (y / max) * 100) + "%";
    if (shareBar) {
      if (y > 300 && y > lastY + 4) shareBar.classList.add("hidden");
      else if (y < lastY - 4 || y < 300) shareBar.classList.remove("hidden");
    }
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  // TOC highlight
  var tocLinks = document.querySelectorAll(".toc a[href^='#idea-']");
  if ("IntersectionObserver" in window && tocLinks.length) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var link = map[e.target.id];
        if (link) link.style.fontWeight = e.isIntersecting ? "700" : "";
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll("section.idea[id]").forEach(function (s) { obs.observe(s); });
  }
  // Share button: copy page link
  document.querySelectorAll("[data-share]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var url = location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          btn.textContent = "Link copied ✓";
          setTimeout(function () { btn.textContent = "Share"; }, 2000);
        });
      }
    });
  });
})();
