# Technical Design Review and Implementation Baseline

## Source and precedence

This plan is derived from the exported *Aplikasi Sunday Service Tim PAW or something - Technical Design Document*, dated 8 September 2026, plus its *V1 Scope Amendment* dated 15 September 2026. The amendment supersedes earlier conflicting scope: V1 is a weekly PnW service-operations system, including roster and live use of the per-song metronome/click device.

## V1 capabilities

1. Team membership and permission roles: owner, admin, member.
2. Weekly Service for Ibadah Raya 1 & 2 and Ibadah Raya 3, with service date/status, roster, temporary service roles, notes, media references, setlist, and click-device configuration.
3. Team-scoped Song Bank. Service-specific key, BPM, time signature, structure, chords, arrangement and notes are stored on a setlist item.
4. Manual and bulk add; revision-based atomic reorder; medley grouping.
5. Smart Add from WhatsApp text, PDF, or DOCX. It produces candidates, matches the Song Bank, and requires WL/MD review before commit. Unknown songs remain service-only proposals until admin promotion.
6. Read-only offline access to prefetched upcoming services.
7. A native, audio-clock-scheduled click device which supports wired/USB output, silent mode, screen lock/backgrounding, and safe interruption/route-change pause.

## Architecture

`Expo mobile app -> Supabase Auth/Postgres/RLS -> Edge Function Smart Add -> configured AI provider`

Supabase direct data access is protected by RLS. Smart Add is the only custom server path: it validates structured model output, keeps user pasted text separate from model instructions, rate limits requests, encrypts raw input, and deletes it after 30 days.

## First implementation sequence

1. Add development-build configuration, environment validation, Supabase client, encrypted large-session adapter, and migration/test harness.
2. Implement `Team`, `Membership`, `Service`, `ServiceAssignment`, `ServiceNote`, `Song`, `SetlistItem`, `MedleyGroup`, `MediaReference`, `ClickDeviceConfiguration`, and `SmartAddJob`.
3. Ship authenticated team/service selection and a read-only service detail view.
4. Add admin/WL/MD edit flows and revision-based reorder.
5. Build Smart Add preview/review/commit and fixture-based evaluation.
6. Spike native audio scheduling before committing to the final setlist UI; then validate against actual church hardware.

## Risks deliberately made visible

- The `react-native-audio-api` click requires an Expo development build and real-device testing; it cannot be proven in Expo Go.
- Indonesian privacy notice/consent is needed before Smart Add, because pasted content is transferred to an external provider. Raw text must expire after 30 days.
- Lyrics require a licensing decision before wider rollout. If CCLI applies, canonical song data and the lyrics view need attribution fields.
- Model choice is an accuracy and latency decision, not a cost decision. Keep model/provider in configuration and benchmark it with de-identified fixtures.
