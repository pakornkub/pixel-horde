# Map: Pixel Horde → web game จริงจัง

Label: wayfinder:map

## Destination

เอกสาร **Game Design + Tech Blueprint** ของ Pixel Horde เวอร์ชันเว็บที่ตัดสินใจครบแล้ว ครอบคลุม story/chapter, ระบบและเนื้อหาที่จะเพิ่ม, แนวกราฟิก, tech stack, hosting/database/co-op ที่ใช้ได้ฟรี, data model, Admin Console, leaderboard และสถิติ ต้องไม่มีอะไรค้างให้ตัดสินใจอีก พร้อมส่งต่อให้ `/to-spec` และ `/to-tickets` แตกเป็นงานลงมือทำ

## Notes

- **ภาษา**: คุยกับผู้ใช้เป็นภาษาไทย ส่วนโค้ด ชื่อไฟล์ และคำศัพท์ใน glossary ใช้อังกฤษ ใช้คำตาม `CONTEXT.md` เสมอ (Run, Stage, Chapter, Theme, Balance Config, Season, Admin Console…)
- **Skills**: ticket แบบ grilling ต้องเรียก `grilling` + `domain-modeling` / แบบ research ต้องเรียก `research` / diagram ใช้ `archify` หรือ `diagram-design` / ผู้ใช้ชอบคำอธิบายง่ายๆ ที่มีตัวอย่างหรือ widget ประกอบ
- **Design pillars** (ทุกการตัดสินใจต้องเช็กกับข้อเหล่านี้):
  1. เล่นง่าย ไม่ต้องคิดเยอะ แค่เดิน สกิลตีเอง
  2. ตีมอนทีละเยอะๆ ฝูงมอนมารุมแบบเกมในโฆษณา
  3. ดาเมจสะใจ สกิลอลังการ
  4. ภาพเรียบง่าย มุมมองจากด้านบนแบบ Pokémon Game Boy
  5. ระบบพัฒนาสกิลเป็นจุดขาย (level-up + Evolution)
  6. ผ่านทีละด่าน ตายแล้วเริ่มใหม่ แต่สะสมคะแนนและ Meta Progression
  7. เล่นกับเพื่อน (co-op) และแข่งกัน (leaderboard)
- **ข้อตกลงตั้งต้น** (ได้จาก session วางแผน 2026-09-24):
  - ทำฟรี ไม่หารายได้ แต่ออกแบบไม่ปิดทาง donate ในอนาคต งบ 0 บาท ใช้โดเมนย่อยฟรี
  - คงแกน survivor ไว้ story เบามาก: มีการ์ดเปิด Chapter กับบอสพูด 2–3 บรรทัด กดข้ามได้ มีตอนจบ
  - เล่นบนเว็บ ทั้งคอมและมือถือ ภาษาไทยเป็นหลัก + อังกฤษ
  - Player Account เริ่มแบบไม่ระบุตัวตน (ใช้ชื่อเล่น) แล้วผูก Google ทีหลังได้
  - Vite + TypeScript + Canvas 2D เขียนเอง ไม่ใช้ engine แยกส่วนวาดภาพไว้ให้เปลี่ยนเป็น WebGL ได้ทีหลัง
  - กราฟิกทั้งหมดเขียนเป็นแถวตัวอักษรในโค้ดเหมือนเดิม **ไม่ใช้ PixelLab/AI**
  - Balance Config มีผลตอนเริ่มด่านถัดไป + admin มีปุ่มทดสอบสดในเครื่องตัวเอง ทุกคะแนนบันทึกเลขเวอร์ชันไว้
  - Admin Console: admin คนเดียว แต่มีช่อง role เตรียมไว้
  - Leaderboard แบ่ง Season (admin กดเปิดเอง) แยก solo กับ co-op และมีตารางตลอดกาลไว้ดูอย่างเดียว
  - Co-op 2–4 คน ใช้รหัสห้อง ไม่มีระบบจับคู่
  - **Admin v1 ต้องทำได้**: ปรับสมดุล (ความยาก, ด่าน, เศรษฐกิจ, สกิล, อีเวนต์) · เวอร์ชัน + ย้อนกลับ · ตรวจช่วงค่า · ค่าเริ่มต้นฝังในเกม · สวิตช์เปิด/ปิด co-op, การส่งคะแนน และอีเวนต์รายตัว · โหมดปิดปรับปรุง · บังคับรีเฟรชเวอร์ชันเก่า · อีเวนต์ตามเวลา (เช่นสุดสัปดาห์เหรียญ ×2) · ด่านท้าทายประจำวัน (seed เดียวกัน) · สถิติ: คนเล่นต่อวัน/จำนวนรอบ/เวลาเล่น, ตายที่ด่านไหน, สกิลที่เลือกและพาไปได้ไกล, retention D1/D7, error/FPS, เทียบระหว่างเวอร์ชัน · ลบคะแนนโกง/ซ่อนชื่อ · แบน · เปิด Season · แจกเหรียญชดเชย/รีเซ็ตบัญชี · ประกาศบนหน้าแรก · ล็อกอิน admin + role · audit log

## Decisions so far

<!-- one line per closed ticket -->

