// Client-side PII tag utilities.
// Masking itself is performed by the user-hosted endpoint (which may use a model,
// not just regex). The FRONTEND is responsible for: holding the mapping in memory,
// and UNMASKING (replacing tags with real values) before showing text on screen.

// Matches tags like <PERSON_1>, <EMAIL_2>, <NIK_1>, <PHONE_3>, <ADDRESS_1>, etc.
export const TAG_REGEX = /<([A-Z_]+)_(\d+)>/g;

export function extractTags(text) {
  if (!text) return [];
  const found = new Set();
  const re = new RegExp(TAG_REGEX.source, "g");
  let m;
  while ((m = re.exec(text)) !== null) found.add(m[0]);
  return Array.from(found);
}

// Replace tags with their real values from the mapping (unmask).
export function unmaskText(text, mapping) {
  if (!text || !mapping) return text || "";
  return text.replace(new RegExp(TAG_REGEX.source, "g"), (tag) =>
    Object.prototype.hasOwnProperty.call(mapping, tag) ? mapping[tag] : tag
  );
}

// Replace real values back with their tags (re-censor for safe screen sharing).
export function remaskText(text, mapping) {
  if (!text || !mapping) return text || "";
  let out = text;
  // Replace longer values first to avoid partial overlaps.
  const pairs = Object.entries(mapping).sort(
    (a, b) => String(b[1]).length - String(a[1]).length
  );
  for (const [tag, value] of pairs) {
    if (!value) continue;
    const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), tag);
  }
  return out;
}

// Message-list helpers. React state holds messages UNMASKED (display, copy and
// regenerate all read it), so masking happens at the boundary — anything
// leaving the browser goes through remaskMessages, anything arriving from the
// server goes through unmaskMessages. Both the persist path and the analyze
// history path used to inline this separately, which is how they drifted apart.
export function remaskMessages(messages, mapping) {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => ({ ...m, content: remaskText(m.content || "", mapping) }));
}

export function unmaskMessages(messages, mapping) {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => ({
    ...m,
    content: unmaskText(m.content || "", mapping),
    citations: Array.isArray(m.citations)
      ? m.citations.map((c) => ({ ...c, snippet: unmaskText(c.snippet || "", mapping) }))
      : m.citations,
  }));
}

// Same boundary pattern as remaskMessages/unmaskMessages, for the risk
// dashboard and top-level citations — they're now persisted server-side
// too, at the same trust level as message content.
export function remaskRisks(risks, mapping) {
  if (!Array.isArray(risks)) return [];
  return risks.map((r) => ({
    ...r,
    title: remaskText(r.title || "", mapping),
    explanation: remaskText(r.explanation || "", mapping),
    suggestion: remaskText(r.suggestion || "", mapping),
    source_excerpt: remaskText(r.source_excerpt || "", mapping),
  }));
}

export function unmaskRisks(risks, mapping) {
  if (!Array.isArray(risks)) return [];
  return risks.map((r) => ({
    ...r,
    title: unmaskText(r.title || "", mapping),
    explanation: unmaskText(r.explanation || "", mapping),
    suggestion: unmaskText(r.suggestion || "", mapping),
    source_excerpt: unmaskText(r.source_excerpt || "", mapping),
  }));
}

export function remaskCitations(citations, mapping) {
  if (!Array.isArray(citations)) return [];
  return citations.map((c) => ({ ...c, snippet: remaskText(c.snippet || "", mapping) }));
}

export function unmaskCitations(citations, mapping) {
  if (!Array.isArray(citations)) return [];
  return citations.map((c) => ({ ...c, snippet: unmaskText(c.snippet || "", mapping) }));
}

// Human label for a tag type, e.g. "PERSON" -> "Nama".
export function tagTypeLabel(type) {
  const map = {
    PERSON: "Nama",
    NAME: "Nama",
    EMAIL: "Email",
    PHONE: "No. Telepon",
    NIK: "NIK",
    ADDRESS: "Alamat",
    NPWP: "NPWP",
    ACCOUNT: "No. Rekening",
    DATE: "Tanggal",
    ORG: "Organisasi",
    MONEY: "Nominal",
  };
  return map[type] || type;
}

export function tagTypeFromTag(tag) {
  const m = /^<([A-Z_]+)_\d+>$/.exec(tag);
  return m ? m[1] : "UNKNOWN";
}
