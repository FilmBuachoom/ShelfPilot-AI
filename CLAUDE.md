# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!--
  Source of truth for AI instructions. After editing this file or anything in
  .claude/rules/ or .claude/agents/, regenerate the Copilot copies:
      python3 .claude/scripts/sync_copilot.py
  This file loads on every session: keep it under ~100 lines and only write what
  Claude cannot infer from the code. Stack conventions belong in .claude/rules/.
  HTML comments like this one are stripped before Claude reads the file.
-->

## ภาษาในการสื่อสาร

**ตอบผู้ใช้เป็นภาษาไทยเสมอ** ไม่ว่าผู้ใช้จะถามมาเป็นภาษาใด (ศัพท์เทคนิค ชื่อไฟล์ ชื่อฟิลด์ และโค้ดใช้ภาษาอังกฤษได้ตามปกติ)

## สถานะ Repository

ณ ตอนสร้างไฟล์นี้ repo ยังว่าง (ยังไม่มีโค้ด, `package.json`, `pyproject.toml` หรือคำสั่ง build/test) — เมื่อเพิ่มโครงสร้างโปรเจกต์แล้วให้อัปเดตส่วน "คำสั่งที่ใช้บ่อย" ด้านล่างด้วยคำสั่งจริง อย่าเดาคำสั่งที่ยังไม่มีอยู่

## ภาพรวมผลิตภัณฑ์

**ShelfPilot AI** — ผู้ช่วยค้นหาหนังสือเล่มและจัดการหนังสือสะสมสำหรับผู้อ่านมังงะ/ไลต์โนเวลในไทย ปัญหาหลัก: ประกาศหนังสือออกใหม่กระจายตามโซเชียลของแต่ละสำนักพิมพ์ และชื่อเรื่องไทย/ญี่ปุ่น ฉบับพิมพ์ เลขเล่ม ระบุไม่ตรงกัน

- บริบท: Hackathon 1 วัน (10:00–16:45 หักพักเที่ยง 1 ชม. ≈ 5–6 ชม. ทำงานจริง) → เลือกทางที่เร็วและเดโมได้ครบ flow มากกว่าความสมบูรณ์แบบ
- MVP ใช้แค็ตตาล็อกขนาดเล็กจากประกาศ สนพ. ที่ได้รับอนุญาตเท่านั้น และต้องทดสอบ 3 เคสหลัก: **ประกาศซ้ำ**, **ชื่อเรียกหลายแบบ (ไทย/ญี่ปุ่น/ชื่อย่อ)**, **ฉบับพิมพ์ไม่ตรงกัน**
- ตัวชี้วัด: ความแม่นยำในการจับคู่, ประโยชน์ของการแจ้งเตือน, จำนวนคลิกไปหน้าซื้อสินค้า

## Tech Stack

ทีมถนัด Python เป็นหลัก

- Frontend: Next.js
- Backend: Next.js (API routes) และ/หรือ Python
- Data/ingestion: Python
- Database: Supabase หรือ MongoDB Atlas (ยังไม่ได้ตัดสินใจ) — ช่วง MVP ข้อมูลอ้างถึงเป็นไฟล์ `catalog.json` / `user_shelf.json`
- Deployment: Vercel หรือ GitHub Pages — หมายเหตุ: GitHub Pages เป็น static hosting รัน API route/เรียก LLM ฝั่ง server ไม่ได้ และห้ามฝัง API key ฝั่ง client ถ้าต้องใช้ LLM ผ่าน backend ให้ใช้ Vercel
- AI: OpenAI (ChatGPT) API — ใช้ Function Calling และ Structured Outputs (JSON Schema)
- Local fuzzy search: `Fuse.js` (ฝั่ง JS) / `RapidFuzz` (ฝั่ง Python)

## โครงสร้างโฟลเดอร์ (ข้อเสนอ — ปรับได้)

| Path | เนื้อหา |
|---|---|
| `web/` | Next.js — UI + API routes (เรียก OpenAI ฝั่ง server เท่านั้น) |
| `ingest/` | Python — Extractor / Matcher / Edition Disambiguator, script นำเข้าประกาศ |
| `data/` | `catalog.json`, `user_shelf.json`, `review_queue.json` (ข้อมูล MVP) |
| `schemas/` | JSON Schema ของข้อมูลทั้งหมด — **สัญญากลาง** ที่ Python และ TypeScript ต้องตรงกัน |

