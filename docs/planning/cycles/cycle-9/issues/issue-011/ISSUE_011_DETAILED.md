# Evidence links are stored, rendered and fetched without checking they are https URLs

| Field           | Value          |
| --------------- | -------------- |
| ID              | C9-011         |
| Area            | WEBAPP         |
| Difficulty      | Medium         |
| Dependencies    | C6-002, C8-002 |
| Estimated Lines | 150-280        |

## Context

`EvidenceSubmissionForm.tsx` accepts the evidence link when it is non-empty (`evidenceLink.trim().length > 0`). It is then written on-chain as it is.

`EvidenceReviewQueue.tsx` renders the stored value as `href={cycle.evidenceLink}`, and `EvidenceVerification.tsx` passes it to `verifyEvidenceDocument`, which fetches it from the browser. The value comes from contract storage, and the contract accepts any string, so the dashboard should treat it as untrusted input.

## What Needs to Be Done

- Add one helper in `apps/webapp/src/services/pilot/` that accepts only absolute `https:` URLs and returns a parsed result.
- Use it in the submission form and in `RecordEvidenceCosignPanel.tsx`, with a translated validation message, so an invalid link cannot be submitted.
- Use it before rendering the link in the review queue and anywhere else an evidence link becomes an anchor. An invalid stored link is shown as plain text with a short warning.
- Use it before `verifyEvidenceDocument` fetches anything.
- Add the messages to `en.json` and `es.json`.

## Scope

In scope: the helper, the form, the queue, the verification component, tests.

Out of scope: contract-side validation (C9-003 covers length only), hosting or uploading evidence documents.

## Acceptance Criteria

- [ ] `http://`, `javascript:`, `data:`, a relative path and a string with spaces are each rejected by the form.
- [ ] A stored link that is not https is never rendered as an anchor and never fetched.
- [ ] A valid https link behaves as it does today.
- [ ] The helper has unit tests for each case above.

## How to Verify

```bash
cd apps/webapp
bun test
bun run lint && bun run type-check
```

## Files and Locations

| File                                                                | What is there today                               |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/webapp/src/components/pilot/EvidenceSubmissionForm.tsx:133`   | `evidenceLink.trim().length > 0`                  |
| `apps/webapp/src/components/pilot/RecordEvidenceCosignPanel.tsx:71` | Same check                                        |
| `apps/webapp/src/components/pilot/EvidenceReviewQueue.tsx:174`      | `href={cycle.evidenceLink}`                       |
| `apps/webapp/src/components/pilot/EvidenceVerification.tsx:51`      | Calls `verifyEvidenceDocument(evidenceLink, ...)` |
| `apps/webapp/src/services/pilot/evidenceVerify.ts:57`               | `verifyEvidenceDocument`, fetches the link        |

## Implementation Steps

1. Add `apps/webapp/src/services/pilot/evidenceLink.ts` with `parseEvidenceLink`.
2. Use it in the two forms, the queue, the verification component and inside `verifyEvidenceDocument`.
3. Add the messages.

## Code Example

```typescript
export function parseEvidenceLink(value: string): URL | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
```

## Testing Guidance

- Unit tests in `apps/webapp/src/services/pilot/__tests__/`.
- Component test: an invalid stored link renders no anchor, and `fetch` is not called.
