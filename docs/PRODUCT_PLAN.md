# 2Cars: stability, validation, and a zero-budget launch

Assessment date: 24 October 2026. This assessment covers the code in PR #2, not a verified live deployment. The current game controls one car across two lanes; true dual-car play is not implemented.

## Shipped in this stability pass

- Prevent Start from resetting a live or paused run.
- Make endRun idempotent; preserve the settled score in the HUD.
- Remove the minimum one-coin payout for zero-score crashes.
- Validate malformed saved profile fields and tolerate unavailable localStorage.
- Apply equipped backgrounds immediately.
- Give all profiles the same base speed and spawn rate; difficulty still ramps with run time and score.
- Define shop upgrades as permanent; snapshot double-coins at run start so mid-run purchases apply next run.
- Add a result summary, instructions, sound control, keyboard pause, and automatic pause on hidden tabs.
- Preserve canvas aspect ratio and add focus styles and reduced-motion support.
- Remove external font requests and developer advertising text from the player interface.
- Clearly label the leaderboard as local personal scores.
- Add npm test and a GitHub Actions workflow. Production assets are rebuilt and tracked.

No advertisements, third-party analytics SDKs, accounts, payments, or remote services were added.

## Verification and limits

Run `npm test` and `node --check app.js`, `node --check dist/app.js`, `node --check build.mjs`.
The tests execute source and built JavaScript in a mocked DOM. They cover restart timing, collision settlement, shields, active-run resets, duplicate settlement, blocked storage, malformed profiles, background equipment, difficulty independence, pause, and next-run upgrades.

Browser QA remains required: the available Playwright installation had no browser, and downloading Chromium failed. Before production, test on a real Android phone, iPhone/Safari, and desktop browser. Verify touch controls, visibility pause, sound, reload persistence, shop, result summary, portrait and landscape, keyboard focus, and storage-denied behavior. The live Vercel URL was not accessible to the research tool.

## Next product decisions

1. Observe 10-20 real first-time players before adding a backend or more shop items.
2. Decide whether to rename the current single-car game or implement a separate dual-car mode. Test dual-car play as the potential differentiator; do not replace the only working mode without evidence.
3. Add a short practice mode, readable obstacle patterns, clear hit feedback, and a restart flow that feels immediate.
4. Add a seeded daily challenge with a fixed ruleset and no gameplay-affecting upgrades. Same pattern and physics for every participant; use a fixed simulation timestep if comparing replays.
5. Add a local shareable score card and challenge link. Describe scores as unverified until a server validates runs.
6. Add 3 understandable daily missions and cosmetic unlocks only after the core loop is enjoyable. Avoid streak penalties and artificial waiting.

## Measurement specification — not connected yet

Use Cloudflare Web Analytics for traffic and page performance; use one game-event provider such as GameAnalytics for cohorts and progression. Verify the provider's current free limits, privacy requirements, and SDK behavior before enabling collection. Website visits alone cannot measure gameplay retention.

Suggested events:

| Event | Parameters | Purpose |
| --- | --- | --- |
| game_loaded | build_version, coarse_device | Load-to-play funnel |
| run_started | mode, build_version | Starts and replay frequency |
| run_ended | mode, score, active_seconds, death_reason, upgrades | Difficulty, fairness, session value |
| run_paused | reason | Exclude inactive time |
| shop_purchase | item_id, virtual_price | Economy balance |
| daily_claimed | reward_type | Return loops |
| share_completed | method | Voluntary sharing; do not count cancelled share dialogs |
| ad_requested / ad_filled / ad_completed / reward_granted | placement, provider | Fill, completion, reward correctness |
| game_error | code, build_version | Reliability; do not send profile data or raw sensitive payloads |

Use bounded parameter values. Do not send every frame, raw keypresses, names, emails, full URLs, or fingerprints. Include build version so releases can be compared. Returning-player measurement requires an appropriate permitted identifier; blocked analytics and cleared storage cause undercounting. Test events in a debug property first. Do not put secret API credentials in client code.

Weekly dashboard:

