# ProPresenter repertoire import

## Prepare the source

In ProPresenter, export each song using **File → Export → Text** (or the presentation's Export Text action). Use **one song per `.txt` file**. Multi-presentation exports must be split/exported per song; the importer does not guess song boundaries. See [Renewed Vision's export guide](https://learn.renewedvision.com/propresenter/working-with-files).

Permission for storing/sharing the lyrics in this church app is user-confirmed, not independently audited. Preserve writer/translator credits and required copyright notices. Do not enter passwords, private tokens or other secrets into the permission-basis note. No website scraping, AI lyric generation or public redistribution is implemented.

## Import on Android

1. Install the newly rebuilt development APK (`artifacts/psalmo-development-arm64-v8a.apk`) on an authorized USB-debugging phone; restart Metro using your established development workflow. To build and install together, use `npm run build:android -- -Install -DeviceId <serial-from-adb-devices> -MetroPort 8082`, then `npm run start:dev -- --localhost --port 8082`. Older binaries can still open other pages, but importing will report a missing native module. Use `build:share` separately if preparing a standalone APK for remote testers.
2. Open **Song Bank → Import dari ProPresenter** as admin/PIC or a permanently authorized song editor (service duty is not required for library maintenance).
3. Trial **5–10 songs** first. Select up to50 `.txt` files,100KiB/file and2MiB total. UTF-8 (with/without BOM) and BOM-marked UTF-16 LE/BE are supported; blank, malformed and binary files reject the selection. Cache copies belonging to this picker invocation are removed after reading, including error paths; original files are never deleted. Cleanup failures are reported.
4. Review each filename-derived title and plain lyrics. Section headings, empty lines and repeated choruses stay intact; only line endings normalize to LF. Remove exported footer text from lyrics manually if it belongs in attribution. Edit artist, writer/translator credits, copyright notice, key, BPM and birama. Defaults:4/4, blank key/BPM—no musical settings are invented.
5. Duplicate title+artist identities are case/whitespace-insensitive; missing artist means empty. Existing and repeated candidates default to skipped. Change a title/artist only when it genuinely identifies a different song/version; existing songs cannot be replaced by this importer.
6. Enter the permission basis, then explicitly confirm. Preview does not write to Supabase or send source files/lyrics to an external AI provider. Only reviewed selected canonical song data is uploaded at confirmation.
7. Inspect the created/skipped result and links. A duplicate created by another editor since preview will be reported as skipped. Repeat in batches only after checking the trial against the source files.

## Failure and access behavior

- Confirmed requests are immutable and retain their UUID/payload after network/server failure. **Coba ulang batch yang sama** uses that same request; the private receipt returns the original result if the first request actually succeeded.
- Reusing a UUID with altered data produces a conflict. Invalid entries roll back all new songs and the receipt. Existing songs/references and service arrangements are not overwritten.
- Discard/Back warns about memory-only drafts; busy work blocks leaving. If abandoning an uncertain request, check Song Bank first—the server operation may already have completed. Drafts and retry payloads are not persisted across process termination.
- Membership/library permissions are checked again server-side before every import or receipt replay. Kicked users cannot replay receipts. Private receipts are inaccessible through direct authenticated table queries.
- Imported songs record `propresenter_text`, source filename and permission basis. Canonical edits keep provenance. Adding them to a service uses the existing snapshot workflow; later canonical edits do not alter that service.

## Verification boundaries

Pure-domain, adapter/API and mocked component tests exercise encodings, content/limits, local-only previews, cache ownership, duplicate review, frozen retries, permissions and dirty guards. `supabase/tests/library_text_import.sql` tests the new RPC with rollback-only fixtures; existing weekly and reviewed-song fixtures are also rerun. Live concurrent authenticated-role transactions were exercised against a disposable workspace, then that workspace/account and all its songs/receipts were removed.

Native picker/filesystem compilation and signed arm64 development APK creation pass. Broad storage permissions are explicitly blocked in Expo configuration and checked in actual APKs before build publication. The development APK needs Metro; it is not the standalone WhatsApp preview.

Actual Android file providers, picker/cancel, keyboard/font scaling, both themes, access refresh and retry touch behavior still require phone acceptance. No real ProPresenter files have been supplied yet: no church repertoire or lyric-rights verification is claimed. Metronome/Hermes/timing/IEM acceptance remains deferred and unchecked.
