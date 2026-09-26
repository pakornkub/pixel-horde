// Recommended Balance Config changes from playtest passes (scripts/playtest: headless Runs with a
// scripted player). Version 0 (the built-in defaults) stays the original game; these values reach
// players only when the admin loads a pass into a draft in the Admin Console (Balance → "ใส่ค่าจากรอบจูน")
// and publishes a new version. The pass's report is published with that version and shown in Admin.
import type { BalanceConfigInput } from './schema';
import type { ChangeEntry } from './changelog';

/** A balance report shown in Admin → Balance (Thai, for the owner); stored with the published version. */
export interface BalanceReport {
  title: string;
  /** One paragraph: what was wrong and what the change does. */
  summary: string;
  /** How the numbers were measured. */
  method?: string;
  /** Headline measurements before → after. */
  metrics?: { label: string; before: string; after: string }[];
  findings?: { level: 'bad' | 'warn' | 'info'; title: string; body: string; status: string }[];
  /** Why each value changed, by Balance Config path (e.g. "shared.kings.splash.r"). */
  reasons?: Record<string, string>;
  /** What is still open after this change. */
  next?: string[];
  /** Full report (charts) outside the Admin Console. */
  link?: string;
}

export interface BalancePass {
  id: string; note: string; patch: BalanceConfigInput; report: BalanceReport;
  /** Changelog entry players read (website Updates page). */
  changelog: Pick<ChangeEntry, 'titleTh' | 'titleEn' | 'items'>;
}

