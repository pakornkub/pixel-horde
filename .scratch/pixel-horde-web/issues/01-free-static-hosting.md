# Research: hosting ฟรีสำหรับตัวเกมและ Admin Console

Type: research
Status: resolved
Blocked by: -

## Question

บริการไหนเหมาะที่สุดสำหรับวางไฟล์ static ที่ build จาก Vite (ตัวเกม + Admin Console แยกหน้า) โดยใช้ได้ฟรีถาวร? เปรียบเทียบ Cloudflare Pages, GitHub Pages, Netlify, Vercel และการฝังผ่าน itch.io ในเรื่อง: bandwidth/build ต่อเดือนของแพ็กฟรี, โดเมนย่อยฟรีและการผูกโดเมนของตัวเองทีหลัง, deploy อัตโนมัติจาก git, ทำ preview ได้หรือไม่, หน้า admin แยกกันได้หรือไม่, และเงื่อนไขการใช้งาน (เช่นใส่ลิงก์ donate ได้ไหมในอนาคต)

## Answer

แนะนำ **Cloudflare Pages** แยกเป็นสองโปรเจกต์จาก repo เดียว: `pixel-horde` (เกม) กับ `pixel-horde-admin` (Admin Console ล็อกด้วย Cloudflare Access ฟรีถึง 50 คน แต่สิทธิ์จริงต้องบังคับที่ backend ด้วย) ได้ bandwidth ไม่จำกัดสำหรับไฟล์ static, build 500 ครั้งต่อเดือน, preview ทุก PR, โดเมนย่อย `*.pages.dev` ฟรี และผูกโดเมนของตัวเองทีหลังได้ อัปโหลดขึ้น itch.io เพิ่มเป็นอีกช่องทางให้คนค้นเจอ (รองรับการจ่ายเท่าไรก็ได้ ถ้าจะรับ donate ในอนาคต)

ทางเลือกที่ตัดออก: Netlify (เครดิตฟรีหมดแล้วเว็บถูกหยุด), Vercel Hobby (ใช้ได้เฉพาะงานไม่หารายได้ แม้ donate จะไม่นับเป็นการค้า), GitHub Pages (ล็อกหน้า admin ไม่ได้ ไม่มี preview)

ยังไม่ชัด: ยังไม่ได้อ่านข้อตกลงฉบับเต็มของ Cloudflare/Netlify

รายละเอียดและแหล่งอ้างอิง (ตรวจ 2026-09-24): `docs/research/01-free-static-hosting.md` บน branch `research/free-static-hosting`
