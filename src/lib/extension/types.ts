// Shared types between the Chrome extension and the BTF Setter OS app.
// Both sides import these via the bundled extension build (extension copies
// this file in at build time).

export type ScrapedMessage = {
  id: string;
  sender: "me" | "them";
  text: string;
  timestamp: string; // ISO or LinkedIn-formatted, best effort
};

export type ScrapedThread = {
  threadId: string; // stable hash of profile URL or LI thread id
  participantName: string;
  participantHeadline?: string;
  participantProfileUrl?: string;
  unread: boolean;
  lastMessagePreview?: string;
  messages: ScrapedMessage[];
  scrapedAt: string;
};

export type ScrapedProfile = {
  profileUrl: string;
  name: string;
  headline?: string;
  about?: string;
  currentRole?: string;
  location?: string;
  recentActivity?: string[];
  scrapedAt: string;
};

export type BridgeEvent =
  | { kind: "ext:hello"; pairingCode: string; version: string }
  | { kind: "ext:thread"; pairingCode: string; thread: ScrapedThread }
  | { kind: "ext:profile"; pairingCode: string; profile: ScrapedProfile }
  | { kind: "ext:inbox"; pairingCode: string; threads: ScrapedThread[] }
  | { kind: "app:insert"; pairingCode: string; threadId: string; text: string }
  | { kind: "app:ack"; pairingCode: string };

export const BRIDGE_NAMESPACE = "btf-setter-os";
