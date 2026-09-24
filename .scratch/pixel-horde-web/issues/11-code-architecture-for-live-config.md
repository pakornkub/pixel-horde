# Grilling: โครงโค้ดหลังแยกไฟล์ ที่รองรับ Balance Config, i18n และการยืนยันคะแนน

Type: grilling
Status: resolved
Blocked by: 05

## Question

ยืนยันโครงสร้างโมดูลที่เสนอไว้ใน `CLAUDE.md` แล้วปรับให้รองรับข้อตกลงใหม่: ค่าทุกตัวใน `data/balance.ts` ต้องมี schema, ช่วงค่าที่ยอมรับ และค่าเริ่มต้น เพื่อให้ Admin Console แก้ได้, การสลับเวอร์ชัน Balance Config ตอนเริ่ม Stage, ข้อความภาษาไทย/อังกฤษ (i18n), RNG แบบ seed ได้และคำนวณได้ผลตรงกันทุกครั้งในระดับที่ #05 แนะนำ, feature flags, และชุดทดสอบ headless ต้องได้เป็นผังโมดูลกับเส้นแบ่งระหว่างตัวเกม, ส่วนต่อ backend และ Admin Console

## Answer

ตัดสินใจ 2026-09-24 (ผู้ใช้เห็นชอบทุกข้อ) หลักออกแบบ: โมดูลลึก แกนคือ **sim** ที่คำนวณเกมโดยไม่รู้จักจอ เน็ต หรือนาฬิกาจริง ใช้ตัวเดียวกันทั้งในเกม ชุดทดสอบ และ server ตรวจ replay

1. **Repo**: npm workspaces
   - `apps/game` (ตัวเกม), `apps/admin` (Admin Console)
   - `packages/sim` (headless: ห้าม import DOM/Canvas/เน็ต), `packages/config` (Balance Config schema), `packages/i18n` (th.json / en.json + `t()`)
   - `workers/room` (Durable Object), `supabase/` (migrations, RPC)
   - `tests/` (Vitest)
2. **Sim**: คำนวณ **60 tick/วินาที** คงที่ (ค่าอยู่ใน Balance Config) ช่องทางใช้งาน: `createSim({seed, config, hero, weapon, meta})` → `step(inputFrame, commands)`, `view()`, `score()`, `hash()` ส่วนหน้าจอเมนูฟังเหตุการณ์จาก sim แล้วส่ง Command กลับ
3. **ทำให้เล่นซ้ำได้ผลเดิม (ขั้น 1 ของกันโกง) ตั้งแต่ตอนย้ายโค้ด**:
   - RNG แบบ seed ได้ (`core/rng.ts` ใช้เลข 32-bit แยก stream ตามชื่อ) ห้าม `Math.random` ใน sim และแยก `fxRng` ให้ส่วนวาดภาพ
   - fixed-step accumulator เก็บเวลาเป็น tick
   - `fmath` ที่ให้ผลเหมือนกันทุก browser + ESLint ห้าม `Math.sin/cos/atan2/hypot/pow/exp/log/random`, `Date.now`, `performance.now` ในโฟลเดอร์ sim
   - `InputFrame` + `Command` บันทึกไว้ตลอด (ส่งออก replay ได้ทุกรอบ)
   - state hash ทุก 60 tick, `scoreOf(state)` ที่เดียว
   - รายการครบอยู่ใน `docs/research/05-leaderboard-anticheat.md` §6
4. **Balance Config** นิยามด้วย **zod**: ค่าเริ่มต้น + ช่วงค่า + คำอธิบาย ใช้ซ้ำเป็น type, ตัวตรวจตอนโหลด, ฟอร์มอัตโนมัติใน Admin และตัวตรวจฝั่ง server
5. **Feature flags แยกจาก Balance Config** มีผลทันที ดึงตอนเปิดเกม, ตอนเริ่มด่าน และก่อนสร้างห้อง/ส่งคะแนน
6. **หน้าจอ**: ตัวเกมใช้ DOM ธรรมดา (ไม่มี framework) ส่วน Admin ใช้ **Preact + uPlot**
7. **ลำดับการย้ายโค้ด**:
   1. ย้ายเข้าโครงใหม่ + วางพื้นฐานเล่นซ้ำได้ผลเดิม โดยเกมเล่นเหมือนเดิม
   2. ชุดทดสอบ headless + replay ทองคำ
   3. ต่อ backend, Admin, co-op ใหม่
   4. ค่อยเพิ่มระบบใหม่
8. **ไลบรารี open source ที่เลือก**:
   - **PartyServer + partysocket** สำหรับห้อง co-op บน Durable Object (ต่อใหม่อัตโนมัติ, broadcast, คนเข้า-ออก)
   - **zod**, **supabase-js**, **Preact + uPlot**
   - **ZzFX / ZzFXM** สำหรับออกแบบเสียงเอฟเฟกต์และเพลงแบบสร้างสด (ไม่ใช้ไฟล์เสียง)
   - **Vitest + Playwright** (ตรวจว่าเล่นซ้ำได้ hash เดิมใน Chromium/Firefox/WebKit)
   - เก็บ **PixiJS 8** ไว้เป็นทางเลือกของส่วนวาดภาพถ้ามือถือไม่ไหว
   - ใช้ **Supabase Studio** ดูแลข้อมูลชั่วคราวระหว่างที่ Admin ยังไม่เสร็จ
   - **ไม่ใช้** เอนจินเกม (Phaser/Excalibur/Kaplay/LittleJS: ต้องเขียนใหม่ และส่วนใหญ่ผลไม่เหมือนเดิมทุกครั้ง), bitECS (มอน ~320 ตัวไม่จำเป็น), Colyseus (ต้องมี server รันตลอด)
   - เวอร์ชันที่ตรวจบน npm 2026-09-24: partyserver 0.5.10, partysocket 1.3.0, zod 4.6.5, supabase-js 2.117.1, preact 10.29.8, uplot 1.6.32, zzfx 1.3.2, pixi.js 8.21.0
