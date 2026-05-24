// BTF Setter OS — app-side bridge
// This content script runs on the BTF Setter OS app pages. It bridges
// chrome.runtime messages from the background worker to window.postMessage
// (which the React app listens to via src/lib/extension/bridge.ts).

(() => {
  "use strict";
  const NS = "btf-setter-os";
  const VERSION = "1.1.0";

  const ackApp = (pairingCode = "") => {
    chrome.runtime.sendMessage({
      kind: "app:ack",
      pairingCode,
      appUrl: window.location.href,
      version: VERSION,
    });
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
      ackApp(e.pairingCode || "");
    }
  });

  // Announce extension presence on load
  chrome.runtime.sendMessage({ kind: "get:pairing" }, (resp) => {
    const code = (resp && resp.code) || "";
    ackApp(code);
    window.postMessage(
      { __ns: NS, event: { kind: "ext:hello", pairingCode: code, version: VERSION } },
      "*",
    );
  });
})();
