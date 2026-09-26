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

/** Every balance pass the Admin Console can load, newest first. */
export const BALANCE_PASSES: BalancePass[] = [BALANCE_PASS_2026_09];
