/**
 * Evidence link validation.
 *
 * The payout contract accepts any string as `evidence_link`, so both values
 * entered in a form and values read back from contract storage must be treated
 * as untrusted input before they are stored, rendered as an anchor, or fetched
 * from the browser.
 */

export interface ParsedEvidenceLink {
  /** Normalized absolute HTTPS URL ready to store, render as href, or fetch. */
  href: string;
  /** Parsed URL object for inspection when needed. */
  url: URL;
}

/**
 * Parses `value` as an absolute `https:` URL, or returns `null` when invalid.
 *
 * Rejects empty strings, strings containing whitespace, relative paths,
 * non-HTTPS schemes (`http:`, `javascript:`, `data:`, etc.), and URLs without
 * a hostname.
 */
export function parseEvidenceLink(value: string): ParsedEvidenceLink | null {
  if (value.length === 0 || /\s/.test(value)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname.length === 0) {
    return null;
  }

  return { href: url.href, url };
}