- [Research: hosting ฟรีสำหรับตัวเกมและ Admin Console](issues/01-free-static-hosting.md): Cloudflare Pages สองโปรเจกต์ (เกม + admin หลัง Cloudflare Access) และลง itch.io เป็นช่องทางเสริม
- [Research: backend + database ฟรีที่รองรับ anonymous account และ realtime](issues/02-free-backend-database.md): Supabase Free ครบทุกข้อ (ต้องกันโปรเจกต์ถูก pause และประหยัด egress) และ Cloudflare Workers + D1 เป็นทางสำรอง
- [Research: ช่องทางส่งข้อมูล co-op 2–4 คนที่ใช้ได้ฟรี](issues/03-coop-transport.md): Cloudflare Worker + Durable Object ต่อห้อง (WebSocket ผ่าน CGNAT ได้, ฟรี ~6–12 ชม.เล่น/วัน) และ PeerJS + Cloudflare TURN เป็นทางสำรอง ส่วน Supabase Realtime ไม่พอ (ขัดกับ `CLAUDE.md` ที่ระบุ PeerJS)
- [Research: เก็บสถิติสำหรับ Admin v1 ให้อยู่ในโควตาฟรี](issues/04-telemetry-within-free-quota.md): เก็บในตารางของเราเอง ส่งสรุปครั้งเดียวต่อ Run (~0.8 KB) สรุปรวมทุกคืน เก็บรายละเอียดเฉพาะ 5% ของผู้เล่น ส่วน error/FPS/retention ทำเองได้ทั้งหมด
- [Grilling: เลือก hosting, backend และช่องทาง co-op](issues/12-backend-and-hosting-choice.md): Cloudflare Pages (+itch.io), Supabase Free (สำรอง Workers+D1), co-op ผ่าน Worker + Durable Object (สำรอง PeerJS+TURN), สถิติในตารางตัวเอง, repo private, เกมเล่น solo ได้แม้ server ล่ม ส่วนข้อสงสัยของแพ็กฟรีไปทดสอบใน #17
- [Task: ทดสอบข้อสงสัยของแพ็กฟรีที่เอกสารไม่ได้ตอบ](issues/17-verify-free-tier-unknowns.md): ผ่านทุกข้อ สร้าง Supabase `pixel-horde` (สิงคโปร์) แล้ว, `pg_cron` ใช้ได้, anonymous นับ MAU, Realtime ฟรีรับได้แค่ 200 connection (ผู้เล่นห้ามเปิดค้างไว้), Cloudflare ไม่ต้องผูกบัตร
- [Research: กันโกง leaderboard ในเกมเว็บที่คำนวณในเครื่องผู้เล่น](issues/05-leaderboard-anticheat.md): ทำเป็น tier: RPC + Run token + plausibility check ก่อน, ทำ sim ให้ผลลัพธ์ซ้ำได้ระหว่าง port, แล้วค่อยตรวจ replay บน GitHub Actions เมื่อเปิดด่านท้าทายประจำวัน ส่วน co-op ติดป้าย unverified

## Not yet specified

- **แผนแบ่งรุ่นปล่อย (release slicing)**: หลัง blueprint ครบแล้ว อะไรต้องมีในรุ่นแรกที่ปล่อยให้คนเล่น อะไรตามมาทีหลัง Admin v1 ที่เลือกไว้ใหญ่มาก อาจต้องทยอยปล่อย
- **เสียงและดนตรี**: pillar "ดาเมจสะใจ" ต้องพึ่งเสียงด้วย ตอนนี้สร้างเสียงสดด้วย Web Audio ยังไม่มีดนตรี ต้องตัดสินใจว่าจะทำต่อทางไหน
- **ประสิทธิภาพบนมือถือ**: มอนเยอะ + สกิลอลังการ อาจเกินกำลังมือถือ ต้องมีงบประมาณ (จำนวนมอน, particle, FPS เป้าหมาย) หลังรู้ขอบเขตเนื้อหา
- **รายละเอียดด่านท้าทายประจำวันและอีเวนต์ตามเวลา**: กติกา รางวัล การผูกกับ leaderboard รอให้ chapter และ data model ชัดก่อน
- **ขั้นตอนผูกบัญชี Google**: ถ้าผูกแล้วเจอเซฟสองชุดชนกันจะทำยังไง รอเลือก backend ก่อน
- **วัด co-op จริงตอน spike แรก**: latency ของ Durable Object จากไทย, P2P ล้มเหลวบ่อยแค่ไหนบน AIS/True/dtac, TURN ต้องผูกบัตรไหม (เลื่อนมาจาก #17 ไม่กระทบ blueprint)
- **ขั้นตอนแปลภาษา**: เก็บข้อความไทย/อังกฤษไว้ที่ไหน ใครแปล

## Out of scope

- ระบบหารายได้ / donate: ผู้ใช้เลือกทำฟรีก่อน แค่ไม่ปิดทางไว้
- ใช้ PixelLab / AI สร้างภาพ: ผู้ใช้เลือกวาดเป็นตัวอักษรในโค้ดแบบเดิม
- ระบบจับคู่ co-op กับคนแปลกหน้า และหน้าดูผู้เล่นออนไลน์แบบสดใน admin: ต้องมี server ทำงานตลอดเวลา ขัดกับงบ 0 บาท
- การลงมือเขียนโค้ด (แยกไฟล์, deploy, สร้าง backend): เป็นงานหลังถึงปลายทางแล้ว
