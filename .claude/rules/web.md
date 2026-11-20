---
paths:
  - "web/**"
---

# Next.js (web/)

## Server / client boundary

- OpenAI ถูกเรียกจาก API route / server action เท่านั้น — key อยู่ใน `process.env.OPENAI_API_KEY` ห้ามมี prefix `NEXT_PUBLIC_`
- ถ้าจะ deploy ไป GitHub Pages (static) จะไม่มี API route — ต้อง Vercel ถ้ามี LLM

## Hydration

- LLM คืน `book_id` / `source_id` เท่านั้น → frontend lookup จาก catalog เพื่อสร้างการ์ด, ป้ายอ้างอิง, ปุ่มร้านค้า
- ID ที่ lookup ไม่เจอ = LLM มโน → ไม่แสดง และ log ไว้ ห้ามแสดง ID เปล่าหรือเดา URL

## Chat Hub (ฟีเจอร์ 1 + 2)

- **Collection-Aware Chatbot** (Required) — โมเดลรุ่นเล็ก + Function Calling เรียก local search, payload pruning, อ้างอิงด้วย ID เช่น "มังงะหมอยาในวัง เล่มล่าสุดออกหรือยัง ฉันขาดเล่มไหน?" → ตอบจากคลังพร้อมป้ายอ้างอิงประกาศ
- **Natural Language Shelf Updater** — tool `propose_shelf_update` แตกช่วงเลขเล่มด้วยโค้ดและจับคู่ `book_id` เช่น "เพิ่งซื้อฟรีเรน เล่ม 9-12 กับสปายฯ เล่ม 14" → 5 เล่ม → Approval Gate; ถ้ากำกวมให้ถามกลับ

## Flow ที่ต้องมีเสมอ

- **Approval Gate** — `propose_shelf_update` แสดงการ์ดสรุปรายการเล่ม (+/-) ผู้ใช้กดยืนยันก่อนค่อยเขียน `user_shelf.json` ปุ่มยกเลิกต้องไม่เขียนอะไรเลย
- **Confirmation Modal** — ก่อนเปิดลิงก์ร้านค้า แสดง ชื่อเรื่อง–เลขเล่ม–ฉบับพิมพ์ ให้ยืนยัน
- **0-Token Fast Path** — ปุ่มลัด (ออกใหม่เดือนนี้, เล่มที่ขาด) คำนวณจาก JSON ตรง ไม่เรียก API route ที่ใช้ LLM
- นับคลิกไปร้านค้า (เป็นตัวชี้วัด) — event เดียว ที่จุดเดียว หลังยืนยันใน modal

## Pitfalls

- import โมดูลที่อ่าน `process.env.OPENAI_API_KEY` ใน client component → key หลุดหรือ build พัง แยกไว้ใน `server-only`
- Fuse.js ฝั่ง client ใช้กับ catalog ที่ตัดฟิลด์แล้วเท่านั้น
