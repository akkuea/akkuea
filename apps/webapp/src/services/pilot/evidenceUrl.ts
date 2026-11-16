/**
 * Strict validation for pilot evidence links.
 *
 * Evidence links come from user input on submission and from untrusted contract
 * storage when rendered or verified in the browser. Only absolute `https:` URLs
 * without spaces or embedded credentials are accepted.
 */

export type EvidenceUrlInvalidReason =
  "empty" | "whitespace" | "invalid_url" | "non_https" | "credentials";

export type EvidenceUrlParseResult =
  | { ok: true; url: URL; href: string }
  | { ok: false; reason: EvidenceUrlInvalidReason };

/**
 * Parses an evidence link, accepting only absolute `https:` URLs with a host,
 * no whitespace characters, and no embedded credentials.
 */
export function parseEvidenceUrl(raw: string): EvidenceUrlParseResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (raw.trim().length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (/\s/.test(raw)) {
    return { ok: false, reason: "whitespace" };
  }

  // Reject scheme-relative URLs (`//example.org/...`) and relative paths before
  // URL parsing so error reasons distinguish relative/malformed from non-https
  // schemes cleanly.
  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw)) {
    return { ok: false, reason: "invalid_url" };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "non_https" };
  }

  if (!parsed.hostname) {
    return { ok: false, reason: "invalid_url" };
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, reason: "credentials" };
  }

  return { ok: true, url: parsed, href: raw };
}
