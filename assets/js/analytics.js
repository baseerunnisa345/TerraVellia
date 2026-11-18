/* TerraVellia — analytics.js (deferred slot).
   No analytics loads by default. To enable, set
   window.TERRAVELLIA_ANALYTICS_URL to your privacy-friendly analytics
   script URL (for example a self-hosted Plausible script) in a small
   inline snippet, and this file loads it only after window load + idle. */
(function () {
  "use strict";
  function load() {
    var url = window.TERRAVELLIA_ANALYTICS_URL;
    if (!url) return;
    var s = document.createElement("script");
    s.defer = true;
    s.src = url;
    document.head.appendChild(s);
  }
  if ("requestIdleCallback" in window) {
    window.addEventListener("load", function () { requestIdleCallback(load); });
  } else {
    window.addEventListener("load", function () { setTimeout(load, 1500); });
  }
})();
