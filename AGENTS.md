# AGENTS.md

This file provides guidance to Codex (and other agents that read `AGENTS.md`) when working with code in this repository.

<!--
  Source of truth for AI instructions. After editing this file or anything in
  .agents/rules/, regenerate the Copilot copies (pre-commit does it too):
      python3 .agents/scripts/sync_copilot.py
  This file loads on every session: keep it short and only write what the agent
  cannot infer from the code. Stack conventions belong in .agents/rules/.
-->

## ภาษาในการสื่อสาร

**ตอบผู้ใช้เป็นภาษาไทยเสมอ** ไม่ว่าผู้ใช้จะถามมาเป็นภาษาใด (ศัพท์เทคนิค ชื่อไฟล์ ชื่อฟิลด์ และโค้ดใช้ภาษาอังกฤษได้ตามปกติ)

## สถานะ Repository

โครง Next.js อยู่ใน `web/` พร้อม JSON Schema ใน `schemas/` และไฟล์ข้อมูลเริ่มต้นใน `data/`

## ภาพรวมผลิตภัณฑ์

**ShelfPilot AI** — ผู้ช่วยค้นหาหนังสือเล่มและจัดการหนังสือสะสมสำหรับผู้อ่านมังงะ/ไลต์โนเวลในไทย ปัญหาหลัก: ประกาศหนังสือออกใหม่กระจายตามโซเชียลของแต่ละสำนักพิมพ์ และชื่อเรื่องไทย/ญี่ปุ่น ฉบับพิมพ์ เลขเล่ม ระบุไม่ตรงกัน Brief ฉบับเต็ม (use case, เหตุผลของแต่ละฟีเจอร์): `docs/brief.md`

- บริบท: Hackathon 1 วัน (10:00–16:45 หักพักเที่ยง 1 ชม. ≈ 5–6 ชม. ทำงานจริง) → เลือกทางที่เร็วและเดโมได้ครบ flow มากกว่าความสมบูรณ์แบบ
- **ฟีเจอร์ Required: 1 (Collection-Aware Chatbot) และ 3 (Explainable Recommendation)** — ถ้าเวลาไม่พอ ตัดฟีเจอร์อื่นก่อน
- MVP ใช้แค็ตตาล็อกขนาดเล็กจากประกาศ สนพ. ที่ได้รับอนุญาตเท่านั้น และต้องทดสอบ 3 เคสหลัก: **ประกาศซ้ำ**, **ชื่อเรียกหลายแบบ (ไทย/ญี่ปุ่น/ชื่อย่อ)**, **ฉบับพิมพ์ไม่ตรงกัน**
- ตัวชี้วัด: ความแม่นยำในการจับคู่, ประโยชน์ของการแจ้งเตือน, จำนวนคลิกไปหน้าซื้อสินค้า

## Tech Stack

ทีมตกลงใช้ **Next.js (TypeScript) ทั้ง Frontend และ Backend** — แอปเดียวใน `web/` ไม่มี service Python (Python ใช้แค่ tooling ใน `.codex/` และ `.agents/scripts/`)

- Frontend + Backend: Next.js — UI, API routes และ Ingestion pipeline (Extractor / Matcher / Disambiguator) เป็น TypeScript ทั้งหมด
- Database: Supabase หรือ MongoDB Atlas (ยังไม่ได้ตัดสินใจ) — ช่วง MVP ใช้ไฟล์ `catalog.json` / `user_shelf.json`
- Deployment: **Vercel** (API route เรียก LLM ฝั่ง server — ห้ามฝัง API key ฝั่ง client)
- AI: OpenAI (ChatGPT) API — Function Calling + Structured Outputs (JSON Schema)
- Local fuzzy search: `Fuse.js`

## โครงสร้างโฟลเดอร์ (ข้อเสนอ — ปรับได้)

