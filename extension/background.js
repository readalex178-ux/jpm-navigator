// BTF Setter OS — background service worker
// Holds pairing code, forwards scraped data to the BTF app via the in-page
// bridge content script (app-bridge.js) which re-broadcasts as window.postMessage.

const NS = "btf-setter-os";
const VERSION = "1.0.0";

async function getPairingCode() {
  const { pairingCode } = await chrome.storage.local.get("pairingCode");
  return pairingCode || "";
}

async function broadcastToApps(event) {
  const tabs = await chrome.tabs.query({
    url: [
      "https://*.lovable.app/*",
      "https://*.lovableproject.com/*",
      "http://localhost/*",
    ],
  });
  for (const t of tabs) {
    if (t.id) {
      chrome.tabs.sendMessage(t.id, { kind: "to-app", event }).catch(() => {});
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg) return;
    const code = await getPairingCode();

    if (msg.kind === "scraped:thread") {
      await broadcastToApps({ kind: "ext:thread", pairingCode: code, thread: msg.thread });
    } else if (msg.kind === "scraped:profile") {
      await broadcastToApps({ kind: "ext:profile", pairingCode: code, profile: msg.profile });
    } else if (msg.kind === "app:insert") {
      // Find a LinkedIn tab and inject into reply box
      const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/messaging/*" });
      for (const t of tabs) {
        if (t.id) chrome.tabs.sendMessage(t.id, { kind: "insert:reply", text: msg.text }).catch(() => {});
      }
    } else if (msg.kind === "save:pairing") {
      await chrome.storage.local.set({ pairingCode: msg.code });
      await broadcastToApps({ kind: "ext:hello", pairingCode: msg.code, version: VERSION });
      sendResponse({ ok: true });
    } else if (msg.kind === "get:pairing") {
      sendResponse({ code });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});
