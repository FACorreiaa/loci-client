/* Loci push handlers, imported into the generated Workbox service worker
 * (vite.config.ts → workbox.importScripts). Plain script: no bundler runs
 * over this file. */
(function (root) {
  function decide(payload, clients) {
    var visible = (clients || []).find(function (c) {
      return c.visibilityState === "visible";
    });
    // A Loci tab is on screen: let the page's own toast say it rather than
    // a system notification over the page. (Chrome tolerates skipping
    // showNotification occasionally; see the spec's fallback if it warns.)
    return visible ? { kind: "relay", client: visible } : { kind: "show" };
  }

  // Only same-site paths: a payload can never send someone off-site.
  // Rejects protocol-relative ("//evil"), anything not starting with a
  // single "/", and a leading "/\" (browsers normalize a backslash after
  // the origin to a forward slash, so "/\evil" would otherwise behave like
  // "//evil").
  function targetUrl(data) {
    var url = data && typeof data.url === "string" ? data.url : "/";
    if (url.charAt(0) !== "/") return "/";
    if (url.charAt(1) === "/" || url.charAt(1) === "\\") return "/";
    return url;
  }

  var api = { decide: decide, targetUrl: targetUrl };
  root.__lociPush = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof root.addEventListener !== "function" || typeof root.registration === "undefined")
    return;

  root.addEventListener("push", function (event) {
    var payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch (_e) {
      return;
    }
    event.waitUntil(
      root.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
        var d = decide(payload, clients);
        if (d.kind === "relay") {
          d.client.postMessage({ lociPush: payload });
          return;
        }
        return root.registration.showNotification(payload.title || "Loci", {
          body: payload.body || "",
          tag: payload.sessionId || undefined,
          data: { url: targetUrl(payload) },
          icon: "/images/brand/icon-192.png",
        });
      }),
    );
  });

  root.addEventListener("notificationclick", function (event) {
    event.notification.close();
    var url = targetUrl(event.notification.data);
    event.waitUntil(
      root.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
        var tab = clients.find(function (c) {
          return new URL(c.url).origin === root.location.origin;
        });
        if (tab)
          return tab.focus().then(function (c) {
            return c.navigate(url);
          });
        return root.clients.openWindow(url);
      }),
    );
  });
})(typeof self !== "undefined" ? self : globalThis);
