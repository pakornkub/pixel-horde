// Player-facing text (Thai, as in the original). Ticket 06 moves this into packages/i18n.
import type { BannerKey, HeroId, PassiveId, ShopId, SkillId } from '@pixel-horde/sim';

export const SKILL_TEXT: Record<SkillId, { name: string; th: string; col: string; g: string }> = {
  bolt: { name: 'Arcane Bolt', th: 'ยิงลูกพลังเวทใส่ศัตรูที่ใกล้ที่สุด', col: '#ff5cf4', g: 'B' },
  orbit: { name: 'Blade Orbit', th: 'ดาบวิญญาณหมุนรอบตัว ฟันทุกตัวที่เข้าใกล้', col: '#7df9ff', g: 'O' },
  chain: { name: 'Chain Lightning', th: 'สายฟ้ากระโดดต่อกันไปหลายเป้าหมาย', col: '#fff35c', g: 'L' },
  nova: { name: 'Fire Nova', th: 'วงแหวนไฟระเบิดออกจากตัว ผลักศัตรูกระเด็น', col: '#ff8a3d', g: 'N' },
  meteor: { name: 'Meteor Storm', th: 'อุกกาบาตถล่มใส่ฝูงมอน ดาเมจหนักเป็นวงกว้าง', col: '#ff4b3a', g: 'M' },
  frost: { name: 'Frost Aura', th: 'ออร่าน้ำแข็งรอบตัว กัดกินพลังชีวิตและทำให้ศัตรูช้าลง', col: '#9fd8ff', g: 'F' },
  lance: { name: 'Holy Lance', th: 'พุ่งหอกแสงทะลุทุกตัวไปตามทิศที่เดิน', col: '#ffe9a8', g: 'I' },
  boomer: { name: 'Spirit Disc', th: 'จานวิญญาณพุ่งออกไปแล้ววกกลับ ฟันทั้งขาไปและขากลับ', col: '#7dffb0', g: 'R' },
  cyclone: { name: 'Cyclone', th: 'พายุหมุนเคลื่อนไปทั่วสนาม ดูดมอนเข้าไปปั่น', col: '#d8f3e0', g: 'T' },
  toxic: { name: 'Toxic Pool', th: 'บ่อพิษใต้เท้ามอน กัดกินพลังชีวิตและทำให้ช้าลง', col: '#b6f24a', g: 'X' },
  laser: { name: 'Prism Laser', th: 'ลำแสงเลเซอร์กวาดรอบตัว 360 องศา', col: '#5cf4ff', g: 'Z' },
  hole: { name: 'Black Hole', th: 'หลุมดำดูดมอนมากองรวมกัน แล้วระเบิดทิ้งทั้งกอง', col: '#b07cff', g: 'Q' },
};

export const PASSIVE_TEXT: Record<PassiveId, { name: string; th: string; col: string; g: string }> = {
  might: { name: 'Might', th: 'ดาเมจทุกสกิล +20% (บวกรวมกับโบนัสอื่น)', col: '#ff7a7a', g: '+' },
  haste: { name: 'Haste', th: 'คูลดาวน์สกิลลดลง 8% (ลดรวมได้สูงสุด 40%)', col: '#c9a8ff', g: 'H' },
  swift: { name: 'Swift Boots', th: 'ความเร็วเดิน +12%', col: '#a9e38a', g: 'S' },
  vital: { name: 'Vitality', th: 'HP สูงสุด +30 และฟื้น HP 30 ทันที', col: '#ffa6c2', g: 'V' },
  magnet: { name: 'Magnet', th: 'ระยะดูดคริสตัล EXP กว้างขึ้น 50%', col: '#8fdcff', g: 'G' },
  crit: { name: 'Keen Eye', th: 'โอกาสคริติคอล +7% (สูงสุด 50%) และคริติคอลแรงขึ้น', col: '#ffe27a', g: 'C' },
};