export const BALANCE_PASS_2026_09: BalancePass = {
  id: '2026-09',
  note: 'Playtest balance pass 2026-09: Chapter 1 wall, beatable Umbra, Awakening worth taking, weak Signatures, runaway combos',
  patch: {
    shared: {
      // Stages as long as the live version; Kings grow slower so late Kings stop escaping
      stage: { durBase: 80, durMax: 180, bossHpGrowth: 1.15 },
      // King Slime's Royal Splash was unavoidable at base speed and caused about half of all Chapter 1 damage
      kings: { splash: { r: 100, dur: 1.6, dmg: 1.2 } },
      scaling: { eliteDmg: 1.35 },
      spawn: { base: 1.2 },
      // Toxic Burst and Overload carried 40–70% of some Heroes' damage
      combos: { overload: 1.25, toxicBurst: 0.8, toxicBurstR: 28 },
      // Awakening used to cost as much as it gave (two maxed Links for level-1 skills)
      awaken: { sigDmg: 2.2, grant: 1, grantLv: 6, wLine: 2 },
      skills: {
        meteor: { n: { perLv: 0.6 }, dmg: { perLv: 32 } },
        // Signatures were among the weakest skills in the game
        hawk: { dmg: { base: 40, perLv: 26 }, cd: { base: 1.6, min: 0.8 }, r: 22, evo: { n: 3 } },
        flask: { dmg: { base: 28, perLv: 13 }, cd: { base: 2.3 }, r: { base: 26 }, evo: { dmgMul: 1.5 } },
        shield: { dmg: { base: 10, perLv: 6 }, evo: { n: 4 } },
        // Kit and Vex lagged behind at the top end: their weakest Skill Line skills get real damage
        galeStep: { dmg: { base: 30, perLv: 14 } },
        arrowRain: { dmg: { perLv: 8 } },
        cauldron: { dmg: { base: 16, perLv: 9 } },
      },
      umbra: { boltDmg: 0.5 },
      heroes: { ranger: { spd: 0.15 } },
    },
    worlds: { lumora: { enemies: { boss: { hp: 1800 }, umbra: { hp: 2000, dmg: 24 } } } },
  },
  changelog: {
    titleTh: 'ปรับสมดุลครั้งใหญ่: ด่านแรกไม่โหดเกินไป บอสสุดท้ายชนะได้',
    titleEn: 'Big balance update: a fairer first Chapter, a beatable final boss',
    items: [
      { cat: 'boss', th: 'King Slime: ท่า Royal Splash คลื่นเล็กลงและช้าลง วิ่งหนีทันแล้ว เจ็บน้อยลง และเลือดลดลงเล็กน้อย', en: 'King Slime: Royal Splash is smaller, slower and weaker, so you can outrun it; slightly less HP' },
      { cat: 'boss', th: 'Umbra บอสสุดท้าย: เลือดและดาเมจลดลงมาก ลูกไฟเงาเบาลง ตอนนี้ชนะได้จริง', en: 'Umbra: much less HP and damage, softer shadow bolts; now beatable' },
      { cat: 'boss', th: 'ราชาช่วงท้าย (ด่าน 5–7) เลือดโตช้าลง ไม่หนีบ่อยเหมือนเดิม', en: 'Late Kings (Chapters 5–7) grow slower and escape less often' },
      { cat: 'monster', th: 'มอนตอนต้นด่านเกิดช้าลงนิดหน่อย และ Elite ตีเบาลง', en: 'Fewer monsters at the start of a Stage; Elites hit softer' },
      { cat: 'hero', th: 'Kit วิ่งเร็วขึ้น', en: 'Kit runs faster' },
      { cat: 'skill', th: 'เหยี่ยวของ Kit: แรงขึ้น โฉบถี่ขึ้น กระแทกโดนมอนรอบเป้า และร่างวิวัฒน์ได้เหยี่ยว 3 ตัว', en: "Kit's Hawk: stronger, faster, hits monsters around its prey; evolved form has 3 hawks" },
      { cat: 'skill', th: 'ขวดของ Vex: แรงขึ้น โยนถี่ขึ้น กระจายกว้างขึ้น ร่างวิวัฒน์แรงขึ้นอีก', en: "Vex's Flask: stronger, faster, wider; evolved form hits harder" },
      { cat: 'skill', th: 'โล่ของ Bram: แรงขึ้น และร่างวิวัฒน์ได้โล่ 4 อัน', en: "Bram's Holy Shield: stronger; evolved form has 4 shields" },
      { cat: 'skill', th: 'Awakening: ได้สกิลสายตัวแรกที่เลเวล 6 ทันที สกิลสายโผล่ให้เลือกบ่อยขึ้น และสกิลประจำตัวแรงขึ้นมาก', en: 'Awakening: your first Skill Line skill arrives at level 6, line skills are offered more often, and the Signature hits much harder' },
      { cat: 'skill', th: 'Gale Step, Arrow Rain (Kit) และ Cauldron (Vex) แรงขึ้น', en: 'Gale Step, Arrow Rain (Kit) and Cauldron (Vex) are stronger' },
      { cat: 'skill', th: 'Meteor เบาลงเล็กน้อย คอมโบ Overload และ Toxic Burst แรงน้อยลง ให้บิลด์อื่นมีที่ยืน', en: 'Meteor slightly weaker; Overload and Toxic Burst combos toned down so other builds can shine' },
    ],
  },
  report: {
    title: 'รอบจูนบาลานซ์ 2026-09 (ทดสอบด้วยบอท)',
    summary: 'ด่าน 1 ฆ่าผู้เล่นเกือบหมด (รอบจริงที่ตาย 22 จาก 27 ตายในด่าน 1) เพราะท่า Royal Splash ของ King Slime หลบไม่ทันตามหลักคณิตศาสตร์ '
      + 'บอสสุดท้าย Umbra แทบฆ่าไม่ได้ (ชนะ 0%) Awakening ไม่คุ้ม สกิลประจำตัว 3 ใน 4 อ่อน และ Toxic Burst/Overload/Meteor ครองดาเมจ '
      + 'ชุดนี้แก้ทั้งหมดผ่าน Balance Config โดยไม่แตะค่า version 0',
    method: 'บอทที่เล่นเหมือนคนเก่งพอประมาณ (เห็นเส้นเตือนช้า 0.25 วิ, หลบท่า, เก็บ EXP, ยืนตีราชา, เลือกสกิลตามสาย) รันเกมเต็มแบบ headless 2,544 เกม '
      + 'ครบ 4 ตัวละคร × บัญชีใหม่/อัปร้านกลาง/อัปเต็ม × รับหรือไม่รับ Awakening × preset ทุกแบบ เทียบกับข้อมูลจริง 53 รอบจาก config v3 '
      + 'บอทเก่งกว่าคนจริงเฉลี่ย ตัวเลขจึงอ่านว่า "ผู้เล่นฝีมือดี"',
    metrics: [
      { label: 'ผ่านด่าน 1 (บัญชีใหม่, เฉลี่ย 4 ตัว)', before: '51%', after: '90%' },
      { label: 'ด่านเฉลี่ยที่ไปถึง (บัญชีใหม่)', before: '2.9', after: '4.3' },
      { label: 'ชนะ Umbra (อัปร้านกลาง)', before: '0%', after: '5–25%' },
      { label: 'ชนะ Umbra (อัปร้านเต็ม)', before: '0%', after: 'Bram 50%, Lyra 42%, Vex 25%, Kit 0%' },
      { label: 'ส่วนดาเมจของ Toxic Burst ใน Vex', before: '55–80%', after: '≈33%' },
      { label: 'Awakening: รับเทียบไม่รับ (ด่านเฉลี่ย)', before: 'เท่ากันหรือแย่กว่า', after: 'เท่ากันหรือดีกว่าเล็กน้อย' },
    ],
    findings: [
      { level: 'bad', title: 'Royal Splash ของ King Slime หลบไม่ได้', body: 'คลื่นรัศมี 140 ขยายใน 1.1 วิ ผู้เล่นความเร็ว 62 วิ่งไม่พ้น ทำดาเมจครึ่งหนึ่งของด่าน 1', status: 'แก้ใน config' },
      { level: 'bad', title: 'Umbra แทบฆ่าไม่ได้', body: 'HP ราว 2.5 ล้านเมื่อมาถึง ผู้เล่นทำได้ 10–20% ก่อนตาย', status: 'แก้ใน config' },
      { level: 'bad', title: 'Toxic Burst คิดดาเมจซ้อน', body: 'พิษคูณ Might/คริ แล้วตอนระเบิดคูณซ้ำ คอมโบเดียวเป็น 55–80% ของดาเมจ Vex', status: 'แก้ในโค้ด + config' },
      { level: 'warn', title: 'Awakening ไม่คุ้ม', body: 'เสีย Link เลเวลเต็ม 2 อัน แลกสกิลสายเลเวล 1', status: 'แก้ใน config (ยังควรออกแบบใหม่)' },
      { level: 'warn', title: 'สกิลประจำตัวอ่อน (Hawk, Flask, Shield)', body: 'ทำดาเมจ 1–5% ของทั้งเกม ส่วน Meteor ครองเกือบทุกบิลด์', status: 'แก้ใน config' },
      { level: 'warn', title: 'Kit และ Vex ตามหลังช่วงท้ายเกม', body: 'รอบเสริมยก Vex แล้ว Kit ยังชนะ Umbra 0% แม้อัปเต็ม', status: 'แก้บางส่วน' },
      { level: 'info', title: 'มอนเลือดเพิ่ม 8% ต่อเลเวลเรา', body: 'ทำให้ Transmute และ Wisdom ทำร้ายผู้เล่น', status: 'ข้อเสนอ' },
    ],
    reasons: {
      'shared.stage.durBase': 'เท่ากับ v3 ที่ใช้อยู่ (ไม่เปลี่ยน)',
      'shared.stage.durMax': 'เท่ากับ v3 ที่ใช้อยู่ (ไม่เปลี่ยน)',
      'shared.stage.bossHpGrowth': 'ราชาด่าน 6–7 หนี 30–80% ลดการโตต่อด่าน',
      'shared.kings.splash.r': 'Royal Splash หลบได้จริง (ตัวฆ่าหลักด่าน 1)',
      'shared.kings.splash.dur': 'คลื่นช้าลงพอให้วิ่งพ้น',
      'shared.kings.splash.dmg': 'ท่าแรกของเกมไม่ควรฆ่าในสองครั้ง',
      'shared.scaling.eliteDmg': 'Elite ทำดาเมจใส่ผู้เล่น 20–35% ของทั้งหมด',
      'shared.spawn.base': 'ต้นด่านหายใจได้ เก็บ EXP ทัน',
      'shared.combos.overload': 'Overload เป็น 20–55% ของดาเมจอัศวิน',
      'shared.combos.toxicBurst': 'หลังแก้บั๊กให้เป็นหนึ่งในหลายแหล่งดาเมจของ Vex',
      'shared.combos.toxicBurstR': 'ลดการกระจายเป็นลูกโซ่',
      'shared.awaken.sigDmg': 'Signature หลังปลุกพลังรู้สึกแรงขึ้นจริง',
      'shared.awaken.grant': 'ได้สกิลสายตัวแรกทันทีในช่องที่ว่าง',
      'shared.awaken.grantLv': 'สกิลสายเริ่มเลเวล 6 ชดเชย Link ที่เสียไป',
      'shared.awaken.wLine': 'สกิลสายโผล่ในตัวเลือกเลเวลอัปบ่อยขึ้น',
      'shared.skills.meteor.n.perLv': 'Meteor แรงสุดในเกม (≈3,100 DPS) ลดจำนวนลูกต่อเลเวล',
      'shared.skills.meteor.dmg.perLv': 'ลดดาเมจต่อเลเวลของ Meteor',
      'shared.skills.hawk.dmg.base': 'เหยี่ยวของ Kit ช่วงต้นเกม',
      'shared.skills.hawk.dmg.perLv': 'เหยี่ยวของ Kit ช่วงท้ายเกม',
      'shared.skills.hawk.cd.base': 'เหยี่ยวโฉบถี่ขึ้น',
      'shared.skills.hawk.cd.min': 'เหยี่ยวโฉบถี่ขึ้นเมื่อเลเวลเต็ม',
      'shared.skills.hawk.r': 'เหยี่ยวกระแทกโดนมอนรอบเป้า เคลียร์ฝูงได้',
      'shared.skills.hawk.evo.n': 'evolution ได้เหยี่ยว 3 ตัว',
      'shared.skills.flask.dmg.base': 'ขวดของ Vex มีบทบาทช่วงต้น',
      'shared.skills.flask.dmg.perLv': 'ขวดของ Vex แรงขึ้นต่อเลเวล',
      'shared.skills.flask.cd.base': 'โยนขวดถี่ขึ้น',
      'shared.skills.flask.r.base': 'ขวดกระจายกว้างขึ้น',
      'shared.skills.flask.evo.dmgMul': 'ช่วงท้ายเกมของ Vex',
      'shared.skills.shield.dmg.base': 'โล่ของ Bram ทำดาเมจได้บ้าง',
      'shared.skills.shield.dmg.perLv': 'โล่ของ Bram แรงขึ้นต่อเลเวล',
      'shared.skills.shield.evo.n': 'evolution ได้โล่เพิ่มจริง (เดิมเลเวลเต็มก็ 3 อันอยู่แล้ว)',
      'shared.skills.galeStep.dmg.base': 'สกิลสายของ Kit ที่อ่อนสุด',
      'shared.skills.galeStep.dmg.perLv': 'สกิลสายของ Kit ที่อ่อนสุด',
      'shared.skills.arrowRain.dmg.perLv': 'สกิลสายหลักของ Kit ช่วงท้าย',
      'shared.skills.cauldron.dmg.base': 'สกิลสายของ Vex ที่อ่อนสุด',
      'shared.skills.cauldron.dmg.perLv': 'สกิลสายของ Vex ที่อ่อนสุด',
      'shared.umbra.boltDmg': 'พัดลูกไฟเงาไม่ฆ่าในชุดเดียว',
      'shared.heroes.ranger.spd': 'Kit หนีฝูงได้',
      'worlds.lumora.enemies.boss.hp': 'ราชาตัวแรกไม่ยืดเยื้อจนเข้า overtime',
      'worlds.lumora.enemies.umbra.hp': 'Umbra ฆ่าได้ (เดิมชนะ 0%)',
      'worlds.lumora.enemies.umbra.dmg': 'Umbra ไม่ฆ่าในสองครั้ง',
    },
    next: [
      'ออกแบบ Awakening ใหม่ให้ไม่ลบ Link (เช่น แปลงเป็นสกิลสายโดยเก็บเลเวล)',
      'ลด scaling.hpPerLv ให้การเก็บ EXP ไม่ย้อนมาทำร้ายผู้เล่น',
      'ให้ Kit มีเครื่องมือเคลียร์ฝูงหรือทนขึ้นช่วงท้ายเกม',
      'ดูข้อมูลจริงหลัง publish 1–2 สัปดาห์: เป้าผ่านด่าน 1 เกิน 60%',
    ],
    link: 'https://claude.ai/artifact/R9XZT7o8JWYzWZbmkJoJ6F',
  },
};

