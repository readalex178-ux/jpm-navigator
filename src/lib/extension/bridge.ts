import { BRIDGE_NAMESPACE, type BridgeEvent } from "./types";

type Handler = (e: BridgeEvent) => void;

const wrap = (event: BridgeEvent) => ({ __ns: BRIDGE_NAMESPACE, event });

export function postToExtension(event: BridgeEvent) {
  if (typeof window === "undefined") return;
  window.postMessage(wrap(event), "*");
}

export function listenFromExtension(handler: Handler) {
  if (typeof window === "undefined") return () => {};
  const onMsg = (ev: MessageEvent) => {
    const data = ev.data;
    if (!data || data.__ns !== BRIDGE_NAMESPACE || !data.event) return;
    handler(data.event as BridgeEvent);
  };
  window.addEventListener("message", onMsg);
  return () => window.removeEventListener("message", onMsg);
}

export function generatePairingCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
