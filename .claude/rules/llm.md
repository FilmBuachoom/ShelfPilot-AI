---
paths:
  - "ingest/**"
  - "web/**/api/**"
  - "web/**/server/**"
  - "web/**/lib/**"
  - "**/prompts/**"
---

# การเรียก OpenAI

มี 3 hub เท่านั้น (Ingestion, Chat, Recommendation — ดู CLAUDE.md) จุดใหม่ต้องถามก่อน

## ต้องทำ

- **Payload pruning** — ส่งเฉพาะ `book_id`, `title`, `aliases`, `volume`, `edition`, `publisher` ที่จำเป็น ตัด URL / รูปปก / ราคา / `raw_text` ที่ไม่ใช้
- **Structured Outputs** ทุกครั้งที่ต้องการ JSON — schema มาจาก `schemas/` ไม่เขียนซ้ำใน prompt
- **Citation** — schema ของคำตอบมี field `book_ids[]` / `source_ids[]` ให้ LLM ใส่ ไม่ให้แทรกในข้อความ
- **ไม่มีข้อมูล = บอกตรงๆ** — system prompt ต้องสั่งให้ตอบว่าไม่พบในแค็ตตาล็อก แทนการเดา
- **Cache** ผล Recommendation ด้วย hash ของ (shelf + catalog) ไม่เรียกซ้ำถ้า hash เดิม
- เก็บ prompt ไว้ไฟล์แยก (`prompts/`) ไม่ฝังเป็น string ยาวในโค้ด

## Pitfalls

- ให้ LLM คำนวณ (นับเล่มขาด, เทียบ threshold, แตกช่วง 9-12) — ทำด้วยโค้ด แล้วให้ LLM แค่เลือก/อธิบาย
- ลืม timeout / retry — เดโมจะค้างกลางเวที ตั้ง timeout และมีข้อความ fallback
- ใช้โมเดลใหญ่กับงาน chat — chat ใช้รุ่นเล็ก งาน extract ค่อยพิจารณารุ่นที่แม่นกว่า
