# ECHO RELEASE PIPELINE v1 — Company lock (2026-09-27)

Priority: latest CEO decision > current company/master lock > observed operation and QA > tests > old documents > inference. Plan A only. ECHO Agent owns product decisions; LLMs are tools. Server v2.2.4 and its observed real-AI 20/20 and end-to-end 38/38 evidence remain release baseline. This automation PR does not change Agent code, Supabase, RLS, migrations, production sites or secrets.

## Fixed topology

- APP = DO IT · ECHO product, production Netlify `doitmobile` (`ff078012-fe79-4108-a210-201554ab0dea`), `https://app.do-it.company`.
- BRAND = DO IT COMPANY, production Netlify `echo-mvp-doit` (`7a4934db-aff3-437d-815a-ffbf49d4b819`), `https://do-it.company`.
- QA APP = `echo-qa-app-20260927` (`2152f690-2d7c-48f9-8cce-d06caea11adf`), team `69f5f33a2f2f197d8b507ecc`. No QA BRAND site has been approved.
- QA Supabase = `mutniujeiyujhkobadkd`. Production Supabase is separate.
- App icon is the supplied silver E frame, yellow and blue bars. Uploaded 2026-09-27 JPEG SHA-256 `aba61478581c43ed4759713411fdf7d514aea3329a559f8c8f8fabf3befa67ff` equals existing `product/brand-src/echo-app-icon-original-20260925.jpg` byte for byte. Generated PNG assets are already in `product/public/pwa`; D symbol stays in intro/loading/transition.
- CEO role after gates: iPhone and Galaxy device check, then explicit GO/HOLD. GO from chat is not equivalent to GitHub environment approval until a verified integration implements that bridge. Production execution remains stopped.

## Observed status at 2026-09-27 21:xx KST

| Item | Status | Evidence or blocking condition |
| --- | --- | --- |
| PR #14 initial head | ACTIVE | `22a34548229add30a2b05a977e14005d39a3b7d4` draft, not merged at inspection |
| Code gate existing run | ACTIVE | Run `36315222879`: check success, qa_publish skipped |
| QA release branch | MISSING | `release/qa-app` search returned no branch |
| QA Netlify deploy | ACTIVE | Deploy `6ab912436a0dca4dce96b1b8` appeared at 2026-09-27 12:55 UTC. Netlify marks it ready, manual `drop`, `commit_ref: null`. This is not a pipeline deploy or verified commit. |
| QA Supabase target | READY | Exact project ref and URL identified, build restriction coded |
| GitHub QA Environment and secrets | UNKNOWN | Connector cannot read environment variables or confirm scoped token |
| Production protection | MISSING | CEO signal, device evidence, freeze, backup and rollback not operational |
| QA / production deployment identity | UNKNOWN | Latest production Netlify IDs observable; commit-to-bundle match not proven |

## Required gate progression

DEV → CODE PASS → QA DEPLOYED → QA PASS → DEVICE PASS → READY FOR CEO GO → PRODUCTION DEPLOYED → PRODUCTION VERIFIED. On failure: HOLD; verified restore: ROLLED BACK.

Do not infer AUTH/JWT/RLS/real AI PASS from static route checks. Actual QA must verify Google button/provider/callback/session, user isolation, corrections/rejections, Canonical State, Profile and matching sources. QR or manifest existence alone does not prove device installation. Build SHA must agree with deployed bytes. APP and BRAND stay distinct. One failed mandatory gate means HOLD and zero production modification.

## Current code blockers identified by actual build

The PR #14 base app manifest has `start_url: "/"`, `short_name: "DO IT"` and user Google buttons lack `VITE_AUTH_GOOGLE_ENABLED` display guards. QA app build succeeded locally with a placeholder public key but `release-check.mjs` correctly failed its PWA entry gate. The latest candidate fixes in separate draft PR #12 have not been merged or proven in this release branch. QA brand navigation also needs production-domain isolation. Do not create or deploy `release/qa-app` from the older PR #14 base.

Do not claim completion until one exact candidate commit successfully runs all code gates, QA deploy, SHA and live asset smoke, then stops at Device Gate. No CEO GO means no production action.
