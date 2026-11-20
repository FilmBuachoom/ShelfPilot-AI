---
paths:
  - "web/**/api/**"
  - "web/**/server/**"
  - "web/**/lib/**"
  - "**/prompts/**"
---

# การเรียก OpenAI

มี 3 hub เท่านั้น (Ingestion, Chat, Recommendation — ดู AGENTS.md) จุดใหม่ต้องถามก่อน

## ต้องทำ

- **Payload pruning** — ส่งเฉพาะ `book_id`, `title`, `aliases`, `volume`, `edition`, `publisher` ที่จำเป็น ตัด URL / รูปปก / ราคา / `raw_text` ที่ไม่ใช้
- **Structured Outputs** ทุกครั้งที่ต้องการ JSON — schema มาจาก `schemas/` ไม่เขียนซ้ำใน prompt
- **Citation** — schema ของคำตอบมี field `book_ids[]` / `source_ids[]` ให้ LLM ใส่ ไม่ให้แทรกในข้อความ
- **ไม่มีข้อมูล = บอกตรงๆ** — system prompt ต้องสั่งให้ตอบว่าไม่พบในแค็ตตาล็อก แทนการเดา
- **Cache** ผล Recommendation ด้วย hash ของ (shelf + catalog) ไม่เรียกซ้ำถ้า hash เดิม
- เก็บ prompt ไว้ไฟล์แยก (`prompts/`) ไม่ฝังเป็น string ยาวในโค้ด

## Recommendation Engine (ฟีเจอร์ 3, Required)

- โค้ดคำนวณ "เล่มที่ขาด" ก่อน (0-Token) แล้วส่งสรุปคลัง + แค็ตตาล็อกย่อให้ LLM ตอบเป็น Structured Output พร้อม citation ID
- แสดง 2 กลุ่ม: **เล่มที่ควรเก็บต่อ** / **เรื่องใหม่แนวคล้าย** พร้อมเหตุผล เช่น มีฟรีเรน 1–13 → แนะนำเล่ม 14 ที่กำลังออก (อิงประกาศ)
- รวมรายการออกใหม่เฉพาะบุคคล และแจ้งเตือนเล่มที่ยังขาด
- Trigger: เปิดแท็บแนะนำครั้งแรก, กดปุ่มอัปเดต, หรือคลัง/แค็ตตาล็อกเปลี่ยน (ใช้ cache ด้านบน)

## Pitfalls

- ให้ LLM คำนวณ (นับเล่มขาด, เทียบ threshold, แตกช่วง 9-12) — ทำด้วยโค้ด แล้วให้ LLM แค่เลือก/อธิบาย
- ลืม timeout / retry — เดโมจะค้างกลางเวที ตั้ง timeout และมีข้อความ fallback
- ใช้โมเดลใหญ่กับงาน chat — chat ใช้รุ่นเล็ก งาน extract ค่อยพิจารณารุ่นที่แม่นกว่า
