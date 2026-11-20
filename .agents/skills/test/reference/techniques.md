# Techniques that work in a driven browser

## Read results through the API, not the screen

A same-origin `fetch()` run in the signed-in tab (the browser tool's JavaScript action) carries
the session cookie, so it reads exactly what the app stored:

```js
const r = await fetch('/api/<resource>?search=<id>').then(r => r.json()); JSON.stringify(r).slice(0, 1500)
```

- Check who is signed in (`session_check` in the config) whenever data looks empty.
- Record the field that proves the row (an id, a total, a flag) in the report.
- Put a wait inside the script (`await new Promise(r => setTimeout(r, 20000))`) when the app has
  an undo window before a record settles.
- The project's checklist names the endpoints for each row; add new ones there after the run.

## Public pages without a session

`curl -s <url>` sends no cookies, so it proves a page or API is public (shared links, receipts,
invitations). Check the status, the content type and a field that must be present.

## Two views at once

Open a second tab for a second screen (customer display, admin, a guest's view) and read it with
the text-extraction action while the first tab acts. **Bring a tab to the front before taking
its screenshot** — background tabs can capture tiled or blank.

## Proving a download happened

A driven browser may not save downloads. Hook the anchor click and read the blob instead:

```js
window.__dl=[]; const o=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){ if(this.download){ window.__dl.push({name:this.download});
  fetch(this.href).then(r=>r.blob()).then(b=>window.__dl.push({size:b.size,type:b.type})); return; }
  return o.call(this); };
```

Click the button, then read `window.__dl` (expect the type and a non-zero size).

## Language and cut-off text

- Switch language with the app's menu, or set the cookie the config names
  (`document.cookie='<locales.cookie>=<code>; path=/'`) and navigate. Set it back afterwards.
- Truncation scan: load each page in an invisible same-origin iframe at the target width
  (375 px for a phone) and list leaf elements with `scrollWidth > clientWidth + 1` and
  `overflow` ≠ `visible` or `text-overflow: ellipsis`. **Run it async with results on
  `window`** (a single JavaScript call times out around 45 s) and poll. One scan at a time —
  two race on the language cookie.
- Icon buttons with hidden labels and one-line summaries are truncated by design; confirm real
  hits with a screenshot at that width.

## Viewports for screenshots

| Device | Size (CSS px) |
|---|---|
| iPhone 16 Pro | 402 × 874 |
| Phone (generic) | 375 × 812 |
| iPad Pro 13" landscape | 1376 × 1032 |
| iPad (portrait) | 768 × 1024 |

The browser may scale a size larger than its window down to fit — say so in the report. Reset
to desktop when done. A screenshot's file path is in the tool result; copy it to
`<report_dir>/screenshots/<what>-<device>.jpg`.

## Making test data

- Use the UI for the row under test; seed **other** data through the API when the form would
  take long (and say so).
- Dates: make anything date-bound span today **and tomorrow** in the config's `timezone`, so a
  midnight rollover doesn't end it mid-test.
- Name everything "QA …" and keep a running list for the report.

## Email

Read mail with a mail tool only for addresses it can reach (`accounts.mail` says how). Search a
narrow window (`newer_than:1h`), quote the line the row asks for, and note the sender — a
staging sender name shows the mail came from the right environment.
