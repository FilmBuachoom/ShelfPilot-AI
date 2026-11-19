---
name: demo-check
description: >
  Pre-demo checklist for ShelfPilot AI: runs the 3 required matching cases
  (duplicate announcement, title aliases, edition mismatch) and walks the guard-rail
  flows (Approval Gate, Confirmation Modal, 0-token buttons, ID citations). Use when
  the user asks "พร้อมเดโมไหม", "เช็คก่อนเดโม", "demo check", "run the 3 cases",
  or before presenting / submitting the hackathon.
---

# Demo check

ตอบผู้ใช้เป็นภาษาไทย รายงานเป็นตาราง ✅ / ❌ / ⚠️ ไม่ต้องแก้โค้ดเองระหว่างเช็ค — รายงานก่อน แล้วถามว่าจะแก้ข้อไหน

## 1. หาคำสั่ง

อ่านส่วน "คำสั่งที่ใช้บ่อย" ใน `CLAUDE.md` ถ้ายังเป็น `_TBD_` ให้หยุดและถามผู้ใช้ — ห้ามเดาคำสั่ง

## 2. รัน 3 เคสหลัก (ingest)

รัน test ของ `ingest/tests/` ที่ใช้ fixtures ใน `ingest/tests/fixtures/` (ไม่รวม test ที่ mark `llm`)

| เคส | ผ่านเมื่อ |
|---|---|
| ประกาศซ้ำ | `duplicate_merged`, ไม่มีแถวใหม่ใน catalog, `sources[]` +1 |
| ชื่อหลายแบบ | ชื่อไทย / ญี่ปุ่น / ชื่อย่อ ได้ `book_id` เดียวกัน |
| ฉบับไม่ตรง | ไม่ถูก merge — ได้ `distinct_edition` หรือ `needs_review` |

ถ้ายังไม่มี fixture ของเคสไหน → ⚠️ และบอกว่าขาดอะไร

## 3. เช็ค guard rails (อ่านโค้ด ไม่ต้องรันแอป)

- [ ] ไม่มี `NEXT_PUBLIC_*OPENAI` / `dangerouslyAllowBrowser` / key literal ใน `web/`
- [ ] `propose_shelf_update` ไม่เขียน `user_shelf.json` ก่อนผู้ใช้กดยืนยัน
- [ ] ลิงก์ร้านค้าผ่าน Confirmation Modal ทุกจุด และนับคลิกหลังยืนยัน
- [ ] ปุ่มลัด (0-Token) ไม่เรียก route ที่ใช้ LLM
- [ ] คำตอบ LLM อ้างอิงด้วย `book_id` / `source_id` เท่านั้น และ frontend ทิ้ง ID ที่ lookup ไม่เจอ
- [ ] Recommendation มี cache

## 4. ถ้ารันแอปได้

ถามผู้ใช้ก่อนว่าจะให้เปิด dev server ไหม ถ้าใช่ ใช้ browser pane เดิน flow: นำเข้าประกาศ → chat "ฟรีเรน 9-12" → ยืนยันการ์ด → เปิดแท็บแนะนำ → กดไปร้านค้า

## 5. รายงาน

ตารางสรุป + ข้อที่ ❌ เรียงตามความเสี่ยงต่อการเดโม (ข้อที่ทำให้ flow หลักพังก่อน)
