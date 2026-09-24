# Grilling: โครงโค้ดหลังแยกไฟล์ ที่รองรับ Balance Config, i18n และการยืนยันคะแนน

Type: grilling
Status: open
Blocked by: 05

## Question

ยืนยันโครงสร้างโมดูลที่เสนอไว้ใน `CLAUDE.md` แล้วปรับให้รองรับข้อตกลงใหม่: ค่าทุกตัวใน `data/balance.ts` ต้องมี schema, ช่วงค่าที่ยอมรับ และค่าเริ่มต้น เพื่อให้ Admin Console แก้ได้, การสลับเวอร์ชัน Balance Config ตอนเริ่ม Stage, ข้อความภาษาไทย/อังกฤษ (i18n), RNG แบบ seed ได้และคำนวณได้ผลตรงกันทุกครั้งในระดับที่ #05 แนะนำ, feature flags, และชุดทดสอบ headless ต้องได้เป็นผังโมดูลกับเส้นแบ่งระหว่างตัวเกม, ส่วนต่อ backend และ Admin Console
