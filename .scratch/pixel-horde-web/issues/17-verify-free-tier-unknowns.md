# Task: ทดสอบข้อสงสัยของแพ็กฟรีที่เอกสารไม่ได้ตอบ

Type: task (HITL)
Status: resolved
Blocked by: 12

## Question

สมัครบัญชีที่ยังไม่มีแล้วทดสอบจริง เพื่อยืนยันสมมติฐานที่ #12 ใช้:

ผู้ใช้ทำ (checklist):
- สมัคร Supabase (ใช้ GitHub ล็อกอินได้) สร้างโปรเจกต์ฟรี region สิงคโปร์
- บน Cloudflare: เปิด Workers (แผนฟรี) และดูว่าต้องผูกบัตรไหม ทั้งสำหรับ Workers/Durable Objects และ Realtime TURN

agent ทำ (สคริปต์ทดสอบ):
- `pg_cron` เปิดใช้บนแพ็กฟรีได้ไหม และนับเป็นการใช้งานที่กันโปรเจกต์ถูกพักไหม
- ผู้เล่นแบบ anonymous นับรวมในเพดาน 50k MAU ไหม
- `linkIdentity()` กับบัญชี Google ที่เป็นของผู้ใช้อื่นอยู่แล้ว เกิด error อะไร และต้องรวมเซฟยังไง
- Durable Object: ห้องทดลอง 2–4 client วัด latency จากไทย และดูว่า DO ไปอยู่ region ไหน
- Supabase Realtime Broadcast ใช้แจ้ง Balance Config ใหม่ได้ภายในโควตา (ส่งไม่กี่ครั้งต่อวัน)

บันทึกผลในคำตอบ ถ้าข้อไหนไม่ผ่าน ระบุว่าจะสลับไปใช้ตัวสำรองตัวไหน

## Answer

ทดสอบ 2026-09-24 **สมมติฐานของ #12 ผ่านทุกข้อ ไม่ต้องสลับไปใช้ตัวสำรอง**

สิ่งที่สร้างไว้:
- Supabase project `pixel-horde` (id `jqvgmkhzdhjreikjqhxt`, region `ap-southeast-1`, org "pakornkub's Org", 0 USD/เดือน) URL `https://jqvgmkhzdhjreikjqhxt.supabase.co`
- เปิด extension `pg_cron` ค้างไว้ ส่วนงานและตารางทดสอบลบทิ้งแล้ว

ผลการทดสอบ:
1. **`pg_cron` ใช้ได้บนแพ็กฟรี** ทดสอบจริง: ตั้งงานรันทุกนาที รันสำเร็จ (`INSERT 0 1`) หมายเหตุ: หลังสร้าง extension ใหม่ๆ งานแรกใช้เวลาสักพักกว่าจะเริ่มรัน
2. **ผู้เล่น anonymous นับรวมใน MAU** (MAU = จำนวน user id ไม่ซ้ำที่มี auth event เช่น login หรือ refresh token ในรอบบิล ฟรี 50,000) ข้อจำกัดอื่นที่เจอ:
   - anonymous sign-in จำกัด **30 ครั้ง/ชม./IP** (ปรับได้ใน dashboard) ร้านเกมหรือโรงเรียนที่ใช้ IP เดียวกันอาจติด ต้องเพิ่มเพดานคู่กับเปิด Turnstile ตามที่ Supabase แนะนำ
   - Supabase **ไม่ลบ anonymous user ที่ทิ้งไปแล้วให้อัตโนมัติ** ต้องตั้งงาน `pg_cron` ลบเอง
3. **ผูก Google ที่เป็นของบัญชีอื่นอยู่แล้ว**: `linkIdentity()` คืน error `identity_already_exists` Supabase ไม่รวมข้อมูลให้ แอปต้องให้ผู้เล่น login เข้าบัญชีเดิม แล้วย้ายหรือรวมข้อมูลของบัญชี anonymous เข้าไปเอง ตามกติกาที่เราเลือก และต้องเปิด "manual linking" ใน dashboard (ยังไม่ได้ลองกับ Google จริง เพราะต้องสร้าง OAuth client ใน Google Cloud ก่อน เลื่อนไปทำตอน implement)
4. **การ pause**: กันได้ถ้ามี "user request เข้าฐานข้อมูลไม่กี่ครั้งต่อวัน" จะได้อีเมลเตือนก่อนหนึ่งสัปดาห์ และ**กู้คืนได้ภายใน 90 วัน** (เอกสารทางการยืนยันแล้ว ส่วนเลข 1 ปีเป็นข้อมูลเก่า) งาน `pg_cron` ภายในไม่ใช่ user request จึงยังต้องใช้ Cloudflare cron ปลุกจากภายนอกตามแผน
5. **ข้อค้นพบใหม่: Realtime แพ็กฟรีรับ connection พร้อมกันได้แค่ 200 และ 100 ข้อความ/วินาที** ผู้เล่นจึง**ห้ามเปิด Realtime ค้างไว้** ให้เช็กเลขเวอร์ชัน Balance Config ผ่าน REST ตอนเริ่ม Stage (ตรงกับแผน cache อยู่แล้ว) ใช้ Realtime กับ Admin Console หรือปุ่มทดสอบสดเท่านั้น
6. **Cloudflare**: ผู้ใช้ยืนยันว่า Workers & Pages ไม่ต้องผูกบัตร Durable Objects ใช้ได้บน Workers Free (เฉพาะแบบ SQLite) ใช้เกินโควตารายวันแล้ว operation จะ error และรีเซ็ต 00:00 UTC (07:00 เวลาไทย) ในบัญชีมี Worker `next-starter-template` อยู่แล้วหนึ่งตัว ไม่เกี่ยวกับโปรเจกต์นี้

เลื่อนไปทำตอน spike co-op แรก (ไม่เปลี่ยนการตัดสินใจใดใน blueprint เพราะมีตัวสำรองรออยู่แล้ว): วัด latency ของ DO จากไทยและดูว่าอยู่ region ไหน, ดูว่า Cloudflare Realtime TURN ต้องผูกบัตรไหม, วัดว่า P2P ล้มเหลวบ่อยแค่ไหนบน AIS/True/dtac
