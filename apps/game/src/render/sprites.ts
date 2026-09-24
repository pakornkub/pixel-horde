// Sprite data and builders, moved from pixel-horde.html (ticket 02). Ticket 33 moves the rows
// into per-Realm sprite files with a validator.
/* eslint-disable */
// @ts-nocheck -- verbatim port of the original sprite code; typed wrappers are exported below.
export const INK='#1e1b33';
const TAU=Math.PI*2;
function spr(rows,pal){
  const w=Math.max(...rows.map(r=>r.length)),h=rows.length;
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  for(let y=0;y<h;y++)for(let i=0;i<rows[y].length;i++){const ch=rows[y][i];if(!pal[ch])continue;x.fillStyle=pal[ch];x.fillRect(i,y,1,1);}
  return c;
}
function recolor(c,col,a){
  const o=document.createElement('canvas');o.width=c.width;o.height=c.height;const x=o.getContext('2d');
  x.drawImage(c,0,0);x.globalCompositeOperation='source-atop';x.globalAlpha=a;x.fillStyle=col;x.fillRect(0,0,o.width,o.height);return o;
}
function flip(c){const o=document.createElement('canvas');o.width=c.width;o.height=c.height;const x=o.getContext('2d');x.translate(c.width,0);x.scale(-1,1);x.drawImage(c,0,0);return o;}
const K=INK;
const HERO_TOP=[
"......KKKK......",
"....KKhhhhKK....",
"...KhHHhhhhhK...",
"..KhHhhhhhhhhK..",
"..KggggggggggK..",
"..KhsssssssshK..",
"..KhsKssssKshK..",
"..KhsssssssshK..",
"...KKssppssKK...",
"..KcccKKKKcccK..",
".KcCccgggcccCcK.",
".KcCcccgcccccCK.",
".KsKccccccccKsK.",
"..KKccccccccKK.."];
const HPAL={K,h:'#7b4bd6',H:'#b58cff',g:'#ffd23f',s:'#ffd9b0',p:'#f28b9b',c:'#3f5fd1',C:'#7fa2ff',b:'#6b3e26'};
const CHARS={
  mage:{name:'Mage',th:'ดาเมจทุกสกิล +15%',start:'bolt',pal:{h:'#7b4bd6',H:'#b58cff',c:'#3f5fd1',C:'#7fa2ff'},cost:0},
  knight:{name:'Knight',th:'HP สูงสุด +50 แต่เดินช้าลง 8%',start:'orbit',pal:{h:'#c23b3b',H:'#ff8a80',c:'#6b7a8f',C:'#aab6c6'},cost:0},
  ranger:{name:'Ranger',th:'เดินเร็วขึ้น 15% และดูด EXP ได้ไกลขึ้น',start:'lance',pal:{h:'#3f8f3a',H:'#8fe39a',c:'#8a5a2b',C:'#c48a55'},cost:150},
  alchemist:{name:'Alchemist',th:'คูลดาวน์เร็วขึ้น 12% และคริติคอล +5%',start:'toxic',pal:{h:'#1f9aa8',H:'#8fe8f2',c:'#d0662a',C:'#ffa36b'},cost:300}
};
const HERO=[
  spr(HERO_TOP.concat(["...KbbK..KbbK...","...KKKK..KKKK..."]),HPAL),
  spr(HERO_TOP.concat(["..KbbK....KbbK..","..KKKK....KKKK.."]),HPAL)];
const HERO_L=HERO.map(flip);
const HERO_W=recolor(HERO[0],'#ffffff',1);
const CHSPR={};for(const k in CHARS){const pal=Object.assign({},HPAL,CHARS[k].pal);
  const f=[spr(HERO_TOP.concat(["...KbbK..KbbK...","...KKKK..KKKK..."]),pal),spr(HERO_TOP.concat(["..KbbK....KbbK..","..KKKK....KKKK.."]),pal)];
  CHSPR[k]={r:f,l:f.map(flip),w:recolor(f[0],'#ffffff',1)};}

