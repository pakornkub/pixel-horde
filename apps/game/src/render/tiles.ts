// Sprite data and builders, moved from pixel-horde.html (ticket 02). Ticket 33 moves the rows
// into per-Realm sprite files with a validator.
/* eslint-disable */
// @ts-nocheck -- verbatim port of the original sprite code; typed wrappers are exported below.
import { INK } from './sprites';
const K=INK, TAU=Math.PI*2;
export const THEME_VIS=[
  {key:'grass',name:'GREEN FIELD',th:'ทุ่งหญ้า',pool:['slime','bat','mush'],boss:'boss',bossName:'KING SLIME',g:['#8fce6a','#6fb553','#3e7d3a'],path:['#e3cf98','#cdb57a'],
    f1:x=>{x.fillStyle='#fff';x.fillRect(4,5,3,1);x.fillRect(5,4,1,3);x.fillStyle='#ffd23f';x.fillRect(5,5,1,1);x.fillStyle='#ff7aa2';x.fillRect(10,10,3,1);x.fillRect(11,9,1,3);x.fillStyle='#fff';x.fillRect(11,10,1,1);},
    f2:x=>{x.fillStyle='#ffd23f';x.fillRect(9,4,3,1);x.fillRect(10,3,1,3);x.fillStyle='#e8434f';x.fillRect(10,4,1,1);},
    deco:x=>{x.fillStyle=K;x.beginPath();x.arc(8,7,7,0,TAU);x.fill();x.fillStyle='#2f7d2a';x.beginPath();x.arc(8,7,6,0,TAU);x.fill();
      x.fillStyle='#4f9e3c';x.beginPath();x.arc(7,6,4,0,TAU);x.fill();x.fillStyle='#8fce6a';x.fillRect(5,3,2,1);x.fillRect(4,4,1,1);
      x.fillStyle=K;x.fillRect(6,13,4,3);x.fillStyle='#7a4a2a';x.fillRect(7,13,2,3);}},
  {key:'desert',name:'SUN DESERT',th:'ทะเลทราย',pool:['sslime','scorp','mummy'],boss:'bossD',bossName:'SAND KING',g:['#ecd08a','#dcb86e','#b88a45'],path:['#c9a15f','#b08548'],
    f1:x=>{x.fillStyle=K;x.fillRect(4,7,5,3);x.fillStyle='#9a8a7a';x.fillRect(5,7,3,2);x.fillStyle='#c8b8a8';x.fillRect(5,7,1,1);},
    f2:x=>{x.fillStyle='#fff8e8';x.fillRect(8,6,5,1);x.fillRect(7,5,1,3);x.fillRect(13,5,1,3);},
    deco:x=>{x.fillStyle=K;x.fillRect(6,1,5,15);x.fillRect(2,5,4,6);x.fillRect(11,3,4,6);
      x.fillStyle='#3f8f3a';x.fillRect(7,2,3,13);x.fillRect(3,6,2,4);x.fillRect(5,9,2,1);x.fillRect(12,4,2,4);x.fillRect(10,7,2,1);
      x.fillStyle='#8fe39a';x.fillRect(7,3,1,10);x.fillStyle='#ff7aa2';x.fillRect(8,1,1,1);}},
  {key:'cave',name:'DEEP CAVE',th:'ถ้ำลึก',pool:['bat','ghost','skel'],boss:'bossC',bossName:'BONE KING',g:['#4a4560','#3d3853','#2a2640'],path:['#5d5878','#6b6688'],
    f1:x=>{x.fillStyle=K;x.fillRect(5,5,3,6);x.fillStyle='#5cf4ff';x.fillRect(6,6,1,4);x.fillStyle='#ffffff';x.fillRect(6,6,1,1);},
    f2:x=>{x.fillStyle=K;x.fillRect(9,7,3,5);x.fillStyle='#ff5cf4';x.fillRect(10,8,1,3);},
    deco:x=>{x.fillStyle=K;x.beginPath();x.moveTo(8,0);x.lineTo(15,16);x.lineTo(1,16);x.closePath();x.fill();
      x.fillStyle='#6b6688';x.beginPath();x.moveTo(8,2);x.lineTo(13,15);x.lineTo(3,15);x.closePath();x.fill();
      x.fillStyle='#8f8aae';x.fillRect(7,4,1,9);}},
  {key:'snow',name:'FROST PEAK',th:'ยอดเขาหิมะ',pool:['islime','ibat','snowman'],boss:'bossS',bossName:'FROST KING',g:['#eef6ff','#d4e6f5','#a9c6e0'],path:['#c7d9ea','#b3c9df'],
    f1:x=>{x.fillStyle='#8fd8ff';x.fillRect(4,5,3,1);x.fillRect(5,4,1,3);x.fillStyle='#ffffff';x.fillRect(5,5,1,1);},
    f2:x=>{x.fillStyle=K;x.fillRect(9,8,4,3);x.fillStyle='#8a94a8';x.fillRect(10,8,2,2);x.fillStyle='#ffffff';x.fillRect(9,8,4,1);},
    deco:x=>{x.fillStyle=K;x.beginPath();x.moveTo(8,0);x.lineTo(15,13);x.lineTo(1,13);x.closePath();x.fill();
      x.fillStyle='#2f6b4a';x.beginPath();x.moveTo(8,1);x.lineTo(14,12);x.lineTo(2,12);x.closePath();x.fill();
      x.fillStyle='#ffffff';x.fillRect(6,4,4,1);x.fillRect(4,8,8,1);x.fillRect(3,11,10,1);
      x.fillStyle=K;x.fillRect(6,13,4,3);x.fillStyle='#7a4a2a';x.fillRect(7,13,2,3);}},
  {key:'crater',name:'HEART CRATER',th:'หลุมหัวใจ',pool:['skel','ghost','scorp'],boss:'umbra',bossName:'UMBRA',g:['#2a1f3d','#241a36','#1a1030'],path:['#3a1f66','#4a2d80'],
    f1:x=>{x.fillStyle=K;x.fillRect(3,6,6,1);x.fillRect(8,7,1,4);x.fillStyle='#ff2a5c';x.fillRect(4,6,4,1);x.fillRect(8,8,1,2);},
    f2:x=>{x.fillStyle='#b07cff';x.fillRect(10,4,1,1);x.fillRect(12,9,1,1);x.fillStyle='#6a5a8a';x.fillRect(5,12,1,1);},
    deco:x=>{x.fillStyle=K;x.beginPath();x.moveTo(8,1);x.lineTo(13,15);x.lineTo(3,15);x.closePath();x.fill();
      x.fillStyle='#4a2d80';x.beginPath();x.moveTo(8,3);x.lineTo(11,14);x.lineTo(5,14);x.closePath();x.fill();
      x.fillStyle='#b07cff';x.fillRect(7,6,2,5);x.fillStyle='#ffffff';x.fillRect(7,6,1,1);}},
  // tickets 36–38 (drafts for the owner's review)
  {key:'ember',name:'EMBERFORGE',th:'ภูเขาไฟ',g:['#5a3a3a','#4a2e2e','#3a2424'],path:['#7a4a3a','#8a5a44'],
    f1:x=>{x.fillStyle=K;x.fillRect(3,6,6,2);x.fillStyle='#ff6a2a';x.fillRect(4,6,4,1);x.fillStyle='#ffd23f';x.fillRect(5,6,1,1);},
    f2:x=>{x.fillStyle='#8a5a44';x.fillRect(10,9,2,2);x.fillStyle='#ff8a3d';x.fillRect(12,4,1,1);},
    deco:x=>{x.fillStyle=K;x.beginPath();x.moveTo(8,1);x.lineTo(15,15);x.lineTo(1,15);x.closePath();x.fill();
      x.fillStyle='#6a4a3a';x.beginPath();x.moveTo(8,3);x.lineTo(13,14);x.lineTo(3,14);x.closePath();x.fill();
      x.fillStyle='#ff6a2a';x.fillRect(7,3,2,3);x.fillStyle='#ffd23f';x.fillRect(7,3,1,1);x.fillStyle='#ff6a2a';x.fillRect(6,8,1,4);}},
  {key:'swamp',name:'MIREFEN',th:'หนองน้ำ',g:['#4f6a3a','#43603a','#334a2a'],path:['#6a5a3a','#5a4a30'],
    f1:x=>{x.fillStyle=K;x.fillRect(3,7,7,3);x.fillStyle='#3a7a6a';x.fillRect(4,7,5,2);x.fillStyle='#8fd8c8';x.fillRect(5,7,1,1);},
    f2:x=>{x.fillStyle='#b6f24a';x.fillRect(10,4,1,1);x.fillRect(12,10,1,1);x.fillStyle='#b36bd8';x.fillRect(6,12,2,1);},
    deco:x=>{x.fillStyle=K;x.fillRect(6,3,4,13);x.fillRect(3,6,10,3);
      x.fillStyle='#6b4a2a';x.fillRect(7,4,2,12);x.fillStyle='#6fb553';x.fillRect(4,7,8,1);x.fillStyle='#b6f24a';x.fillRect(4,6,2,1);x.fillRect(10,6,2,1);}},
  {key:'sky',name:'SKYREACH ISLES',th:'เกาะลอยฟ้า',g:['#a8d8a0','#93c98a','#6fae6a'],path:['#e6f0ff','#c8dcf0'],
    f1:x=>{x.fillStyle='#ffffff';x.fillRect(3,5,5,2);x.fillRect(4,4,3,1);x.fillStyle='#c8dcf0';x.fillRect(3,7,5,1);},
    f2:x=>{x.fillStyle='#fff35c';x.fillRect(10,9,1,3);x.fillRect(11,11,1,2);},
    deco:x=>{x.fillStyle=K;x.fillRect(2,6,12,6);x.fillRect(4,4,8,2);x.fillStyle='#e6f0ff';x.fillRect(3,7,10,4);x.fillRect(5,5,6,2);
      x.fillStyle='#ffffff';x.fillRect(5,5,3,1);x.fillRect(3,7,2,1);x.fillStyle='#8fdcff';x.fillRect(4,10,8,1);}},
  {key:'sea',name:'TIDEHOLLOW',th:'เมืองใต้ทะเล',g:['#2f6f8f','#28617f','#1e4f6a'],path:['#c8b88a','#b8a878'],
    f1:x=>{x.fillStyle=K;x.fillRect(4,5,2,7);x.fillStyle='#3fbf8f';x.fillRect(4,5,1,6);x.fillStyle='#6fe0b0';x.fillRect(5,6,1,4);},
    f2:x=>{x.fillStyle='#bff0f0';x.fillRect(10,4,1,1);x.fillRect(11,7,1,1);x.fillRect(12,3,1,1);},
    deco:x=>{x.fillStyle=K;x.fillRect(3,4,10,11);x.fillStyle='#8f8a7a';x.fillRect(4,5,8,9);x.fillStyle='#b8b3a0';x.fillRect(4,5,8,2);
      x.fillStyle='#ff9ad8';x.fillRect(5,12,2,2);x.fillRect(9,11,2,3);x.fillStyle='#e8543c';x.fillRect(6,13,1,1);}},
  {key:'gear',name:'GEARSPIRE',th:'เมืองจักรกล',g:['#6a7488','#5e6878','#4a5468'],path:['#8a94a8','#9aa4b8'],
    f1:x=>{x.fillStyle=K;x.fillRect(3,5,6,6);x.fillStyle='#b8c0cc';x.fillRect(4,6,4,4);x.fillStyle=K;x.fillRect(5,7,2,2);},
    f2:x=>{x.fillStyle='#ffd23f';x.fillRect(10,9,3,1);x.fillStyle='#4a5468';x.fillRect(11,4,1,3);},
    deco:x=>{x.fillStyle=K;x.fillRect(2,2,12,13);x.fillStyle='#8a94a8';x.fillRect(3,3,10,11);x.fillStyle='#b8c0cc';x.fillRect(3,3,10,2);
      x.fillStyle='#4a5468';x.fillRect(5,7,2,2);x.fillRect(9,7,2,2);x.fillStyle='#e8434f';x.fillRect(7,11,2,1);}},
  {key:'dusk',name:'DUSKHOLD',th:'ปราสาทผีสิง',g:['#3a2a4a','#33253f','#261c30'],path:['#4a4a5a','#5a5a6a'],
    f1:x=>{x.fillStyle=K;x.fillRect(4,6,3,6);x.fillStyle='#e9e0ff';x.fillRect(5,7,1,4);x.fillStyle='#ffd23f';x.fillRect(5,6,1,1);},
    f2:x=>{x.fillStyle='#b07cff';x.fillRect(10,5,1,1);x.fillRect(12,11,1,1);x.fillStyle='#6a5a8a';x.fillRect(8,13,2,1);},
    deco:x=>{x.fillStyle=K;x.fillRect(3,3,10,13);x.fillRect(4,1,2,2);x.fillRect(10,1,2,2);
      x.fillStyle='#5a5a6a';x.fillRect(4,4,8,11);x.fillStyle='#3a2a4a';x.fillRect(6,8,4,7);x.fillStyle='#ffd23f';x.fillRect(7,10,1,1);x.fillStyle='#7a7a8a';x.fillRect(4,4,8,1);}}
];
/* ---------- walk-through props (ticket 34): generic shapes in each Realm's colours ---------- */
// c = [dark, mid, light, accent]
const PROP={
  rock:c=>x=>{x.fillStyle=K;x.fillRect(3,8,10,7);x.fillRect(4,7,8,1);x.fillStyle=c[1];x.fillRect(4,8,8,6);x.fillStyle=c[2];x.fillRect(5,8,4,2);x.fillStyle=c[0];x.fillRect(4,13,8,1);x.fillRect(10,10,2,3);},
  stump:c=>x=>{x.fillStyle=K;x.fillRect(4,8,8,7);x.fillStyle=c[1];x.fillRect(5,9,6,5);x.fillStyle=c[2];x.fillRect(5,8,6,2);x.fillStyle=c[0];x.fillRect(7,8,2,1);x.fillRect(5,13,1,1);x.fillRect(10,12,1,2);},
  sign:c=>x=>{x.fillStyle=K;x.fillRect(3,4,10,6);x.fillRect(7,10,2,6);x.fillStyle=c[1];x.fillRect(4,5,8,4);x.fillStyle=c[3];x.fillRect(5,6,6,1);x.fillRect(5,8,4,1);x.fillStyle=c[0];x.fillRect(7,10,1,5);},
  tuft:c=>x=>{x.fillStyle=K;x.fillRect(3,10,1,5);x.fillRect(6,8,1,7);x.fillRect(9,9,1,6);x.fillRect(12,11,1,4);x.fillStyle=c[2];x.fillRect(4,11,1,4);x.fillRect(7,9,1,6);x.fillRect(10,10,1,5);x.fillStyle=c[3];x.fillRect(7,8,1,1);x.fillRect(4,10,1,1);},
  crystal:c=>x=>{x.fillStyle=K;x.fillRect(6,3,4,12);x.fillRect(3,8,3,7);x.fillRect(10,7,3,8);x.fillStyle=c[1];x.fillRect(7,4,2,10);x.fillRect(4,9,1,5);x.fillRect(11,8,1,6);x.fillStyle=c[3];x.fillRect(7,4,1,4);},
  bones:c=>x=>{x.fillStyle=K;x.fillRect(3,11,10,3);x.fillRect(5,9,3,3);x.fillStyle=c[2];x.fillRect(4,12,8,1);x.fillRect(6,10,1,2);x.fillStyle=c[3];x.fillRect(3,12,1,1);x.fillRect(12,12,1,1);},
};
const PROPS=[
  [PROP.rock(['#5a6a5a','#8a9a8a','#b8c8b8','#fff']),PROP.stump(['#4a2e1a','#7a4a2a','#c48a55','#fff']),PROP.sign(['#4a2e1a','#c48a55','#fff','#6b3e26']),PROP.tuft(['#2f7d2a','#4f9e3c','#8fce6a','#ffd23f'])],
  [PROP.rock(['#8a6a3a','#c9a15f','#ecd08a','#fff']),PROP.bones(['#8a8070','#c8b8a8','#fff8e8','#e8d9b0']),PROP.sign(['#6b4a2a','#b08548','#fff','#6b3e26']),PROP.tuft(['#3f8f3a','#3f8f3a','#8fe39a','#ff7aa2'])],
  [PROP.rock(['#2a2640','#4a4560','#6b6688','#fff']),PROP.crystal(['#2a2640','#5cf4ff','#fff','#ffffff']),PROP.bones(['#8a8aa0','#d8d0ff','#f0ece0','#f0ece0']),PROP.crystal(['#2a2640','#ff5cf4','#fff','#ffc8f8'])],
  [PROP.rock(['#8aa6c0','#c7d9ea','#ffffff','#fff']),PROP.crystal(['#3f7fbf','#8fd8ff','#fff','#ffffff']),PROP.stump(['#4a2e1a','#7a4a2a','#f4fbff','#fff']),PROP.sign(['#4a2e1a','#b3c9df','#fff','#3f7fbf'])],
  [PROP.rock(['#1a1030','#3a1f66','#4a2d80','#fff']),PROP.crystal(['#1a1030','#b07cff','#fff','#ff2a5c']),PROP.bones(['#3a2a4a','#6a5a8a','#8a7aaa','#b07cff']),PROP.crystal(['#1a1030','#ff2a5c','#fff','#ffc0d0'])],
  [PROP.rock(['#2a1a1a','#4a2e2e','#6a4a3a','#fff']),PROP.crystal(['#3a2424','#ff6a2a','#fff','#ffd23f']),PROP.rock(['#3a1a0a','#6a3a2a','#ff6a2a','#fff']),PROP.bones(['#3a2424','#8a7a6a','#c8b8a8','#ff8a3d'])],
  [PROP.stump(['#2a3a1a','#4a3a2a','#6b5a3a','#fff']),PROP.tuft(['#2a4a2a','#3a7a3a','#6fb553','#b36bd8']),PROP.rock(['#2a3a2a','#4a5a3a','#6a7a4a','#fff']),PROP.tuft(['#2a4a2a','#3a6a3a','#8fce6a','#b6f24a'])],
  [PROP.rock(['#6a8aa0','#c8dcf0','#ffffff','#fff']),PROP.tuft(['#4f9e3c','#6fae6a','#a8d8a0','#fff35c']),PROP.sign(['#6a8aa0','#e6f0ff','#fff','#3f7fbf']),PROP.crystal(['#3f7fbf','#fff35c','#fff','#ffffff'])],
  [PROP.rock(['#1e4f6a','#3f6f8f','#6f9fbf','#fff']),PROP.tuft(['#1e4f6a','#2f8f6a','#3fbf8f','#ff9ad8']),PROP.crystal(['#1e4f6a','#ff9ad8','#fff','#ffd8f0']),PROP.bones(['#8f8a7a','#c8b88a','#fff4e0','#e8543c'])],
  [PROP.rock(['#3a4458','#6a7488','#9aa4b8','#fff']),PROP.sign(['#3a4458','#8a94a8','#fff','#ffd23f']),PROP.crystal(['#3a4458','#ffd23f','#fff','#fff4b0']),PROP.stump(['#3a4458','#6a7488','#b8c0cc','#fff'])],
  [PROP.rock(['#1e1628','#3a2a4a','#5a4a6a','#fff']),PROP.bones(['#3a2a4a','#8a8aaa','#e9e0ff','#b07cff']),PROP.crystal(['#1e1628','#b07cff','#fff','#e0c8ff']),PROP.sign(['#1e1628','#5a4a6a','#fff','#ffd23f'])],
];
function tile(fn){const c=document.createElement('canvas');c.width=16;c.height=16;fn(c.getContext('2d'));return c;}
function makeTiles(th){
  const[B1,B2,B3]=th.g;
  const base=seed=>x=>{x.fillStyle=B1;x.fillRect(0,0,16,16);x.fillStyle=B2;
    const pts=seed?[[3,4],[11,2],[7,10],[13,12],[1,13]]:[[5,6],[12,9],[2,1],[9,14]];
    for(const[a,c]of pts){x.fillRect(a,c,1,2);x.fillRect(a+2,c,1,2);x.fillRect(a+1,c+1,1,1);}};
  return{
    grass:[tile(base(0)),tile(base(1))],
    tall:tile(x=>{x.fillStyle=B2;x.fillRect(0,0,16,16);x.fillStyle=B3;
      for(let yy=1;yy<16;yy+=5)for(let xx=0;xx<16;xx+=4){x.fillRect(xx,yy,1,3);x.fillRect(xx+2,yy,1,3);x.fillRect(xx+1,yy+2,1,1);}
      x.fillStyle=B1;for(let yy=0;yy<16;yy+=5)for(let xx=1;xx<16;xx+=4)x.fillRect(xx,yy,1,1);}),
    fl:[tile(x=>{base(1)(x);th.f1(x);}),tile(x=>{base(0)(x);th.f2(x);})],
    deco:tile(x=>{base(0)(x);th.deco(x);}),
    // dithered ground (every other pixel of the mid tone) and walk-through props
    dith:tile(x=>{base(1)(x);x.fillStyle=B2;for(let yy=0;yy<16;yy++)for(let xx=(yy&1);xx<16;xx+=2)if(((xx*7+yy*3)&7)<3)x.fillRect(xx,yy,1,1);}),
    props:(PROPS[THEME_VIS.indexOf(th)]||[]).map(fn=>tile(x=>{base((th.key.length)&1)(x);fn(x);})),
    path:tile(x=>{x.fillStyle=th.path[0];x.fillRect(0,0,16,16);x.fillStyle=th.path[1];x.fillRect(3,4,1,1);x.fillRect(11,9,1,1);x.fillRect(7,13,2,1);x.fillRect(13,2,1,1);})
  };
}
const TILES=THEME_VIS.map(makeTiles);
function h2(x,y){let n=(Math.imul(x,374761393)+Math.imul(y,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function tileAt(themeIdx,tx,ty){
  const T=TILES[themeIdx];
  if(((tx%40)+40)%40===0||((ty%32)+32)%32===0)return T.path;
  if(h2(Math.floor(tx/6)+999,Math.floor(ty/6)-555)<0.12&&h2(tx,ty)<0.55)return T.deco;
  const pr=h2(tx*3+11,ty*5-7);
  if(pr<0.02&&T.props.length)return T.props[Math.floor(h2(tx-3,ty+9)*T.props.length)];
  if(h2(Math.floor(tx/3)-40,Math.floor(ty/3)+70)>0.8)return T.dith;
  if(h2(Math.floor(tx/4),Math.floor(ty/4))>0.72)return T.tall;
  const r=h2(tx+77,ty-33);if(r<0.035)return T.fl[0];if(r<0.06)return T.fl[1];
  return T.grass[(tx+ty)&1];
}

export const tileAtT: (themeIdx: number, tx: number, ty: number) => HTMLCanvasElement = tileAt;
export { h2 };
