# Research: ช่องทางส่งข้อมูล co-op 2–4 คนที่ใช้ได้ฟรี

Type: research
Status: resolved
Blocked by: -

## Question

co-op ควรส่งข้อมูลผ่านอะไร? ตอนนี้โฮสต์เป็นคนคำนวณทุกอย่าง แล้วส่ง snapshot ~15 ครั้งต่อวินาที ขนาดไม่เกิน ~4 KB (มอนตัวละ 11 ตัวอักษร สูงสุด 230 ตัว) ส่วนแขกส่งยอดดาเมจกลับทุก 150 ms และข้อมูลตัวเอง ~20 ครั้งต่อวินาที

ตัวเลือกที่ต้องเปรียบเทียบ: PeerJS + PeerJS cloud server (WebRTC P2P), WebRTC ที่ต้องมี STUN/TURN (TURN ฟรีมีที่ไหนบ้าง เช่น Cloudflare Calls/TURN, Metered, Open Relay), ส่งผ่าน server เช่น Supabase Realtime Broadcast หรือ Cloudflare Durable Objects WebSocket

ต้องได้คำตอบเรื่อง: ความเชื่อถือได้เมื่ออยู่หลัง NAT หรือใช้เน็ตมือถือ, latency, โควตาฟรีเมื่อคิดจาก bandwidth ข้างบน (2–4 คน × ชั่วโมงเล่นต่อเดือน), ใช้รหัสห้อง 4–6 ตัวได้ไหม และถ้าโฮสต์หลุดทำอะไรได้บ้าง

## Answer

แนะนำ **Cloudflare Worker + Durable Object หนึ่งตัวต่อห้อง** ส่งต่อข้อความผ่าน WebSocket (WSS พอร์ต 443 ผ่าน CGNAT ของเน็ตมือถือไทยได้, ใช้รหัสห้องเป็นชื่อ DO ได้ตรงๆ, ห้องยังอยู่แม้ Host หลุด ทำให้ reconnect หรือย้าย Host ได้) โควตาฟรีวันละ 100,000 request ≈ 4 คนเล่นได้ ~5.8 ชม./วัน หรือ ~12.3 ชม./วันถ้าลดข้อความของ Guest เป็น 10 Hz เกินแล้วระบบจะ error จนรีเซ็ต 07:00 เวลาไทย **ทางสำรอง**: PeerJS P2P + Cloudflare TURN (ฟรี 1,000 GB/เดือน) ให้ทั้งสองแบบอยู่หลัง interface `net/transport.ts` เดียวกัน

ตัดออก: Supabase Realtime (นับข้อความทั้งผู้ส่งและผู้รับทุกคน โควตาฟรีหมดใน ~88 นาทีต่อเดือน) และ PeerJS อย่างเดียว (server 0.peerjs.com ไม่รับประกันความเสถียร และ Host ต้องอัปโหลดแยกให้ทุกคน สูงสุด ~648 MB/ชม.)

ยังไม่ได้ยืนยัน: latency ที่เพิ่มขึ้นจาก DO (ประมาณ 20–60 ms) และ DO ของผู้เล่นไทยจะไปอยู่ที่ไหน, P2P ล้มเหลวบ่อยแค่ไหนบน AIS/True/dtac (ควรวัดตอน playtest), Workers แผนฟรีและ TURN ต้องผูกบัตรหรือไม่ **ขัดกับ `CLAUDE.md`** ที่ตอนนี้กำหนดให้ใช้ PeerJS ให้ไปตัดสินใน #12/#16

รายละเอียด, การคำนวณโควตา และแหล่งอ้างอิง (ตรวจ 2026-09-24): `docs/research/03-coop-transport.md` บน branch `research/coop-transport`
