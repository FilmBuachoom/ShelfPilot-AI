# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## คำสั่งที่ใช้บ่อย

_ยังไม่มี — เพิ่มเมื่อสร้างโปรเจกต์ Next.js / Python แล้ว (dev server, build, lint, test, และวิธีรัน test เดี่ยว)_
