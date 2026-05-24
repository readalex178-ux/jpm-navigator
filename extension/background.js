// BTF Setter OS — background service worker
// Holds pairing state, talks to the active LinkedIn tab, and forwards manual
// profile sends to the BTF app via the app-bridge content script.

const VERSION = "1.1.0";
const APP_ACK_TTL_MS = 60_000;

async function getState() {
  const data = await chrome.storage.local.get([
    "pairingCode",
    "lastAppAckAt",
    "lastAppUrl",
    "lastAckPairingCode",
  ]);
  return {
    pairingCode: data.pairingCode || "",
    lastAppAckAt: typeof data.lastAppAckAt === "number" ? data.lastAppAckAt : 0,
    lastAppUrl: data.lastAppUrl || "",
    lastAckPairingCode: data.lastAckPairingCode || "",
  };
}

async function broadcastToApps(event) {
  const tabs = await chrome.tabs.query({
    url: [
      "https://*.lovable.app/*",
      "https://*.lovableproject.com/*",
      "http://localhost/*",
    ],
  });
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { kind: "to-app", event });
      } catch {
        // Ignore tabs that do not currently have the app bridge attached.
      }
    }),
  );
}

async function getActiveLinkedinTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return null;
  if (!(tab.url || "").startsWith("https://www.linkedin.com/")) return null;
  return tab;
}

async function inspectActiveLinkedinPage() {
  const tab = await getActiveLinkedinTab();
  if (!tab?.id) {
    return { ok: false, error: "Open LinkedIn in the active tab first." };
  }

  try {
    const context = await chrome.tabs.sendMessage(tab.id, { kind: "inspect:page" });
    if (!context) {
      return { ok: false, error: "Could not inspect this page. Refresh LinkedIn once and try again." };
    }
    return { ok: true, context };
  } catch {
    return { ok: false, error: "Could not inspect this page. Refresh LinkedIn once and try again." };
  }
}

function isAppConnected(state) {
  return Boolean(
    state.lastAppAckAt &&
      Date.now() - state.lastAppAckAt <= APP_ACK_TTL_MS &&
      (!state.lastAckPairingCode || state.lastAckPairingCode === state.pairingCode),
  );
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (!msg) return;

    const state = await getState();

    if (msg.kind === "scraped:thread") {
      await broadcastToApps({ kind: "ext:thread", pairingCode: state.pairingCode, thread: msg.thread });
      return;
    }

    if (msg.kind === "scraped:profile") {
      return;
    }

    if (msg.kind === "app:insert") {
      const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/messaging/*" });
      await Promise.all(
        tabs.map(async (tab) => {
          if (!tab.id) return;
          try {
            await chrome.tabs.sendMessage(tab.id, { kind: "insert:reply", text: msg.text });
          } catch {
            // Ignore tabs without a mounted message composer.
          }
        }),
      );
      return;
    }

    if (msg.kind === "save:pairing") {
      const code = (msg.code || "").trim().toUpperCase();
      await chrome.storage.local.set({
        pairingCode: code,
        lastAppAckAt: 0,
        lastAckPairingCode: "",
      });
      await broadcastToApps({ kind: "ext:hello", pairingCode: code, version: VERSION });
      sendResponse({ ok: true, code });
      return;
    }

    if (msg.kind === "get:pairing") {
      sendResponse({ code: state.pairingCode, version: VERSION });
      return;
    }

    if (msg.kind === "get:status") {
      sendResponse({
        code: state.pairingCode,
        version: VERSION,
        appConnected: isAppConnected(state),
        lastAppUrl: state.lastAppUrl,
      });
      return;
    }

    if (msg.kind === "inspect:active-linkedin-page") {
      sendResponse(await inspectActiveLinkedinPage());
      return;
    }

    if (msg.kind === "send:profile-to-app") {
      if (!state.pairingCode) {
        sendResponse({ ok: false, error: "Pair the extension with the app first." });
        return;
      }
      await broadcastToApps({
        kind: "ext:profile",
        pairingCode: state.pairingCode,
        profile: msg.profile,
      });
      sendResponse({ ok: true });
      return;
    }

    if (msg.kind === "app:ack") {
      await chrome.storage.local.set({
        lastAppAckAt: Date.now(),
        lastAppUrl: msg.appUrl || "",
        lastAckPairingCode: msg.pairingCode || "",
      });
      sendResponse({ ok: true });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});
