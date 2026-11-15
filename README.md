# DukaanPulse

**An inspectable payment signal, an owner-approved experiment, and an honest review.**

Team Trio · Paytm Build for India AI Hackathon · Chennai · **Track 1: Merchant Growth AI**

Initial audience: neighbourhood tea shops, cafés and snack shops. This independent prototype has no production Paytm integration or endorsement. All bundled records are synthetic. Pilot, adoption, retention, pricing and growth remain hypotheses.

## Working journey

1. Upload `public/datasets/valid.csv`, inspect the mapping and validation report, and import.
2. In Setup, confirm 12:00–20:00 coverage for 2026-11-14, 2026-11-07, 2026-10-31 and 2026-10-24. Record a reason and save. Uploads deliberately clear old coverage.
3. Open the Decision Receipt. It computes 14 payments versus a matched median of 23.
4. Type `close 5 pm` into the correction box. Interpret, inspect the readback and confirm. The complete-window comparison and offer advice withdraw. Type `close 8 pm` to restore.
5. Compare actions. Set the discount to ₹15, save, select the discount card and inspect the blocked −₹3 contribution. Restore ₹5 and save.
6. Switch language. Inspect the same numbers in Hindi or Tamil. Request a receipt briefing. Without a configured Sarvam key the app clearly labels rule-based text and offers device speech only if a matching device voice exists.
7. Approve exact terms via a checkbox and confirmation. Prepare a print-ready HTML poster with embedded Indic fonts. Open it in a browser and print/save PDF. Preparation does not mark an experiment as run.
8. Explicitly confirm it ran. Upload `positive.csv`, confirm follow-up coverage, hours and execution, then review 19 payments: +5 versus the original and −4 versus the saved median. No causal claim.

`Load synthetic shop` is the fast rehearsal route and includes labelled, explicit synthetic context. The upload route remains independently testable.

## Local setup