/** Follow-up to 2026-09 (published as config v4). v5 = this pass + 2026-09c (the Director change from the spawn-wave
 *  work, its own pass): load both onto one draft in Admin → Balance (loads stack) and publish them together. */
export const BALANCE_PASS_2026_09B: BalancePass = {
  id: '2026-09b',
  note: 'Playtest follow-up 2026-09b: Awakening keeps the Links and adds a slot, extra EXP no longer toughens monsters, Kit survives the late game',
  patch: {
    shared: {
      // Awakening was only as good as declining it: the Links now stay and a 5th attack slot holds the new skills
      awaken: { keep: 1, slots: 1 },
      // monsters count the player's level only up to the usual level for that point of the Run (7 + 7 per Chapter),
      // so Wisdom and Transmute stop making the game harder; the Chapter curve stays where it was
      scaling: { lvCapBase: 7, lvCapPerCh: 7 },
      // Kit died to regular monsters: the Hawk clears a crowd around Kit, and a little more HP
      skills: { hawk: { guardN: 4, guardR: 40 } },
      heroes: { ranger: { hp: 20 } },
    },
  },
  changelog: {
    titleTh: 'ตื่นพลังคุ้มขึ้นมาก เก็บ EXP ไม่เป็นโทษอีกต่อไป Kit ทนขึ้น',
    titleEn: 'Awakening pays off, extra EXP no longer backfires, a sturdier Kit',
    items: [
      { cat: 'hero', th: 'Kit: HP สูงสุด +20', en: 'Kit: +20 max HP' },
      { cat: 'skill', th: 'ตื่นพลังไม่ต้องเสีย Link อีกแล้ว: Link อยู่ครบ และได้ช่องสกิลโจมตีที่ 5 พร้อมสกิลตื่นพลังตัวแรก', en: 'Awakening no longer costs your Links: they stay, and you get a 5th attack slot holding your first Awakened skill' },
      { cat: 'skill', th: 'เหยี่ยวของ Kit: เมื่อมอนล้อมตัว (4 ตัวขึ้นไปในระยะใกล้) จะโฉบตัวที่ใกล้ที่สุดเพื่อเปิดทาง', en: 'Kit\'s Hawk: when 4 or more monsters close in, it dives the nearest one to clear a path' },
      { cat: 'difficulty', th: 'มอนนับเลเวลเราแค่ถึงระดับปกติของช่วงนั้น เลเวลเกินจาก Wisdom หรือ Transmute จะไม่ทำให้มอนอึดขึ้นอีก', en: 'Monsters count your level only up to the usual level for that point of the Run: extra levels from Wisdom or Transmute no longer make them tougher' },
      { cat: 'ui', th: 'คำใบ้ใหม่: บอกว่าสกิลไหนเป็น Link และต้องทำอะไรเพื่อตื่นพลัง', en: 'New hints: which skills are Links and what Awakening needs' },
    ],
  },
  report: {
    title: 'รอบจูนต่อ 2026-09b (Awakening, HP มอนตามเลเวล, Kit)',
    summary: 'สามเรื่องที่ค้างจากรอบ 2026-09: Awakening ยังกิน Link เต็มเลเวล 2 ตัว จึงดีพอ ๆ กับการปฏิเสธ; '
      + 'HP มอนโต 8% ต่อเลเวลเรา ทำให้ Wisdom และ Transmute (EXP) ทำร้ายผู้เล่น; Kit ตายกับมอนธรรมดาช่วงท้ายเกม '
      + 'ชุดนี้ให้ Awakening เก็บ Link ไว้และเพิ่มช่องที่ 5, ให้สูตรมอนนับเลเวลแค่ถึงเส้นปกติ, ให้เหยี่ยวป้องกัน Kit และ Kit HP +20',
    method: 'บอทเดิมของรอบ 2026-09 (scripts/playtest) เทียบ v4 กับ v5 (= v4 + ชุดนี้ + 2026-09c Director) บน seed เดียวกัน 24 seed ต่อฮีโร่ '
      + 'ที่อัปร้านกลางและอัปเต็ม และทดลองทางเลือกแยกทีละข้ออีกราว 2,000 เกม ในวงเล็บคือผลของชุดนี้อย่างเดียว (ไม่มี 2026-09c)',
    metrics: [
      { label: 'ชนะ Umbra อัปร้านเต็ม (Vex/Bram/Lyra/Kit)', before: '38/46/29/17%', after: '75/63/67/17% (ไม่รวม Director 71/58/46/13%)' },
      { label: 'ชนะ Umbra อัปร้านกลาง (Vex/Bram/Lyra/Kit)', before: '17/17/13/4%', after: '38/46/25/21% (42/17/33/0%)' },
      { label: 'ถึงด่าน 8 อัปร้านเต็ม (Vex/Bram/Lyra/Kit)', before: '83/63/75/17%', after: '96/88/92/58% (79/83/79/46%)' },
      { label: 'ถึงด่าน 8 อัปร้านกลาง (Vex/Bram/Lyra/Kit)', before: '38/46/42/4%', after: '71/71/79/46% (67/54/54/17%)' },
      { label: 'Kit ถึงด่าน 7 (ร้านกลาง / อัปเต็ม)', before: '33% / 75%', after: '67% / 92% (54% / 88%)' },
      { label: 'ด่าน 1–4 (ถึงด่าน, ราชาตาย)', before: 'ผ่านเกือบ 100%', after: 'เท่าเดิม' },
      { label: 'ดาเมจที่ Kit โดนจากมอนธรรมดา (อัปเต็ม)', before: '60%', after: '56% (54%)' },
    ],
    findings: [
      { level: 'warn', title: 'Awakening ดีพอ ๆ กับการปฏิเสธ', body: 'อัปเต็ม: รับ 33/33/33/13% เทียบปฏิเสธ 50/29/38/8% (Vex/Bram/Lyra/Kit) แบบแปลง Link เป็นสกิลสายยังเท่าเดิม ส่วนแบบเก็บ Link + ช่องที่ 5 ได้ 63/42/50/17%', status: 'แก้ด้วย field ใหม่ awaken.keep/slots' },
      { level: 'warn', title: 'EXP เพิ่มทำให้มอนอึดขึ้น', body: 'เมื่อ Vex ได้ Transmute เลเวลพุ่งถึง 80 และถึงด่าน 8 ลดจาก 44% เหลือ 25% ทางเลือก hpPerLv 0.04 + ชดเชย hpGrowth 1.6/hpProg 1.24 ทำให้ยากขึ้นเป็นฟันเลื่อย (ต้นด่าน −20% ท้ายด่าน +22%)', status: 'แก้ด้วยเพดานเลเวล scaling.lvCapBase/lvCapPerCh' },
      { level: 'warn', title: 'Kit ตายกับมอนธรรมดา', body: 'มอนธรรมดาเป็น 62–69% ของดาเมจที่ Kit โดน เหยี่ยวไล่ตีตัวเลือดมากที่สุดเสมอแม้โดนล้อม เสริมสกิลสาย (Gale Step) ไม่มีผลเพราะ Kit ตื่นพลังได้แค่ราวครึ่งหนึ่ง', status: 'แก้ด้วย hawk.guardN/guardR + heroes.ranger.hp' },
      { level: 'info', title: 'ช่วงท้ายเกมง่ายขึ้นโดยรวม', body: 'Awakening ทำให้ท้ายเกมง่ายขึ้น และ Director ที่เบาลงยิ่งเพิ่มอีก (อัปเต็มชนะ Umbra 63–75% ยกเว้น Kit) ลด awaken.sigDmg เหลือ 1.8 แทบไม่ต่าง ถ้าอยากให้ยากขึ้นควรปรับที่ Umbra หรือ bossHpGrowth', status: 'รอดูข้อมูลจริง' },
    ],
    reasons: {
      'shared.awaken.keep': 'Link เต็มเลเวล 2 ตัวไม่หายไปตอนตื่นพลัง',
      'shared.awaken.slots': 'ช่องโจมตีที่ 5 รับสกิลตื่นพลังโดยไม่ต้องถอดสกิลเดิม',
      'shared.scaling.lvCapBase': 'เส้นเลเวลปกติเริ่มที่ 7 (ค่ากลางของบอทตอนกลางด่าน 1)',
      'shared.scaling.lvCapPerCh': 'เส้นเลเวลโต 7 ต่อ Chapter ตามค่ากลางของบอท',
      'shared.skills.hawk.guardN': 'เมื่อมอน 4 ตัวขึ้นไปล้อม Kit เหยี่ยวช่วยเปิดทาง',
      'shared.skills.hawk.guardR': 'ระยะล้อม 40 px รอบตัว Kit (เท่าค่าเริ่มต้น)',
      'shared.heroes.ranger.hp': 'Kit เปราะที่สุด เพิ่ม HP ครึ่งหนึ่งของโบนัส Bram',
    },
    next: [
      'Kit ยังชนะ Umbra น้อยสุด (v5: ร้านกลาง 21%, อัปเต็ม 17%) ดู DPS ด่าน 4–8 ของ Kit ต่อ',
      'ท้ายเกม v5 ง่ายขึ้นมาก ถ้าข้อมูลจริงยืนยัน ให้เพิ่ม HP ของ Umbra หรือ bossHpGrowth',
      'หลัง publish ดูข้อมูลจริง: อัตราตื่นพลัง และเวลาที่ผู้เล่นใช้ในด่าน 6–8',
      ],
    },
  };

