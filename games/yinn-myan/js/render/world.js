// Static scenery generated from road.json (v6): road surface, kerbs, markings, OSM buildings + filler
// shophouses, trees, poles and cables, signals, YBS stops, flyovers. Milestone 1 replaces the
// buildings/flyover between s 3230 and 4850 with hand-modelled, photo-matched assets.
import * as THREE from 'three';
import { lerp } from '../core/util.js';
import { LANE_W } from '../sim/road.js';
import { buildScenery } from './scenery.js';

const CYCLE = { green: 24, amber: 4, red: 20 }; const CYC = CYCLE.green + CYCLE.amber + CYCLE.red;
export function signalState(sg, t) { const p = (t + sg.offset) % CYC; return p < CYCLE.green ? 'green' : p < CYCLE.green + CYCLE.amber ? 'amber' : 'red'; }

export function buildWorld({ scene, road, decks = [], SC = null, TEX, R, canvasTex, signTex }) {
  const { RD, CL, JUNCTIONS, frameAt, curbAt, medAt, lanesAt, walkAt, raisedAt, gapAt, projectAny } = road;
const F=v=>typeof v==='function'?v:()=>v;
// a strip between two lateral offsets (numbers or functions of s) along the road
function stripGeom(d0,d1,y,step,skip,uvScale){
  d0=F(d0);d1=F(d1);y=F(y);const pos=[],uv=[],idx=[];let vi=0;const us=uvScale||0.25;
  for(let s=0;s<CL.len;s+=step){const s2=Math.min(s+step,CL.len);if(skip&&(skip(s)||skip(s2)))continue;
    const a=frameAt(s),b=frameAt(s2);const a0=d0(s),a1=d1(s),b0=d0(s2),b1=d1(s2),ya=y(s),yb=y(s2);
    pos.push(a.x+a.nx*a0,ya,a.z+a.nz*a0, a.x+a.nx*a1,ya,a.z+a.nz*a1, b.x+b.nx*b0,yb,b.z+b.nz*b0, b.x+b.nx*b1,yb,b.z+b.nz*b1);
    uv.push(a0*us,s*us,a1*us,s*us,b0*us,s2*us,b1*us,s2*us);
    if(a1>a0)idx.push(vi,vi+1,vi+2,vi+1,vi+3,vi+2);else idx.push(vi,vi+2,vi+1,vi+1,vi+2,vi+3);vi+=4;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
function wallGeom(d,y0,y1,step,skip,flip){d=F(d);const pos=[],idx=[];let vi=0;
  for(let s=0;s<CL.len;s+=step){const s2=Math.min(s+step,CL.len);if(skip&&(skip(s)||skip(s2)))continue;const a=frameAt(s),b=frameAt(s2);const da=d(s),db=d(s2);
    pos.push(a.x+a.nx*da,y0,a.z+a.nz*da,a.x+a.nx*da,y1,a.z+a.nz*da,b.x+b.nx*db,y0,b.z+b.nz*db,b.x+b.nx*db,y1,b.z+b.nz*db);
    if(flip)idx.push(vi,vi+1,vi+2,vi+1,vi+3,vi+2);else idx.push(vi,vi+2,vi+1,vi+1,vi+2,vi+3);vi+=4;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
const addM=(g,m,recv,cast)=>{const o=new THREE.Mesh(g,m);o.receiveShadow=!!recv;o.castShadow=!!cast;scene.add(o);return o;};
const SIGNALS=[];
const TANK_G=new THREE.CylinderGeometry(0.8,0.8,1.4,10),TANK_M=[new THREE.MeshStandardMaterial({color:0x2b5ea8,roughness:0.6}),new THREE.MeshStandardMaterial({color:0x2c2c2c,roughness:0.6})];
const BAR_M=new THREE.MeshStandardMaterial({color:0xc8442a,roughness:0.7});
let WM=null;
function buildWorld(){
  const M=WM={
    asphalt:new THREE.MeshStandardMaterial({map:TEX.asphalt,roughnessMap:TEX.asphaltR,roughness:0.92,metalness:0}),
    walk:new THREE.MeshStandardMaterial({map:TEX.walk,roughness:0.9}),
    curb:new THREE.MeshStandardMaterial({color:0xbab4a6,roughness:0.85}),
    curbPaint:new THREE.MeshStandardMaterial({color:0xd8c24a,roughness:0.8}),
    median:new THREE.MeshStandardMaterial({color:0x4d6630,roughness:1}),
    white:new THREE.MeshStandardMaterial({color:0xe2e0d6,roughness:0.7,polygonOffset:true,polygonOffsetFactor:-2}),
    yellow:new THREE.MeshStandardMaterial({color:0xd9a42a,roughness:0.7,polygonOffset:true,polygonOffsetFactor:-2}),
    ground:new THREE.MeshStandardMaterial({map:TEX.ground,roughness:1}),
    metal:new THREE.MeshStandardMaterial({color:0x8a8f93,roughness:0.5,metalness:0.7}),
    dark:new THREE.MeshStandardMaterial({color:0x2a2d30,roughness:0.6,metalness:0.4}),
    concrete:new THREE.MeshStandardMaterial({color:0xa8a397,roughness:0.9}),
    shelter:new THREE.MeshStandardMaterial({color:0x2f5f9e,roughness:0.5,metalness:0.3}),
  };
  TEX.ground.repeat.set(100,260);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(4000,10400,32,80),M.ground);ground.rotation.x=-Math.PI/2;ground.position.set(-350,-0.12,3900);ground.receiveShadow=true;scene.add(ground);
  // carriageways out to the (smoothed) curb on both sides
  addM(stripGeom(s=>-curbAt(s),s=>curbAt(s),0,4,null,0.09),M.asphalt,true);
  // raised median with openings; painted where the road has no physical divider
  const medSkip=s=>!!gapAt(s,0)||!raisedAt(s);
  addM(stripGeom(s=>-medAt(s),s=>medAt(s),0.24,4,medSkip),M.median,true);
  addM(wallGeom(s=>medAt(s),0,0.24,4,medSkip,true),M.curbPaint);addM(wallGeom(s=>-medAt(s),0,0.24,4,medSkip,false),M.curbPaint);
  for(const side of [1,-1]){const sk=s=>!!gapAt(s,side);
    const c0=s=>side*curbAt(s),c1=s=>side*(curbAt(s)+0.25),w1=s=>side*walkAt(s);
    const lo=(a,b)=>s=>Math.min(a(s),b(s)),hi=(a,b)=>s=>Math.max(a(s),b(s));
    addM(stripGeom(lo(c0,c1),hi(c0,c1),0.18,4,sk),M.curb,true);addM(wallGeom(c0,0,0.18,4,sk,side>0),M.curb);
    addM(stripGeom(lo(c1,w1),hi(c1,w1),0.18,4,sk,0.5),M.walk,true);}
  // markings: lane dashes per real lane count, edge lines, median lines, zebras and stop lines
  (function(){const P=[],I=[],YP=[],YI=[];let vi=0,yi=0;
    function quad(arrP,arrI,base,s0,s1,d0,d1,w){const a=frameAt(s0),b=frameAt(s1),y=0.012;
      arrP.push(a.x+a.nx*(d0-w),y,a.z+a.nz*(d0-w),a.x+a.nx*(d0+w),y,a.z+a.nz*(d0+w),b.x+b.nx*(d1-w),y,b.z+b.nz*(d1-w),b.x+b.nx*(d1+w),y,b.z+b.nz*(d1+w));
      arrI.push(base,base+1,base+2,base+1,base+3,base+2);}
    for(const side of [1,-1]){
      for(let s=0;s<CL.len-3;s+=9){if(gapAt(s,side)||gapAt(s+3,side)||gapAt(s,0))continue;const n=Math.min(lanesAt(s),lanesAt(s+3));
        for(let l=1;l<n;l++){quad(P,I,vi,s,s+3,side*(medAt(s)+l*LANE_W),side*(medAt(s+3)+l*LANE_W),0.07);vi+=4;}}
      for(let s=0;s<CL.len-3;s+=3){
        if(!gapAt(s,side)&&!gapAt(s+3,side)){quad(P,I,vi,s,s+3,side*(curbAt(s)-0.45),side*(curbAt(s+3)-0.45),0.08);vi+=4;}
        if(!gapAt(s,0)&&!gapAt(s+3,0)){const off=raisedAt(s)?0.25:0.12;quad(YP,YI,yi,s,s+3,side*(medAt(s)+off),side*(medAt(s+3)+off),0.07);yi+=4;}}}
    const zebra=s=>{const e=curbAt(s)-0.6;for(let d=-e;d<e;d+=1.1){if(Math.abs(d)<medAt(s)&&raisedAt(s))continue;quad(P,I,vi,s-3,s,d,d,0.28);vi+=4;}};
    for(const sg of RD.signals){if(sg.stop<40)continue;zebra(sg.stop+4.5);const c=medAt(sg.stop)+lanesAt(sg.stop)*LANE_W/2;quad(P,I,vi,sg.stop,sg.stop+0.45,c,c,lanesAt(sg.stop)*LANE_W/2);vi+=4;}
    for(const s of RD.crossings){if(s>40&&!RD.signals.some(g=>Math.abs(g.stop-s)<25))zebra(s);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();addM(g,M.white,true);
    const gy=new THREE.BufferGeometry();gy.setAttribute('position',new THREE.Float32BufferAttribute(YP,3));gy.setIndex(YI);gy.computeVertexNormals();addM(gy,M.yellow,true);})();
  // side streets (named from OSM) ending in barricades
  for(const j of JUNCTIONS){const f=frameAt(j.s);const cb=curbAt(j.s);for(const sd of (j.side===0?[1,-1]:[j.side])){
    const len=55;const m=new THREE.Mesh(new THREE.PlaneGeometry(j.w,len),M.asphalt);m.receiveShadow=true;m.rotation.x=-Math.PI/2;
    m.position.set(f.x+f.nx*sd*(cb+len/2),0.004,f.z+f.nz*sd*(cb+len/2));m.rotation.z=-Math.atan2(f.nx,f.nz);scene.add(m);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(j.w,1.1,0.4),BAR_M);bar.castShadow=true;
    bar.position.set(f.x+f.nx*sd*(cb+len),0.55,f.z+f.nz*sd*(cb+len));bar.rotation.y=Math.atan2(f.tx,f.tz);scene.add(bar);
    if(j.name&&j.w>=11){ // blue street-name sign on the corner
      const tex=signTex(j.name,'#1d4f91','#ffffff',512,96);const sg=new THREE.Group();
      const pl=new THREE.Mesh(new THREE.PlaneGeometry(2.6,0.5),new THREE.MeshStandardMaterial({map:tex,roughness:0.5,side:THREE.DoubleSide}));pl.position.y=3.1;
      const po=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,3.2,6),M.metal);po.position.y=1.6;sg.add(pl,po);
      const ds=sd*(cb+1.2);sg.position.set(f.x+f.nx*ds-f.tx*(j.w/2+1.2),0.18,f.z+f.nz*ds-f.tz*(j.w/2+1.2));sg.rotation.y=Math.atan2(f.nx,f.nz);scene.add(sg);}}}
  if(SC)buildScenery({scene,road,SC,TEX,R,canvasTex,signTex,M});else buildBuildings();buildTreesPoles(M);buildSignals(M);buildBusStops(M);buildFlyovers(M);
  // overhead road sign at the start
  const f=frameAt(70);const grp=new THREE.Group();const cb=curbAt(70);
  const board=new THREE.Mesh(new THREE.PlaneGeometry(9,2.8),new THREE.MeshStandardMaterial({map:TEX.sign,roughness:0.6,side:THREE.DoubleSide}));board.position.set(0,6.4,0);
  const beam=new THREE.Mesh(new THREE.BoxGeometry(cb+1,0.3,0.3),M.metal);beam.position.set(-(cb+1)/2+4.5,7.9,0.1);
  const post=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,8,10),M.metal);post.position.set(-cb+3.6,4,0.1);
  [board,beam,post].forEach(o=>{o.castShadow=true;grp.add(o);});
  const dd=medAt(70)+lanesAt(70)*LANE_W/2;grp.position.set(f.x+f.nx*dd,0,f.z+f.nz*dd);grp.rotation.y=Math.atan2(f.tx,f.tz)+Math.PI;scene.add(grp);
}
function buildBuildings(){
  const lists={shop:{P:[],U:[],C:[],I:[]},up:[0,1,2,3].map(()=>({P:[],U:[],C:[],I:[]})),roof:{P:[],U:[],C:[],I:[]}};
  const PAL=[[0.93,0.88,0.78],[0.82,0.8,0.74],[0.66,0.76,0.73],[0.87,0.75,0.6],[0.74,0.78,0.81],[0.9,0.84,0.66],[0.8,0.63,0.52],[0.7,0.74,0.64],[0.96,0.94,0.9],[0.6,0.68,0.7]];
  // generic prism from a footprint polygon (x,z); walls face outward whatever the winding
  function prism(L,pts,y0,h,col,uw,uh,u0){
    let cx=0,cz=0;pts.forEach(p=>{cx+=p[0];cz+=p[1];});cx/=pts.length;cz/=pts.length;let u=u0||0;
    for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<0.05)continue;
      const base=L.P.length/3;L.P.push(a[0],y0,a[1],b[0],y0,b[1],b[0],y0+h,b[1],a[0],y0+h,a[1]);
      const u1=u+len/uw;L.U.push(u,0,u1,0,u1,h/uh,u,h/uh);u=u1;for(let k=0;k<4;k++)L.C.push(col[0],col[1],col[2]);
      // outward test: edge normal (dz,-dx) vs vector from centroid
      const ex=b[0]-a[0],ez=b[1]-a[1];const mx=(a[0]+b[0])/2-cx,mz=(a[1]+b[1])/2-cz;const out=(ez*mx-ex*mz)>0;
      if(out)L.I.push(base,base+1,base+2,base,base+2,base+3);else L.I.push(base,base+2,base+1,base,base+3,base+2);}}
  function roof(pts,y,shade){const L=lists.roof;const v2=pts.map(p=>new THREE.Vector2(p[0],p[1]));let tris;
    try{tris=THREE.ShapeUtils.triangulateShape(v2,[]);}catch(e){return;}
    const base=L.P.length/3;for(const p of pts){L.P.push(p[0],y,p[1]);L.U.push(p[0]/8,p[1]/8);L.C.push(shade,shade,shade);}
    for(const t of tris){const a=pts[t[0]],b=pts[t[1]],c=pts[t[2]];const cr=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      if(cr<0)L.I.push(base+t[0],base+t[1],base+t[2]);else L.I.push(base+t[0],base+t[2],base+t[1]);}}
  function addTank(x,z,y){if(R()<0.55){const t=new THREE.Mesh(TANK_G,R()<.5?TANK_M[0]:TANK_M[1]);t.position.set(x,y+0.7,z);t.castShadow=true;scene.add(t);}}
  // frontage coverage per side (5 m bins) from real OSM buildings
  const NB=Math.ceil(CL.len/5)+1;const cover={'1':new Float32Array(NB).fill(1e9),'-1':new Float32Array(NB).fill(1e9)};
  const named=[];
  for(const b of RD.buildings){
    const pr=b.p.map(p=>projectAny(p[0],p[1]));if(pr.some(q=>!q))continue;
    let mind=1e9,ms=0,side=1;pr.forEach(q=>{const gap=Math.abs(q.d)-curbAt(q.s);if(gap<mind){mind=gap;ms=q.s;side=q.d>0?1:-1;}});
    if(mind<3)continue;
    const s0=Math.min(...pr.map(q=>q.s)),s1=Math.max(...pr.map(q=>q.s));
    for(let k=Math.max(0,Math.floor(s0/5));k<=Math.min(NB-1,Math.floor(s1/5));k++)cover[side][k]=Math.min(cover[side][k],mind);
    let area=0;for(let i=0;i<b.p.length;i++){const a=b.p[i],c=b.p[(i+1)%b.p.length];area+=a[0]*c[1]-c[0]*a[1];}area=Math.abs(area)/2;
    const floors=b.lv>0?Math.max(1,b.lv-1):(area>1500?3+(R()*4|0):area>400?2+(R()*3|0):1+(R()*3|0));
    const col=PAL[(R()*PAL.length)|0];const shopFront=mind<18&&area<4000;
    if(shopFront){prism(lists.shop,b.p,0.18,3.6,[1,1,1],48,3.6,(R()*8|0)/8);}
    else prism(lists.up[(R()*4)|0],b.p,0.18,3.6,col,4.2,3.1);
    prism(lists.up[(R()*4)|0],b.p,3.78,floors*3.1,col,4.2,3.1);roof(b.p,3.78+floors*3.1,0.75+R()*0.2);
    let cx=0,cz=0;b.p.forEach(p=>{cx+=p[0];cz+=p[1];});addTank(cx/b.p.length,cz/b.p.length,3.78+floors*3.1);
    if(b.n&&mind<40)named.push({b,pr,side,h:3.78+floors*3.1});
  }
  // name boards on real named buildings, on the wall nearest the road
  for(const nb of named){
    let best=null;for(let i=0;i<nb.b.p.length;i++){const a=nb.b.p[i],c=nb.b.p[(i+1)%nb.b.p.length];const len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<4)continue;
      const q=projectAny((a[0]+c[0])/2,(a[1]+c[1])/2);if(!q)continue;const sc=Math.abs(q.d);if(!best||sc<best.sc)best={a,c,len,sc,q};}
    if(!best)continue;
    const w=Math.min(best.len*0.85,Math.max(5,nb.b.n.length*0.42));const tex=signTex(nb.b.n,'#f4f1e8','#1c2a3a',768,128,'700 60px Barlow, Padauk, Arial, sans-serif');
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(w,w/6),new THREE.MeshStandardMaterial({map:tex,roughness:0.5,emissive:0x111111}));
    const mx=(best.a[0]+best.c[0])/2,mz=(best.a[1]+best.c[1])/2;const f=frameAt(best.q.s);const toRoad=best.q.d>0?-1:1;
    const nx=f.nx*toRoad,nz=f.nz*toRoad;pl.position.set(mx+nx*0.12,Math.min(nb.h-0.6,5.2),mz+nz*0.12);pl.rotation.y=Math.atan2(nx,nz);scene.add(pl);}
  // fill the gaps in mapped frontage with typical shophouses (OSM building coverage in Yangon is partial)
  for(const side of [1,-1]){let s=2;
    while(s<CL.len-6){const w=6+R()*10;const mid=s+w/2;const k0=Math.floor(s/5),k1=Math.floor((s+w)/5);let real=1e9;
      for(let k=k0;k<=Math.min(NB-1,k1);k++)real=Math.min(real,cover[side][k]);
      const near=JUNCTIONS.some(j=>(j.side===0||j.side===side)&&Math.abs(mid-j.s)<j.w/2+w/2+2);
      if(!near&&real>16){
        const maxDepth=real<1e8?Math.max(6,real-6):24;const depth=Math.min(maxDepth,11+R()*12),floors=R()<0.15?6+(R()*5|0):1+(R()*4|0);const hUp=floors*3.1;
        const f=frameAt(mid),f0=frameAt(s+0.2),f1=frameAt(s+w-0.2);const wk=walkAt(mid)+0.4;
        const pts=[[f0.x+f0.nx*side*wk,f0.z+f0.nz*side*wk],[f1.x+f1.nx*side*wk,f1.z+f1.nz*side*wk],[f1.x+f1.nx*side*(wk+depth),f1.z+f1.nz*side*(wk+depth)],[f0.x+f0.nx*side*(wk+depth),f0.z+f0.nz*side*(wk+depth)]];
        const col=PAL[(R()*PAL.length)|0];
        prism(lists.shop,pts,0.18,3.6,[1,1,1],48,3.6,(R()*8|0)/8);prism(lists.up[(R()*4)|0],pts,3.78,hUp,col,4.2,3.1);roof(pts,3.78+hUp,0.75+R()*0.2);
        addTank(f.x+f.nx*side*(wk+depth/2),f.z+f.nz*side*(wk+depth/2),3.78+hUp);}
      s+=w;}}
  function mk(L,mat){if(!L.P.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(L.P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(L.U,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(L.C,3));g.setIndex(L.I);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;scene.add(m);}
  TEX.shops.wrapS=THREE.RepeatWrapping;
  mk(lists.shop,new THREE.MeshStandardMaterial({map:TEX.shops,vertexColors:true,roughness:0.8}));
  lists.up.forEach((L,i)=>mk(L,new THREE.MeshStandardMaterial({map:TEX.upper[i],vertexColors:true,roughness:0.85})));
  mk(lists.roof,new THREE.MeshStandardMaterial({map:TEX.roof,vertexColors:true,roughness:0.95}));
}
function buildTreesPoles(M){
  if(!SC){ // v6 trees (OSM points + random street trees); real canopy trees come from scenery.js
  const trees=[];
  for(const t of RD.trees)trees.push({s:t[0],d:t[1]});
  for(const side of [1,-1])for(let s=8;s<CL.len-5;s+=13+R()*12){if(gapAt(s,side)||gapAt(s-5,side)||gapAt(s+5,side))continue;
    if(trees.some(t=>Math.abs(t.s-s)<9&&Math.sign(t.d)===side))continue;trees.push({s,d:side*(curbAt(s)+1.7)});}
  const trunkG=new THREE.CylinderGeometry(0.2,0.34,3.6,7);trunkG.translate(0,1.8,0);
  const crownG=new THREE.SphereGeometry(1,12,8);{const p=crownG.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const k=0.86+0.14*Math.sin(x*5.1+y*3.7)*Math.cos(z*4.3-y*2.9)+0.06*Math.sin(x*13+z*11);p.setXYZ(i,x*k,y*k,z*k);}
    crownG.computeVertexNormals();}
  const trunk=new THREE.InstancedMesh(trunkG,new THREE.MeshStandardMaterial({color:0x4e4134,roughness:0.95}),trees.length);
  const leafTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#8a8a8a';g.fillRect(0,0,w,h);for(let i=0;i<2600;i++){const v=60+R()*170|0;g.fillStyle=`rgba(${v},${v},${v},.85)`;g.beginPath();g.ellipse(R()*w,R()*h,2+R()*5,1.5+R()*3,R()*3,0,7);g.fill();}});
  leafTex.repeat.set(3,2);
  const N=trees.length*3;const crown=new THREE.InstancedMesh(crownG,new THREE.MeshStandardMaterial({color:0xffffff,map:leafTex,roughness:0.85}),N);
  trunk.castShadow=crown.castShadow=true;crown.receiveShadow=true;
  const o=new THREE.Object3D(),col=new THREE.Color();let ci=0;
  trees.forEach((t,i)=>{const f=frameAt(t.s);const x=f.x+f.nx*t.d,z=f.z+f.nz*t.d;
    o.position.set(x,0.18,z);o.rotation.set(0,R()*6,0);o.scale.set(1,1,1);o.updateMatrix();trunk.setMatrixAt(i,o.matrix);
    const r=2.4+R()*2;
    for(let k=0;k<3;k++){const a=R()*6.28,rr=k===0?0:r*0.55;o.position.set(x+Math.cos(a)*rr,3.6+r*0.35+R()*1.2,z+Math.sin(a)*rr);
      const sc=r*(k===0?1:0.7+R()*0.3);o.scale.set(sc*1.2,sc*0.6,sc*1.2);o.rotation.set(0,R()*6,0);o.updateMatrix();crown.setMatrixAt(ci,o.matrix);
      col.setHSL(0.22+R()*0.07,0.42+R()*0.15,0.3+R()*0.12);crown.setColorAt(ci,col);ci++;}});
  scene.add(trunk,crown);
  }
  const o=new THREE.Object3D();
  // street lights on the raised median
  const poles=[];for(let s=10;s<CL.len;s+=38){if(!gapAt(s,0)&&raisedAt(s))poles.push(s);}
  const pG=new THREE.CylinderGeometry(0.08,0.13,9,8);pG.translate(0,4.5,0);const aG=new THREE.BoxGeometry(0.2,0.12,5.4);aG.translate(0,8.9,0);
  const pM=new THREE.InstancedMesh(pG,M.metal,poles.length),aM=new THREE.InstancedMesh(aG,M.metal,poles.length);pM.castShadow=aM.castShadow=true;
  poles.forEach((s,i)=>{const f=frameAt(s);o.position.set(f.x,0.24,f.z);o.scale.set(1,1,1);o.rotation.set(0,Math.atan2(f.nx,f.nz),0);o.updateMatrix();pM.setMatrixAt(i,o.matrix);aM.setMatrixAt(i,o.matrix);});
  scene.add(pM,aM);
  // utility poles + sagging overhead cables
  const up=[];for(const side of [1,-1])for(let s=6;s<CL.len;s+=34){if(gapAt(s,side))continue;up.push({s,side});}
  const uG=new THREE.CylinderGeometry(0.12,0.16,10,6);uG.translate(0,5,0);
  const uM=new THREE.InstancedMesh(uG,new THREE.MeshStandardMaterial({color:0x8d877c,roughness:0.9}),up.length);uM.castShadow=true;
  const wire=[];
  up.forEach((p,i)=>{const f=frameAt(p.s);const d=p.side*(curbAt(p.s)+0.55);o.position.set(f.x+f.nx*d,0.18,f.z+f.nz*d);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.updateMatrix();uM.setMatrixAt(i,o.matrix);});
  for(const side of [1,-1]){const ps=up.filter(p=>p.side===side);
    for(let k=0;k<ps.length-1;k++){if(ps[k+1].s-ps[k].s>40)continue;const a=frameAt(ps[k].s),b=frameAt(ps[k+1].s);const da=side*(curbAt(ps[k].s)+0.55),db=side*(curbAt(ps[k+1].s)+0.55);
      for(const [h,off] of [[9.4,0],[8.9,0.25],[8.4,-0.2]]){let prev=null;for(let t=0;t<=8;t++){const u=t/8;const x=lerp(a.x+a.nx*(da+off),b.x+b.nx*(db+off),u),z=lerp(a.z+a.nz*(da+off),b.z+b.nz*(db+off),u);
        const y=h-Math.sin(u*Math.PI)*0.9;if(prev)wire.push(prev[0],prev[1],prev[2],x,y,z);prev=[x,y,z];}}}}
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(wire,3));
  scene.add(uM,new THREE.LineSegments(wg,new THREE.LineBasicMaterial({color:0x1a1a1a,transparent:true,opacity:0.8})));
}
function buildSignals(M){
  RD.signals.filter(g=>g.stop>40).forEach((g,k)=>{
    const stop=g.stop;const f=frameAt(stop);const grp=new THREE.Group();const cb=curbAt(stop);const reach=Math.min(cb-1.5,8);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,5.6,10),M.dark);post.position.y=2.8;
    const arm=new THREE.Mesh(new THREE.BoxGeometry(reach,0.15,0.15),M.dark);arm.position.set(-reach/2,5.4,0);
    const box=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.45,0.42),new THREE.MeshStandardMaterial({color:0x17191b,roughness:0.6}));box.position.set(-reach+0.6,4.85,0);
    [post,arm,box].forEach(o=>{o.castShadow=true;grp.add(o);});
    const lamps=[0xff3b30,0xffb020,0x2ee26b].map((c,i)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(0.17,16),new THREE.MeshStandardMaterial({color:0x111111,emissive:0x000000,emissiveIntensity:3}));
      m.position.set(-reach+0.6,5.3-i*0.45,-0.22);m.rotation.y=Math.PI;m.userData.on=c;grp.add(m);return m;});
    grp.position.set(f.x+f.nx*(cb+0.8),0.18,f.z+f.nz*(cb+0.8));grp.rotation.y=Math.atan2(f.nz,f.nx);
    grp.userData.dynamic=true;scene.add(grp);SIGNALS.push({stop,lamps,offset:k*17,state:'green',name:g.name});});
}
function buildBusStops(M){
  const ybs=signTex('YBS  ဘတ်စ်ကားမှတ်တိုင်','#f2c230','#1a1a1a',512,96,'700 40px Padauk, "Myanmar Text", Barlow, sans-serif');
  const sm=new THREE.MeshStandardMaterial({map:ybs,roughness:0.5});
  for(const b of RD.bus){if(b.s<20||b.s>CL.len-20)continue;const f=frameAt(b.s);const d=b.side*(curbAt(b.s)+2.6);
    const g=new THREE.Group();
    const roof=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.08,5),M.shelter);roof.position.y=2.55;
    const back=new THREE.Mesh(new THREE.BoxGeometry(0.06,1.6,5),new THREE.MeshStandardMaterial({color:0x9fb6c8,roughness:0.1,metalness:0.4,transparent:true,opacity:0.55}));back.position.set(0.8,1.4,0);
    const bench=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.08,3.6),M.metal);bench.position.set(0.45,0.5,0);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.4,0.45),sm);sign.position.set(-0.92,2.25,0);sign.rotation.y=-Math.PI/2;
    g.add(roof,back,bench,sign);for(const z of [-2.3,2.3])for(const x of [-0.8,0.8]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.5,6),M.metal);p.position.set(x,1.25,z);g.add(p);}
    g.children.forEach(o=>o.castShadow=true);
    g.position.set(f.x+f.nx*d,0.18,f.z+f.nz*d);g.rotation.y=Math.atan2(f.tx,f.tz)+(b.side>0?0:Math.PI);scene.add(g);}
}
// Drivable decks (js/sim/deck.js) drawn from the same functions the physics uses, so what you see is
// what you drive on: deck surface following the ramp profile, slab underside, parapets, solid ramp
// walls where the deck is too low to pass under, piers in the median, lane paint.
function buildDecks(M){
  const STEP=2,SLAB=0.9,PARA=1.0,CLEAR=4.4;
  const ds=Object.assign(M.concrete.clone(),{side:THREE.DoubleSide});
  const top=Object.assign(M.asphalt.clone(),{side:THREE.DoubleSide});
  const paintW=Object.assign(M.white.clone(),{side:THREE.DoubleSide}),paintY=Object.assign(M.yellow.clone(),{side:THREE.DoubleSide});
  const geo=()=>({P:[],U:[],I:[]});const G={top:geo(),con:geo(),white:geo(),yellow:geo()};
  const pt=(s,d,y)=>{const f=frameAt(s);return [f.x+f.nx*d,y,f.z+f.nz*d];};
  // quad between edge A (s,dA,yA) and edge B (s,dB,yB), from s to s+STEP; d* and y* are functions of s
  function ribbon(L,sa,sb,dA,dB,yA,yB,uvK){
    for(let s=sa;s<sb-1e-6;s+=STEP){const s2=Math.min(s+STEP,sb);const b=L.P.length/3;
      const a0=pt(s,dA(s),yA(s)),a1=pt(s,dB(s),yB(s)),b0=pt(s2,dA(s2),yA(s2)),b1=pt(s2,dB(s2),yB(s2));
      L.P.push(...a0,...a1,...b0,...b1);const k=uvK||0.09;
      L.U.push(dA(s)*k,s*k,dB(s)*k,s*k,dA(s2)*k,s2*k,dB(s2)*k,s2*k);
      L.I.push(b,b+2,b+1,b+1,b+2,b+3);}}
  // runs of s where pred(s) holds, at STEP resolution
  function runs(s0,s1,pred){const out=[];let a=null;for(let s=s0;s<=s1+1e-6;s+=STEP){const ok=pred(s);if(ok&&a===null)a=s;if(!ok&&a!==null){out.push([a,s]);a=null;}}if(a!==null)out.push([a,s1]);return out;}
  const lift=y=>s=>y(s)+0.02;
  function structure(s0,s1,yf,lf,rf,parL,parR){
    // deck top, slab underside (where clear), outer faces down to the slab or to the ground on ramps
    ribbon(G.top,s0,s1,lf,rf,lift(yf),lift(yf));
    for(const [a,b] of runs(s0,s1,s=>yf(s)>=CLEAR))ribbon(G.con,a,b,lf,rf,s=>yf(s)-SLAB,s=>yf(s)-SLAB);
    const foot=s=>yf(s)>=CLEAR?yf(s)-SLAB:0;
    for(const [e,par] of [[lf,parL],[rf,parR]]){ribbon(G.con,s0,s1,e,e,foot,s=>yf(s)+(par(s)?PARA:0.02));}
  }
  for(const k of decks){
    const nb=k.nb;
    // southbound deck; where joined, its slab reaches across the northbound lanes
    structure(k.s0,k.s1,k.y,s=>k.left(s),s=>k.right(s),()=>true,()=>true);
    // northbound deck where it is its own structure (its ramps)
    if(nb){const nl=s=>nb.centre(s)-nb.hw,nr=s=>nb.centre(s)+nb.hw;
      for(const [a,b] of runs(nb.s0,nb.s1,s=>!k.joined(s)))structure(a,b,nb.y,nl,nr,()=>true,()=>true);
      // northbound lane divider (dashed) and edge lines
      for(let s=nb.s0+MOUTH_PAINT;s<nb.s1-MOUTH_PAINT;s+=9){const c=s2=>nb.centre(s2)+0.07,c2=s2=>nb.centre(s2)-0.07;const yy=s2=>nb.y(s2)+0.035;ribbon(G.white,s,Math.min(s+3,nb.s1),c2,c,yy,yy,1);}
      for(const off of [-nb.hw+0.45,nb.hw-0.45])ribbon(G.white,nb.s0,nb.s1,s=>nb.centre(s)+off-0.07,s=>nb.centre(s)+off+0.07,s=>nb.y(s)+0.035,s=>nb.y(s)+0.035,1);}
    // southbound edge lines; double yellow on the joined section (no barrier between the directions, as in the photos)
    for(const sd of [-1,1])ribbon(G.white,k.s0,k.s1,s=>k.centre(s)+sd*(k.hwAt(s)-0.45)-0.07,s=>k.centre(s)+sd*(k.hwAt(s)-0.45)+0.07,s=>k.y(s)+0.035,s=>k.y(s)+0.035,1);
    if(nb)for(const [a,b] of runs(k.s0,k.s1,s=>k.joined(s))){const mid=s=>(k.centre(s)-k.hwAt(s)+nb.centre(s)+nb.hw)/2;
      for(const o of [-0.12,0.12])ribbon(G.yellow,a,b,s=>mid(s)+o-0.06,s=>mid(s)+o+0.06,s=>k.y(s)+0.035,s=>k.y(s)+0.035,1);}
    // piers on the median, every 27 m where the deck is high enough to stand on legs
    for(let s=k.s0+12;s<k.s1-12;s+=27){const y=k.y(s);if(y<CLEAR)continue;const d=k.joined(s)?(k.centre(s)+nb.centre(s))/2:k.centre(s);
      if(!(raisedAt(s)&&Math.abs(d)<medAt(s)-0.7))continue;const f=frameAt(s);const h=y-SLAB;
      const c=new THREE.Mesh(new THREE.BoxGeometry(1.4,h,1.4),M.concrete);c.position.set(f.x+f.nx*d,h/2,f.z+f.nz*d);c.rotation.y=Math.atan2(f.tx,f.tz);c.castShadow=true;scene.add(c);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(k.joined(s)?(k.right(s)-k.left(s))*0.8:k.hwAt(s)*1.6,0.6,1.8),M.concrete);cap.position.set(f.x+f.nx*d,h-0.3,f.z+f.nz*d);cap.rotation.y=Math.atan2(f.nx,f.nz)+Math.PI/2;cap.castShadow=true;scene.add(cap);}
  }
  const mk=(L,mat,uv)=>{if(!L.P.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(L.P,3));
    if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(L.U,2));g.setIndex(L.I);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;scene.add(m);};
  mk(G.top,top,true);mk(G.con,ds,false);mk(G.white,paintW,false);mk(G.yellow,paintY,false);
}
const MOUTH_PAINT=8;
function buildFlyovers(M){
  buildDecks(M);
  // flyovers that aren't drivable decks yet (Myaynigone overpass): flat deck + parapets, columns only where they stand clear of the lanes
  const covered=fl=>{const q=projectAny(fl.p[0][0],fl.p[0][1]);return q&&decks.some(k=>q.s>Math.min(k.s0,k.nb?k.nb.s0:k.s0)-20&&q.s<Math.max(k.s1,k.nb?k.nb.s1:k.s1)+20&&Math.abs(q.d)<15);};
  for(const fl of RD.flyovers){if(covered(fl))continue;
    const pts=[];for(let i=0;i<fl.p.length-1;i++){const a=fl.p[i],b=fl.p[i+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.max(1,Math.ceil(L/4));
      for(let k=0;k<n;k++)pts.push([lerp(a[0],b[0],k/n),lerp(a[1],b[1],k/n)]);}pts.push(fl.p[fl.p.length-1]);
    const w=Math.max(2,fl.lanes)*3.5+1.2,H=6.8;const P=[],I=[];let vi=0;
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];const tx=b[0]-a[0],tz=b[1]-a[1],l=Math.hypot(tx,tz)||1;const nx=-tz/l*w/2,nz=tx/l*w/2;
      for(const [y,dy] of [[H,0],[H-0.9,0]]){P.push(a[0]-nx,y,a[1]-nz,a[0]+nx,y,a[1]+nz,b[0]-nx,y,b[1]-nz,b[0]+nx,y,b[1]+nz);
        if(y===H)I.push(vi,vi+2,vi+1,vi+1,vi+2,vi+3);else I.push(vi,vi+1,vi+2,vi+1,vi+3,vi+2);vi+=4;}
      for(const sd of [-1,1]){const ox=nx*sd,oz=nz*sd;P.push(a[0]+ox,H-0.9,a[1]+oz,a[0]+ox,H+1.0,a[1]+oz,b[0]+ox,H-0.9,b[1]+oz,b[0]+ox,H+1.0,b[1]+oz);
        I.push(vi,vi+1,vi+2,vi+1,vi+3,vi+2,vi,vi+2,vi+1,vi+1,vi+2,vi+3);vi+=4;}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();addM(g,M.concrete,true,true);
    for(let i=0;i<pts.length;i+=6){const q=projectAny(pts[i][0],pts[i][1]);if(!q)continue;const ad=Math.abs(q.d);
      const inMedian=raisedAt(q.s)&&ad<medAt(q.s)-0.7,outside=ad>curbAt(q.s)+0.6;if(!inMedian&&!outside)continue;
      const c=new THREE.Mesh(new THREE.BoxGeometry(1.1,H-0.9,1.1),M.concrete);c.position.set(pts[i][0],(H-0.9)/2,pts[i][1]);c.castShadow=true;scene.add(c);}}
}


  buildWorld();
  return { SIGNALS, materials: WM };
}