const SLIME=[
".....KKKK.....",
"...KKggggKK...",
"..KgGGgggggK..",
".KgGgggggggggK",
".KggKggggKgggK",
".KggKggggKgggK",
".KgggggggggggK",
".KggggddddgggK",
"..KKKKKKKKKK.."];
const BAT1=[
"K.............K",
"KK...K...K...KK",
"KpK.KKKKKKK.KpK",
"KppKpprprppKppK",
".KpppppppppppK.",
"..KKpppppppKK..",
"....KpKKKpK....",
".....K...K....."];
const BAT2=[
"...............",
".....K...K.....",
"....KKKKKKK....",
"..KKpprprppKK..",
".KppppppppppppK",
"KpppKpppppKpppK",
"KppK.KKKKK.KppK",
"KKK.........KKK"];
const GHOST=[
"....KKKK....",
"..KKwwwwKK..",
".KwwwwwwwwK.",
"KwwwwwwwwwwK",
"KwwKKwwKKwwK",
"KwwKKwwKKwwK",
"KwwwwwwwwwwK",
"KwwwwKKwwwwK",
"KwwwwwwwwwwK",
"KwwwwwwwwwwK",
"KwwwKwwKwwwK",
".KK.K.KK.KK."];
const MUSH=[
"....KKKKKK....",
"..KKrrwwrrKK..",
".KrrrrwwrrrrK.",
"KrwwrrrrrrwwrK",
"KrwwrrrrrrwwrK",
"KrrrrrrrrrrrrK",
".KKKKKKKKKKKK.",
"...KssssssK...",
"...KsKssKsK...",
"...KssssssK...",
"..KKssssssKK..",
"..KbbK..KbbK..",
"..KKKK..KKKK.."];
const CROWN=["...KgKggKgK...","...KggggggK..."];
const EPAL={
  slime:{K,g:'#6fd34e',G:'#c6f7a0',d:'#2f7d2a'},
  bat:{K,p:'#8a5ad6',r:'#ff4b5c'},
  ghost:{K,w:'#e9f1ff'},
  mush:{K,r:'#e8434f',w:'#fff4e0',s:'#f2d6a8',b:'#6b3e26'},
  boss:{K,g:'#4fa8ff',G:'#c9ecff',d:'#1f4f9d'}
};
function mk(rows,pal){const n=spr(rows,pal);return{n,w:recolor(n,'#ffffff',1),e:recolor(n,'#ff2a3a',.45),i:recolor(n,'#9fd8ff',.6),a:recolor(n,'#8a94a8',.55)};}
const SCORP=[
"..KK......KK..",
".KrrK....KrrK.",
".KrK......KrK.",
"..KK.KKKK.KK..",
"....KrrrrK....",
"...KrKrrKrK...",
"...KrrrrrrK...",
"..KrKrrrrKrK..",
"...KKrrrrKK...",
".....KrrK.....",
"......KrK.....",
".......KK....."];
const SKEL=[
"...KKKKKK...",
"..KwwwwwwK..",
".KwwwwwwwwK.",
".KwKKwwKKwK.",
".KwKKwwKKwK.",
".KwwwwwwwwK.",
"..KwKwKwKK..",
"...KKKKKK...",
"....KwwK....",
"..KKwwwwKK..",
".KwKwKKwKwK.",
"..K.KwwK.K..",
"...KwK.KwK..",
"...KK...KK.."];
const SNOWM=[
"....KKKK....",
"...KwwwwK...",
"..KwKwwKwK..",
"..KwwoowwK..",
"...KwwwwK...",
"..KKrrrrKK..",
".KwwwwwwwwK.",
"KwwwwKwwwwwK",
"KwwwwwwwwwwK",
"KwwwwKwwwwwK",
".KwwwwwwwwK.",
"..KKKKKKKK.."];
const pad1=rows=>rows.map(r=>'.'+r+'.');
EPAL.sslime={K,g:'#e0a040',G:'#ffe0a0',d:'#9a5a1a'};
EPAL.islime={K,g:'#8fd8ff',G:'#ffffff',d:'#3f7fbf'};
EPAL.ibat={K,p:'#5cc8e8',r:'#ffffff'};
EPAL.mummy={K,w:'#e8d9b0'};
EPAL.scorp={K,r:'#d9822b'};
EPAL.skel={K,w:'#f0ece0'};
EPAL.snowman={K,w:'#f4fbff',o:'#ff8a3d',r:'#e8434f'};
function mkBoss(rows,pal){const n=spr(CROWN.concat(rows),pal),x=n.getContext('2d');x.clearRect(0,0,n.width,2);x.drawImage(spr(CROWN,{K,g:'#ffd23f'}),0,0);
  return{n,w:recolor(n,'#ffffff',1),e:recolor(n,'#ff2a3a',.45),i:recolor(n,'#9fd8ff',.6),a:recolor(n,'#8a94a8',.55)};}
