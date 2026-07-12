# AquaTwin

AquaTwin is a monitoring and digital twin platform for aquaponic farms. It shows
live water quality readings, raises threshold and predictive alerts, projects the
system forward with a what if simulation, and runs user defined automation rules
that switch devices. The interface is a strictly monochrome, keyboard accessible
single page app localized in English, Russian and Kazakh.

## Tech stack

- Vite, React 19 and TypeScript in strict mode
- react-router-dom v7 with lazy loaded, code split routes
- Tailwind CSS v4 (design tokens via the @tailwindcss/vite plugin, no config file)
- Supabase for authentication, Postgres storage and realtime
- i18next for localization (en, ru, kk)
- lucide-react for icons; charts and the schematic are hand rolled SVG
- Self hosted variable fonts via Fontsource

## Local setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy the environment template and fill in your Supabase project values:

   ```
   cp .env.example .env
   ```

   Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project
   (Project Settings, API).

3. Apply the database schema: open the Supabase SQL editor and run the contents of
   `supabase/schema.sql`. It creates the tables, row level security policies and the
   realtime publication, and is safe to run more than once.

4. Start the dev server:

   ```
   npm run dev
   ```

## Scripts

- `npm run dev` starts the Vite dev server
- `npm run build` type checks and builds the production bundle to `dist`
- `npm run preview` serves the production build locally
- `npm run lint` runs oxlint
- `npm run check:db` verifies the database is reachable (reads `.env`)
- `npm run check:trend` runs the trend math sanity checks
- `npm run check:model` runs the farm model sanity checks

## Deployment

The app deploys to Vercel as a static single page app. The default output directory
`dist` is used, and `vercel.json` rewrites all routes to `index.html` so client side
routing works on refresh and deep links. Set the same two environment variables in the
Vercel project settings: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Disclaimer

This is an educational MVP. The sensor stream is simulated client side, and the
farm model used by the what if simulation is a simplified approximation, not a
validated scientific model.