/** Owner playtest after v4: Chapters 2–3 turn into a wall of monsters from every side. First step (config only):
 *  a lower, slower Director. Wave fronts (spawn.front*, pincer, director.stageReset) come in a later pass. */
export const BALANCE_PASS_2026_09C: BalancePass = {
  id: '2026-09c',
  note: 'Playtest pass 2026-09c: fewer monsters for players who do well (Director max 2.4 → 1.6, slower rise)',
  patch: {
    shared: {
      // a player doing well sat at 2.0–2.3 of 2.4 from Chapter 1 on: spawns ×2.3 and carried into the next Stage
      director: { max: 1.6, rise: 0.04 },
    },
  },
  changelog: {
    titleTh: 'มอนไม่ท่วมจอเกินไปเมื่อเล่นได้ดี',
    titleEn: 'Fewer monster floods when you play well',
    items: [
      { cat: 'difficulty', th: 'ระบบปรับความยากกดดันน้อยลงและเร่งช้าลง ด่าน 2–3 มอนบนจอลดลงราวหนึ่งในสี่เมื่อเล่นได้ดี', en: 'The difficulty Director pushes less and ramps up slower: about a quarter fewer monsters on screen in Chapters 2–3 when you play well' },
    ],
  },
  report: {
    title: 'รอบจูน 2026-09c: ลดมอนท่วมจอ (Director)',
    summary: 'เล่นจริงหลัง v4: ด่าน 2–3 มอนมาเป็นฝูงใหญ่รอบตัวทุกทิศ สาเหตุหลักคือ Director ขึ้นถึงเพดานเร็ว (ผู้เล่นที่เล่นดีอยู่ที่ 2.0–2.3 จากเพดาน 2.4 ตั้งแต่ด่าน 1) '
      + 'และค่าติดข้ามด่าน อัตราเกิดมอนจึงคูณ ×2.3 ตลอด ชุดนี้ลดเพดานเหลือ 1.6 และให้ขึ้นช้าลง ส่วนเรื่องมอนมาทุกทิศต้องแก้ด้วยโค้ด (คลื่นทีละทิศ) ซึ่งจะมาในรอบถัดไป',
    method: 'บอทชุดเดิม (scripts/playtest) เทียบ v4 กับ v4 + 2026-09c บน seed เดียวกัน 12 seed ต่อฮีโร่ ทั้งบัญชีใหม่และอัปร้านกลาง (192 เกม) '
      + 'วัดความแน่นของมอนทุกครึ่งวินาที: จำนวนมอนบนจอ และสัดส่วน 12 ทิศรอบตัวที่มีมอนขวางในระยะ 70 px',
    metrics: [
      { label: 'Director เฉลี่ยด่าน 2 (อัปร้านกลาง)', before: '2.25', after: '1.5' },
      { label: 'มอนบนจอเฉลี่ยด่าน 2 (บัญชีใหม่ / อัปร้านกลาง)', before: '66 / 64', after: '47 / 46' },
      { label: 'มอนบนจอเฉลี่ยด่าน 3 (อัปร้านกลาง)', before: '73', after: '55' },
      { label: 'ทิศรอบตัวที่โดนขวางด่าน 2 (อัปร้านกลาง)', before: '34%', after: '26%' },
      { label: 'ด่านเฉลี่ยที่ไปถึง (บัญชีใหม่ / อัปร้านกลาง)', before: '3.6 / 6.6', after: '4.1 / 6.9' },
      { label: 'ชนะ Umbra อัปร้านกลาง (Lyra/Bram/Kit/Vex)', before: '0/0/0/17%', after: '17/42/0/33%' },
    ],
    findings: [
      { level: 'bad', title: 'Director ติดเพดานเกือบตลอดเกม', body: 'ขึ้น 0.06/วิ เมื่อเลือดเกิน 75% และไม่โดนตี 6 วิ จาก 1 ถึง 2.4 ใช้แค่ราว 23 วิ และไม่รีเซ็ตตอนเริ่มด่านใหม่ ด่าน 2 จึงเริ่มที่ ×2.3 ทันที', status: 'แก้ใน config (เพดาน) + รีเซ็ตรอโค้ด director.stageReset' },
      { level: 'warn', title: 'มอนเกิดมุมสุ่มเท่ากันทุกทิศ', body: 'ทุกตัวสุ่ม 0–360° ที่ขอบจอ มอนที่ตามไม่ทันก็วาร์ปกลับมาแบบสุ่มทิศ และฝูงล้อมเป็นวงเต็มทุก 18 วิ ผู้เล่นจึงไม่มีทางหนี', status: 'รอโค้ด: คลื่นทีละทิศ (spawn.front*)' },
      { level: 'info', title: 'ช่วงท้ายเกมง่ายขึ้นด้วย', body: 'Director ต่ำลงทำให้เลือดมอนต่ำลงเล็กน้อยด้วย (×0.85 + 0.15 × Director) ชนะ Umbra ที่อัปร้านกลางจากเฉลี่ย 4% เป็น 23% ถ้าใส่คู่กับ 2026-09b จะง่ายขึ้นอีก ควรดูข้อมูลจริงหลัง publish', status: 'รอดูข้อมูลจริง' },
    ],
    reasons: {
      'shared.director.max': 'ผู้เล่นที่เล่นดีไม่โดนมอน ×2.4 ตั้งแต่ด่าน 2',
      'shared.director.rise': 'ความกดดันขึ้นช้าลง ต้องเล่นดีต่อเนื่องราว 15 วิ ถึงเพดาน',
    },
    next: [
      'คลื่นทีละทิศ: มอนส่วนใหญ่มาจากทิศเดียวแล้วเปลี่ยนทิศเป็นช่วง ๆ มีช่วงพักหายใจ ฝูงล้อมเป็นก้ามปู 2 ฝั่ง',
      'รีเซ็ต Director ครึ่งทางตอนเริ่มด่านใหม่ (director.stageReset)',
      'หลัง publish ดูข้อมูลจริง: ด่านที่ตาย และอัตราชนะ Umbra',
    ],
  },
};

