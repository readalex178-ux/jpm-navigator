import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { getDueFollowUps } from "@/lib/followups";
import { toast } from "sonner";

const STORAGE_KEY = "btf:fu-notif-last-fired";

/**
 * On app load (after auth + hydrate), if there are due follow-ups, fire ONE
 * OS-level notification. Asks for permission the first time. No automation
 * happens — the notification just deep-links the user back to the dashboard.
 */
export function useFollowUpNotifications() {
  const hydrated = useStore((s) => s.hydrated);
  const prospects = useStore((s) => s.prospects);
  const firedThisSession = useRef(false);

  // Ask permission once, on first prospect-load after hydrate.
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Defer the prompt slightly so it doesn't fire on the very first paint.
      const t = window.setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 1500);
      return () => window.clearTimeout(t);
    }
  }, [hydrated]);

  // Fire once per session if there are due items and we haven't already
  // shown a notification today.
  useEffect(() => {
    if (!hydrated || firedThisSession.current) return;
    if (typeof window === "undefined") return;
    const due = getDueFollowUps(prospects);
    if (due.length === 0) return;

    firedThisSession.current = true;

    // In-app toast — always shown
    toast.message(`${due.length} follow-up${due.length > 1 ? "s" : ""} due`, {
      description: due
        .slice(0, 3)
        .map((d) => d.prospect.name)
        .join(", ") + (due.length > 3 ? "…" : ""),
    });

    // OS notification — only if permitted, and not already fired today
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === today) return;
      window.localStorage.setItem(STORAGE_KEY, today);
    } catch {
      // ignore
    }
    try {
      const n = new Notification(
        `${due.length} follow-up${due.length > 1 ? "s" : ""} due — BTF Setter OS`,
        {
          body: due
            .slice(0, 5)
            .map((d) => `• ${d.prospect.name} (${d.prospect.stage})`)
            .join("\n"),
          tag: "btf-follow-ups",
        },
      );
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn("[notif] failed to fire", e);
    }
  }, [hydrated, prospects]);
}