| Path | เนื้อหา |
|---|---|
| `web/` | Next.js — UI + API routes (เรียก OpenAI ฝั่ง server เท่านั้น) |
| `web/lib/ingest/` | Ingestion pipeline — Extractor / Matcher / Edition Disambiguator (เรียกจาก API route ของหน้า Admin "Import / Extract") |
| `data/` | `catalog.json`, `user_shelf.json`, `review_queue.json` (ข้อมูล MVP) |
| `schemas/` | JSON Schema ของข้อมูลทั้งหมด — **สัญญากลาง** ของไฟล์ใน `data/`, TypeScript types และ Structured Outputs ต้องตรงกัน |
| `design/` | สำเนาอ้างอิง (read-only snapshot) ของ Design System "ShelfPilot AI" (`shelfpilot-ds/`: tokens, README และ preview ของ component) + ไฟล์ Figma wireframe (`figma/`) — ไม่ใช่โค้ดที่ build; ที่มาและกติกาอยู่ใน `design/README.md` |

ถ้าเปลี่ยนโครงสร้างนี้ ให้แก้ `paths:` ใน `.agents/rules/*.md`, ตาราง "อ่านก่อนแก้" ด้านล่าง และ regex ใน `.codex/hooks/protect_files.py` ตามด้วย

## อ่านก่อนแก้ (Rule files)

Codex ไม่โหลด rule file ให้อัตโนมัติ — **อ่านไฟล์ที่ตรงกับ path ที่จะแตะก่อนเริ่มงานทุกครั้ง**

| เมื่อแตะ | อ่าน |
|---|---|
| `web/**/ingest/**` | `.agents/rules/ingest.md`, `.agents/rules/llm.md`, `.agents/rules/data-contract.md` (+ `.agents/rules/web.md`) |
| `web/**` | `.agents/rules/web.md` (+ `.agents/rules/llm.md` ถ้าแตะ `api/`, `server/`, `lib/`; + `.agents/rules/data-contract.md` ถ้าแตะ `types/`, `lib/`; + `design/shelfpilot-ds/README.md` และ `components/<ชื่อ>/README.md` ของ component ที่จะสร้าง ถ้าแตะ UI) |
| `design/**` | `design/README.md` (ห้ามแก้เนื้อหา — นำเข้าใหม่ทับทั้งโฟลเดอร์เท่านั้น) |
| `schemas/**`, `data/**` | `.agents/rules/data-contract.md` |
| `**/prompts/**` | `.agents/rules/llm.md` |

Skills ของโปรเจกต์อยู่ใน `.agents/skills/` (Codex โหลดให้เอง)

## สถาปัตยกรรม: 3 LLM Hubs

ทุกการเรียก LLM ต้องอยู่ใน 1 ใน 3 hub นี้เท่านั้น รายละเอียดอยู่ใน rule file (ดูตารางด้านบน)

| Hub | ฟีเจอร์ | Trigger | สรุป | Rule |
|---|---|---|---|---|
| Ingestion Pipeline | 4+5+6 | แอดมินกด "Import / Extract" | Extractor (LLM) → Matcher (fuzzy + LLM) → Disambiguator (โค้ด, threshold 0.8) → `match_status` | `ingest.md`, `data-contract.md` |
| Chat Hub | 1+2 | ผู้ใช้พิมพ์ในแชท | โมเดลเล็ก + Function Calling; `propose_shelf_update` หยุดที่ Approval Gate; ปุ่มลัด 0-Token | `web.md`, `llm.md` |
| Recommendation | 3 | เปิดแท็บ / กดอัปเดต / ข้อมูลเปลี่ยน | โค้ดนับเล่มขาด → LLM แนะนำ 2 กลุ่มพร้อมเหตุผล + รายการออกใหม่เฉพาะบุคคล / แจ้งเตือนเล่มที่ขาด; cache | `llm.md` |

## กฎที่ต้องรักษาทุกจุด (Core Rules)

