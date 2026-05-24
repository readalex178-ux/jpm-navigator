// BTF Setter OS — app-side bridge
// This content script runs on the BTF Setter OS app pages. It bridges
// chrome.runtime messages from the background worker to window.postMessage
// (which the React app listens to via src/lib/extension/bridge.ts).

(() => {
  "use strict";
  if (window.__btfAppBridgeMounted) return;
  window.__btfAppBridgeMounted = true;

  const NS = "btf-setter-os";
  const VERSION = "1.1.3";

  const ackApp = (pairingCode = "") => {
    chrome.runtime.sendMessage({
      kind: "app:ack",
      pairingCode,
      appUrl: window.location.href,
      version: VERSION,
    });
  };

  const announceToPage = (pairingCode = "") => {
    window.postMessage(
      { __ns: NS, event: { kind: "ext:hello", pairingCode, version: VERSION } },
      "*",
    );
  };

  const announce = (pairingCode = "") => {
    if (!pairingCode) return;
    ackApp(pairingCode);
    announceToPage(pairingCode);
  };

  // Background → app
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.kind === "to-app" && msg.event) {
      window.postMessage({ __ns: NS, event: msg.event }, "*");
    }
  });

  // App → background (insert into LinkedIn reply box)
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.__ns !== NS || !d.event) return;
    const e = d.event;
    if (e.kind === "app:insert") {
      chrome.runtime.sendMessage({ kind: "app:insert", text: e.text, threadId: e.threadId });
      return;
    }
    if (e.kind === "app:ack") {
      if (!e.pairingCode) return;
      ackApp(e.pairingCode || "");
    }
  });

  // Announce extension presence on load
  chrome.runtime.sendMessage({ kind: "get:pairing" }, (resp) => {
    const code = (resp && resp.code) || "";
    announce(code);
  });

  // Keepalive: re-announce every 10s so the background doesn't drop the connection.
  setInterval(() => {
    chrome.runtime.sendMessage({ kind: "get:pairing" }, (resp) => {
      const code = (resp && resp.code) || "";
      announce(code);
    });
  }, 10_000);
})();

