# Task: พิมพ์เขียว diagram ของระบบปัจจุบัน

Type: task (AFK)
Status: resolved
Blocked by: -

## Question

ทำเอกสาร diagram ที่อ่านแล้วเข้าใจระบบปัจจุบันของ `pixel-horde.html` (ผู้ใช้ขอไว้) เป็นฐานร่วมกันก่อนตัดสินใจเรื่องที่เหลือ ต้องมีอย่างน้อย: สถาปัตยกรรมและโมดูลในไฟล์, state machine ของเกม, วงจรหนึ่ง Run (เลเวลอัป/หีบ/Stage clear/Meta Progression), การไหลของข้อมูล co-op ระหว่าง Host กับ Guest และส่วนที่ผูกกับ `window.claude` ซึ่งต้องเปลี่ยน

ส่งเป็นไฟล์ HTML ใน `docs/blueprint/` ใช้ skill `archify` หรือ `diagram-design` และเขียนคำอธิบายเป็นภาษาไทย

## Answer

ส่งแล้ว 2026-09-24: `docs/blueprint/current-system.html` (หน้าเดียว, ภาษาไทย, สีของเกม) มี 4 ภาพ: ผังโมดูลในไฟล์ (เน้น `window.claude` ที่ต้องเปลี่ยน), state machine, วงจรหนึ่ง Run + Meta Progression, ลำดับข้อมูล co-op ระหว่าง Host/ห้อง Claude/Guest และการ์ดสรุป 6 ใบ (สกิลและ evolution, ตัวละคร, ศัตรู, อีเวนต์พิเศษ, สูตรสมดุล, สิ่งที่ต้องเปลี่ยนเมื่อย้ายออกจาก Claude) บันทึกชุดสีเป็น diagram-design profile `pixel-horde` และมี marker `.diagram-design` ที่ root ของโปรเจกต์

สิ่งที่รวมหรือตัดเพื่อไม่ให้เกิน budget ของ skill: `pause` กลายเป็นโน้ต, `clearing`+`clear` อยู่กล่องเดียว, ภาพ loop เน้นสีเฉพาะขั้นเลือกสกิล ข้อจำกัดของการตรวจ: ไม่มี Python ในเครื่อง จึงรันสคริปต์ตรวจของ skill ไม่ได้ ตรวจตามกฎด้วยมือและใน browser แทน
