# Encrypted offline ibadah

## Scope

pSalmo keeps a read-only snapshot for the next four Sundays. Sunday itself is
included. The snapshot contains the signed-in user's current church role and
display name, the RLS-visible schedules/services, and sanitized service detail
(roster display labels, setlist snapshots, notes, and reference labels/URLs).

The snapshot deliberately excludes authentication tokens, email addresses,
roster account/person links, the Song Bank catalogue, source import files, and
downloaded media. Assignment identifiers that could reveal account linking are
replaced with `null` before encryption.

## Storage and validity

- A dedicated random 256-bit key is stored in Android Keystore/iOS Keychain via
  SecureStore. It is not the Supabase session-storage key.
- Authenticated AES-GCM ciphertext is stored in AsyncStorage. Tampering, a lost
  key, an invalid schema/version, or an incomplete key/data pair clears the
  snapshot instead of returning partial data.
- Membership is valid offline for seven days from the most recent successful
  online membership check. A schedule request alone cannot extend this time.
- The full snapshot refresh is throttled to 15 minutes, replaces one ciphertext
  value atomically, and excludes archived/cancelled services.
- Sign-out, account mismatch, a missing/revoked membership, expiry, corruption,
  or a permission-denied refresh clears the snapshot.

## Runtime behavior

Only recognized transport/network failures may fall back to the cache. RLS,
authorization, server, and validation failures remain visible and never use
stale data. Home, Jadwal, and cached service detail display an OFFLINE/read-only
notice. Editors, Practice/new click starts, YouTube/external media, Song Bank,
and all writes require a freshly verified online membership.

An already-running native metronome is not stopped merely because the network
becomes unavailable. Starting a new one is blocked offline.

Profil → Data Offline shows sync/verification/expiry times and cached service
count, and provides explicit refresh and clear actions.

## Device acceptance (still required)

The 3 October 2026 pilot baseline reruns all 83 automated tests, including
encryption round-trip, tamper/wrong-key rejection and the exact seven-day
boundary. The Android JavaScript export and Supabase rollback suites also pass.
These remain automated evidence only; use the private non-live matrix in
[pilot-readiness.md](pilot-readiness.md) for actual phone results.

1. While online, open Profil → Data Offline and tap **Perbarui data offline**.
2. Confirm the service count and timestamps, then disable Wi-Fi/mobile data.
3. Cold-open the app and inspect Home, the relevant four-Sunday schedule, an
   accessible approved service, and an accessible editor draft.
4. Confirm the OFFLINE badge and read-only notices; verify no edit, create,
   publish, import, video, Practice, or Song Bank action remains usable.
5. Re-enable connectivity and verify membership before writes return.
6. Test account switch, sign-out, manual clear, corrupt/missing storage, a
   seven-day-expired fixture, and a kicked account. No cached church content may
   remain available after those cases.
7. Repeat in Light/Dark themes and with a locked/backgrounded app.

These checks require an actual device. Automated encryption/domain/UI contracts
and an Android JavaScript export do not establish device or Hermes acceptance.
