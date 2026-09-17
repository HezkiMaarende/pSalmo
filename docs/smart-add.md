# Smart Add: provider-neutral text review

## Implemented first subphase

Open an editable ibadah → Tambah lagu → Dari teks WhatsApp. The same flow is available from Setlist's Add screen without main tabs.

- Paste one song title per line. Numbered markers, `-`/`•` bullets and paired WhatsApp bold markers are removed locally. Every other nonempty line stays visible: this is not AI extraction of arbitrary conversation.
- Preview performs authorized service/Song Bank reads only. It does not write songs, jobs or setlist rows, and the pasted text is never sent to a provider or retained in persistent storage.
- Review/edit titles and skip headers, roster lines, instructions and unwanted repeats yourself. Order and deliberate repetitions are preserved. Key, BPM, roles, artist and lyrics are not inferred from the message.
- A unique normalized exact title match selects a Song Bank snapshot for review; multiple artists with the same title require explicit selection. You can switch to a service-only manual title. Similar/fuzzy titles are not silently matched.
- Confirm the selected batch explicitly. The authenticated invoker/RLS RPC rechecks service-edit access, serializes append, locks the setlist and requires the preview's revision. Any invalid/foreign library song or invalid entry rolls back the entire batch, including the revision. A stale preview returns HTTP409 and must be regenerated; it is not automatically retried.
- Canonical matches copy current library title, artist, key/BPM/meter, lyrics and ordered reference records at commit. Manual titles create service-only arrangements with4/4 and no invented BPM. Neither path changes the Song Bank, other ibadah or audio algorithm.
- Input limit:10,000 characters,1–50 nonempty lines,200 characters per title. Drafts have a leave/discard guard and remain mounted during access refresh. Drafts are memory-only: do not rely on persistence after process termination. Permissions can disable confirmation after refresh.

## Future AI/server subphase — not implemented

- Choose provider/model using de-identified Indonesian fixture lists and accuracy/latency evaluation. No provider, cost commitment or secrets are assumed.
- Define privacy notice and explicit consent before sending pasted messages/documents externally. PDF/DOCX import waits for that workflow.
- Guard/rate-limit the Edge Function; separate untrusted pasted material from model instructions; validate structured candidate output and preserve mandatory review.
- Encrypt server-retained raw input, delete after30days, expire jobs and implement one-time/idempotent confirmation. The existing SmartAddJob table is unused by local review; local processing does not claim these server lifecycle requirements have been delivered.
- Add conservative matching evaluation and investigate medley grouping. Unknown candidates remain service-only until separately authorized library promotion.

## Evidence / remaining device checks

Pure-domain and mocked component tests cover limits, list-marker parsing, repeated/untrusted lines, exact/ambiguous matching, reviewed payloads, no preview writes, explicit confirmation, disabled controls and drafts surviving commit failure. Supabase rollback fixtures cover snapshots/order/repeats, stale revision, ordinary/off-duty/kicked denial, foreign-song batch rollback and canonical snapshot independence.

Real Android clipboard/keyboard/large-font rendering, discard/cancel/Back, reload while a draft is active and two-user concurrent review remain acceptance checks. These tests do not validate metronome playback, Hermes or IEM safety.
