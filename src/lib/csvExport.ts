import type { Prospect } from "./btf/types";

const ESC = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function prospectsToCsv(prospects: Prospect[]): string {
  const headers = [
    "Name",
    "Platform",
    "Profile URL",
    "Niche",
    "Lead Type",
    "Tier",
    "Stage",
    "Qual Score",
    "Need",
    "Timeline",
    "Authority",
    "Budget",
    "VN1 Date",
    "VN1 Reply",
    "VN2 Date",
    "VN2 Reply",
    "Last Touch",
    "Created",
    "Bio",
  ];
  const rows = prospects.map((p) => {
    const vn1 = p.vnLog[p.vnLog.length - 1];
    const vn2 = p.vnLog[p.vnLog.length - 2];
    return [
      p.name,
      p.platform,
      p.profileUrl,
      p.niche,
      p.leadType,
      p.tier,
      p.stage,
      p.qualScore,
      p.bant.need,
      p.bant.timeline,
      p.bant.authority,
      p.bant.budget,
      vn1?.date ?? "",
      vn1?.reply ?? "",
      vn2?.date ?? "",
      vn2?.reply ?? "",
      p.lastTouchAt,
      p.createdAt,
      p.bio,
    ].map(ESC).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