/** Owner request after v5: Bram's Holy Shield barely hurts anything, the Lance fires the way you walk, and Awakening
 *  should change the Signature's form with Skill Line skills that combo with it. Turns on the code switches
 *  shipped with that work (awaken.form, lance.aim, shield.bashCd) and tunes the new forms. */
export const BALANCE_PASS_2026_09D: BalancePass = {
  id: '2026-09d',
  note: 'Signature rework 2026-09d: Shield Bash for Bram, Lance aims at crowds, a new form for every Awakened Signature with Skill Line combos',
  patch: {
    shared: {
      // every Awakened Signature takes its new form; the Skill Line skills follow it into Combos
      awaken: { form: 1 },
      // the Lance pierces: aimed at the thickest crowd it hits many instead of whatever is ahead
      skills: {
        lance: { aim: 32 },
        // Holy Shield only hurt monsters touching the ring and knocked them out of reach: a Bash every 2 s, less knockback, more damage
        shield: { bashCd: 2, bashMul: 2.4, kb: 50, size: 8, dmg: { base: 26, perLv: 16 } },
        // wandering sigils made Lyra the strongest Hero (Umbra wins 17% → 58–67%): no extra sigil, weaker echoes and trail, a slower freeze
        sigil: { awk: { echo: 0.3, trailMul: 0.35, warpChill: 0.5 } },
        hawk: { awk: { dmgMul: 0.8 } },
      },
    },
  },
  changelog: {
    titleTh: 'สกิลประจำตัวใหม่: โล่กระแทกของ Bram, หอกเล็งฝูง และร่างตื่นพลังแบบใหม่ทั้ง 4 ฮีโร่',
    titleEn: 'Signature rework: Bram\'s Shield Bash, crowd-seeking Lance, and a new Awakened form for every Hero',
    items: [
      { cat: 'skill', th: 'Holy Shield ของ Bram: ทุก 2 วิ โล่ขยายวงออกกระแทกมอนรอบตัวแล้วหดกลับ ดาเมจแรงขึ้นมาก กระเด็นน้อยลง', en: 'Bram\'s Holy Shield: every 2 s the shields swing out in a wide bash and come back; much more damage, less knockback' },
      { cat: 'skill', th: 'Holy Lance เล็งไปยังฝูงที่หนาแน่นที่สุดเอง ไม่ต้องหันหน้าเล็ง', en: 'Holy Lance now aims at the thickest crowd by itself' },
      { cat: 'skill', th: 'ตื่นพลังแล้วสกิลประจำตัวเปลี่ยนร่าง: โล่พิพากษา (Bram), วงเวทเคลื่อนที่ (Lyra), ฝูงเหยี่ยว (Kit), ขวดยักษ์แตกกระจาย (Vex)', en: 'Awakening now changes your Signature\'s form: Judgement Shields (Bram), Wandering Sigils (Lyra), Hawk Flock (Kit), Giant Flask (Vex)' },
      { cat: 'skill', th: 'สกิลตื่นพลังคอมโบต่อจากสกิลประจำตัว เช่น Judgement Pillar ลงเป็นไฟตรงจุดที่โล่กระแทก (Firestorm), Arrow Rain เป็นศรไฟตามเหยี่ยว (Overload)', en: 'Awakened skills now combo with your Signature, e.g. Judgement Pillar burns where your shields slam (Firestorm), Arrow Rain turns to fire on the hawks\' prey (Overload)' },
    ],
  },
  report: {
    title: 'รอบจูน 2026-09d: สกิลประจำตัวและร่างตื่นพลังใหม่',
    summary: 'เจ้าของเกมเล่นแล้ว Bram อ่อนมาก: Holy Shield ตีแค่มอนที่ชนโล่และกระแทกมอนกระเด็นออกไปจนแทบไม่โดนซ้ำ (ไม่ติด 9 อันดับดาเมจของ Bram) '
      + 'ส่วนหอกยิงตามทิศที่เดิน และการตื่นพลังแค่ทำให้สกิลประจำตัวแรงขึ้น ชุดนี้เปิดสวิตช์โค้ดใหม่: โล่กระแทกเป็นจังหวะ, หอกเล็งฝูง และร่างตื่นพลังใหม่ทั้ง 4 ฮีโร่ '
      + 'ที่สกิลสายคอมโบต่อกันได้ แล้วจูนให้ Lyra ไม่แรงเกิน',
    method: 'บอทชุดเดิม (scripts/playtest) บน v5 + ชุดนี้ เทียบ v5 บน seed เดียวกัน 12 seed ต่อฮีโร่ อัปร้านกลาง และทดลองตัวเลือกอีก 3 ชุด',
    metrics: [
      { label: 'ดาเมจของ Holy Shield ใน Bram (ทั้งรอบ / หลังตื่นพลัง)', before: 'ไม่ติด 9 อันดับ', after: '12% / 24% (อันดับ 1)' },
      { label: 'เวลาฆ่า King ของ Bram (ค่ากลาง)', before: '47.6 วิ', after: '34.3 วิ' },
      { label: 'ชนะ Umbra อัปร้านกลาง (Lyra/Bram/Kit/Vex)', before: '17/33/0/33%', after: '50/58/0/42%' },
      { label: 'ถึงด่าน 8 อัปร้านกลาง (Lyra/Bram/Kit/Vex)', before: '83/67/33/58%', after: '83/75/33/67%' },
      { label: 'คอมโบ Firestorm ของ Bram หลังตื่นพลัง', before: '0%', after: '11% ของดาเมจ' },
    ],
    findings: [
      { level: 'bad', title: 'Holy Shield แทบไม่มีดาเมจ', body: 'บน v5 โล่ของ Bram ไม่ติด 9 อันดับดาเมจทั้งรอบ ขณะที่ Sigil ของ Lyra 36%, Hawk ของ Kit 20%, Flask ของ Vex 8% (+ คอมโบ)', status: 'แก้ด้วย shield.bashCd/kb/size/dmg' },
      { level: 'warn', title: 'วงเวทเคลื่อนที่ทำให้ Lyra แรงที่สุด', body: 'วงเวทที่ไล่ตามฝูงทำให้ Lyra ชนะ Umbra จาก 17% เป็น 58–67% จึงตัดวงเวทที่เพิ่ม ลดคลื่นซ้ำ รอยเวท และความเร็วแช่แข็งของ Time Warp', status: 'จูนใน sigil.awk' },
      { level: 'info', title: 'Kit ยังชนะ Umbra น้อย', body: 'ฝูงเหยี่ยวเพิ่มดาเมจของ Kit แต่ Kit ยังตายกับ elite และมอนธรรมดาช่วงท้ายเกม ปัญหาอยู่ที่ความทน ไม่ใช่สกิลประจำตัว', status: 'รอรอบถัดไป' },
    ],
    reasons: {
      'shared.awaken.form': 'เปิดร่างตื่นพลังใหม่และคอมโบของสกิลสาย',
      'shared.skills.lance.aim': 'หอกเล็งฝูงที่หนาแน่นที่สุด (ขนาดฝูง 32 px)',
      'shared.skills.shield.bashCd': 'โล่กระแทกขยายวงทุก 2 วิ ให้โล่โดนมอนรอบตัวจริง',
      'shared.skills.shield.bashMul': 'วงกว้างสุด 2.4 เท่า (ราว 80 px ที่เลเวลเต็ม)',
      'shared.skills.shield.kb': 'มอนไม่กระเด็นหลุดวงโล่ทันที',
      'shared.skills.shield.size': 'โล่ชนมอนง่ายขึ้นเล็กน้อย',
      'shared.skills.shield.dmg.base': 'ดาเมจโล่เริ่มต้นแรงพอ ๆ กับสกิลประจำตัวอื่น',
      'shared.skills.shield.dmg.perLv': 'ดาเมจโล่โตทันสกิลประจำตัวอื่น',
      'shared.skills.sigil.awk.echo': 'คลื่น Mana Nova ซ้ำจากวงเวทไม่แรงเกิน',
      'shared.skills.sigil.awk.trailMul': 'รอยเวทเป็นของแถม ไม่ใช่ดาเมจหลัก',
      'shared.skills.sigil.awk.warpChill': 'Time Warp แช่แข็งช้าลง Lyra ไม่อมตะรอบตัว',
      'shared.skills.hawk.awk.dmgMul': 'ฝูงเหยี่ยวแรงขึ้นเล็กน้อยให้ Kit ตามทัน',
    },
    next: [
      'หลัง publish ดูข้อมูลจริง: อัตราตื่นพลังและอัตราชนะของแต่ละฮีโร่',
      'Kit ยังอ่อนช่วงท้ายเกม: ดูความทนของ Kit ต่อ',
    ],
  },
};

