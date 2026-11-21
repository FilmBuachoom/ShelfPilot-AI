# ShelfPilot AI

ใช้ Node.js 22.12 ขึ้นไปในสาย 22 หรือ Node.js 24 LTS รันคำสั่งจากโฟลเดอร์ `web/`

```sh
npm ci
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) แล้วดูว่าแสดงหน้าคลังของฉัน กด Ctrl+C เมื่อต้องการหยุด dev server

## ตรวจสอบก่อน commit

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run gen:types
npm run gen:tokens
git diff --exit-code -- types/generated styles/tokens.css
```

ทดสอบไฟล์เดียวด้วย `npm test -- tests/normalize.test.ts` ชุดทดสอบ OpenAI ใช้ HTTP response จำลอง

## ตั้งค่าผู้ช่วย

ตั้ง `NEXT_PUBLIC_AI_ENABLED=false` ก่อนรันแอปเพื่อซ่อนทางเข้าผู้ช่วยและแท็บแนะนำ คลัง การค้นหา และแท็บออกใหม่จะยังใช้งานได้

หน้าแรกและชุดทดสอบรันได้โดยไม่ต้องใช้ API key เมื่อต้องต่อฟีเจอร์ที่เรียก OpenAI ให้ใช้ `.env.example` เป็นตัวอย่างสำหรับ `web/.env.local` หากเว้นชื่อโมเดลว่าง จะใช้ `gpt-6-luna` สำหรับแชทและ `gpt-4.1` สำหรับ extraction

## ไฟล์ข้อมูล

JSON Schema ใน `../schemas/` เป็นสัญญาของไฟล์ใน `../data/` รัน `npm run gen:types` หลังแก้ schema แล้ว commit ไฟล์ TypeScript ที่สร้างพร้อมกัน

ไฟล์ JSON ตั้งต้นใช้กับการอ่านข้อมูลบน Vercel การบันทึกคลังและการนับคลิกร้านค้ารองรับการรันในเครื่อง การเขียนข้อมูลบน Vercel ต้องมีที่เก็บข้อมูลถาวร ตั้ง `SHELFPILOT_DATA_DIR` เป็น path ของชุดไฟล์สำหรับทดสอบเมื่อต้องการแยกข้อมูลทดสอบจาก `../data/`

### Local Supabase demo

Apply the migrations in `supabase/migrations/` to the development database and provision a dedicated Supabase Auth fixture account with `app_metadata.shelfpilot_fixture` set to `true` and an existing shelf tied to its user ID. Supply the five `SHELFPILOT_*` connection settings listed in `.env.example` to the server process. Set `SHELFPILOT_DATA_BACKEND=supabase`. Keep the fixture password out of Git and use the project's publishable key.

Run `npm run dev -- --hostname 127.0.0.1` from `web/`. The app reads the catalog, shelf, and review queue directly from Supabase and sends confirmed shelf changes and store clicks to the database. This mode is for local development with a shared fixture shelf. The regular mode uses JSON when the backend selector is unset.
