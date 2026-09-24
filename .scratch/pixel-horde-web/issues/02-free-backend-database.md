# Research: backend + database ฟรีที่รองรับ anonymous account และ realtime

Type: research
Status: resolved
Blocked by: -

## Question

backend แบบไหนใช้ได้ฟรีและรองรับความต้องการของเราได้ครบที่สุด? ความต้องการคือ: Player Account แบบไม่ระบุตัวตนที่ผูก Google ทีหลังได้, สิทธิ์ admin แยกตาม role, สั่งให้ client ดึง Balance Config หรือรับแจ้งเมื่อมีเวอร์ชันใหม่, กฎความปลอดภัยระดับแถว (เช่น RLS), ฟังก์ชันฝั่ง server สำหรับตรวจคะแนน, และ cron สำหรับอีเวนต์ตามเวลาหรือสรุปสถิติ

ตัวเลือกที่ต้องเปรียบเทียบ: Supabase, Firebase (Spark plan), Cloudflare (Workers + D1 + KV + Durable Objects), Appwrite Cloud, PocketBase บน host ฟรี

ต้องได้คำตอบเรื่อง: โควตาฟรี (จำนวนแถว/พื้นที่/request/ผู้ใช้ต่อเดือน), นโยบายหยุดโปรเจกต์ที่ไม่มีคนใช้ (เช่น Supabase หยุดหลังไม่มีความเคลื่อนไหว 7 วัน), สิ่งที่เกิดขึ้นเมื่อใช้เกินโควตา และความยากในการย้ายออกภายหลัง

## Answer

แนะนำ **Supabase Free** เป็นตัวหลัก ทำได้ครบทุกข้อบนแพ็กเกจฟรี: anonymous auth แล้วผูก Google ทีหลังด้วย `linkIdentity()`, แยก role admin, RLS, ตรวจคะแนนฝั่ง server (Edge Functions), `pg_cron` และ Realtime Broadcast ไว้แจ้งเมื่อมี Balance Config เวอร์ชันใหม่

ข้อควรระวัง: โปรเจกต์ฟรีถูก pause ถ้าฐานข้อมูลไม่มีการใช้งาน ~1 สัปดาห์ (การเล่นของผู้เล่นนับเป็นการใช้งาน กันไว้ด้วย Cloudflare cron ยิง request เบาๆ วันละครั้ง) และ egress ฟรีแค่ 5 GB/เดือน ตอนเริ่ม Stage ให้เช็กแค่เลขเวอร์ชัน แล้ว cache Balance Config ไว้ใน localStorage

**ตัวสำรอง**: Cloudflare Workers + D1 (ไม่เคยถูก pause, export เป็น SQLite ได้ แต่ต้องเขียน auth/ผูกบัญชี/สิทธิ์เอง และโควตา 100k request/วันต้องแบ่งกับ co-op ตาม #03) ให้เกมเรียก backend ผ่าน `net/backend.ts` ไฟล์เดียว

ตัดออก: Firebase Spark (Functions/cron ต้องอัปเป็น Blaze ที่ผูกบัตร), Appwrite (pause ถ้า admin ไม่เข้า Console 7 วัน และลบโปรเจกต์หลัง pause 90 วัน), PocketBase (ไม่มีโฮสต์ฟรีที่อยู่ยาว ไม่มี anonymous auth ยังไม่ถึง 1.0)

ต้องทดสอบจริง: anonymous user นับรวมในเพดาน 50k MAU ไหม, ผูก Google ที่เป็นของบัญชีอื่นอยู่แล้วเกิดอะไรขึ้นและจะรวมเซฟยังไง, `pg_cron` นับเป็นการใช้งานกัน pause ได้ไหม, โปรเจกต์ที่ถูก pause กู้คืนได้ภายใน 90 วันหรือ 1 ปี (เอกสารขัดกัน)

รายละเอียดและแหล่งอ้างอิง (ตรวจ 2026-09-24): `docs/research/02-free-backend-database.md` บน branch `research/free-backend-database`