/** Owner co-op playtest (2026-09-27): levels chained while the player stood invulnerable in the level-up bubble.
 *  Co-op only; works on any build that has `coop.choosingSkills` / `coop.xpShareK`. */
export const BALANCE_PASS_2026_09_COOP: BalancePass = {
  id: '2026-09-coop',
  note: 'Co-op pass: no attacks while choosing a level-up, a shorter shield after it, EXP shared by team size',
  patch: {
    shared: {
      // the choosing player could not be hurt but their Skills kept killing: EXP kept coming and level-ups chained
      coop: { choosingSkills: 0, shieldAfter: 1.5, xpShareK: 0.4 },
    },
  },
  changelog: {
    titleTh: 'เล่นด้วยกัน: เลเวลอัปไม่ทำให้อมตะยาว ๆ อีกต่อไป',
    titleEn: 'Co-op: level-ups no longer make you untouchable for ages',
    items: [
      { cat: 'coop', th: 'ระหว่างเลือกเลเวลอัปหรือหมุนหีบ สกิลและสัตว์คู่ใจหยุดโจมตี โล่หลังเลือกเสร็จเหลือ 1.5 วินาที', en: 'While you choose a level-up or spin a chest, your Skills and Companion stop attacking; the shield after choosing lasts 1.5 s' },
      { cat: 'coop', th: 'EXP ที่ทีมเก็บได้แบ่งตามจำนวนคน: 2 คนได้คนละ 71%, 3 คน 56%, 4 คน 45%', en: 'Team EXP is shared by team size: 71% each for 2 players, 56% for 3, 45% for 4' },
    ],
  },
  report: {
    title: 'รอบจูน co-op 2026-09: เลเวลอัปต่อกันไม่รู้จบ',
    summary: 'เล่นจริงแบบ co-op: ตอนเลือกการ์ดผู้เล่นอยู่ในโล่ ไม่โดนดาเมจ แต่สกิลยังยิงและฆ่ามอนต่อ '
      + 'และหลังเลือกเสร็จยังอมตะอีก 5 วินาที ส่วน EXP ทุกเม็ดที่ใครเก็บ ทุกคนได้เต็ม (มอนเกิดเพิ่มแค่ ×1.6 เมื่อมี 2 คน) '
      + 'EXP จึงไหลเข้าไม่หยุด เลเวลอัปต่อกันเป็นทอด ๆ และอมตะเกือบตลอด ชุดนี้ให้สกิลหยุดระหว่างเลือก ลดโล่หลังเลือก และแบ่ง EXP ตามจำนวนคน',
    method: 'อ่านโค้ด co-op (packages/sim/src/systems/coop.ts, sim.ts) และทดสอบ headless host + guest (tests/coop.test.ts)',
    findings: [
      { level: 'bad', title: 'อมตะแต่ยังฆ่ามอนได้', body: 'ระหว่างเลือกการ์ด updSkills และสัตว์คู่ใจยังทำงาน ผู้เล่นฆ่ามอนต่อในโล่ แล้วได้ EXP เลเวลอัปถัดไปเปิดทันที', status: 'แก้ด้วย coop.choosingSkills = 0' },
      { level: 'warn', title: 'โล่หลังเลือก 5 วินาที', body: 'เลเวลอัปต่อกัน 3–4 ครั้งเท่ากับอมตะ 20+ วินาที', status: 'ลดเหลือ 1.5 วินาที' },
      { level: 'warn', title: 'EXP ทีมได้คนละเต็ม', body: 'ใครเก็บ ทุกคนได้ 100% ขณะที่มอนเกิดเพิ่มแค่ 1 + 0.6 × เพื่อน เล่น 2 คนแต่ละคนจึงได้ EXP ราว 1.6 เท่าของเล่นคนเดียว', status: 'แก้ด้วย coop.xpShareK = 0.4' },
    ],
    reasons: {
      'shared.coop.choosingSkills': 'คนที่กำลังเลือกการ์ด (อมตะ) ไม่ฆ่ามอนต่อ',
      'shared.coop.shieldAfter': 'พอให้ตั้งหลัก แต่ไม่อมตะยาว ๆ เมื่อเลเวลอัปต่อกัน',
      'shared.coop.xpShareK': '2 คนได้คนละ 71% ใกล้ ๆ กับมอนที่เพิ่มขึ้น ×1.6 หารสองคน',
    },
    next: [
      'หลังเล่นจริง: ดูว่าเลเวลตอนจบด่าน 1–3 ของ co-op ใกล้กับเล่นคนเดียวไหม ถ้ายังเร็วไปเพิ่ม xpShareK',
    ],
  },
};

/** Every balance pass the Admin Console can load, newest first (the playtest harness applies them oldest first). */
export const BALANCE_PASSES: BalancePass[] = [BALANCE_PASS_2026_09_COOP, BALANCE_PASS_2026_09D, BALANCE_PASS_2026_09C, BALANCE_PASS_2026_09B, BALANCE_PASS_2026_09];
