// Procedural canvas textures (v6). Real PBR texture sets from Poly Haven / ambientCG replace these.
import * as THREE from 'three';

export function createTextures(renderer, R) {
const maxAniso=renderer.capabilities.getMaxAnisotropy();
function canvasTex(w,h,draw,opt){opt=opt||{};const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,maxAniso);if(opt.color!==false)t.colorSpace=THREE.SRGBColorSpace;return t;}
function noiseFill(g,w,h,n,base,spread,alpha,size){for(let i=0;i<n;i++){const v=base+R()*spread|0;g.fillStyle=`rgba(${v},${v},${v},${alpha})`;const sz=size*(0.5+R());g.fillRect(R()*w,R()*h,sz,sz);}}
let TEX={};
function buildTextures(){
  TEX.asphalt=canvasTex(1024,1024,(g,w,h)=>{g.fillStyle='#3c3d3e';g.fillRect(0,0,w,h);
    noiseFill(g,w,h,60000,30,70,0.55,1.8);
    // repair patches, oil darkening, cracks
    for(let i=0;i<10;i++){g.fillStyle=`rgba(${20+R()*25|0},${20+R()*25|0},${22+R()*25|0},.45)`;const x=R()*w,y=R()*h,ww=40+R()*160,hh=30+R()*120;g.fillRect(x,y,ww,hh);}
    for(let i=0;i<30;i++){g.fillStyle='rgba(10,10,10,.12)';g.beginPath();g.ellipse(R()*w,R()*h,10+R()*60,6+R()*30,R()*3,0,7);g.fill();}
    g.strokeStyle='rgba(15,15,15,.55)';g.lineWidth=1.2;
    for(let i=0;i<22;i++){let x=R()*w,y=R()*h;g.beginPath();g.moveTo(x,y);for(let k=0;k<10;k++){x+=(R()-.5)*40;y+=(R()-.5)*40;g.lineTo(x,y);}g.stroke();}
    noiseFill(g,w,h,6000,120,80,0.25,1.2);});
  TEX.asphaltR=canvasTex(512,512,(g,w,h)=>{g.fillStyle='#d8d8d8';g.fillRect(0,0,w,h);noiseFill(g,w,h,20000,150,105,0.6,2);
    for(let i=0;i<14;i++){g.fillStyle='rgba(70,70,70,.35)';g.beginPath();g.ellipse(R()*w,R()*h,20+R()*60,10+R()*30,R()*3,0,7);g.fill();}},{color:false});
  TEX.walk=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#8f897e';g.fillRect(0,0,w,h);
    for(let y=0;y<4;y++)for(let x=0;x<4;x++){const v=125+R()*30|0;g.fillStyle=`rgb(${v},${v-5},${v-14})`;g.fillRect(x*64+2,y*64+2,60,60);}
    noiseFill(g,w,h,5000,40,60,0.18,2);for(let i=0;i<20;i++){g.fillStyle='rgba(40,35,25,.25)';g.fillRect(R()*w,R()*h,R()*30,R()*20);}});
  TEX.ground=canvasTex(512,512,(g,w,h)=>{g.fillStyle='#5f5b46';g.fillRect(0,0,w,h);noiseFill(g,w,h,20000,60,70,0.4,4);
    for(let i=0;i<4000;i++){g.fillStyle=R()<.5?'rgba(72,90,48,.5)':'rgba(110,96,70,.45)';g.fillRect(R()*w,R()*h,4,4);}});
  TEX.ground.repeat.set(80,80);
  // upper floors: one bay x one floor tile; Yangon apartment blocks with balconies, grilles, AC units, laundry
  TEX.upper=[0,1,2,3].map(v=>canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#ffffff';g.fillRect(0,0,w,h);noiseFill(g,w,h,3000,190,60,0.25,3);
    // rain streaks
    for(let i=0;i<40;i++){g.fillStyle='rgba(60,60,55,.10)';g.fillRect(R()*w,R()*h*0.4,2+R()*3,40+R()*120);}
    const win=v%2===0;
    g.fillStyle='rgba(28,34,40,.92)';g.fillRect(40,60,176,112);
    g.fillStyle='rgba(150,175,190,.35)';g.fillRect(44,64,80,104);
    if(win){g.strokeStyle='rgba(50,50,48,.9)';g.lineWidth=4;for(let x=48;x<216;x+=16){g.beginPath();g.moveTo(x,60);g.lineTo(x,172);g.stroke();}} // grille
    if(v>=2){g.fillStyle='rgba(210,205,195,1)';g.fillRect(28,170,200,14);g.fillStyle='rgba(90,90,85,.9)';for(let x=32;x<224;x+=12)g.fillRect(x,140,3,30);g.fillRect(28,138,200,4);} // balcony
    if(R()<0.8){g.fillStyle='#d9d9d4';g.fillRect(150,186,60,36);g.fillStyle='#9a9a95';for(let y=190;y<220;y+=5)g.fillRect(154,y,52,2);} // AC unit
    if(v===3){const cols=['#c43c3c','#2f6db5','#e0b030','#3d8a4f','#f0f0f0'];for(let i=0;i<5;i++){g.fillStyle=cols[i];g.fillRect(50+i*30,128,22,34);}} // laundry
    g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,248,w,8);
  }));
  // ground-floor shophouses with Burmese signboards and roller shutters
  const SHOPS=[['ရွှေဆိုင်','#b81f24','#ffd65a'],['ဖုန်းဆိုင်','#1f4fa8','#ffffff'],['ဆေးဆိုင်','#1d7a45','#ffffff'],['ကော်ဖီ','#5b3a22','#ffe9c4'],
    ['မုန့်ဟင်းခါး','#d9a21c','#3a1b0a'],['စားသောက်ဆိုင်','#9c1b5c','#fff3c4'],['ကွန်ပျူတာ','#1b1b1b','#5ad1ff'],['ဟိုတယ်','#e4e0d4','#9b1d20']];
  TEX.shops=canvasTex(2048,256,(g,w,h)=>{
    SHOPS.forEach(([txt,bg,fg],i)=>{const x=i*256;
      g.fillStyle='#d7d2c6';g.fillRect(x,0,256,256);
      g.fillStyle=bg;g.fillRect(x+6,10,244,62);g.fillStyle=fg;g.font='700 34px Padauk, "Myanmar Text", sans-serif';g.textAlign='center';g.textBaseline='middle';
      g.fillText(txt,x+128,44,232);
      const shut=i%3===1;
      if(shut){g.fillStyle='#8e9295';g.fillRect(x+14,84,228,160);g.fillStyle='rgba(40,40,40,.4)';for(let y=88;y<244;y+=7)g.fillRect(x+14,y,228,2);}
      else{g.fillStyle='#2a2622';g.fillRect(x+14,84,228,160);g.fillStyle='rgba(255,220,160,.35)';g.fillRect(x+20,90,216,150);
        for(let k=0;k<12;k++){g.fillStyle=`hsl(${R()*360},45%,${35+R()*30}%)`;g.fillRect(x+24+R()*190,100+R()*120,10+R()*24,10+R()*18);}}
      g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x,244,256,12);
    });});
  TEX.roof=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#7d786e';g.fillRect(0,0,w,h);noiseFill(g,w,h,3000,70,70,0.4,3);});
  TEX.taxi=canvasTex(256,64,(g,w,h)=>{g.fillStyle='#f6c400';g.fillRect(0,0,w,h);g.fillStyle='#111';g.font='800 44px "Saira Condensed", Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('TAXI',w/2,h/2+2);});
  TEX.plate=canvasTex(256,64,(g,w,h)=>{g.fillStyle='#111';g.fillRect(0,0,w,h);g.strokeStyle='#ddd';g.lineWidth=3;g.strokeRect(4,4,w-8,h-8);g.fillStyle='#eee';g.font='700 34px "Saira Condensed", Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('YGN 4B-2026',w/2,h/2+2);});
  TEX.plateTaxi=canvasTex(256,64,(g,w,h)=>{g.fillStyle='#b3121b';g.fillRect(0,0,w,h);g.strokeStyle='#fff';g.lineWidth=3;g.strokeRect(4,4,w-8,h-8);g.fillStyle='#fff';g.font='700 34px "Saira Condensed", Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('YGN 7H-1103',w/2,h/2+2);});
  TEX.sign=canvasTex(512,160,(g,w,h)=>{g.fillStyle='#1f6b46';g.fillRect(0,0,w,h);g.strokeStyle='#f2f2ec';g.lineWidth=6;g.strokeRect(8,8,w-16,h-16);
    g.fillStyle='#f2f2ec';g.textAlign='center';g.font='700 58px Padauk, "Myanmar Text", sans-serif';g.fillText('ပြည်လမ်း',w/2,80);
    g.font='600 34px Barlow, Arial, sans-serif';g.fillText('PYAY ROAD  ↓  DOWNTOWN',w/2,130);});
  TEX.sign.wrapS=TEX.sign.wrapT=THREE.ClampToEdgeWrapping;
}

function signTex(text,bg,fg,w,h,font){return canvasTex(w||512,h||96,(g,W,H)=>{g.fillStyle=bg;g.fillRect(0,0,W,H);g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
  g.font=font||'700 46px Barlow, "Myanmar Text", Padauk, Arial, sans-serif';g.fillText(text,W/2,H/2+2,W-24);});}

  buildTextures();
  return { TEX, canvasTex, signTex };
}
