/* Loci push handlers, imported into the generated Workbox service worker
 * (vite.config.ts → workbox.importScripts). Plain script: no bundler runs
 * over this file. */
(function (root) {
  // Same icon public/manifest.json points at for the 192 size — kept as one
  // constant so the "payload parsed" and "payload didn't parse" notifications
  // can't drift apart.
  var ICON = "/images/brand/icon-192.png";

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

  // Pure so it's testable without a ServiceWorkerGlobalScope: the same-origin
  // window client to focus on notificationclick, or null when none is open.
  // Wrapped in try/catch because a client's url is attacker-controlled input
  // (relayed through the browser, not this code) and URL() throws on garbage.
  function pickTab(clients, origin) {
    return (
      (clients || []).find(function (c) {
        try {
          return new URL(c.url).origin === origin;
        } catch (_e) {
          return false;
        }
      }) || null
    );
  }

  var api = { decide: decide, targetUrl: targetUrl, pickTab: pickTab };
  root.__lociPush = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof root.addEventListener !== "function" || typeof root.registration === "undefined")
    return;

  root.addEventListener("push", function (event) {
    var payload;
    try {
      payload = event.data ? event.data.json() : {};
    } catch (_e) {
      // Bad payload: still show something. A silent push is exactly what
      // userVisibleOnly subscriptions promise never to do, and browsers
      // (Chrome in particular) penalise — and can eventually revoke — a
      // subscription that goes quiet on push.
      event.waitUntil(
        root.registration.showNotification("Loci", {
          body: "Tap to open Loci.",
          data: { url: "/" },
          icon: ICON,
        }),
      );
      return;
    }
    event.waitUntil(
      root.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
        var d = decide(payload, clients);
        if (d.kind === "relay") {
          // Same same-site check as the notification path: a relayed message
          // is still attacker payload until targetUrl has looked at it.
          d.client.postMessage({
            lociPush: Object.assign({}, payload, { url: targetUrl(payload) }),
          });
          return;
        }
        return root.registration.showNotification(payload.title || "Loci", {
          body: payload.body || "",
          tag: payload.sessionId || undefined,
          data: { url: targetUrl(payload) },
          icon: ICON,
        });
      }),
    );
  });

  root.addEventListener("notificationclick", function (event) {
    event.notification.close();
    var url = targetUrl(event.notification.data);
    event.waitUntil(
      root.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
        var tab = pickTab(clients, root.location.origin);
        if (!tab) return root.clients.openWindow(url);
        // focus() can reject (e.g. the tab closed between matchAll and here),
        // and navigate() can reject or resolve null for a client Workbox
        // doesn't control yet — either way, fall back to opening a new
        // window rather than leaving the click with no visible result.
        return tab
          .focus()
          .then(function (c) {
            return c && c.navigate ? c.navigate(url) : null;
          })
          .then(function (r) {
            return r || root.clients.openWindow(url);
          })
          .catch(function () {
            return root.clients.openWindow(url);
          });
      }),
    );
  });
})(typeof self !== "undefined" ? self : globalThis);
