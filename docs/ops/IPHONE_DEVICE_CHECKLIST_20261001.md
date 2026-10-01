# iPhone real-device final checklist (2026-10-01)

- Release standard device: **iPhone Safari + home-screen PWA**. Galaxy is not a release blocker for now (CEO decision 2026-10-01).
- Target: QA app `https://echo-app-qa.netlify.app` (QA Supabase `mutniujeiyujhkobadkd`). Do not test on PROD.
- Status at writing: **EXTERNAL_DEVICE_HOLD**. Desktop Chromium (390×844 emulation, 34 scenarios) is not real-device evidence. There is no DEVICE PASS without the items below.

## How to record evidence (each item)
- Device model / iOS version / Safari or PWA
- Time (KST)
- Screenshot or screen recording file name
- Result: PASS / FAIL / 확인 불가 (and why)

## Preparation
1. On the iPhone, open Safari and go to the QA app address.
2. Share button → "홈 화면에 추가" (Add to Home Screen) → add it.
3. Use one Google account that may be used for QA. A second QA account (another phone, or the PC) is needed for the "mutual" step.

## Checklist (in order)

| # | Step | What to look at | Pass rule |
|---|---|---|---|
| 1 | Cold start | Close all apps → tap the ECHO icon on the home screen | Opens without a white flash or a crash |
| 2 | First pixel | The very first color you see | Deep navy (the splash color). No white or green flash |
| 3 | Splash | The navy E image | Shows for about 1 second, then moves on by itself |
| 4 | Onboarding | First screens | Pastel background (Mint/Aqua/Yellow/Coral). Text is not cut off; buttons are not hidden by the notch or the bottom bar |
| 5 | Google login | "Google로 계속하기" | Google screen opens → choose the account → comes back into the app (not stuck on a blank page) |
| 6 | Session restore | Fully close the PWA → open it again | Still logged in (no second login) |
| 7 | Agent | ECHO conversation: answer 3–4 questions | Questions are short and follow the previous answer. "잘 모르겠어요" is accepted. "질문이 너무 많아요" gets an apology/adjustment, not a new question about it |
| 8 | Matching | The "당신이 잠든 사이" screen | The readiness list matches what you have done ("ECHO와 대화" etc.) |
| 9 | Candidate | Candidate card | Photo is not shown before the rules allow. No internal words (65%, 35%, Reveal, Lock, KEY …) anywhere |
| 10 | Waiting | Choose a candidate | A gentle "waiting" pulse. No pressure wording |
| 11 | Mutual | The second account also chooses | Both sides see the "서로 선택" state |
| 12 | Connection | Open the connection | The connection screen opens without a reload |
| 13 | First question | The first question card | It appears once and can be answered |
| 14 | Blind-first | Before reveal | The other person's photo stays hidden |
| 15 | Reveal | After the agreed step | The photo shows only by the server rule. No progress numbers |
| 16 | Message | Send 2–3 messages | Messages arrive, in order, without duplicates |
| 17 | Keyboard | Tap the input box | The keyboard does not cover the input box or the send button. The page does not jump sideways |
| 18 | Back | iOS swipe-back / the back button | Goes to the previous screen and does not log out |
| 19 | Input preservation | Type a sentence → go back → return | The typed sentence is still there (or an expected, clear reset) |
| 20 | Outcome | Finish / end the connection | The outcome choice is saved once (pressing twice does not duplicate it) |
| 21 | Settings | Settings screen | Visibility rules, help and the saju/tarot links show. Text fits at 390px |
| 22 | Logout | Log out | Returns to the start. Reopening the PWA does not show the old account |
| 23 | PWA home launch | Open from the home screen icon again | Opens full screen (no Safari address bar), with the right icon and name |

## Extra (Saju / Tarot)
- Saju and tarot screens stay in the same pastel world. Only the light, depth and texture differ (PASTEL_WORLD_LOCKED). It must not look like a separate dark app.

## Not to do
- Do not use PROD addresses. Do not use real payment. Do not paste passwords or keys into chat or into screenshots.