export const EVO_TEXT: Record<SkillId, { name: string; th: string }> = {
  bolt: { name: 'Arcane Barrage', th: 'ลูกพลังรัวเป็นพายุ ยิงถี่ขึ้นและทะลุ' },
  orbit: { name: 'Storm Blades', th: 'ดาบ 8 เล่มหมุนเป็นวงกว้าง แรงขึ้นมาก' },
  chain: { name: 'Thunder God', th: 'สายฟ้ากระโดดไกลขึ้นและแรงขึ้น' },
  nova: { name: 'Inferno', th: 'วงแหวนไฟยักษ์ ระเบิดถี่ขึ้นและแรงขึ้น' },
  meteor: { name: 'Armageddon', th: 'อุกกาบาตมากขึ้น รัศมีใหญ่ขึ้น' },
  frost: { name: 'Absolute Zero', th: 'แช่แข็งมอนจนขยับไม่ได้ และแรงขึ้น' },
  lance: { name: 'Divine Spear', th: 'หอกแสงกางเป็นพัด แรงขึ้นมาก' },
  boomer: { name: 'Twin Moons', th: 'จานเพิ่มเป็นสองเท่า แรงขึ้น' },
  cyclone: { name: 'Hurricane', th: 'พายุลูกใหญ่ขึ้นและมากขึ้น' },
  toxic: { name: 'Plague', th: 'บ่อพิษขนาดใหญ่และแรงขึ้น' },
  laser: { name: 'Prism Burst', th: 'เลเซอร์สองลำหมุนสวนทางกัน' },
  hole: { name: 'Singularity', th: 'หลุมดำใหญ่ขึ้น ระเบิดแรงขึ้นสองเท่า' },
};

export const HERO_TEXT: Record<HeroId, { name: string; th: string }> = {
  mage: { name: 'Mage', th: 'ดาเมจทุกสกิล +15%' },
  knight: { name: 'Knight', th: 'HP สูงสุด +50 แต่เดินช้าลง 8%' },
  ranger: { name: 'Ranger', th: 'เดินเร็วขึ้น 15% และดูด EXP ได้ไกลขึ้น' },
  alchemist: { name: 'Alchemist', th: 'คูลดาวน์เร็วขึ้น 12% และคริติคอล +5%' },
};

export const SHOP_TEXT: Record<ShopId, { name: string; th: string; col: string; g: string }> = {
  power: { name: 'Power', th: 'ดาเมจพื้นฐาน +8% ต่อขั้น', col: '#ff7a7a', g: 'P' },
  vigor: { name: 'Vigor', th: 'HP สูงสุด +15 ต่อขั้น', col: '#ffa6c2', g: 'V' },
  speed: { name: 'Agility', th: 'ความเร็วเดิน +4% ต่อขั้น', col: '#a9e38a', g: 'A' },
  greed: { name: 'Greed', th: 'ได้เหรียญเพิ่ม 15% ต่อขั้น', col: '#ffd23f', g: '$' },
  wisdom: { name: 'Wisdom', th: 'ได้ EXP เพิ่ม 10% ต่อขั้น', col: '#8fdcff', g: 'W' },
  revive: { name: 'Second Wind', th: 'ตายแล้วฟื้นกลับมาได้ 1 ครั้งต่อรอบ', col: '#fff35c', g: '!' },
};

export const THEME_TEXT = [
  { name: 'GREEN FIELD', th: 'ทุ่งหญ้า', bossName: 'KING SLIME' },
  { name: 'SUN DESERT', th: 'ทะเลทราย', bossName: 'SAND KING' },
  { name: 'DEEP CAVE', th: 'ถ้ำลึก', bossName: 'BONE KING' },
  { name: 'FROST PEAK', th: 'ยอดเขาหิมะ', bossName: 'FROST KING' },
];

type Args = Record<string, string | number>;