ถ้าเปลี่ยนโครงสร้างนี้ ให้แก้ `paths:` ใน `.claude/rules/*.md` (ถ้ามี) และ regex ใน `.claude/hooks/protect_files.py` ตามด้วย

## สถาปัตยกรรม: 3 LLM Hubs

ทุกการเรียก LLM ต้องอยู่ใน 1 ใน 3 hub นี้เท่านั้น อย่าเพิ่มจุดเรียก LLM ใหม่โดยไม่จำเป็น

### 1) Ingestion Pipeline (ฟีเจอร์ 4 + 5 + 6)
Trigger: แอดมินวางข้อความประกาศจากโซเชียลแล้วกด **"Import / Extract"**

1. **Extractor** — LLM + Structured Outputs สกัด `title`, `publisher`, `volume`, `edition`, `release_date` เก็บ `raw_text` และ `source_url` ไว้เป็น audit trail ผูกกับ `source_id`
2. **Matcher** — ใช้ local fuzzy search ดึงเฉพาะรายการใกล้เคียงจาก catalog แล้วให้ LLM เทียบ (ข้อ 5 + 6 รวมเป็น API call เดียวได้) คืน `match_status`
3. **Edition Disambiguator** — `edition` เป็น enum: `manga`, `light_novel`, `special_set`, `big_book` พร้อม `confidence`; **โค้ด** (ไม่ใช่ LLM) เป็นผู้ตัดสินตามเกณฑ์ threshold (เริ่มที่ 0.8)

ผลลัพธ์ตาม `match_status`:
- `duplicate_merged` → **ไม่สร้างแถวใหม่** แต่ append ประกาศลง `sources[]` ของเล่มเดิม และอัปเดตสถานะวางขาย
- `distinct_edition` → สร้างรายการใหม่ (คนละฉบับพิมพ์)
- `needs_review` → confidence ต่ำกว่าเกณฑ์หรือกำกวม (เช่น ไม่ระบุว่ามังงะหรือนิยาย) → **ห้ามรวมอัตโนมัติ** ส่งเข้าคิวให้คนตรวจพร้อมตัวเลือกที่เป็นไปได้

### 2) Interactive Chat Hub (ฟีเจอร์ 1 + 2)
- **Collection-Aware Chatbot** — โมเดลรุ่นเล็ก + Function Calling เรียก local search, ตัดฟิลด์ก่อนส่ง (payload pruning), อ้างอิงด้วย ID
- **0-Token Fast Path** — ปุ่มลัด (เช่น "ออกใหม่เดือนนี้") ต้องตอบจากโค้ด/JSON ตรง ไม่ผ่าน LLM
- **Natural Language Shelf Updater** — tool `propose_shelf_update` แตกช่วงเลขเล่ม (เช่น "ฟรีเรน 9-12" → 4 เล่ม) และจับคู่ `book_id` แล้ว **หยุดที่ Approval Gate**: แสดงการ์ดให้ผู้ใช้ยืนยันก่อนเขียนลง `user_shelf.json` เสมอ ถ้ากำกวมให้ถามกลับ
- Frontend เป็นผู้ hydrate `book_id` / `source_id` ที่ LLM คืนมาให้เป็นการ์ดหนังสือ ป้ายอ้างอิงที่คลิกได้ และปุ่มไปร้านค้า

### 3) Recommendation Engine (ฟีเจอร์ 3)
- คำนวณ "เล่มที่ขาด" ด้วยโค้ดก่อน (0-Token) แล้วจึงส่งสรุปคลัง + แค็ตตาล็อกย่อให้ LLM ตอบเป็น Structured Output พร้อม citation ID
- แสดง 2 กลุ่ม: **เล่มที่ควรเก็บต่อ** / **เรื่องใหม่แนวคล้าย** พร้อมเหตุผลที่อธิบายได้
- Trigger: เปิดแท็บแนะนำครั้งแรก, กดปุ่มอัปเดต, หรือเมื่อคลัง/แค็ตตาล็อกเปลี่ยน — ต้อง cache ผลไว้ ไม่เรียกซ้ำถ้าข้อมูลไม่เปลี่ยน

## กฎที่ต้องรักษาทุกจุด (Core Rules)

