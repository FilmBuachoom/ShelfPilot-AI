---
paths:
  - "ingest/**"
---

# Ingestion pipeline (Python)

Flow: ข้อความประกาศ → **Extractor** (LLM) → **Matcher** (RapidFuzz + LLM) → **Disambiguator** (โค้ด) → เขียน `data/`

## ต้องทำ

- Extractor ใช้ Structured Outputs กับ JSON Schema จาก `schemas/` — ห้ามขอ JSON ด้วย prompt เปล่าแล้ว `json.loads` เอง
- Matcher: RapidFuzz ดึง top-N candidate (เริ่ม N=5) ก่อน แล้วส่งเฉพาะ candidate ที่ตัดฟิลด์แล้วเข้า LLM ไม่ใช่ทั้ง catalog
- Disambiguator เป็นฟังก์ชัน pure: รับ `confidence` + ผล match คืน `match_status` — ทดสอบได้โดยไม่เรียก LLM
- เขียนไฟล์ JSON แบบ atomic (เขียนไฟล์ชั่วคราวแล้ว `os.replace`) กัน catalog พังกลางทาง
- อ่าน key จาก `os.environ["OPENAI_API_KEY"]` (โหลดจาก `.env` ผ่าน `python-dotenv` ถ้ามี)

## Test 3 เคสหลัก (ต้องผ่านก่อนเดโม)

เก็บ fixture ไว้ที่ `ingest/tests/fixtures/` — ประกาศดิบ + ผลที่คาดหวัง

| เคส | ตัวอย่าง | คาดหวัง |
|---|---|---|
| ประกาศซ้ำ | สนพ. โพสต์เล่มเดิมซ้ำ 2 ช่องทาง | `duplicate_merged`, `sources[]` ยาวขึ้น 1 |
| ชื่อหลายแบบ | ชื่อไทย vs โรมาจิ vs ชื่อย่อ | จับคู่ `book_id` เดิมได้ |
| ฉบับไม่ตรง | มังงะ vs ไลต์โนเวลชื่อเดียวกัน, หรือไม่ระบุ | `distinct_edition` หรือ `needs_review` — ห้าม merge |

- test ของ Disambiguator / merge logic ไม่ต้องเรียก LLM — mock ผล Extractor
- test ที่เรียก LLM จริง แยก marker (เช่น `@pytest.mark.llm`) ไม่ให้รันทุกครั้ง

## Pitfalls

- เชื่อ `confidence` ของ LLM ตรงๆ เกินไป — ถ้า `edition` ไม่ปรากฏใน `raw_text` เลย ให้ `needs_review` แม้ confidence สูง
- Normalize ก่อน fuzzy: ตัดช่องว่างซ้ำ, เลขไทย → อารบิก, ตัด "เล่ม"/"Vol." ออก
