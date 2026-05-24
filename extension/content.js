// BTF Setter OS — LinkedIn content script
// Runs on linkedin.com. Watches the DOM for active conversations and the
// open profile, scrapes structured data, sends to background worker.
//
// This is intentionally defensive — LinkedIn changes selectors often.
// All selectors live below; if scraping breaks, patch SELECTORS first.

(() => {
  "use strict";

  if (window.__btfLinkedinContentLoaded) return;
  window.__btfLinkedinContentLoaded = true;

  const SELECTORS = {
    // Messaging
    messagingThread: ".msg-conversations-container__convo-item",
    activeConvoTitle: ".msg-thread__link-to-profile, .msg-entity-lockup__entity-title",
    messageBubble: ".msg-s-event-listitem",
    messageSenderName: ".msg-s-message-group__name",
    messageBody: ".msg-s-event-listitem__body",
    messageTimestamp: ".msg-s-message-list__time-heading, time",
    selfHeader: ".global-nav__me-photo",
    replyBox: ".msg-form__contenteditable",

    // Profile
    profileName: "h1",
    profileHeadline:
      ".text-body-medium.break-words, .pv-text-details__left-panel h2, .pv-text-details__left-panel .text-body-medium",
    profileAbout:
      "#about ~ div .display-flex span[aria-hidden='true'], #about ~ * .display-flex .visually-hidden + span, .pv-shared-text-with-see-more span, [data-generated-suggestion-target]",
    profileLocation: ".text-body-small.inline.t-black--light",
    profileRecentPosts:
      "main article .update-components-text span[dir='ltr'], main article .break-words span[dir='ltr'], .occludable-update div[dir='ltr']",
    profileFeaturedLinks: "a[href*='calendly'], a[href*='cal.com'], a[href*='book'], a[href*='schedule'], #featured a",
  };

  const log = (...a) => console.debug("[BTF]", ...a);
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const uniq = (items) => Array.from(new Set(items.filter(Boolean)));

  const getMyName = () => {
    const meImg = document.querySelector(SELECTORS.selfHeader);
    if (meImg && meImg.alt) return meImg.alt.trim();
    return null;
  };

  const hashId = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  };

  const scrapeOpenThread = () => {
    if (!location.pathname.startsWith("/messaging")) return null;

    const titleEl = document.querySelector(SELECTORS.activeConvoTitle);
    const participantName = titleEl ? titleEl.textContent.trim() : null;
    if (!participantName) return null;

    const bubbles = Array.from(document.querySelectorAll(SELECTORS.messageBubble));
    if (bubbles.length === 0) return null;

    const myName = getMyName();
    let lastSender = "them";
    const messages = [];

    for (const b of bubbles) {
      const nameEl = b.querySelector(SELECTORS.messageSenderName);
      if (nameEl) {
        const name = nameEl.textContent.trim();
        lastSender = myName && name === myName ? "me" : "them";
      }
      const bodyEl = b.querySelector(SELECTORS.messageBody);
      if (!bodyEl) continue;
      const text = bodyEl.textContent.trim();
      if (!text) continue;
      const tsEl = b.querySelector(SELECTORS.messageTimestamp);
      const timestamp = tsEl ? tsEl.textContent.trim() : new Date().toISOString();
      messages.push({
        id: hashId(text + timestamp),
        sender: lastSender,
        text,
        timestamp,
      });
    }

    const profileLinkEl = titleEl && titleEl.closest("a");
    const profileUrl = profileLinkEl ? profileLinkEl.href : location.href;

    return {
      threadId: hashId(profileUrl),
      participantName,
      participantHeadline: undefined,
      participantProfileUrl: profileUrl,
      unread: false,
      lastMessagePreview: messages.length ? messages[messages.length - 1].text.slice(0, 120) : undefined,
      messages,
      scrapedAt: new Date().toISOString(),
    };
  };

  const scrapeOpenProfile = () => {
    if (!location.pathname.startsWith("/in/")) return null;
    const nameEl = document.querySelector(SELECTORS.profileName);
    if (!nameEl) return null;
    const name = clean(nameEl.textContent);
    const headlineEl = document.querySelector(SELECTORS.profileHeadline);
    const aboutEl = document.querySelector(SELECTORS.profileAbout);
    const locEl = document.querySelector(SELECTORS.profileLocation);
    const featuredLinks = uniq(
      Array.from(document.querySelectorAll(SELECTORS.profileFeaturedLinks)).map((el) => {
        const href = el.getAttribute("href") || "";
        const text = clean(el.textContent);
        if (!href && !text) return "";
        return [text, href].filter(Boolean).join(" — ");
      }),
    );
    const recentPosts = uniq(
      Array.from(document.querySelectorAll(SELECTORS.profileRecentPosts))
        .map((el) => clean(el.textContent))
        .filter((text) => text.length >= 24)
        .slice(0, 6),
    );
    const recentActivity = uniq([
      ...featuredLinks.map((item) => `Featured: ${item}`),
      ...recentPosts.map((item) => `Post: ${item}`),
    ]).slice(0, 8);

    return {
      profileUrl: location.origin + location.pathname,
      name,
      headline: headlineEl ? clean(headlineEl.textContent) : undefined,
      about: aboutEl ? clean(aboutEl.textContent) : undefined,
      currentRole: headlineEl ? clean(headlineEl.textContent) : undefined,
      location: locEl ? clean(locEl.textContent) : undefined,
      recentActivity,
      scrapedAt: new Date().toISOString(),
    };
  };

  const clipText = (value, max = 2800) => {
    const cleaned = clean(value);
    return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
  };

  const clipList = (items, maxItems = 6, maxChars = 320) =>
    uniq(items.map((item) => clipText(item, maxChars))).slice(0, maxItems);

  const buildProfilePayload = (profile) => {
    const recentActivity = clipList(profile.recentActivity || [], 8, 320);
    return {
      ...profile,
      headline: clipText(profile.headline || "", 280),
      about: clipText(profile.about || "", 2400),
      currentRole: clipText(profile.currentRole || "", 280),
      location: clipText(profile.location || "", 180),
      recentActivity,
      profileText: [
        profile.name,
        profile.headline,
        profile.currentRole,
        profile.location,
        profile.about,
        ...recentActivity,
      ]
        .filter(Boolean)
        .map((item) => clipText(item, 2400))
        .join("\n")
        .slice(0, 12000),
    };
  };

  let lastSent = "";
  const tick = () => {
    try {
      const thread = scrapeOpenThread();
      if (thread && thread.messages.length) {
        const sig = thread.threadId + ":" + thread.messages.length + ":" + (thread.messages.at(-1)?.id ?? "");
        if (sig !== lastSent) {
          lastSent = sig;
          chrome.runtime.sendMessage({ kind: "scraped:thread", thread });
          log("sent thread", thread.participantName, thread.messages.length);
        }
        return;
      }
      const profile = scrapeOpenProfile();
      if (profile) {
        const payload = buildProfilePayload(profile);
        const sig = [
          "p",
          payload.profileUrl,
          payload.name,
          payload.headline || "",
          payload.about || "",
          (payload.recentActivity || []).join("|"),
        ].join(":");
        if (sig !== lastSent) {
          lastSent = sig;
          chrome.runtime.sendMessage({ kind: "scraped:profile", profile: payload });
          log("sent profile", payload.name);
        }
      }
    } catch (e) {
      console.warn("[BTF] scrape error", e);
    }
  };

  // Insert text into active reply box on demand
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && (msg.kind === "inspect:page" || msg.kind === "inspect:page-force")) {
      const force = msg.kind === "inspect:page-force";
      const profile = scrapeOpenProfile();
      const thread = scrapeOpenThread();
      if (profile) {
        return Promise.resolve({
          pageType: "profile",
          profile: buildProfilePayload(profile),
          url: location.href,
        });
      }
      if (thread) {
        return Promise.resolve({ pageType: "messaging", thread, url: location.href });
      }
      // Forced fallback: on a /in/ URL but selectors failed — return a minimal
      // profile from <h1> / <title> / URL so the user can still push it.
      if (force && location.pathname.startsWith("/in/")) {
        const h1 = document.querySelector("h1");
        const rawName = clean(h1?.textContent || document.title.split("|")[0] || "LinkedIn profile");
        const headlineGuess = clean(
          document.title.replace(rawName, "").replace(/\|/g, "").replace(/LinkedIn/gi, "").trim(),
        );
        const fallback = buildProfilePayload({
          profileUrl: location.origin + location.pathname,
          name: rawName,
          headline: headlineGuess || undefined,
          currentRole: headlineGuess || undefined,
          recentActivity: [],
          scrapedAt: new Date().toISOString(),
        });
        return Promise.resolve({
          pageType: "profile",
          profile: fallback,
          url: location.href,
          fallback: true,
        });
      }
      return Promise.resolve({ pageType: "unsupported", url: location.href });
    }

    if (msg && msg.kind === "insert:reply") {
      const box = document.querySelector(SELECTORS.replyBox);
      if (box) {
        box.focus();
        const p = document.createElement("p");
        p.textContent = msg.text;
        box.innerHTML = "";
        box.appendChild(p);
        box.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    }
  });

  const obs = new MutationObserver(() => {
    clearTimeout(window.__btfTimer);
    window.__btfTimer = setTimeout(tick, 600);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  setInterval(tick, 4000);
  tick();
})();
