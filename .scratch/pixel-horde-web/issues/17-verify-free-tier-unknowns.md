# Task: ทดสอบข้อสงสัยของแพ็กฟรีที่เอกสารไม่ได้ตอบ

Type: task (HITL)
Status: claimed
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