- **ห้ามส่ง JSON ทั้งก้อนเข้า LLM** — local search + ตัดฟิลด์ (URL, รูปปก) ก่อนใส่ prompt
- **ID-Based Citation** — LLM อ้างอิงได้เฉพาะ `book_id` / `source_id`; URL มาจาก hydrate ฝั่ง frontend; ไม่มีข้อมูลให้ตอบตรงๆ
- **Approval Gate** ก่อนแก้ไขคลังหนังสือของผู้ใช้ทุกครั้ง
- **Confirmation Modal** ยืนยันชื่อเรื่อง–เลขเล่ม–ฉบับพิมพ์ ก่อนพาไปหน้าร้านค้า
- งาน deterministic (นับเล่มขาด, ตรวจ threshold, ปุ่มลัด) ทำด้วยโค้ด ไม่ใช่ LLM
- ไม่มั่นใจว่าเป็นเล่มเดียวกัน → `needs_review` แทนการเดา
- **`schemas/` คือสัญญากลาง** — แก้ shape ต้องแก้ schema + TypeScript types ใน commit เดียวกัน
- **UI ตาม Design System ใน `design/shelfpilot-ds/`** — คลังต้องใช้งานครบได้โดยไม่ต้องพึ่ง AI, ปุ่ม `action` สีส้มไม่เกิน 1 ปุ่มต่อหน้าจอ, ข้อมูลจากแค็ตตาล็อกแสดงผ่าน component (BookCard / VolumeStrip / CitationChip) ไม่ใช่ข้อความหรือ URL ดิบ (รายละเอียดใน `.agents/rules/web.md`)

## คำสั่งที่ใช้บ่อย

รันคำสั่งจาก `web/`

| งาน | คำสั่ง |
|---|---|
| ติดตั้ง dependencies | `npm ci` |
| Dev (web) | `npm run dev` |
| Build / Start | `npm run build` / `npm start` |
| Test / Test เดี่ยว | `npm test` / `npm test -- tests/normalize.test.ts` |
| Lint / Typecheck | `npm run lint` / `npm run typecheck` |
| สร้าง TypeScript types จาก schema | `npm run gen:types` |

## Git and PRs

- Default branch: `main`. Branches: `feature/`, `fix/`, `hotfix/`, `chore/`, `refactor/`, `docs/` + short kebab-case; ticket ID first when there is one.
- Commits: Conventional Commits (`feat(scope): …`, `fix: …`, `chore: …`).
- Write PRs in English unless the user asks for Thai. No template in `.github/PULL_REQUEST_TEMPLATE/` yet — `pr-description` uses its default.
- Issues go to GitHub Project "ShelfPilot AI" (`.github/issue-config.yml`).

## ถามก่อนทำ (Ask first)

- เพิ่ม dependency ใหม่ (npm) — hook จะถามให้อัตโนมัติ
- เปลี่ยนค่าใน enum `edition` หรือ `match_status`, หรือเปลี่ยน threshold 0.8
- แก้ไฟล์ใน `schemas/` หรือข้อมูลจริงใน `data/*.json` ด้วยมือ
- เลือก database (Supabase / MongoDB) — ยังเป็นการตัดสินใจของทีม
- เพิ่มจุดเรียก LLM ที่อยู่นอก 3 hub

## ห้ามทำ (Never)

- ใส่ OpenAI key ในโค้ด, ใน `NEXT_PUBLIC_*`, หรือเรียก OpenAI จาก browser (`dangerouslyAllowBrowser`) — hook บล็อกไว้แล้ว
- แต่งข้อมูลหนังสือ / ประกาศขึ้นเองใน catalog — ใช้เฉพาะประกาศ สนพ. ที่ได้รับอนุญาต
- ให้ LLM ตัดสิน threshold, นับเล่มขาด หรือเขียนลง `user_shelf.json` โดยไม่ผ่าน Approval Gate
- ปิด / ข้าม test หรือ hook เพื่อให้ผ่าน (`--no-verify`); ทิ้ง `print()` / `console.log()` debug ใน commit
- แก้ไฟล์ `.env` (แก้ `.env.example` แทน) หรือ commit secret
- แก้ไฟล์ใน `design/` — ถ้า design system ต้นฉบับเปลี่ยน ให้นำเข้าใหม่ทับทั้งโฟลเดอร์; ถ้าต้องปรับ token/CSS ให้แก้ในสำเนาที่ใช้งานจริงใน `web/`
- Touch files unrelated to the task, including drive-by formatting.

<!-- codex-only -->
Editing `.env` files or `design/`, writing an OpenAI key, bypassing git hooks, committing secrets, and pushing from `main` are blocked by hooks in `.codex/hooks.json` (each teammate must trust them once via `/hooks`). Codex hooks cannot *ask*, so the "Ask first" list above is on you: stop and ask in chat before doing any of it.
<!-- /codex-only -->
<!-- copilot-only
Adding dependencies, editing `.env` files, bypassing git hooks, and committing secrets are also checked by pre-commit hooks (gitleaks).
-->
