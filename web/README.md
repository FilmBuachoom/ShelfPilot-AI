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

## ฟีเจอร์ AI และการเตรียมข้อมูลก่อนเข้า LLM

ทั้ง 6 ฟีเจอร์ใช้ LLM ฝั่งเซิร์ฟเวอร์ผ่าน 3 ส่วน ได้แก่ Chat, Recommendation และ Ingestion. แต่ละส่วนคัดเฉพาะข้อมูลที่เกี่ยวข้อง และใช้ Structured Outputs กำหนดรูปแบบคำตอบด้วย JSON Schema. ข้อมูลหนังสือที่ส่งให้โมเดลผ่านการตัดฟิลด์อย่างรูปปก ราคา และ URL ร้านค้าออก เมื่อได้คำตอบแล้ว แอปตรวจ `book_id` และ `source_id` ก่อนใช้ ID ดึงการ์ดหนังสือและลิงก์อ้างอิงจากแค็ตตาล็อก. [JSON Schema](../schemas/) · [การตัดฟิลด์หนังสือ](lib/llm/prune.ts)

### Chat

#### 1. แชทที่อิงคลังหนังสือ (Collection-Aware Chatbot)

- **เตรียมข้อมูล** เมื่อผู้ใช้ส่งคำถาม เซิร์ฟเวอร์ส่งประวัติแชทล่าสุดไม่เกิน 12 ข้อความ วันที่ตามเวลาไทย และคำอธิบายเครื่องมือ เมื่อโมเดลเรียกเครื่องมือค้นหา โค้ดใช้ Fuse.js ค้นชื่อและชื่อเรียกอื่น (alias) ในแค็ตตาล็อก เครื่องมือดูสถานะเทียบข้อมูลกับคลังแล้วคำนวณเล่มที่มี ขาด และกำลังออกแยกตามฉบับ ก่อนคืนผลที่เกี่ยวข้องให้โมเดล. [Chat flow](lib/chat/run.ts) · [เครื่องมือดูสถานะ](lib/chat/tools/series-status.ts)
- **หน้าที่ของ AI** ตีความคำถาม เช่น “มังงะหมอยาฯ เล่มล่าสุดออกหรือยัง ฉันขาดเล่มไหน?” เลือกเรียกเครื่องมือด้วย Function Calling แล้วเรียบเรียงคำตอบภาษาไทยพร้อม `book_ids` และ `source_ids` จากผลเครื่องมือในรอบนั้น ถ้าฉบับกำกวม ระบบถามกลับ ถ้าหลักฐานไม่พอ ระบบแจ้งว่ายังไม่พบในแค็ตตาล็อก ปุ่มลัด **เล่มที่ขาด** และ **ออกใหม่เดือนนี้** คำนวณในเบราว์เซอร์และใช้ 0 token. [กติกาของแชท](prompts/chat-system.md) · [ปุ่มลัด](lib/chat/quick.ts)

#### 2. ปรับคลังด้วยภาษาธรรมชาติ (Natural Language Shelf Updater)

- **เตรียมข้อมูล** ใช้ประวัติแชทชุดเดียวกับข้อ 1 และส่งคำอธิบายเครื่องมือ `propose_shelf_update` ซึ่งรับชื่อเรื่อง การเพิ่มหรือนำออก เลขเล่มหรือช่วงเลขเล่ม และฉบับเมื่อผู้ใช้ระบุ. [รูปแบบคำขอ](lib/chat/tool-calls.ts)
- **หน้าที่ของ AI** แปลงข้อความอย่าง “เพิ่งซื้อฟรีเรน เล่ม 9–12” เป็นคำขอเพิ่มหนังสือโดยคงช่วง `9–12` ไว้ โค้ดแตกช่วงเป็น `9, 10, 11, 12` จับคู่ชื่อหรือ alias และฉบับกับ `book_id` แล้วเทียบกับคลังเพื่อเตรียมรายการเปลี่ยนแปลง ถ้าพบเพียงชื่อใกล้เคียงหรือมีหลายฉบับ ระบบขอให้ผู้ใช้ระบุเพิ่ม เมื่อจับคู่ได้ ผู้ใช้ตรวจรายการผ่าน **Approval Gate** และกดยืนยันก่อนบันทึก. [การเตรียมรายการปรับคลัง](lib/chat/tools/propose-shelf-update.ts) · [การยืนยัน](components/ApprovalSheet/ApprovalSheet.tsx)

### Recommendation

#### 3. แนะนำหนังสือพร้อมเหตุผล (Explainable Recommendation)

