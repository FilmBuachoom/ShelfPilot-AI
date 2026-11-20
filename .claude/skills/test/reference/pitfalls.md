# Pitfalls of testing through a driven browser

Generic ones. Project-specific traps belong in the checklist file's "Project traps" section.

| Pitfall | What happens | Do |
|---|---|---|
| Sheets and dialogs animate | A click 0–1 s after opening lands on nothing or closes the sheet | Wait 2–3 s between steps; screenshot before clicking; don't batch blind past a transition |
| Buttons move | A button disappears (an undo after its timeout) and the next one shifts | `find` the element or re-screenshot before each click |
| Taps ignored right after a screen change | The first taps after a transition do nothing | Wait; report only as "not confirmed" unless reproduced on a device |
| Background-tab screenshots | Captured tiled or blank | Bring the tab to the front first |
| Hidden duplicate refs | "ref is outside the viewport" (a mobile copy of the same control) | Use the other match, or scroll it into view |
| Rich-text editors (Quill, contenteditable) | Select-all shortcuts don't work; focus can stick to one editor | Triple-click + Delete to clear; check `document.activeElement`; report a real focus bug |
| Native selects | Their dropdown doesn't render in screenshots | Set them with the form-input action |
| Date pickers | First click sets the start, second the end; a past click resets the start | Click start then end, then zoom to read the field |
| Midnight in `timezone` | "Today" changes; one-day records end; opened-yesterday prompts appear | Span today + tomorrow; expect the rollover |
| Changes made elsewhere | An open page doesn't pick up a record created in another tab or via the API | Reload before calling it a bug; report if the app should have updated live |
| Snapshots | Old records keep the settings they were made with | Check a settings change on a **new** record |
| Clipboard | The driven browser denies `clipboard.writeText` | The app's "couldn't copy" is it handling that; mark ⚠️ environment |
| Offline | Usually can't be simulated (fetch bound at load, no network switch) | ⬜, ask for a device test |
| Session swaps | Signing up or in replaces the session; data suddenly "empty" | Check the session before calling it a bug |
| Language bleed | The language choice is per browser; every tab changes | Set it back after a language check |
| Long scripts | A JavaScript call gives up around 45 s | Run in the background on `window`, poll |
| Two scans at once | Racing on a shared cookie mixes results | One at a time |

## Before calling something a bug

1. Reproduce once more (reload, other tab).
2. Rule out every row above.
3. Find the code (`file:line`) and the project's rule for it — "by design" goes in the report's
   notes, not the bug table.