- Visit-to-first-run rate.
- First-run survival distribution, especially deaths under 5 seconds.
- Share of run finishers starting another run in the same session.
- Median and mean active session duration, excluding hidden and paused time.
- Exact-day D1 and D7 cohorts: returns on day 1/day 7 divided by the original new-player cohort. Wait until each cohort has aged enough.
- Errors per started run, device/browser breakdown.
- Once ads exist: eligible opportunities, fill, completed views, estimated revenue, revenue per 1,000 sessions, retention before/after ads.

Use the first 100-300 genuine players to establish a baseline. Small samples are noisy. Initial internal goals might be 60% visit-to-play, 40% same-session replay, and 15% D1; these are hypotheses, not industry guarantees. CrazyGames currently describes successful titles as often having 10+ minutes mean session time and 10-15% D1, with top conversion around 80% playing at least one minute. Its definitions and audience must be respected when comparing.

## Revenue sequence

1. Validate replay and fair difficulty without ads.
2. Confirm hosting permits commercial use. Vercel Hobby currently restricts use to personal non-commercial projects. Existing paid Hostinger static hosting is an option if available under the user's plan; Cloudflare Pages is another candidate to evaluate.
3. Start with a clearly separated post-game banner on the owned site, only after publisher approval and placement review. No popunders, redirects, notifications, or gameplay interruptions. Avoid ads near movement/replay controls.
4. Later offer optional rewarded cosmetic currency, with clear reward terms, completion-only grants, deduplication, and a no-fill path. Do not grant rewards for clicking advertisements.
5. Consider a curated portal. CrazyGames Basic Launch is a non-monetized evaluation; Full Launch enables revenue after selection and integration. Poki's current preferred revenue-share arrangement includes web exclusivity; do not assume the same game can remain everywhere under that deal.
6. Consider direct sponsorship or game reskins only after an audience or a polished demonstration exists. Avoid cash-prize competitions and paid gameplay advantages during validation.

Revenue sensitivity, not a forecast:
`revenue = served monetized impressions / 1000 * effective CPM`.
At 10,000 monthly sessions and one eligible ad opportunity each, 60% fill yields 6,000 impressions. Hypothetical $1/$3/$5 eCPM means $6/$18/$30 gross, before applicable deductions or taxes. Actual country mix, format, viewability, eligibility, invalid traffic, blockers, and demand change this materially. Never purchase traffic merely to increase ad impressions.

## Four-week execution

- Week 1: finish real-device QA, confirm deployment, collect 10-20 observed playtests and a first baseline.
- Week 2: test one distinctive mechanic; publish short clips of actual gameplay with source-tagged links. Start with three strong clips per week rather than bulk AI output.
- Week 3: add seeded daily challenge and voluntary sharing if the core loop has evidence of replay. Recruit another 50-100 players through relevant communities with permission.
- Week 4: review mature cohorts and death patterns; choose one improvement. Prepare a portal submission if quality is ready. Add monetization only after approval and compatible hosting.

## Scaling and AI

Keep the current static build. A CDN can serve the game without a per-player application server. Add a backend only for a justified feature: shared scores, cloud saves, accounts, or verified rewards. Cross-device sync and competitive scores cannot be trusted to localStorage. A server-submitted score alone is not anti-cheat: use server-issued run tokens, fixed rules, rate limits, plausible timing, and deterministic replay validation where needed. Keep valuable reward verification server-side.

Use AI offline for debugging, tests, pattern ideas, translations, and analysis of consented aggregate data. Review and playtest every output. Avoid a paid per-player AI API in the core loop: it adds cost, latency, and failure modes. AI also makes generic clones easier; brand, distinctive controls, fairness, fast loading, reliable updates, community, and player data become more useful advantages. Do not ship unreviewed generated code or assets with uncertain rights.

## Sources checked

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/web-analytics/
- https://www.gameanalytics.com/pricing
- https://docs.gameanalytics.com/event-tracking-and-integrations/sdks-and-collection-api/open-source-sdks/javascript/
- https://docs.crazygames.com/
- https://docs.crazygames.com/resources/basic-launch-metrics/
- https://developers.poki.com/guide/revenue-deal-types
- https://developers.poki.com/guide/share
- https://support.google.com/adsense/answer/9959170?hl=en
- https://developers.google.com/ad-placement/apis