- **เตรียมข้อมูล** โค้ดสรุปชื่อเรื่อง ฉบับ และจำนวนเล่มที่ผู้ใช้มี แล้วสร้างตัวเลือกสองกลุ่ม **เล่มที่ควรเก็บต่อ** รวมเล่มที่วางขายแล้วแต่ยังขาดกับเล่มถัดไปที่กำลังออก **เรื่องใหม่** ใช้เล่มเริ่มต้นหนึ่งเล่มต่อเรื่องที่ผู้ใช้ยังไม่สะสม สูงสุด 15 เรื่อง แต่ละตัวเลือกมีข้อมูลหนังสือแบบย่อและ ID แหล่งประกาศ. [การเตรียมตัวเลือก](lib/recommend/candidates.ts)
- **หน้าที่ของ AI** เลือกและจัดลำดับหนังสือจากตัวเลือกในแต่ละกลุ่ม แล้วเขียนเหตุผลสั้น ๆ พร้อม `book_id` และ `source_ids`. สำหรับเรื่องใหม่ เหตุผลอิงข้อมูลที่มี เช่น ฉบับพิมพ์หรือสำนักพิมพ์ โค้ดตรวจว่า ID อยู่ในชุดตัวเลือกและแหล่งประกาศเป็นของเล่มนั้น แล้วเก็บผลในแคชตามคลังและเวอร์ชันแค็ตตาล็อก ยอดเล่มที่ขาดและรายการออกใหม่ของเรื่องที่ผู้ใช้เก็บคำนวณด้วยโค้ด หากโมเดลไม่พร้อมใช้ หน้ายังแสดงตัวเลือกจากแค็ตตาล็อกได้. [กติกาการแนะนำ](prompts/recommend-system.md) · [แคชและการสำรองผล](lib/recommend/run.ts)

### Ingestion

#### 4. สกัดข้อมูลจากประกาศสำนักพิมพ์ (Publisher Announcement Extractor)

- **เตรียมข้อมูล** เมื่อแอดมินกด **Import / Extract** เซิร์ฟเวอร์ตรวจข้อความและ URL แล้วเช็กว่าเคยประมวลผลประกาศนี้หรือยัง สำหรับประกาศใหม่ Extractor ได้รับข้อความดิบ `raw_text` และชื่อสำนักพิมพ์ที่แอดมินระบุเป็นข้อมูลประกอบ `publisher_hint` ถ้ามี ส่วน URL ต้นทางเก็บคู่กับข้อความดิบใต้ `source_id` เพื่อให้ตรวจสอบย้อนหลังได้. [ขั้นตอนนำเข้า](lib/ingest/pipeline.ts) · [ข้อมูลที่ส่งให้ Extractor](lib/ingest/extract.ts)
- **หน้าที่ของ AI** สกัดหนึ่งรายการต่อเล่ม โดยดึงชื่อเรื่อง สำนักพิมพ์ เลขเล่ม ฉบับ วันวางจำหน่าย และสถานะวางขายตามที่ประกาศระบุ ฟิลด์ที่ไม่มีข้อมูลใช้ `null` และถ้าระบุฉบับ โมเดลคืนข้อความหลักฐานกับคะแนนความมั่นใจด้วย โค้ดตรวจและปรับข้อมูลก่อนส่งต่อ เช่น แปลง `เล่ม ๑๒` เป็น `12` และเก็บความละเอียดระดับเดือนเมื่อประกาศให้มาเพียงเดือน. [กติกาการสกัด](prompts/extract-system.md) · [การปรับรูปแบบข้อมูล](lib/ingest/normalize.ts)

#### 5. จับคู่ชื่อข้ามภาษาและรวมประกาศซ้ำ (Cross-Language Title & Duplicate Matcher)

- **เตรียมข้อมูล** โค้ดปรับรูปแบบชื่อและ alias แล้วใช้ Fuse.js หาตัวเลือกสูงสุด 5 เล่ม โดยให้ความสำคัญกับชื่อที่ตรงและเลขเล่มเดียวกัน โมเดลได้รับข้อมูลที่สกัดได้พร้อมตัวเลือกแบบย่อ ได้แก่ `book_id`, ชื่อ, alias, เลขเล่ม, ฉบับ และสำนักพิมพ์ เมื่อไม่มีตัวเลือก โค้ดข้ามการเรียก Matcher. [การค้นตัวเลือก](lib/search/fuse.ts) · [ข้อมูลที่ส่งให้ Matcher](lib/ingest/match.ts)
- **หน้าที่ของ AI** ประเมินว่าชื่อไทย ญี่ปุ่น โรมาจิ หรือชื่อย่อหมายถึงเรื่องเดียวกันหรือไม่ คืน `candidate_book_id` จากตัวเลือกหรือ `null` และระบุว่าเรื่องกับเลขเล่มตรงกันไหม โค้ดตรวจผลร่วมกับฉบับพิมพ์ เมื่อยืนยันว่าเป็นเรื่อง เลขเล่ม และฉบับเดียวกัน จะให้สถานะ `duplicate_merged` และเพิ่มแหล่งประกาศให้ `book_id` เดิม. [กติกาการจับคู่](prompts/match-system.md) · [การรวมประกาศ](lib/ingest/apply.ts)

