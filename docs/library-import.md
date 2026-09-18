# ProPresenter repertoire import

## Prepare the source

Choose **one song per file**: native PP7 `.pro` or a `.txt` export. `.propresenter` is accepted only when it contains the supported PP7 binary format; older XML/bundles/media are not supported. For the text fallback, use ProPresenter **File → Export → Text** (or the presentation's Export Text action). Multi-song presentations/exports must be split per song; the importer does not guess song boundaries. See [Renewed Vision's export guide](https://learn.renewedvision.com/propresenter/working-with-files) and [native parsing boundaries](propresenter-native.md).

The app does not verify or collect a permission-basis note. Reviewers remain responsible for using material they are permitted to store/share, and preserving writer/translator credits and required copyright notices. No permission is inferred from file selection or stored as a fabricated note. No website scraping, AI lyric generation or public redistribution is implemented.

## Import on Android

1. Install the newly rebuilt development APK (`artifacts/psalmo-development-arm64-v8a.apk`) on an authorized USB-debugging phone; restart Metro using your established development workflow. To build and install together, use `npm run build:android -- -Install -DeviceId <serial-from-adb-devices> -MetroPort 8082`, then `npm run start:dev -- --localhost --port 8082`. Older binaries can still open other pages, but importing will report a missing native module. Use `build:share` separately if preparing a standalone APK for remote testers.
2. Open **Song Bank → + menu → Import dari ProPresenter** as admin/PIC or a permanently authorized song editor (service duty is not required for library maintenance). The same small header menu contains **Tambah lagu baru**; tap a compact song row/chevron to open details.
3. Trial **5–10 songs** first. Select up to50 `.txt`/`.pro`/supported `.propresenter` files,100KiB/file and2MiB total. TXT supports UTF-8/BOM UTF-16; native files use bounded protobuf/RTF parsing. Unsupported/blank/corrupt selections fail with a text-export fallback message. Cache copies belonging to this picker invocation are removed after reading, including error paths; original files are never deleted. Cleanup failures are reported.
4. Review each filename-derived title and plain lyrics. TXT section headings, empty lines and repeated choruses stay intact; only line endings normalize to LF. Native adds actual group headings, trims line edges and collapses identical whole elements in the same slide, not repeated lyrics/choruses across slides. Group order is not the selected playback arrangement. Inspect static footer/title text manually; available CCLI attribution is prefilled but not independently verified. Edit artist, writer/translator credits, copyright notice, key, BPM and birama. Defaults:4/4, blank key/BPM—no musical settings are invented.
5. Duplicate title+artist identities are case/whitespace-insensitive; missing artist means empty. Existing and repeated candidates default to skipped. Change a title/artist only when it genuinely identifies a different song/version; existing songs cannot be replaced by this importer.
6. Explicitly confirm the reviewed selection; no permission-basis field is required. Preview does not write to Supabase or send source files/lyrics to an external AI provider. Only reviewed selected canonical song data is uploaded at confirmation.
7. Inspect the created/skipped result and links. A duplicate created by another editor since preview will be reported as skipped. Repeat in batches only after checking the trial against the source files.

## Failure and access behavior

- Confirmed requests are immutable and retain their UUID/payload after network/server failure. **Coba ulang batch yang sama** uses that same request; the private receipt returns the original result if the first request actually succeeded.
- Reusing a UUID with altered data produces a conflict. Invalid entries roll back all new songs and the receipt. Existing songs/references and service arrangements are not overwritten.
- Discard/Back warns about memory-only drafts; busy work blocks leaving. If abandoning an uncertain request, check Song Bank first—the server operation may already have completed. Drafts and retry payloads are not persisted across process termination.
- Membership/library permissions are checked again server-side before every import or receipt replay. Kicked users cannot replay receipts. Private receipts are inaccessible through direct authenticated table queries.
- Imported songs record `propresenter_text` or `propresenter_native` and source filename. New app imports leave permission basis null; older notes remain intact, and compatible older clients can still send a note. Canonical edits keep provenance. Adding songs to a service uses the existing snapshot workflow; later canonical edits do not alter that service.

## Verification boundaries

Pure-domain, adapter/API and mocked component tests exercise encodings, content/limits, local-only previews, cache ownership, duplicate review, frozen retries, permissions and dirty guards. `supabase/tests/library_text_import.sql` tests the new RPC with rollback-only fixtures; existing weekly and reviewed-song fixtures are also rerun. Live concurrent authenticated-role transactions were exercised against a disposable workspace, then that workspace/account and all its songs/receipts were removed.

Native picker/filesystem compilation and signed arm64 development APK creation pass. Broad storage permissions are explicitly blocked in Expo configuration and checked in actual APKs before build publication. The development APK needs Metro; it is not the standalone WhatsApp preview.

Actual Android file providers, picker/cancel, keyboard/font scaling, both themes, access refresh and retry touch behavior still require phone acceptance. A representative native file passed read-only local parsing (see native notes), but no church repertoire population or lyric-rights verification is claimed. Metronome/Hermes/timing/IEM acceptance remains deferred and unchecked.
