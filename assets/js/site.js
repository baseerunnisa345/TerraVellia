/* TerraVellia — site.js (public pages, < 15KB total with listing/article) */
(function () {
  "use strict";
  // Footer year
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = String(new Date().getFullYear());
  // Close the mobile category drawer when a nav link is tapped
  var toggle = document.getElementById("nav-toggle");
  if (toggle) {
    document.querySelectorAll(".main-nav a").forEach(function (a) {
      a.addEventListener("click", function () { toggle.checked = false; });
    });
  }
})();
