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

### Chat rate limits

Local development allows six chat requests per minute across the local process. Production and Vercel require a shared Upstash Redis instance. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the server environment. Use the standard write token and separate Redis instances if preview and production need independent limits.

On Vercel, the app allows six requests per minute per client IP and 30 per minute across the deployment using that Redis instance. It uses the IP provided by Vercel and sends a keyed hash to Redis. Other hosts, or requests without a trusted IP, share one six-request bucket. Chat returns HTTP 429 with `Retry-After` when limited and HTTP 503 if the shared counter is missing or unavailable. The browser's quick shortcuts still run locally.

## ไฟล์ข้อมูล

JSON Schema ใน `../schemas/` เป็นสัญญาของไฟล์ใน `../data/` รัน `npm run gen:types` หลังแก้ schema แล้ว commit ไฟล์ TypeScript ที่สร้างพร้อมกัน

### ในเครื่อง

แอปอ่านและบันทึกข้อมูลใน `../data/` โดยค่าเริ่มต้น รองรับการแก้คลังหลังยืนยัน บันทึกคลิกร้านค้า และนำเข้าประกาศผ่าน `/admin` เมื่อรันด้วย `npm run dev` บน loopback

หากต้องการใช้ข้อมูลเดโมในเครื่อง ให้คัดลอกไฟล์ไปยังโฟลเดอร์ชั่วคราว แล้วชี้แอปไปยังสำเนานั้น

```sh
demo_dir="$(mktemp -d)"
cp ../fixtures/demo/database/*.json "$demo_dir/"
SHELFPILOT_DATA_DIR="$demo_dir" npm run dev
```

### Vercel

1. ตั้ง Root Directory เป็น `web` เปิด **Include source files outside of the Root Directory in the Build Step** และเปิด **Automatically expose System Environment Variables** เพื่อให้แอปใช้ค่า `VERCEL` ของแพลตฟอร์ม
2. Deploy สาขาที่ต้องการ แอปจะรวมแค็ตตาล็อก คลังตัวอย่าง และคิวตรวจจาก `fixtures/demo/database/` ใน server bundle ใช้การ deploy ใหม่เพื่ออัปเดต snapshot
3. หากต้องการให้เฉพาะทีมเข้าได้ ให้ตั้ง `SHELFPILOT_TEAM_PASSWORD` สำหรับ environment ที่ใช้งาน แล้วลงชื่อเข้าใช้ด้วยชื่อผู้ใช้ `shelfpilot`

ข้อมูลบน Vercel เป็นแบบอ่านอย่างเดียว การบันทึกคลังและสถิติคลิกร้านค้าตอบ HTTP 503 การนำเข้าประกาศและจัดการคิวตรวจใช้ได้ในเครื่อง การเปิดลิงก์ร้านค้าผ่านหน้าต่างยืนยันยังใช้งานได้
