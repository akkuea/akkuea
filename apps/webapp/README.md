This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

1. Set up environment variables:

```bash
cp .env.local.example .env.local
```

See `.env.example` for a full variable reference and production-like example values.

2. Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

Unit tests (`bun test`, colocated with the source they cover):

```bash
bun test
```

### End-to-end tests (Playwright)

`e2e/` holds the Playwright suite covering the pilot whitelist onboarding and
review flow (`WhitelistOnboardingForm` and `WhitelistReviewQueue`). It is
isolated from the unit test suite above: it boots a real Next.js dev server
and drives it in a real browser, but every whitelist API call is mocked at
the network layer (see `e2e/fixtures/whitelist-api.ts`), so it needs no
backend process and never touches a testnet transaction.

Run it locally with a single command:

```bash
bun run test:e2e
```

This installs nothing by itself; the first time you run it, install
Playwright's browser binary once with:

```bash
bunx playwright install chromium
```

Other useful variants:

```bash
bun run test:e2e:ui       # interactive UI mode, step through each test
bun run test:e2e:report   # open the HTML report from the last run
```

`bun run test:e2e` boots its own dev server on port 3100 (see
`playwright.config.ts`) and shuts it down when the run finishes. If that
fails to start in your shell (for example, some Windows setups have trouble
with Playwright spawning a `bun run` script directly), start it yourself in
one terminal and point Playwright at it in another:

```bash
# terminal 1
bun run dev:e2e

# terminal 2
PLAYWRIGHT_SKIP_WEBSERVER=1 bun run test:e2e
```

**Seam for a real environment**: this suite intentionally only exercises the
mocked path. To point the same specs at a real, seeded backend later, set
`PLAYWRIGHT_BASE_URL` to that deployment's URL and `PLAYWRIGHT_SKIP_WEBSERVER=1`,
then remove or make conditional the `page.route()` mocks in the specs that
would otherwise shadow real network calls.

In CI, this suite runs as its own `e2e-tests` job in `webapp-ci.yml`,
independent of the unit-test job, so it can never slow that job down or make
it flaky.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