#### 6. แยกฉบับพิมพ์และส่งให้แอดมินตรวจ (Edition Disambiguator & Human Review)

- **เตรียมข้อมูล** ใช้ผลจาก Extractor และ Matcher ร่วมกัน ได้แก่ `edition`, `edition_evidence` และ `edition_confidence`. โค้ดใช้ข้อความประกาศต้นฉบับตรวจว่าหลักฐานระบุฉบับของเรื่องและเลขเล่มนั้น โดยเฉพาะเมื่อโพสต์เดียวมีหลายรายการ. [การตรวจหลักฐาน](lib/ingest/edition-review.ts)
- **หน้าที่ของ AI** ระบุฉบับจากถ้อยคำในประกาศตามค่าที่รองรับ ได้แก่ `manga`, `light_novel`, `special_set` และ `big_book` พร้อมหลักฐานและคะแนนความมั่นใจ โค้ดตรวจหลักฐานและใช้เกณฑ์ **0.8**. หากยืนยันได้ว่าเป็นฉบับต่างกัน ระบบสามารถสร้างรายการใหม่ด้วยสถานะ `distinct_edition`. หากหลักฐานไม่ชัดหรือคะแนนต่ำกว่าเกณฑ์ ระบบส่งเข้า `needs_review` เช่น ประกาศที่ระบุเพียง “หมอยาฯ เล่ม 12” โดยไม่ระบุฉบับ. [การตัดสินสถานะ](lib/ingest/decide.ts) · [คิวตรวจสอบ](lib/ingest/review-queue.ts) · [คู่มือ Ingestion](lib/ingest/README.md)

## ไฟล์ข้อมูล

JSON Schema ใน `../schemas/` เป็นสัญญาของไฟล์ใน `../data/` รัน `npm run gen:types` หลังแก้ schema แล้ว commit ไฟล์ TypeScript ที่สร้างพร้อมกัน

แอปใช้ข้อมูล JSON ตั้งต้นเมื่อเว้น `SHELFPILOT_DATA_BACKEND` ว่าง โหมด JSON รองรับการบันทึกคลังและการนับคลิกร้านค้าในเครื่อง ตั้ง `SHELFPILOT_DATA_DIR` เป็น path ของชุดไฟล์สำหรับทดสอบเมื่อต้องการแยกข้อมูลทดสอบจาก `../data/`

### Local Supabase demo

Apply the migrations in `supabase/migrations/` to the development database and provision a dedicated Supabase Auth fixture account with `app_metadata.shelfpilot_fixture` set to `true` and an existing shelf tied to its user ID. Supply the five `SHELFPILOT_*` connection settings listed in `.env.example` to the server process. Set `SHELFPILOT_DATA_BACKEND=supabase`. Keep the fixture password out of Git and use the project's publishable key.

Run `npm run dev -- --hostname 127.0.0.1` from `web/`. The app reads the catalog, shelf, and review queue directly from Supabase and sends confirmed shelf changes and store clicks to the database. This mode is for local development with a shared fixture shelf. The regular mode uses JSON when the backend selector is unset.

To enable `/admin` writes in local Supabase mode, apply the [ingestion admin migration](../supabase/migrations/20261121082000_enable_ingest_admin.sql). Set `app_metadata.shelfpilot_admin = true` on the Supabase Auth user configured as `SHELFPILOT_SUPABASE_DEMO_EMAIL`. The grant adds access to the catalog and review queue through the ingestion functions. Removing `shelfpilot_admin` returns the page to read-only mode.

### Shared Supabase demo on Vercel

1. Apply the Supabase migrations and provision the fixture account and shelf as described above. Use a Supabase project and fixture account dedicated to team demo data.
2. In Project Settings → Environment Variables, set the same five `SHELFPILOT_*` connection settings for Production. Set `SHELFPILOT_TEAM_PASSWORD` to a separate, randomly generated team password. Set Preview variables too if the team uses Preview deployments.
3. Deploy the updated commit. Open the HTTPS production URL and sign in with username `shelfpilot` and the team password. The browser uses this sign-in for pages and API requests. Each signed-in teammate uses the same fixture shelf.

The catalog, shelf, and review queue load from Supabase. Confirmed shelf changes and store clicks persist in Supabase.

On Vercel Preview and Production, the team can import announcements and resolve reviews through `/admin` after signing in as `shelfpilot`. Enable **Automatically expose System Environment Variables** in the Vercel project and apply the ingestion admin migration and grant to the Supabase account configured for each environment. Imports and reviews write to the Supabase project configured for that environment.

For judging, keep Vercel Deployment Protection enabled and set `SHELFPILOT_PREVIEW_JUDGE_ACCESS=true` on the judging branch's Preview environment. Redeploy Preview and create a Vercel Shareable Link for that deployment. Anyone with the link can use the demo, including imports and reviews, and writes go to the shared Supabase demo data. Revoke the link after judging and remove the branch variable before deploying another protected team preview.