- **ห้ามส่ง JSON ทั้งก้อนเข้า LLM** — ดึงเฉพาะรายการที่เกี่ยวข้องผ่าน local search และตัดฟิลด์ที่ไม่จำเป็น (URL, รูปปก) ออกก่อนใส่ prompt
- **ID-Based Citation** — LLM อ้างอิงได้เฉพาะ `book_id` และ `source_id` เท่านั้น ห้ามให้ LLM พิมพ์ URL เอง (URL มาจากการ hydrate ฝั่ง frontend) และต้องตอบตรงๆ เมื่อไม่มีข้อมูลในแค็ตตาล็อก
- **Approval Gate** ก่อนแก้ไขคลังหนังสือของผู้ใช้ทุกครั้ง
- **Confirmation Modal** ยืนยันชื่อเรื่อง–เลขเล่ม–ฉบับพิมพ์ ทุกครั้งก่อนพาผู้ใช้ออกไปหน้าร้านค้า
- งานที่โค้ดทำได้แบบ deterministic (นับเล่มขาด, ตรวจ threshold, ปุ่มลัด) ต้องทำด้วยโค้ด ไม่ใช่ LLM
- เมื่อไม่มั่นใจว่าเป็นเล่มเดียวกัน → `needs_review` แทนการเดา (ความถูกต้องของแค็ตตาล็อกสำคัญกว่าความอัตโนมัติ)
- **`schemas/` คือสัญญากลาง** — แก้ shape ของข้อมูลเมื่อไหร่ ต้องแก้ schema, ฝั่ง Python และ type ฝั่ง TypeScript ใน commit เดียวกัน

## คำสั่งที่ใช้บ่อย

_ยังไม่มี — เพิ่มเมื่อสร้างโปรเจกต์ Next.js / Python แล้ว (dev server, build, lint, test, และวิธีรัน test เดี่ยว)_

| งาน | คำสั่ง |
|---|---|
| Dev (web) | _TBD_ |
| รัน ingest | _TBD_ |
| Test (Python) | _TBD_ |
| Test เดี่ยว | _TBD_ |
| Lint / typecheck | _TBD_ |

## Git and PRs

- Branches: `feature/`, `fix/`, `hotfix/`, `chore/`, `refactor/`, `docs/` + short kebab-case; ticket ID first when there is one (`feature/UC-123-add-export`).
- Commits: Conventional Commits (`feat(scope): …`, `fix: …`, `chore: …`).
- PR body: no template in `.github/PULL_REQUEST_TEMPLATE/` yet — the `pr-description` skill falls back to its default template.

## ถามก่อนทำ (Ask first)

- เพิ่ม dependency ใหม่ (npm / pip) — hook จะถามให้อัตโนมัติ
- เปลี่ยนค่าใน enum `edition` หรือ `match_status`, หรือเปลี่ยน threshold 0.8
- แก้ไฟล์ใน `schemas/` หรือข้อมูลจริงใน `data/*.json` ด้วยมือ
- เลือก database (Supabase / MongoDB) หรือ hosting — ยังเป็นการตัดสินใจของทีม
- เพิ่มจุดเรียก LLM ที่อยู่นอก 3 hub

## ห้ามทำ (Never)

- ใส่ OpenAI key ในโค้ด, ใน `NEXT_PUBLIC_*`, หรือเรียก OpenAI จาก browser (`dangerouslyAllowBrowser`) — hook บล็อกไว้แล้ว
- แต่งข้อมูลหนังสือ / ประกาศขึ้นเองใน catalog — ใช้เฉพาะประกาศ สนพ. ที่ได้รับอนุญาต
- ให้ LLM ตัดสิน threshold, นับเล่มขาด หรือเขียนลง `user_shelf.json` โดยไม่ผ่าน Approval Gate
- ปิด / ข้าม test หรือ hook เพื่อให้ผ่าน (`--no-verify`)
- `print()` / `console.log()` ที่ debug ค้างไว้ใน commit
- Touch files unrelated to the task, including drive-by formatting.

<!-- claude-only -->
Adding dependencies, editing `.env` files, bypassing git hooks, and committing secrets are enforced by hooks in `.claude/settings.json` — you will be stopped or asked automatically.
<!-- /claude-only -->
<!-- copilot-only
Adding dependencies, editing `.env` files, bypassing git hooks, and committing secrets are also checked by pre-commit hooks and CI.
-->
