# design/

สำเนาอ้างอิง (snapshot) ของ Design System "ShelfPilot AI" — ไม่ใช่โค้ดที่ build

| รายการ | ค่า |
|---|---|
| แหล่งที่มา | https://claude.ai/artifact/D6GWvUyj1nv1W8NEdDCJHV (version `1795171995-7d97`) |
| นำเข้าเมื่อ | 2026-11-20 |
| แก้ล่าสุดโดย (ตาม `design-system.json`) | Tan, 2026-11-20 |
| ไฟล์ที่นำเข้า | `shelfpilot-ds/tokens.json`, `shelfpilot-ds/README.md`, `shelfpilot-ds/components/**` |
| ไม่ได้นำเข้า | `SKILL.md`, `artifact-type/**` (ตัวแสดงผลของ artifact), `design-system.json` |

## Figma: `figma/`

| ไฟล์ | คืออะไร |
|---|---|
| `figma/shelfpilot-design-system-and-wireframes.fig` | ไฟล์ Figma ต้นฉบับ "ShelfPilot AI — Design System & Wireframes" (export 2026-11-20, ~300 KB) — เปิดด้วย Figma (File → Import / Open local file) |
| `figma/thumbnail.png` | ภาพตัวอย่างขนาดเล็ก (293×400) จากไฟล์ .fig |
| `figma/meta.json` | metadata ที่ Figma แนบมากับ export (ชื่อไฟล์, เวลา export) |

เนื้อหาในไฟล์ (อ่านจาก string ภายใน ไม่ได้เปิดใน Figma): 2 หน้า คือ **Design System** (ตัวแปรสี light/dark, spacing, radius, text style — ตรงกับ `shelfpilot-ds/tokens.json`) และ **Wireframes & User Flow** (User Flow, Baseline คลังหนังสือ, Add-on AI Assistant + Recommendation, Admin Ingestion, Responsive)

- ไฟล์ `.fig` เป็น binary แก้ด้วย Figma เท่านั้น และ git diff อ่านไม่ได้ — ถ้าแก้ wireframe ให้ export ไฟล์ใหม่ทับ (หรือบันทึกการเปลี่ยนแปลงใน `docs/spec-ai-features.md`)
- ถ้า wireframe ใน Figma ต่างจาก artifact ที่ spec อ้างถึง (https://claude.ai/artifact/KwnNffUMGT96wvJYGWrWc2) ให้ถือ Figma เป็นต้นฉบับล่าสุดและอัปเดต spec ตาม

## กติกา

- ไฟล์ใน `shelfpilot-ds/` เป็นสำเนาที่ **ไม่แก้เนื้อหา** — ถ้า design system ต้นฉบับเปลี่ยน ให้นำเข้าใหม่ทับทั้งโฟลเดอร์
- `components/*/preview.html` เป็นตัวอย่างหน้าตา ไม่ใช่ React component — ต้องเขียน component ใน `web/` เอง ตามชื่อและ README ของแต่ละตัว
- `components/bundle.css` ขึ้นต้นด้วย `@import` ของ Google Fonts (Inter, Noto Sans Thai, IBM Plex Mono) — ตอนสร้าง `web/` ให้โหลดฟอนต์ผ่าน `next/font/google` แทน และตัดบรรทัด `@import` ออกจากสำเนาที่ใช้งานจริง (อย่าแก้ไฟล์ใน `design/`)
- ตรวจแล้วตอนนำเข้า: ไม่มี `<script>`, inline handler หรือ URL ภายนอกอื่นนอกจาก Google Fonts ข้างต้น
