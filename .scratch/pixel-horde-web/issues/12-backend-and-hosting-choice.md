# Grilling: เลือก hosting, backend และช่องทาง co-op

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 04

## Question

จากผล research #01–#04 จะใช้บริการตัวไหนสำหรับ hosting เกมกับ Admin Console, database และการยืนยันตัวตน, realtime/การแจ้ง Balance Config ใหม่, การส่งข้อมูล co-op และการเก็บสถิติ? ต้องอยู่ในงบ 0 บาท และต้องระบุความเสี่ยงของแพ็กฟรี (เช่นโปรเจกต์ถูกหยุด หรือใช้เกินโควตา) พร้อมแผนสำรอง

เพิ่มจาก #05: ต้องตัดสินด้วยว่า repo จะเป็นสาธารณะ (GitHub Actions ฟรีไม่จำกัด ใช้ตรวจ replay ได้เต็มที่) หรือ private (มีนาทีฟรีจำกัดต่อเดือน)

## Answer

ตัดสินใจ 2026-09-24 (ผู้ใช้เลือกตามข้อแนะนำทุกข้อ):

1. **Hosting**: Cloudflare Pages สองโปรเจกต์: `pixel-horde` (เกม) และ `pixel-horde-admin` (หลัง Cloudflare Access) + อัปโหลด build ขึ้น itch.io อีกช่องทาง
2. **Backend**: Supabase Free (Auth anonymous → `linkIdentity()` Google, Postgres + RLS, RPC ตรวจคะแนน, Realtime แจ้ง Balance Config ใหม่, `pg_cron`) เรียกผ่าน `net/backend.ts` ไฟล์เดียว **ตัวสำรอง**: Cloudflare Workers + D1 มี Worker cron ปลุก Supabase วันละครั้ง ตอนเริ่ม Stage เช็กแค่เลขเวอร์ชันแล้ว cache Balance Config ไว้ในเครื่อง
3. **Co-op**: Cloudflare Worker + Durable Object หนึ่งตัวต่อห้อง (WebSocket) **ตัวสำรอง**: PeerJS + Cloudflare TURN ทั้งสองอยู่หลัง `net/transport.ts` ถ้าโควตาเต็มในวันนั้น เกมบอกผู้เล่นว่า "co-op เต็มวันนี้" แทนที่จะค้าง แก้ `CLAUDE.md` ให้ตรงแล้ว
4. **สถิติ**: ตารางของเราเองใน Supabase ส่งสรุปครั้งเดียวต่อ Run สรุปรวมทุกคืน (ตาม #04)
5. **Repo**: GitHub private (`pakornkub`) ใช้นาที Actions ฟรี 2,000 นาที/เดือนตรวจ replay เปิดเป็น public ทีหลังได้
6. **ตอน server ล่ม**: เกมเล่น solo ได้เต็มที่ด้วย Balance Config ที่ฝังไว้และเซฟในเครื่อง ส่วนฟีเจอร์ออนไลน์ปิดชั่วคราวพร้อมบอกผู้เล่น คะแนนที่ส่งไม่ได้เก็บคิวไว้ส่งทีหลัง
7. **บัญชี**: มี GitHub (gh CLI ล็อกอินแล้ว) และ Cloudflare อยู่แล้ว ยังไม่มี Supabase เรื่องที่เอกสารไม่ตอบให้ไปทดสอบจริงใน #17 ถ้าไม่ผ่านจะสลับไปใช้ตัวสำรองที่เตรียมไว้
