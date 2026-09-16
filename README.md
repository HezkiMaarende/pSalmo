# pSalmo

Mobile service-operations app for the PAW worship team. It consolidates each weekly service's roster, temporary roles, shared notes, setlist, song arrangements, media references, and click-device configuration.

## Baseline scope

The 15 September 2026 V1 Scope Amendment in the supplied technical design is the authoritative scope. In particular, V1 includes Ibadah Raya 1 & 2 and Ibadah Raya 3, roster management, live-rehearsal click-device reliability, and a review-gated Smart Add workflow. The earlier statements excluding rostering and live use are superseded.

## Stack

- React Native + Expo development build
- Supabase Auth + Postgres + Row Level Security
- Supabase Edge Function for Smart Add
- `react-native-audio-api` for the click device (native integration, added in the audio spike)

## Start locally

```sh
npm install
npm run start
```

Use an Expo development build rather than Expo Go once the click-device module is introduced.

## Configure Supabase

1. Create a Supabase project and enable email authentication.
2. Copy `.env.example` to `.env`, then set the public project URL and publishable key.
3. Apply the SQL files in `supabase/migrations` in timestamp order through the Supabase CLI or SQL editor. All three have been run against project `uhyxiflkahqqutnkvash`; they are kept in the repository as the reproducible source of truth.

The migration creates profiles from `auth.users`, makes each team creator an owner, enables RLS on every application table, and deliberately keeps service-role credentials out of the mobile app.

The current app supports email authentication, team creation/selection, service creation/listing, and service details. Owners and admins can add or remove temporary roster roles, notes, media links, and proposed-title setlist items, and can reorder setlist items atomically. Native session data is encrypted locally; the full flow still needs on-device verification. Song Bank matching, arrangements, and Smart Add are next.

## Planning

See [PROGRESS.md](PROGRESS.md) for milestones, acceptance gates, decisions, and current status. See [docs/technical-design-review.md](docs/technical-design-review.md) for the implementation interpretation of the supplied document.
