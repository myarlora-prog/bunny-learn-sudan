# Nawabig scoped completion

## Current request
- [x] Review the existing owner-managed onboarding tour and preserve its working controls.
- [x] Add the owner-editable unlock-lessons/WhatsApp tour step after the account step, linked to the real profile action.
- [x] Replace the flashcard interaction sound with a quieter, non-overlapping study sound without changing card behavior.
- [ ] Replace every existing app logo/icon/splash usage with the supplied official image, preserving its aspect ratio. Blocked: the uploaded document contains no logo image.
- [x] Run focused tests and mobile browser checks for the implemented changes.
- [x] Commit only the scoped changes and report PASS/FAIL/NOT TESTED clearly.

## Verification
- PASS: owner edit, restore, disable/enable, reorder, save, and reload persistence for the new step.
- PASS: isolated student tour text, real spotlight, mobile scrolling, saved Saudi WhatsApp number, and prepared inquiry.
- PASS: real flashcard flip, quieter local sound at volume 0.18, and complete answer-face rendering.
- NOT TESTED: new logo, app icon, splash, favicon, and PWA icon because no image was supplied.

## Previously committed work — do not repeat
- Owner smart breadcrumb: `2f402cf`, `ba300db`.
- Legacy book-upload restoration: `b7cf5fb`.
