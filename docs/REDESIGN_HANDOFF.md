# Tooka v4 redesign: handoff

Read this file first, and keep token use low: read only the lines you need, keep command output short, and don't print whole diffs.

## Where things stand (2026-10-27)
- Branch `feature/redesign-v4`, cut from `feature/calling`. Everything is committed and pushed (last commit `7df1206`).
- Phases 0–4 are done: the theme and shared pieces, the booking flow (Spa Details → Review & pay → Booked), Home, Explore, My Bookings, the tab bar, Profile, Edit profile, Payment history and Policies.
- All the per-screen switches in `src/config/uiFlags.ts` are on (`USE_V4_UI` master plus `V4_SCREENS`).

## How the code is laid out
- Tokens and motion: `src/theme/` (`theme.ts`, `motion.ts`). Shared pieces: `src/components/ui/` (Button, Card, Chip, BackButton/RoundButton, Haze, TabBar, Text, Icon, Screen, plus a development-only Gallery shown when `SHOW_V4_GALLERY` is on).
- Each screen was done in two passes. First its logic moved into a hook (e.g. `useHomeScreen`, `useExploreScreen`, `useSpaDetailsScreen`) with no visual change. Then the v4 layout was built on that same hook behind `isV4('<screen>')`, with the old layout as the fallback.
- Review & pay is still a Modal, so the iOS Cashfree fix still gets `onDismiss`. Keep it that way.
- Design source: the canvas at https://claude.ai/artifact/4pSECFwYsHMG5G8pzfMfi5, `project/*4.dc.html` files (v4 is the approved version). Dark espresso theme, brand `#FFB02E`, saffron used sparingly.

## Rules
- **Change no logic** without asking the user first. `useSlotBooking`, `usePayment`, `useMyBookings`, `useProfile`, the payment code and the APIs stay as they are. The 69 tests cover them.
- Nothing goes to `main`: it is live and ships over Stallion OTA. Keep booking times' `Z` suffix and Cashfree PRODUCTION as they are (the user's decision).
- Sections with no backend data stay hidden: the gender filter, multi-spa "slots today", `hold_ends_at` countdown, refund summary and receipts. Add to calendar is skipped because it needs a new native library.
- No new native libraries. There is no blur library, so the glass effects are near-solid fills, and there are no haptics.
- After each step, run `npx jest`, `npx tsc --noEmit` and `npx eslint src App.tsx`, then stop for the user to test on the iPad (Metro plus a device). Commit and push only when the user says so.

## What's next
1. **Phase 5:** Login, Onboarding, Splash, Location picker, the call screens and the Wellness article have no v4 designs yet. Ask the user whether to design them on the canvas first or just recolour them for the dark theme.
2. **Final device test** with every switch on: book, pay (iOS Cashfree), leave checkout so the hold is released, log in mid-booking and return to it, use Directions and Call spa on Booked, and place a call.
3. **Cleanup** after approval, in one commit: delete the old layouts and the switches, and remove the Gallery if it's no longer wanted.
