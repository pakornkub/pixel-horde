# Research: กันโกง leaderboard ในเกมเว็บที่คำนวณในเครื่องผู้เล่น

Type: research
Status: resolved
Blocked by: -

## Question

เกมคำนวณทุกอย่างในเบราว์เซอร์ของผู้เล่น (co-op ก็คำนวณในเครื่องโฮสต์) แล้วควรกันโกง leaderboard แบบไหนที่คุ้มค่าสำหรับเกมฟรีที่ admin มีคนเดียว?

เทียบวิธีเหล่านี้: server ตรวจว่าคะแนนเป็นไปได้จริงไหม (plausibility check), บันทึก seed + input แล้วให้ server เล่นซ้ำเพื่อยืนยัน (replay validation, ต้องเช็กว่า RNG แบบ seed ได้และคำนวณได้ผลตรงกันทุกครั้งพอหรือไม่), เซ็นชื่อ/token ต่อ Run, จำกัดความถี่การส่ง, และตรวจด้วยมือผ่าน admin

ต้องได้คำตอบเรื่อง: แต่ละวิธีป้องกันอะไรได้และใช้แรงแค่ไหน, ด่านท้าทายประจำวันแบบ seed เดียวกันทุกคนต้องใช้อะไรบ้างเพื่อให้ยุติธรรม และถ้าจะทำ replay validation ตอนแยกไฟล์ต้องเตรียมโค้ดส่วนไหนไว้บ้าง

## Answer

แนะนำให้**ทำเป็นขั้น (tier)**:

- **Tier 0 (วันเปิด leaderboard, ~2–3 วัน, 0 บาท):** เขียนคะแนนผ่าน RPC ฝั่ง server เท่านั้น (ตอนนี้ client เขียนลงตาราง `scores` ตรงๆ ได้ ที่ `pixel-horde.html` บรรทัด 1050–1052) + Run token ที่ server ออกตอนเริ่ม Run (server เลือก seed และจดเวลาเอง) + plausibility check เทียบกับ Balance Config version (ข้อที่แรงสุด: เวลาจริงขั้นต่ำ เพราะความยาว Stage ตายตัว) + rate limit ใน Postgres + Turnstile + ซ่อนคะแนน/แบนใน Admin Console
- **Tier 1 (ทำระหว่าง port เป็น TS ต้นทุนเกือบ 0 แต่ถ้าไม่ทำ Tier 2 จะทำไม่ได้เลย):** sim ต้องผลลัพธ์ซ้ำได้: fixed timestep, RNG ที่ใส่ seed ได้และแยก stream ให้ particle/ภาพ, ห้ามใช้ `Math.sin/cos/atan2/hypot/pow` ในส่วน sim (spec รับประกันผลตรงกันทุก browser แค่ + − × ÷ และ `Math.sqrt`), เก็บ input log + state hash และมี replay viewer ใน admin (checklist ข้อ 6 ในไฟล์)
- **Tier 2 (ตอนเปิดด่านท้าทายประจำวัน):** ตรวจ replay แบบ async บน GitHub Actions (รันซ้ำหนึ่ง Run น่าจะใช้ 10–30 วินาที เกินเพดาน Supabase Edge 2 วิ และ Cloudflare ฟรี 10 ms) เฉพาะด่านประจำวันและอันดับต้นของ solo แต่ละ Season อันดับสุดท้ายนับเฉพาะ Run ที่ตรวจผ่าน *(GitHub Actions ฟรีไม่จำกัดเฉพาะ repo สาธารณะ ต้องตัดสินว่าจะเปิด repo หรือใช้นาทีฟรีของ private)*
- **Co-op:** ตรวจด้วย replay ไม่ได้ (Guest คำนวณดาเมจเอง) ใช้ Tier 0 + เทียบยอดที่แต่ละคนส่ง + admin ตรวจเอง และติดป้าย "unverified" บนกระดาน

ด่านท้าทายประจำวันจะยุติธรรมได้ต้องมี: seed จาก server ที่เดาไม่ได้, Balance Config ตายตัวทั้งวัน, ล็อกตัวละครและปิด Meta Progression, อีเวนต์และตัวนับ pity มาจาก seed ไม่ใช่ประวัติผู้เล่น, ตัวเลือกตอนเลเวลอัปผูกกับเลขเลเวล, เล่นได้ครั้งเดียวต่อวัน และเปิดเฉพาะ solo ก่อน

รายละเอียดและแหล่งอ้างอิง (ตรวจ 2026-09-24): `docs/research/05-leaderboard-anticheat.md` บน branch `research/leaderboard-anticheat`
