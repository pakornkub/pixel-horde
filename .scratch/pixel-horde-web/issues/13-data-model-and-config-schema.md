# Grilling: data model และ schema ของ Balance Config

Type: grilling
Status: resolved
Blocked by: 11, 12, 17

## Question

ออกแบบข้อมูลทั้งหมดบน backend ที่เลือก: Player Account + Meta Progression (Gold, Shop, ตัวละครที่ปลดล็อก), คะแนนและ Season, เวอร์ชัน Balance Config + feature flags + อีเวนต์ตามเวลา + seed ของด่านท้าทายประจำวัน, event สถิติ, การแบน/ซ่อนชื่อ, ประกาศ และ audit log แต่ละตารางใครอ่าน/เขียนได้ (กฎความปลอดภัย) และจะย้ายเซฟเดิมที่อยู่ใน localStorage (`pixelhorde-meta`) ขึ้นไปยังไง

เพิ่มจาก #17: anonymous นับ MAU, rate limit 30/ชม./IP, ต้องมีงานลบ anonymous ที่ทิ้งไปแล้ว, ต้องออกแบบการรวมเซฟเมื่อเจอ `identity_already_exists`, ผู้เล่นห้ามเปิด Realtime ค้างไว้ (เพดาน 200 connection)

## Answer

ตัดสินใจ 2026-09-24 (ผู้ใช้เห็นชอบทุกข้อ) บน Supabase project `pixel-horde` หลัก: **ผู้เล่นไม่เขียนตารางตรงๆ เลย** ทุกการเขียนผ่าน RPC ที่ตรวจความสมเหตุสมผลก่อน และทุกตารางเปิด RLS

**ตาราง**
- *ผู้เล่น*:
  - `profiles` (id = auth user, nickname, role player/admin, name_hidden, banned_until, created_at, last_seen)
  - `meta_progress` (user_id, gold, shop jsonb, heroes[], weapons[], stats jsonb, updated_at)
- *การเล่นและคะแนน*:
  - `runs` (id, user_id, token, seed ที่ server สุ่ม, mode solo/coop/daily/endless, room_id, hero, weapon, config_versions[], started_at/ended_at, result, chapter, kills, level, escapes, gold_earned, score, status started/submitted/verified/rejected/hidden, summary jsonb ~0.8 KB)
  - `leaderboard` (season_id, board solo/coop/endless/daily:วันที่, user_id, best_run_id, score, weapon, verified; เก็บเฉพาะดีที่สุดต่อคนต่อกระดาน)
  - `seasons`
  - replay เป็นไฟล์ใน Supabase Storage
- *Live ops*:
  - `balance_configs` (version, data jsonb ตาม zod schema, status draft/published/archived, note, created_by, published_at)
  - `feature_flags` (key, value, min_client_build)
  - `scheduled_events`, `daily_challenges` (date, seed, hero, weapon, route, config_version), `announcements` (th/en)
- *สถิติ*:
  - `player_days` (retention)
  - `telemetry_samples` (5%)
  - `client_errors` (รวมซ้ำตาม fingerprint)
  - `stats_daily` (สรุปทุกคืนแยกตาม config_version)
- *ดูแลระบบ*:
  - `audit_log` (เขียนโดย trigger เท่านั้น ลบไม่ได้)
  - `gold_grants`

**RPC หลัก**:
- `start_run` → token + seed (บันทึก player_days)
- `submit_run` → ตรวจเวลาขั้นต่ำ, เพดานคะแนนและ Gold เทียบ Chapter/config version, rate limit แล้วเพิ่ม Gold และอัปเดต leaderboard
- `buy_upgrade`, `set_nickname`, `merge_accounts`, `report_errors`, `report_telemetry`
- ฝั่ง admin: `publish_config`, `rollback_config`, `set_flag`, `ban`, `hide_score`, `open_season`, `grant_gold` (บันทึก audit_log อัตโนมัติทุกฟังก์ชัน)

**กติกา**:
1. **Server เป็นผู้นับ Gold**: เพิ่มได้ทางเดียวคือ `submit_run` (มีเพดาน) ลดผ่าน `buy_upgrade` (และการใช้ Gold ในรอบที่ส่งมากับผลรอบ) เล่นออฟไลน์ ผลรอบเข้าคิวรอส่ง ระหว่างนั้นแสดงยอดในเครื่อง เซฟสองเครื่องจึงไม่ชนกัน
2. **ผูก Google แล้วเจอ `identity_already_exists`**: รวมอัตโนมัติ ของสะสม (ฮีโร่, อาวุธ, ระดับร้านที่สูงกว่า) เอาทั้งสองฝั่ง, Gold เอาฝั่งที่**มากกว่า** (ไม่บวก กันปั๊ม Gold), leaderboard เอาคะแนนดีที่สุด
3. **ลบบัญชีที่ถูกทิ้ง** (ยังไม่ผูก Google และไม่ได้เข้าเล่น 90 วัน) ด้วย pg_cron และหน้าแรกชวนผูก Google
4. **ระยะเวลาเก็บ**: runs 30 วัน (ยกเว้นรอบที่เป็นคะแนนดีที่สุดบน leaderboard หรือถูกแจ้ง เก็บตลอด) · telemetry_samples 14 วัน · client_errors 30 วัน · stats_daily ตลอดไป · replay เฉพาะ 50 อันดับแรกต่อกระดาน + รอบที่ถูกแจ้ง เก็บต่ออีก 30 วันหลังหลุดอันดับ (ประมาณ 250–300 MB ที่ 10k รอบ/วัน)
5. **เซฟเก่า `pixelhorde-meta`**: อัปโหลดเป็นเซฟเริ่มต้นครั้งเดียว ติดป้ายว่ามาจากเซฟเก่า
6. **Setting เก็บในเครื่องอย่างเดียว**
7. **ทุกการแก้ไขของ admin** ผ่าน RPC ที่ trigger บันทึก audit_log
8. **Seed**: server สุ่มตอน `start_run` และ seed ด่านประจำวันอ่านได้เฉพาะตั้งแต่วันนั้น (สร้างล่วงหน้าด้วย pg_cron)
9. ผู้เล่น**ไม่เปิด Realtime ค้างไว้** (เพดาน 200 connection จาก #17) เช็กเลขเวอร์ชัน Balance Config/flags ผ่าน REST

เพิ่มภายหลังจาก #15: ตาราง `player_titles`, `player_badges`, `achievements` และคอลัมน์ `profiles.shown_title` ส่วนรางวัลจบ Season แจกด้วย RPC `open_season` (ตรวจเฉพาะคะแนนที่ยืนยันแล้ว)
