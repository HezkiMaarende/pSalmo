# Five-song Song Bank acceptance trial

## Evidence checkpoint · 18 September 2026

- Implementation commit `f33be11209350218a2ddbac42b56434bb3001257` passed [CI run35308580936](https://github.com/HezkiMaarende/pSalmo/actions/runs/35308580936). TypeScript and all76 local tests pass again.
- Native/TXT import, weekly workflow and reviewed-song batch SQL fixtures pass again and roll back all synthetic changes. These verify access, snapshot isolation, atomic failure and retry protection, not phone behavior.
- A read-only query found five existing native imports and one draft service in the configured church. All five stored lyric hashes match fresh local parsing of their corresponding original files; all originals' before/after hashes match. Database settings are4/4 with null key/BPM, and source metadata supplies no artist/writer/copyright. No real song/service was created or edited by these checks.
- AJAIB KAU TUHAN remains a separate planned sample: local parsing succeeds with four sections and21 lyric lines,4/4, blank key/BPM and absent attribution. It is not one of those five existing imports; local parsing does not count as app import or visual review.
- Phone was not detected by ADB at this checkpoint. Installation, visual content review, keyboard/theme controls, confirm/cancel and song-to-service copy remain unverified. Original files, lyric text and their hashes are not retained in this document/repository.

## Prepare the device and samples

1. Use the picker-enabled development APK and Metro on8082. Keep the Metro terminal alive. After connecting an unlocked debugging-authorized phone, forward the port with `adb -s <authorized-device-serial> reverse tcp:8082 tcp:8082`; open pSalmo at `http://127.0.0.1:8082`, not Expo Go. Check the installed APK if the app reports missing ExpoDocumentPicker; Metro cannot add a native module.
2. Obtain the user's four other sample choices alongside AJAIB KAU TUHAN. Already-imported samples may be reused to exercise duplicate preview without creating replacements. Do not select different songs on the user's behalf.
3. Transfer only the chosen five files into the phone's Download/pSalmo-Trial folder via USB when connected, or send those files privately as Documents. Keep source files unchanged; do not add originals/lyrics to GitHub or public links.

## Phone acceptance — record actual results only

- [ ] Compact Song Bank rows open details by tapping the row/chevron; editor header + offers Add/Import. Back/backdrop dismiss the menu in Light/Dark and large fonts.
- [ ] Choose the five files from Song Bank → + → Import dari ProPresenter. Cancel the picker once; no songs are created.
- [ ] Review each preview against ProPresenter itself: actual headings/order, line breaks, repeated choruses, static footer/title text and credits. Match to the intended library group order, not a separately selected playback arrangement. Move/remove nonlyrics manually, preserve supplied credits, and leave unavailable metadata blank.
- [ ] No permission-note field is present. Key/BPM may remain blank; meter is4/4 unless explicitly supplied otherwise. Check keyboard and font scaling in both themes.
- [ ] Cancel/discard the preview once; reopening Song Bank leaves its existing contents unchanged. Memory-only drafts are not promised across process termination.
- [ ] Reopen, review and explicitly confirm selected nonduplicates. Record created/skipped counts; inspect every created detail and reopen after refresh. Existing duplicates stay skipped, unchanged, and need no new confirmation when zero candidates remain selected.
- [ ] Re-select the same sample set after success: normalized title+artist duplicates are skipped. Do not rename songs to bypass identity checks.
- [ ] If the response is lost, retry the same frozen batch. Inspect Song Bank before abandoning an uncertain batch; do not submit a replacement merely because the response failed.
- [ ] Add one reviewed song to an existing editable draft service through its eligible target. Verify lyrics/key/BPM/meter. Do not modify an approved service or create a test service merely to close this gate. If no eligible draft exists, record the check as deferred.

Canonical attribution is maintained on the library song; the existing service arrangement snapshots title/artist/defaults/lyrics/references, not separate writer/copyright fields. Verify attribution in Song Bank and do not claim additional snapshot fields.

## Results and expansion gate

| Gate | Verified result |
| --- | --- |
| Automated/API checks | Passed as recorded above |
| Five existing stored lyric payloads vs local source parsing | Exact matches; does not establish manual content review |
| User-selected sample set including AJAIB KAU TUHAN | Pending |
| Phone preview/import/cancel/duplicate/theme acceptance | Pending |
| Real song-to-draft copy | Pending |
| Metronome/Hermes/timing/IEM | Deferred; unchecked |

After all five chosen songs are visually verified as correct new imports or unchanged existing duplicates, continue reviewed batches of25, respecting100KiB/file and2MiB/batch. Unsupported native files use TXT fallback; unknown lyrics/settings are not invented. Fix reproducible importer bugs before expanding, then rerun TypeScript/tests/Android export/rollback fixtures/CI. No automatic import or overwrite of the725-file collection is authorized by this checkpoint.
