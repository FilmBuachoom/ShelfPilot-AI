# Production AI remaining-state test — 2026-11-22

Target: https://shelf-pilot-ai.vercel.app, deployed main at the start of the test: `b4b8b5ee7098caa651c5440755e209a086ebef38`. The browser session was authenticated by the user.

## Results

| Case | Result | Evidence |
| --- | --- | --- |
| Shelf confirmation | Pass | The assistant proposed adding แกล้งนักรัก (แล้ว) นะรู้ยัง? manga volume 6. After confirmation, the shelf changed from 4 series / 5 volumes / 1 missing to 4 series / 6 volumes / 0 missing. The change persisted after reload and Supabase reported `book-dexpress-943fd57fdc4a-manga-6` as owned. |
| Title alias | Pass for English alias | Asking for “The Angel Next Door Spoils Me Rotten” light novel volume 12 returned ขาดคุณนางฟ้าข้างห้องไป ผมคงมีชีวิตต่อไปไม่ได้อีกแล้ว volume 12, light novel, with an Animag citation. |
| Ambiguous edition | Pass | Asking for the latest volume of the same alias without an edition prompted a choice between manga and light novel. Replying light novel returned volume 12 and a light-novel book card. |
| Review resolution | Pass | Imported the existing Vibulkij GTO PARADISE LOST volume 14 announcement without an edition, resulting in review `rv_f2730f4cc56e`, source `src_6fe75fbd3e34`, and candidate manga `book-vibulkij-ce1434e00f31-manga-14`. The source catalog identifies it as manga. Selected that candidate and confirmed merge. The queue count returned from 15 to 14; a read of Supabase confirmed the review status `resolved` and the source attached to that book. |
| Edition mismatch | Pass for one same-title/same-volume pair | Two existing Phoenix Next announcements for เพื่อนคนแรกของผมคือสาวสวยอันดับสองของห้อง volume 8 matched to separate manga and light-novel book IDs. Supabase confirmed manga source `src_2601b69ae084` was attached only to the manga book and light-novel source `src_95bc95904947` only to the novel book. |

No defects were observed in these cases, so no application code was changed. This is a targeted test, not a guarantee for all names, editions or intermittent failures. Screenshots were not saved; evidence comes from browser observations and read-only Supabase checks.

## Persistent test changes

- Added `book-dexpress-943fd57fdc4a-manga-6` to the shared demo shelf. It was not removed after the test.
- Resolved review `rv_f2730f4cc56e` and attached source `src_6fe75fbd3e34` to the existing GTO manga volume 14.
- Attached sources `src_2601b69ae084` and `src_95bc95904947` to their respective existing Phoenix manga and light-novel volume 8 entries.
