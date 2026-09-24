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
      x.fillStyle=K;x.fillRect(6,13,4,3);x.fillStyle='#7a4a2a';x.fillRect(7,13,2,3);}}
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
    path:tile(x=>{x.fillStyle=th.path[0];x.fillRect(0,0,16,16);x.fillStyle=th.path[1];x.fillRect(3,4,1,1);x.fillRect(11,9,1,1);x.fillRect(7,13,2,1);x.fillRect(13,2,1,1);})
  };
}
const TILES=THEME_VIS.map(makeTiles);
function h2(x,y){let n=(Math.imul(x,374761393)+Math.imul(y,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function tileAt(themeIdx,tx,ty){
  const T=TILES[themeIdx];
  if(((tx%40)+40)%40===0||((ty%32)+32)%32===0)return T.path;
  if(h2(Math.floor(tx/6)+999,Math.floor(ty/6)-555)<0.12&&h2(tx,ty)<0.55)return T.deco;
  if(h2(Math.floor(tx/4),Math.floor(ty/4))>0.72)return T.tall;
  const r=h2(tx+77,ty-33);if(r<0.035)return T.fl[0];if(r<0.06)return T.fl[1];
  return T.grass[(tx+ty)&1];
}

export const tileAtT: (themeIdx: number, tx: number, ty: number) => HTMLCanvasElement = tileAt;
export { h2 };
