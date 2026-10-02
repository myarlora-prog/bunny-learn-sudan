# Four-tab navigation and streak screen

## Scope
- Keep the existing Saqro visual system, Arabic RTL typography, colors, cards, spacing, and mobile layout.
- Replace the bottom navigation with exactly four destinations: المكتبة، اختباري، الاستريك، حسابي.
- Reuse the existing curriculum as the library destination and existing lesson quizzes as the quiz source.
- Build the streak screen in the reference structure: mascot, current streak message, three-month activity calendar, three statistics, and guidance action.
- Use the supplied Sudanese jalabiya-and-turban mascot only on the streak screen.

## Navigation behavior
- المكتبة opens the existing curriculum screen.
- اختباري opens a consolidated quiz list and links into each lesson’s existing embedded quiz tab; no separate quiz-taking page is introduced.
- الاستريك opens the new streak screen.
- حسابي opens the existing profile screen.
- Existing secondary screens remain reachable from their current in-app links but are removed from bottom navigation.

## Verification
- Check all four tabs and active states on a mobile viewport.
- Confirm the streak layout matches the supplied reference without changing global styling.
- Confirm quiz links resolve to existing lesson screens and the app builds without errors.