const SPR={
  slime:[mk(SLIME,EPAL.slime)],
  bat:[mk(BAT1,EPAL.bat),mk(BAT2,EPAL.bat)],
  ghost:[mk(GHOST,EPAL.ghost)],
  mush:[mk(MUSH,EPAL.mush)],
  boss:[mkBoss(SLIME,EPAL.boss)],
  sslime:[mk(SLIME,EPAL.sslime)],
  scorp:[mk(SCORP,EPAL.scorp)],
  mummy:[mk(GHOST,EPAL.mummy)],
  skel:[mk(SKEL,EPAL.skel)],
  islime:[mk(SLIME,EPAL.islime)],
  ibat:[mk(BAT1,EPAL.ibat),mk(BAT2,EPAL.ibat)],
  snowman:[mk(SNOWM,EPAL.snowman)],
  bossD:[mkBoss(SCORP,{K,r:'#ff9a2a'})],
  bossC:[mkBoss(pad1(SKEL),{K,w:'#d8d0ff'})],
  bossS:[mkBoss(pad1(SNOWM),{K,w:'#e6f6ff',o:'#ff8a3d',r:'#4fa8ff'})]
};

const DRAGON=[
"..........KKKK..........",
".........KrrrrK.........",
"........KrYrrYrK........",
"........KrrrrrrK........",
".KK......KrrrrK......KK.",
"KwwK....KrroorrK....KwwK",
"KwwwK..KrrooooorK..KwwwK",
"KwwwwKKrrrooooorrKKwwwwK",
"KwwwwwKrrrooooorrKwwwwwK",
".KwwwwKrrrooooorrKwwwwK.",
"..KwwwKrrrrooorrrKwwwK..",
"...KKKKrrrrrrrrrrKKKK...",
"......KrrrrrrrrrrK......",
".......KrrKrrKrrK.......",
".......KKK.KrrK.KKK.....",
"...........KrrK.........",
"............KrrK........",
".............KrK........",
"..............KK........"];
const PETD=[
"....KKKK....",
"...KrYrYK...",
"....KrrK....",
"KK..KrrK..KK",
"KwK.KooK.KwK",
"KwwKroorKwwK",
".KwKroorKwK.",
"..KKrrrrKK..",
"....KrrK....",
".....KrK....",
"......KK...."];
const DRAGON_S=mk(DRAGON,{K,r:'#d8342c',o:'#ffb347',w:'#8a1f1f',Y:'#ffe14d'});
SPR.dragon=[DRAGON_S];
SPR.whelp=[mk(PETD,{K,r:'#a8231d',o:'#ff8a3d',w:'#5a1414',Y:'#ffe14d'})];
const PET_S=spr(PETD,{K,r:'#ff6a2a',o:'#ffd08a',w:'#ffb347',Y:'#ffffff'}),PET_L=flip(PET_S);
SPR.rival=[mk(HERO_TOP.concat(["...KbbK..KbbK...","...KKKK..KKKK..."]),Object.assign({},HPAL,{h:'#2a1f3d',H:'#5a3f8a',c:'#3a2a55',C:'#6a4a9a',s:'#b8a8d8',g:'#ff4b5c',p:'#ff4b5c',b:'#1e1b33'}))];
for(const k in CHSPR){const c=CHSPR[k];c.dk=c.r.map(f=>recolor(f,'#2a1f3d',0.55));c.dkl=c.dk.map(flip);}

const EYE=[
"...KKKKKK...",
"..KwwwwwwK..",
".KwwwwwwwwK.",
"KwwwKKKKwwwK",
"KwwKrrrrKwwK",
"KwwKrKKrKwwK",
"KwwKrKKrKwwK",
"KwwKrrrrKwwK",
"KwwwKKKKwwwK",
".KwwwwwwwwK.",
"..KwKwwKwK..",
"..K.K..K.K.."];
const BOAR=[
"...KK......KK...",
"..KbbK....KbbK..",
"..KbbbKKKKbbbK..",
".KbbbbbbbbbbbbK.",
"KwKbbKbbbbKbbKwK",
"KwKbbbbbbbbbbKwK",
".KKbbbppppbbbKK.",
"..KbbbpKKpbbbK..",
"..KbbbbbbbbbbK..",
"...KbK....KbK...",
"...KK......KK..."];
SPR.caster=[mk(EYE,{K,w:'#f0e6ff',r:'#b03ad6'})];
SPR.charger=[mk(BOAR,{K,b:'#8a5a3a',p:'#e0a0a0',w:'#fff4e0'})];
SPR.splitter=[mk(SLIME,{K,g:'#b36bff',G:'#e6ccff',d:'#6b2fb3'})];
SPR.mini=SPR.splitter;

type C = HTMLCanvasElement;
/** n normal, w hit flash, e elite, i frozen, a armored. */
export type Sheet = { n: C; w: C; e: C; i: C; a: C };
export type HeroSheet = { r: C[]; l: C[]; w: C; dk: C[]; dkl: C[] };
export const HERO_SPR: Record<string, HeroSheet> = CHSPR;
export const ENEMY_SPR: Record<string, Sheet[]> = SPR;
export const PET_R: C = PET_S;
export const PET_LEFT: C = PET_L;
export { spr, recolor, flip };
