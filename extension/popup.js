const codeEl = document.getElementById("code");
const saveBtn = document.getElementById("save");
const refreshBtn = document.getElementById("refresh");
const analyzeBtn = document.getElementById("analyze");
const sendBtn = document.getElementById("send");
const pairingStatusEl = document.getElementById("pairing-status");
const appBadgeEl = document.getElementById("app-badge");
const pageStateEl = document.getElementById("page-state");
const profileCardEl = document.getElementById("profile-card");
const profileNameEl = document.getElementById("profile-name");
const profileHeadlineEl = document.getElementById("profile-headline");
const profileSummaryEl = document.getElementById("profile-summary");
const analysisCardEl = document.getElementById("analysis-card");
const fitBadgeEl = document.getElementById("fit-badge");
const verdictBoxEl = document.getElementById("verdict-box");
const signalsEl = document.getElementById("signals");

const SIGNAL_LABELS = {
  featuredOffer: "Featured offer",
  bookingLinkInBio: "Booking link",
  referralsOnly: "Referrals only",
  slowMonth: "Slow month",
  wantsToScale: "Wants to scale",
  noOutboundSystem: "No outbound",
  decisionMakerConfirmed: "Decision maker",
};

let currentContext = null;
let currentAnalysis = null;

function normalize(value) {
  return String(value || "").toLowerCase();
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function runHeuristicAnalysis(profile) {
  const text = normalize(
    [
      profile.name,
      profile.headline,
      profile.currentRole,
      profile.location,
      profile.about,
      ...(profile.recentActivity || []),
    ].join("\n"),
  );

  const buyingSignals = {
    featuredOffer: includesAny(text, ["featured:", "work with", "offer", "program", "service", "help founders", "help coaches"]),
    bookingLinkInBio: includesAny(text, ["calendly", "cal.com", "book a call", "schedule", "booking", "dm me"]),
    referralsOnly: includesAny(text, ["referrals", "word of mouth", "referral only", "referrals only"]),
    slowMonth: includesAny(text, ["slow month", "quiet month", "dry spell", "pipeline is slow", "need leads", "low month"]),
    wantsToScale: includesAny(text, ["scale", "scaling", "grow", "growth", "hire", "ceiling", "want to grow"]),
    noOutboundSystem: !includesAny(text, ["outbound", "sdr", "appointment setter", "paid ads", "media buyer", "cold email", "cold dm"]),
    decisionMakerConfirmed: includesAny(text, ["founder", "co-founder", "owner", "ceo", "director", "agency owner", "solo"]),
  };

  const score = Object.values(buyingSignals).filter(Boolean).length;
  const verdict = score >= 4 && buyingSignals.decisionMakerConfirmed ? "SEND_VN" : score >= 2 ? "MAYBE" : "SKIP";
  const verdictLine =
    verdict === "SEND_VN"
      ? "✅ SEND VN — strong enough fit signals on this profile."
      : verdict === "MAYBE"
        ? "⚠️ MAYBE — some buying signals are present but not enough yet."
        : "❌ SKIP — not enough clear buying signals on this profile.";

  return { verdict, verdictLine, buyingSignals };
}

function setBadge(el, label, kind = "neutral") {
  el.textContent = label;
  el.className = `badge ${kind}`;
}

function setButtonBusy(button, label, busy) {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
  button.textContent = busy ? label : button.dataset.defaultLabel;
  button.disabled = busy;
}

function updatePairingUI(status) {
  if (status.code) codeEl.value = status.code;
  if (status.appConnected) {
    setBadge(appBadgeEl, "App connected", "ok");
    pairingStatusEl.innerHTML = `Paired with <span class="mono">${status.code || "------"}</span>.`;
  } else if (status.code) {
    setBadge(appBadgeEl, "Waiting for app", "warn");
    pairingStatusEl.innerHTML = `Code saved as <span class="mono">${status.code}</span>. Keep the app open on screen.`;
  } else {
    setBadge(appBadgeEl, "Not paired", "danger");
    pairingStatusEl.textContent = "Enter the code shown inside the app.";
  }
}

function clearAnalysis() {
  currentAnalysis = null;
  analysisCardEl.style.display = "none";
  verdictBoxEl.textContent = "";
  verdictBoxEl.className = "verdict";
  signalsEl.innerHTML = "";
  setBadge(fitBadgeEl, "Not analysed", "neutral");
  sendBtn.disabled = true;
}

function renderProfile(profile) {
  profileCardEl.style.display = "block";
  profileNameEl.textContent = profile.name || "Unknown profile";
  profileHeadlineEl.textContent = profile.headline || profile.currentRole || "No headline found";
  profileSummaryEl.textContent = profile.about || "No About section found on this page yet.";
}

function renderInspection(result) {
  currentContext = result?.context || null;
  clearAnalysis();

  if (!result?.ok) {
    profileCardEl.style.display = "none";
    pageStateEl.textContent = result?.error || "Open a LinkedIn profile in the active tab.";
    analyzeBtn.disabled = true;
    return;
  }

  const context = result.context;
  if (context.pageType === "profile" && context.profile) {
    renderProfile(context.profile);
    pageStateEl.textContent = "Profile detected in the active LinkedIn tab.";
    analyzeBtn.disabled = false;
    return;
  }

  profileCardEl.style.display = "none";
  analyzeBtn.disabled = true;
  if (context.pageType === "messaging") {
    pageStateEl.textContent = "You are on LinkedIn messages. Open a profile page to analyse a prospect.";
  } else {
    pageStateEl.textContent = "This LinkedIn page is not a supported profile view yet.";
  }
}

function renderAnalysis(data) {
  currentAnalysis = data;
  analysisCardEl.style.display = "block";
  verdictBoxEl.textContent = data.verdictLine;
  verdictBoxEl.className = "verdict";

  if (data.verdict === "SEND_VN") {
    verdictBoxEl.classList.add("good");
    setBadge(fitBadgeEl, "Good fit", "ok");
  } else if (data.verdict === "MAYBE") {
    verdictBoxEl.classList.add("maybe");
    setBadge(fitBadgeEl, "Maybe", "warn");
  } else {
    verdictBoxEl.classList.add("bad");
    setBadge(fitBadgeEl, "Skip", "danger");
  }

  signalsEl.innerHTML = "";
  Object.entries(SIGNAL_LABELS).forEach(([key, label]) => {
    const chip = document.createElement("span");
    chip.className = `signal${data.buyingSignals?.[key] ? " on" : ""}`;
    chip.textContent = label;
    signalsEl.appendChild(chip);
  });

  sendBtn.disabled = data.verdict !== "SEND_VN";
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function refreshStatus() {
  const status = await sendMessage({ kind: "get:status" });
  updatePairingUI(status || {});
}

function refreshStatusSoon(delay = 400) {
  window.setTimeout(() => {
    refreshStatus().catch(() => {
      pairingStatusEl.textContent = "Could not confirm app status yet. Try Refresh once.";
    });
  }, delay);
}

async function inspectActivePage() {
  setButtonBusy(refreshBtn, "Checking…", true);
  try {
    const result = await sendMessage({ kind: "inspect:active-linkedin-page" });
    renderInspection(result);
  } finally {
    setButtonBusy(refreshBtn, "Checking…", false);
  }
}

saveBtn.addEventListener("click", async () => {
  const code = (codeEl.value || "").trim().toUpperCase();
  if (code.length < 4) {
    pairingStatusEl.textContent = "Enter the 6-character code from the app.";
    return;
  }
  setButtonBusy(saveBtn, "Pairing…", true);
  try {
    const resp = await sendMessage({ kind: "save:pairing", code });
    if (resp?.ok) {
      await refreshStatus();
      refreshStatusSoon();
      refreshStatusSoon(1200);
    }
  } finally {
    setButtonBusy(saveBtn, "Pairing…", false);
  }
});

refreshBtn.addEventListener("click", () => {
  inspectActivePage();
});

analyzeBtn.addEventListener("click", async () => {
  if (!currentContext?.profile) return;
  setButtonBusy(analyzeBtn, "Analysing…", true);
  try {
    const analysis = runHeuristicAnalysis(currentContext.profile);
    renderAnalysis(analysis);
    pageStateEl.textContent = "Analysis ready. Send to app if it is a fit.";
  } finally {
    setButtonBusy(analyzeBtn, "Analysing…", false);
  }
});

sendBtn.addEventListener("click", async () => {
  if (!currentContext?.profile) return;
  setButtonBusy(sendBtn, "Sending…", true);
  try {
    const payload = {
      ...currentContext.profile,
      extensionAnalysis: currentAnalysis || null,
    };
    const resp = await sendMessage({ kind: "send:profile-to-app", profile: payload });
    if (resp?.ok) {
      pageStateEl.textContent = "Profile sent to the app. Open the LinkedIn page there to review and save it.";
    } else {
      pageStateEl.textContent = resp?.error || "Could not send profile to app.";
    }
  } finally {
    setButtonBusy(sendBtn, "Sending…", false);
  }
});

codeEl.addEventListener("input", () => {
  codeEl.value = codeEl.value.toUpperCase();
});

Promise.all([refreshStatus(), inspectActivePage()]).catch(() => {
  pairingStatusEl.textContent = "Could not load extension state.";
});