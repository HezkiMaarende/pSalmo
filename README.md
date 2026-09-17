# pSalmo

Mobile service-operations app for GPdI Elshaddai Magelang. The five tabs are Beranda, Jadwal, Song Bank, Pengumuman, and Profil. IR 1 & 2 share a roster and setlist; IR 3 is independent.

## Baseline scope

The supplied design and its 15 September V1 Scope Amendment establish the baseline; the subsequently approved five-page/weekly-duty plan supersedes conflicting invitation, navigation, and permission assumptions. Smart Add and native audio playback remain later objectives.

## Stack

- React Native + Expo development build
- React Navigation bottom tabs with per-tab native detail stacks; SDK54 WebView for lazy video embeds
- Supabase Auth + Postgres + Row Level Security
- Supabase Edge Function for Smart Add
- `react-native-audio-api` for the click device (native integration, added in the audio spike)

## Start locally

```sh
npm ci
npm run start
```

Use an Expo development build rather than Expo Go once the click-device module is introduced.

## Configure Supabase

1. Create a Supabase project and enable email authentication.
2. Copy `.env.example` to `.env`, then set the public project URL, publishable key, and `EXPO_PUBLIC_CHURCH_TEAM_ID`. Restart Metro after configuration changes. Environment values prefixed `EXPO_PUBLIC_` are public, not credentials.
3. Apply every SQL file in `supabase/migrations` in timestamp order through the Supabase CLI or SQL editor. All migrations through `202609160017_exact_account_linking.sql` are applied to project `uhyxiflkahqqutnkvash`.
4. For this deployment only, `supabase/provision-church.sql` bootstraps the clean church using the existing prototype owner's account. It returns the generated church ID for environment configuration, copies no content, and is idempotent. For another deployment, provision its actual owner instead of assuming a `sounday` prototype exists.

The migration creates profiles from `auth.users`, makes each team creator an owner, enables RLS on every application table, and deliberately keeps service-role credentials out of the mobile app.

The clean church starts empty; `sounday` remains intact but is outside the regular app flow. PIC adds roster names before signup and later links exact registered account emails without invitations. Linking grants membership; kicking revokes membership and access while retaining historical roster labels. A permanent `song_editor` capability allows library maintenance off duty; service editing additionally requires a linked WL/MD assignment. Owners/admins manage all church services and publish the weekly schedule independently of song approval.

All members can browse published **roster-only** schedules. Unassigned members cannot query service details, setlists, notes, or media. Ordinary assigned members see approved details; authorized assigned WL/MD editors can prepare drafts. Home uses Asia/Jakarta and counts Sunday itself as the upcoming Sunday.

Song Bank stores canonical sectioned plain lyrics, key/BPM/birama, attribution, and ordered labeled YouTube references. Adding a library song snapshots its title, artist, defaults, lyrics, and all references into the service arrangement. Subsequent library edits do not change those snapshots. Chords, structure, key/BPM overrides, links, and notes are edited per service. Reordering requires an expected revision and returns HTTP 409 for stale edits.

Video is mounted only when expanded, requires a user gesture, never autoplays, and retains an external-link fallback. The WebView supplies application identification as required by [YouTube's embedded-player guidance](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity). Pengumuman and Peraturan remain placeholders. Profil edits the greeting name and supports sign-out.

Latihan has separate Edit/Play modes, service-specific BPM/birama/notes, tap tempo, beat indicators and Start/Stop/Next. Native click playback requires the installed pSalmo development app, not Expo Go. On Windows, `npm run build:android` uses a fresh short physical source copy under TEMP to avoid Ninja's path-length limit, then copies a successful arm64 debug APK back into ignored `artifacts/`; `npm run start:dev` serves it from the original repository. `-PrepareOnly` checks staging/dependencies/native generation without compilation or installation. Use `npm run start:go` for Expo Go's settings-only/UI flow. Standard `npm run android` also builds/installs natively, but does not provide the short-copy workaround. It is a **foreground-only audio spike, not validated for live service/mixer use**; background/lock playback and Android route-disconnect safety remain outstanding. Read [docs/latihan-audio.md](docs/latihan-audio.md) for counting conventions, architecture, USB installation and acceptance gates.

## Share a private testing APK

Run `npm run build:share` to create a standalone, multi-architecture preview at `artifacts/psalmo-preview-universal.apk`. Unlike the development APK, it embeds the app and does not need Metro. Send it through WhatsApp as a Document after testing with Metro disconnected. It uses a template test signing key, not production signing. See [docs/share-apk.md](docs/share-apk.md) for setup, account access and safety notes.

## Validate

```sh
npm run typecheck
npm test
npx expo export --platform android --max-workers 1 --no-bytecode
```

Tests use Node24 (also configured in CI); `--test-isolation=none` avoids restricted Windows child-process spawning. Run `supabase/tests/weekly_workflow.sql` as postgres through SQL Editor for rollback-only authenticated-role policy and workflow tests. `tests/reorder-concurrency.cjs` exercises simultaneous authenticated RPCs against a separately prepared disposable fixture account; never point it at real church data.

JavaScript export is not a native/Hermes build or on-device test. Complete [docs/device-validation.md](docs/device-validation.md) before pilot readiness. The database Security Advisor's guarded signed-in `SECURITY DEFINER` notices are intentional and documented in the tracker; leaked-password protection still needs an Auth configuration review.

## Planning

See [PROGRESS.md](PROGRESS.md) for milestones, acceptance gates, decisions, and current status. See [docs/technical-design-review.md](docs/technical-design-review.md) for the implementation interpretation of the supplied document.
