# ShelfPilot AI

ใช้ Node.js 22.12 ขึ้นไปในสาย 22 หรือ Node.js 24 LTS รันคำสั่งจากโฟลเดอร์ `web/`

```sh
npm ci
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) แล้วดูว่าหน้าแสดงชื่อ ShelfPilot AI กด Ctrl+C เมื่อต้องการหยุด dev server

## ตรวจสอบก่อน commit

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run gen:types
git diff --exit-code -- types/generated
```

ทดสอบไฟล์เดียวด้วย `npm test -- tests/normalize.test.ts` ชุดทดสอบ OpenAI ใช้ HTTP response จำลอง

## ตั้งค่า OpenAI

หน้าแรกและชุดทดสอบรันได้โดยไม่ต้องใช้ API key เมื่อต้องต่อฟีเจอร์ที่เรียก OpenAI ให้ใช้ `.env.example` เป็นตัวอย่างสำหรับ `web/.env.local` หากเว้นชื่อโมเดลว่าง จะใช้ `gpt-4.1-mini` สำหรับแชทและ `gpt-4.1` สำหรับ extraction

## ไฟล์ข้อมูล

JSON Schema ใน `../schemas/` เป็นสัญญาของไฟล์ใน `../data/` รัน `npm run gen:types` หลังแก้ schema แล้ว commit ไฟล์ TypeScript ที่สร้างพร้อมกัน

ไฟล์ JSON ตั้งต้นใช้กับการอ่านข้อมูลบน Vercel การเขียนไฟล์ของ MVP รองรับการรันในเครื่อง การเขียนข้อมูลบน Vercel ต้องมีที่เก็บข้อมูลถาวร
