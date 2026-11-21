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

แอปใช้ข้อมูล JSON ตั้งต้นเมื่อเว้น `SHELFPILOT_DATA_BACKEND` ว่าง โหมด JSON รองรับการบันทึกคลังและการนับคลิกร้านค้าในเครื่อง ตั้ง `SHELFPILOT_DATA_DIR` เป็น path ของชุดไฟล์สำหรับทดสอบเมื่อต้องการแยกข้อมูลทดสอบจาก `../data/`

### Local Supabase demo

Apply the migrations in `supabase/migrations/` to the development database and provision a dedicated Supabase Auth fixture account with `app_metadata.shelfpilot_fixture` set to `true` and an existing shelf tied to its user ID. Supply the five `SHELFPILOT_*` connection settings listed in `.env.example` to the server process. Set `SHELFPILOT_DATA_BACKEND=supabase`. Keep the fixture password out of Git and use the project's publishable key.

Run `npm run dev -- --hostname 127.0.0.1` from `web/`. The app reads the catalog, shelf, and review queue directly from Supabase and sends confirmed shelf changes and store clicks to the database. This mode is for local development with a shared fixture shelf. The regular mode uses JSON when the backend selector is unset.

### Shared Supabase demo on Vercel

1. Apply the Supabase migrations and provision the fixture account and shelf as described above. Use a Supabase project and fixture account dedicated to team demo data.
2. In Project Settings → Environment Variables, set the same five `SHELFPILOT_*` connection settings for Production. Set `SHELFPILOT_TEAM_PASSWORD` to a separate, randomly generated team password. Set Preview variables too if the team uses Preview deployments.
3. Deploy the updated commit. Open the HTTPS production URL and sign in with username `shelfpilot` and the team password. The browser uses this sign-in for pages and API requests. Each signed-in teammate uses the same fixture shelf.

The catalog, shelf, and review queue load from Supabase. Confirmed shelf changes and store clicks persist in Supabase. Announcement import is available in local JSON mode.
