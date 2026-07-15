# AquaTwin — Engineering and Design Constitution

## Design rules (non negotiable)
1. Light theme only. White background everywhere. Dark mode must never be implemented.
2. Strict monochrome: #0A0A0A foreground, #FFFFFF background, #666666 muted text, #EAEAEA borders, #FAFAFA surfaces. No other colors, no accent, no gradients. Charts and data visualizations are monochrome too.
3. Status and severity are expressed through typography and fills, never through color: normal = outlined, warning = gray fill, critical = solid black fill with white text.
4. border-radius between 0 and 2px on every element, no exceptions.
5. Icons: lucide-react only, strokeWidth 1.5, sizes 16/20/24. Never inline custom SVGs, never other icon packs.
6. Typography: Space Grotesk Variable for UI and headings (Latin), Onest Variable as the Cyrillic fallback for Russian and Kazakh, JetBrains Mono Variable for all numbers, sensor readings, timestamps, and identifiers.
7. Zero emojis anywhere in the product.
8. Avoid hyphens and dashes in UI copy in every language; in Russian and Kazakh a hyphen is allowed only where grammar strictly requires it, never as punctuation.
9. Vercel style minimalism: generous whitespace, 1px borders instead of shadows, clear typographic hierarchy, zero decorative noise.

## Architecture rules
1. src/landing = public pages. src/frontend = authenticated app. src/backend = the ONLY place allowed to import supabase. src/shared = primitives and i18n used by both.
2. Components never call Supabase directly; they call typed functions exported from src/backend.
3. Every top level route is code split via lazy().
4. TypeScript strict; the type `any` is forbidden.
5. Every user facing string goes through i18next (en, ru, kk). No hardcoded copy.
6. No new dependencies unless a phase prompt explicitly approves them.

## Process
Development is phased. Build only what the current phase specifies. Never scaffold ahead. Do not run git commands unless explicitly asked.
Schema changes ship as numbered files in supabase/migrations and must be applied before deploy.
