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

อ่านส่วน "คำสั่งที่ใช้บ่อย" ใน `AGENTS.md` ถ้ายังเป็น `_TBD_` ให้หยุดและถามผู้ใช้ — ห้ามเดาคำสั่ง

## 2. รัน 3 เคสหลัก (ingest)

รัน test ของ `web/lib/ingest/__tests__/` ที่ใช้ fixtures ใน `web/lib/ingest/__tests__/fixtures/` (ไม่รวม `*.llm.test.ts` ที่เรียก LLM จริง)

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

ถามผู้ใช้ก่อนว่าจะให้เปิด dev server ไหม ถ้าใช่ ใช้ browser pane เดิน flow (use case จาก `docs/brief.md`):

1. นำเข้าประกาศ → ได้ JSON ที่มี `source_id`; ประกาศซ้ำข้ามช่องทาง (X + Facebook) ต้อง `duplicate_merged`; "หมอยาฯ เล่ม 12 เข้าพรุ่งนี้" ต้อง `needs_review`
2. chat "เพิ่งซื้อฟรีเรน เล่ม 9-12 กับสปายฯ เล่ม 14" → การ์ด 5 เล่ม → ยืนยัน
3. chat "มังงะหมอยาในวัง เล่มล่าสุดออกหรือยัง ฉันขาดเล่มไหน?" → ตอบพร้อมป้ายอ้างอิง
4. เปิดแท็บแนะนำ → 2 กลุ่มพร้อมเหตุผล → กดไปร้านค้า → Confirmation Modal

## 5. รายงาน

ตารางสรุป + ข้อที่ ❌ เรียงตามความเสี่ยงต่อการเดโม (ข้อที่ทำให้ flow หลักพังก่อน)
