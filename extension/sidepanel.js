const codeEl = document.getElementById("code");
const saveBtn = document.getElementById("save");
const syncBtn = document.getElementById("sync");
const appBadgeEl = document.getElementById("app-badge");
const pairStatusEl = document.getElementById("pair-status");
const syncStatusEl = document.getElementById("sync-status");

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function setBadge(label, kind) {
  appBadgeEl.textContent = label;
  appBadgeEl.className = `badge ${kind}`;
}

function setStatus(el, text, kind = "") {
  el.textContent = text;
  el.className = `status${kind ? " " + kind : ""}`;
}

function setBusy(btn, busyLabel, busy) {
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent;
  btn.textContent = busy ? busyLabel : btn.dataset.defaultLabel;
  btn.disabled = busy;
}

async function refreshStatus() {
  const s = (await send({ kind: "get:status" })) || {};
  if (s.code) codeEl.value = s.code;
  if (s.appConnected) {
    setBadge("App connected", "ok");
    pairStatusEl.innerHTML = `Paired with <span class="mono">${s.code || "------"}</span>.`;
  } else if (s.code) {
    setBadge("Waiting for app", "warn");
    pairStatusEl.innerHTML = `Code saved as <span class="mono">${s.code}</span>. Open the app preview in its own tab.`;
  } else {
    setBadge("Not paired", "danger");
    pairStatusEl.textContent = "Enter the code shown inside the app.";
  }
  return s;
}

codeEl.addEventListener("input", () => {
  codeEl.value = codeEl.value.toUpperCase();
});

saveBtn.addEventListener("click", async () => {
  const code = (codeEl.value || "").trim().toUpperCase();
  if (code.length < 6) {
    pairStatusEl.textContent = "Enter the 6-character code from the app.";
    return;
  }
  setBusy(saveBtn, "Pairing…", true);
  try {
    await send({ kind: "save:pairing", code });
    await refreshStatus();
    setTimeout(refreshStatus, 800);
    setTimeout(refreshStatus, 2000);
  } finally {
    setBusy(saveBtn, "Pairing…", false);
  }
});

syncBtn.addEventListener("click", async () => {
  setBusy(syncBtn, "Syncing…", true);
  setStatus(syncStatusEl, "Scraping the active LinkedIn tab…");
  try {
    const resp = await send({ kind: "force:sync-active-profile" });
    if (resp?.ok) {
      const name = resp.profile?.name || "profile";
      const note = resp.fallback ? " (minimal capture — edit details in the app)" : "";
      setStatus(syncStatusEl, `Sent ${name} to the app${note}.`, "ok");
    } else {
      setStatus(syncStatusEl, resp?.error || "Could not sync this profile.", "err");
    }
  } catch (e) {
    setStatus(syncStatusEl, e?.message || "Sync failed.", "err");
  } finally {
    setBusy(syncBtn, "Syncing…", false);
  }
});

refreshStatus().catch(() => {
  setStatus(pairStatusEl, "Could not load extension state.", "err");
});
setInterval(refreshStatus, 4000);