/** Merge all static meshes into 240 m cells per material so frustum culling works (~100–200 draw calls). */
export function bakeStatic(scene, sun) {
  return bake();
function bake(){
  const CELL=240,buckets=new Map(),drop=[];const colMat=new Map();
  const v=new THREE.Vector3(),n=new THREE.Vector3(),M4=new THREE.Matrix4(),NM=new THREE.Matrix3(),IM=new THREE.Matrix4(),c=new THREE.Color();
  const p=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],q=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  function bucketFor(mat,key,cast,recv){let b=buckets.get(key);if(!b){b={mat,cast,recv,P:[],N:[],U:[],C:[]};buckets.set(key,b);}return b;}
  const e=new Float32Array(9);
  function addGeom(o,matrix,instColor){
    const g=o.geometry,pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv,col=g.attributes.color,idx=g.index;
    let mat=o.material;if(Array.isArray(mat))return false;
    if(instColor){if(!colMat.has(mat)){const m2=mat.clone();m2.vertexColors=true;colMat.set(mat,m2);}mat=colMat.get(mat);}
    const wantUV=!!(mat.map||mat.roughnessMap),wantC=!!mat.vertexColors;const mk=mat.uuid+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0);
    let byCell=buckets.get(mk);if(!byCell){byCell=new Map();buckets.set(mk,byCell);}
    NM.getNormalMatrix(matrix);const m=matrix.elements,nm=NM.elements;const tri=idx?idx.count/3:pos.count/3;const ia=idx?idx.array:null;
    const PA=pos.array,NA=nor?nor.array:null,UA=uv?uv.array:null,CA=col?col.array:null;
    for(let t=0;t<tri;t++){
      const i0=ia?ia[t*3]:t*3,i1=ia?ia[t*3+1]:t*3+1,i2=ia?ia[t*3+2]:t*3+2;
      let cx=0,cz=0;
      for(let k=0;k<3;k++){const i=k===0?i0:k===1?i1:i2;const x=PA[i*3],y=PA[i*3+1],z=PA[i*3+2];
        const X=m[0]*x+m[4]*y+m[8]*z+m[12],Y=m[1]*x+m[5]*y+m[9]*z+m[13],Z=m[2]*x+m[6]*y+m[10]*z+m[14];e[k*3]=X;e[k*3+1]=Y;e[k*3+2]=Z;cx+=X;cz+=Z;}
      const ck=(Math.floor(cx/3/CELL)+500)*1000+Math.floor(cz/3/CELL)+500;
      let b=byCell.get(ck);if(!b){b={mat,cast:o.castShadow,recv:o.receiveShadow,P:[],N:[],U:[],C:[]};byCell.set(ck,b);}
      for(let k=0;k<3;k++){const i=k===0?i0:k===1?i1:i2;b.P.push(e[k*3],e[k*3+1],e[k*3+2]);
        if(NA){const x=NA[i*3],y=NA[i*3+1],z=NA[i*3+2];let X=nm[0]*x+nm[3]*y+nm[6]*z,Y=nm[1]*x+nm[4]*y+nm[7]*z,Z=nm[2]*x+nm[5]*y+nm[8]*z;const l=Math.hypot(X,Y,Z)||1;b.N.push(X/l,Y/l,Z/l);}else b.N.push(0,1,0);
        if(wantUV){if(UA)b.U.push(UA[i*2],UA[i*2+1]);else b.U.push(0,0);}
        if(wantC){if(instColor)b.C.push(instColor.r,instColor.g,instColor.b);else if(CA)b.C.push(CA[i*3],CA[i*3+1],CA[i*3+2]);else b.C.push(1,1,1);}}}
    return true;}
  scene.updateMatrixWorld(true);
  for(const top of scene.children.slice()){
    if(top.userData.dynamic||top.isLight||top===sun.target)continue;
    let ok=true;const meshes=[];top.traverse(o=>{if(o.isLineSegments)ok=false;if(o.isMesh)meshes.push(o);});
    if(!ok||!meshes.length)continue;
    for(const o of meshes){
      if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,IM);M4.multiplyMatrices(o.matrixWorld,IM);
          let ic=null;if(o.instanceColor){c.fromBufferAttribute(o.instanceColor,i);ic=c;}addGeom(o,M4,ic);}}
      else addGeom(o,o.matrixWorld,null);}
    drop.push(top);}
  drop.forEach(o=>scene.remove(o));
  let nb=0;for(const byCell of buckets.values())for(const b of byCell.values()){nb++;const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(b.P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.N,3));
    if(b.U.length)g.setAttribute('uv',new THREE.Float32BufferAttribute(b.U,2));if(b.C.length)g.setAttribute('color',new THREE.Float32BufferAttribute(b.C,3));
    g.computeBoundingSphere();const m=new THREE.Mesh(g,b.mat);m.castShadow=b.cast;m.receiveShadow=b.recv;m.matrixAutoUpdate=false;m.updateMatrix();scene.add(m);}
  return nb;
}


}
