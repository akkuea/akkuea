# Add Form Validation with React Hook Form and Zod

## Description

Implement form validation infrastructure using React Hook Form and Zod. This includes creating reusable form components, validation schemas, and error handling patterns for all forms in the application.

## Requirements

| Requirement | Description |
|-------------|-------------|
| REQ-001 | Install React Hook Form and Zod resolver |
| REQ-002 | Create form wrapper component |
| REQ-003 | Create validated input components |
| REQ-004 | Implement property creation form |
| REQ-005 | Implement lending action forms |
| REQ-006 | Display field-level errors |
| REQ-007 | Handle form submission states |

## Acceptance Criteria

| Criteria | Validation Method |
|----------|-------------------|
| Forms validate on blur and submit | Manual testing |
| Error messages display correctly | Visual verification |
| Form submission is prevented when invalid | Test with invalid data |
| Loading state shown during submission | Visual verification |
| Success/error feedback displayed | Visual verification |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/webapp/src/components/forms/Form.tsx` | Create | Base form component |
| `apps/webapp/src/components/forms/FormInput.tsx` | Create | Validated input |
| `apps/webapp/src/components/forms/FormSelect.tsx` | Create | Validated select |
| `apps/webapp/src/components/forms/index.ts` | Create | Form exports |
| `apps/webapp/src/schemas/forms.ts` | Create | Form validation schemas |
| `apps/webapp/package.json` | Modify | Add dependencies |

## Test Requirements

| Test Case | Expected Result |
|-----------|-----------------|
| Empty required field | Error shown on blur |
| Invalid email format | Format error displayed |
| Form submit with errors | Submit prevented |
| Valid form submit | onSubmit called |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-016/ISSUE_016_DETAILED.md

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-016 |
| Title | Add form validation with React Hook Form and Zod |
| Area | WEBAPP |
| Difficulty | Medium |
| Labels | frontend, forms, validation, medium |
| Dependencies | None |
| Estimated Lines | 150-200 |
