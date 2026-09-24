# Grilling: data model และ schema ของ Balance Config

Type: grilling
Status: open
Blocked by: 11, 12, 17

## Question

ออกแบบข้อมูลทั้งหมดบน backend ที่เลือก: Player Account + Meta Progression (Gold, Shop, ตัวละครที่ปลดล็อก), คะแนนและ Season, เวอร์ชัน Balance Config + feature flags + อีเวนต์ตามเวลา + seed ของด่านท้าทายประจำวัน, event สถิติ, การแบน/ซ่อนชื่อ, ประกาศ และ audit log แต่ละตารางใครอ่าน/เขียนได้ (กฎความปลอดภัย) และจะย้ายเซฟเดิมที่อยู่ใน localStorage (`pixelhorde-meta`) ขึ้นไปยังไง

เพิ่มจาก #17: anonymous นับ MAU, rate limit 30/ชม./IP, ต้องมีงานลบ anonymous ที่ทิ้งไปแล้ว, ต้องออกแบบการรวมเซฟเมื่อเจอ `identity_already_exists`, ผู้เล่นห้ามเปิด Realtime ค้างไว้ (เพดาน 200 connection)