Node >=22.13 (tested with Node 24). Source contains the lockfile and all app assets.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cheerful_robin_chapel.sql
npm run dev
```

Use the URL printed by the dev command. Run the migration once per fresh local database. The hosted Sites workflow provisions D1 and applies migrations independently. Local records do not copy into production.

```sh
npm test
npm run typecheck
npm run build
```

The checkout-local managed preview configuration is excluded from source; ordinary development defaults to the portable profile. No dependency directory or credential belongs in a source archive.

## Architecture

One TypeScript app: React + Vinext, Cloudflare Worker API routes, Zod validation and native D1 storage. No Python service, external database, customer messaging service or additional runtime AI provider is required.

- `lib/analytics.ts`: CSV parser, ISO timestamp validation, paise arithmetic, window/weekday comparisons, median and economics.
- `lib/commands.ts`: validated mutations, revisions, approval guards, experiment transitions and saved-goal outcome review.
- `lib/i18n.ts`: fixed English/Hindi/Tamil dictionaries and numerical templates.
- `lib/provider-service.ts`: injectable provider boundary, grounding and cache orchestration.
- `app/api/provider`: server-side Sarvam speech and bounded question classification.
- `app/api/speech`: short recording transcription, followed by deterministic correction interpretation.
- `app/api/state`: optimistic concurrency, source validation and isolated persistence.
- `db/schema.ts` + `drizzle`: schema-only migrations for workspaces, provider cache and usage counters.

The model selects a validated explanation focus. Code supplies the complete explanation and every figure. This deliberately constrains open-ended financial language. Three built-in evidence questions work without AI. Spoken corrections support a narrow grammar for budget, unambiguous closing times, stock unavailability and goal. They never approve anything.

## Data and calculation contract

See [docs/SCHEMA.md](docs/SCHEMA.md). One row is one payment:

```csv
transaction_id,timestamp,amount,status
001,2026-11-14T16:00:00+05:30,40.00,completed
```

IDs remain strings. Amount input is rupees with at most two decimal places, converted to integer paise. Totals are summed in paise. Averages retain precision internally and round only for currency presentation. Completed statuses: `completed`, `success`, `successful`, case-insensitive. Pending, failed, cancelled/canceled and refunded records are excluded with counts. Unknown statuses, missing fields, negatives, invalid amounts and ambiguous dates are rejected with row-level feedback.

Identical IDs and identical source fields deduplicate. Any conflict sharing an ID removes all versions of that ID, including an excluded-status conflict. No guess is made about which is correct. The prototype imports valid completed rows after displaying the report; it never silently repairs invalid ones.

The 4–6 PM analysis examines earlier matching weekdays within eight weeks, with the same half-open window [16:00,18:00), full opening and explicit coverage. Three eligible periods are the minimum. The baseline is their median count. The default 25% dip threshold is owner-configurable from 5–90%. A zero baseline never divides by zero and never produces a percentage dip. An average-value target needs three nonempty historical averages. This is descriptive evidence, not a significance test or causal model.

Closed, partial opening, confirmed open with zero recorded payments, exceptional-date exclusion and unknown coverage remain distinct. Regular hours apply every day unless an owner adds a date-specific exception. The prototype handles same-day hours, not overnight opening.

## Approval and persistence

`Draft` is the current receipt/action selection. Approval creates an experiment, then:

`Approved → Prepared → Ran → Reviewed`, with `Skipped` and `Stopped` terminal alternatives.

A material context, offer, goal or upload change creates an immutable receipt snapshot. Unfinished earlier approvals stop. Already-run experiments retain their original terms and remain reviewable, but cannot create new stale materials. The saved goal and baseline determine the later outcome. Reviewed, stopped, skipped, rejected, negative and inconclusive records stay visible.

D1 stores context, validated completed rows, validation reports, revisions, exact terms, lifecycle events and follow-up records. Updates use a version compare-and-swap. The frontend also locks pending submissions. An experiment cannot be created twice for the same current revision while an existing one remains active/reviewed. Browser refresh persistence was checked.

On the private hosted Site, the signed-in owner ID scopes records. A managed development preview without that identity uses a random 256-bit HttpOnly SameSite=Strict demo-session cookie (30-day cookie lifetime). Clearing that cookie loses access to the demo scope; an export is recommended. Server records are not stored in localStorage. Only language is device-local. This is prototype isolation, not a completed multi-outlet account/retention policy.

## Sarvam and finite-credit controls

See [docs/PROVIDERS.md](docs/PROVIDERS.md). **500 organiser credits are user-reported; their unit, current balance, expiry and eligibility have not been verified.** No paid upgrade, purchase or top-up was performed. Development help in ChatGPT does not confer API credits.

Server-only key name: `SARVAM_API_KEY`. In your own terminal run:

```sh
node scripts/configure-sarvam.mjs
```

This masks input and writes an ignored `.dev.vars` with restricted permissions for local development. Never paste the key into chat, source, screenshots or browser code. For this hosted Site, the supported environment-variable operation accepts `SARVAM_API_KEY` marked `is_secret: true`, followed by deployment of the saved version. A secure credential source/handoff is still required; none was supplied in this session. A local `.dev.vars` does not configure hosted production. For a separate Cloudflare deployment you control, Wrangler's interactive `secret put SARVAM_API_KEY` is another secure host setup route.

Limits: 12 provider attempts per workspace per UTC day and 100 across this deployment. The application counter includes failed attempts, is conservative, and is not the provider balance. Inputs and output tokens are bounded. Provider requests time out after 20 seconds, with no automatic retries. Recordings stop after 15 seconds and are capped at 1 MB. Explanations and audio cache by immutable receipt revision, language, model, focus/question and voice settings; reset numbering cannot collide with old content. Failed/in-flight keys have a 45-second cooldown. Usage metadata is retained when supplied. No cost estimate is presented as a verified charge.

## Materials and source

- `public/datasets/`: actual valid, insufficient-history, dirty, positive and negative CSV files, with JSON context companions.
- `docs/Original_Stage1_Proposal.pdf`: preserved original upload, unchanged.
- `docs/Example_Approved_Tamil_Poster.html`: actual browser-downloaded synthetic poster with embedded fonts.
- `docs/DEMO.md`: 60-second mentor demo, three-minute jury script and reset instructions.
- `docs/JUDGING_QA.md`: honest answers and pilot hypotheses.
- `docs/VERIFICATION.md`: evidence, limitations and test scope.

## Remaining limits

Live Sarvam TTS/STT/chat calls and account-credit details await credentials and a small authorised verification set. Device speech depends on installed voices and is never labelled Sarvam. Hindi/Tamil copy is implemented and visually inspected; a native-speaking merchant usability review remains necessary. Three periods are a prototype minimum. Payment records do not reveal item mix, unique customers, cash, inventory, profit or causality. No payment execution, customer delivery, production Paytm API, role management, backups, monitoring or commercial pilot has been implemented. Production rollout requires those operational controls and appropriate authorised data access.
# DukaanPulse