/** Banner title + subtitle for a sim banner event. */
export function bannerText(key: BannerKey, a: Args, themeIdx: number): { txt: string; sub: string } {
  const th = THEME_TEXT[themeIdx];
  switch (key) {
    case 'stage': return { txt: 'STAGE ' + a.n, sub: th.th + ' รอด ' + a.dur + ' วินาที' };
    case 'bloodMoon': return { txt: 'BLOOD MOON', sub: 'ด่านพิเศษ! มอนมาเยอะมาก เหรียญ x2 และได้หีบเมื่อผ่านด่าน' };
    case 'intro.caster': return { txt: 'EYE CASTER', sub: 'ตาเวทยิงกระสุนจากระยะไกล สกิลที่ตีรอบตัวแตะไม่ถึง' };
    case 'intro.charger': return { txt: 'WILD BOAR', sub: 'เล็งเส้นแดงแล้วพุ่งชาร์จ ให้หลบออกจากเส้น' };
    case 'intro.splitter': return { txt: 'SPLIT SLIME', sub: 'สไลม์ยักษ์ ตายแล้วแตกเป็นตัวเล็ก 3 ตัว' };
    case 'intro.armor': return { txt: 'ARMORED!', sub: 'มอนสีเทาใส่เกราะ หักดาเมจทุกครั้งที่โดน สกิลตีเบาแต่ถี่ได้ผลน้อย' };
    case 'bossDown': return { txt: 'BOSS DOWN!', sub: '' };
    case 'judgement': return { txt: 'JUDGEMENT!', sub: '' };
    case 'swarm': return { txt: 'SWARM!', sub: 'มอนมารุมรอบตัว' };
    case 'bossIncoming': return { txt: 'BOSS INCOMING!', sub: th.bossName };
    case 'dragonOmen': return { txt: '...', sub: 'มีบางอย่างบินมา...' };
    case 'stageClear': return { txt: 'STAGE CLEAR!', sub: '' };
    case 'stageClearDragonFled': return { txt: 'STAGE CLEAR!', sub: 'แต่มังกรบินหนีไปแล้ว...' };
    case 'stageClearRivalFled': return { txt: 'STAGE CLEAR!', sub: 'ร่างเงาหนีไปแล้ว...' };
    case 'evolved': return { txt: 'EVOLVED!', sub: EVO_TEXT[a.id as SkillId].name };
    case 'secondWind': return { txt: 'SECOND WIND!', sub: 'ฟื้นคืนชีพ' };
    case 'dragonAppears': return { txt: 'INFERNO DRAGON', sub: 'ปราบให้ได้ แล้วมันจะมาเป็นพวกคุณ' };
    case 'dragonSummons': return { txt: '', sub: 'มังกรเรียกลูกน้อง!' };
    case 'rivalAppears': return { txt: '??? APPEARS', sub: 'ร่างเงาที่ใช้สกิลแบบเดียวกับคุณ ชนะได้ใน 35 วินาทีเพื่อรับรางวัล' };
    case 'rivalEscaped': return { txt: 'ESCAPED...', sub: 'ร่างเงาหนีไปแล้ว' };
    case 'dragonTamed': return { txt: 'DRAGON TAMED!', sub: 'มังกรไฟจะช่วยคุณสู้จนจบรอบนี้' };
    case 'dragonPowerUp': return { txt: 'DRAGON POWER UP', sub: 'มังกรไฟแข็งแกร่งขึ้น LV ' + a.lv };
    case 'clonePowerUp': return { txt: 'CLONE POWER UP', sub: 'ร่างแยกแรงขึ้น LV ' + a.lv };
    case 'shadowClone': return { txt: 'SHADOW CLONE!', sub: 'ได้ร่างแยกที่ใช้สกิลเดียวกับคุณ' };
    case 'shadowShard': return { txt: 'SHADOW SHARD', sub: `ได้เศษเงา ${a.n}/3 (ครบ 3 ได้ร่างแยกแน่นอน)` };
  }
}

export function skillDetail(id: SkillId, s: { dmg: number; n: number; pierce: number; jumps: number; r: number; len: number; boom: number }): string {
  switch (id) {
    case 'bolt': return `ดาเมจ ${s.dmg}, ${s.n} ลูกต่อครั้ง${s.pierce ? `, ทะลุ ${s.pierce} ตัว` : ''}`;
    case 'orbit': return `ดาเมจ ${s.dmg}, ดาบ ${s.n} เล่ม`;
    case 'chain': return `ดาเมจ ${s.dmg}, กระโดด ${s.jumps} เป้า`;
    case 'nova': return `ดาเมจ ${s.dmg}, รัศมี ${s.r}`;
    case 'meteor': return `ดาเมจ ${s.dmg}, ${s.n} ลูกต่อครั้ง`;
    case 'frost': return `ดาเมจ ${s.dmg} ทุก 0.4 วิ, รัศมี ${s.r}`;
    case 'lance': return `ดาเมจ ${s.dmg}, ${s.n} เล่มต่อครั้ง, ทะลุไม่จำกัด`;
    case 'boomer': return `ดาเมจ ${s.dmg}, ${s.n} จานต่อครั้ง`;
    case 'cyclone': return `ดาเมจ ${s.dmg} ทุก 0.25 วิ, ${s.n} ลูก`;
    case 'toxic': return `ดาเมจ ${s.dmg} ทุก 0.3 วิ, ${s.n} บ่อ`;
    case 'laser': return `ดาเมจ ${s.dmg}, ยาว ${s.len}`;
    case 'hole': return `ระเบิด ${s.boom}, รัศมี ${s.r}`;
  }
}
