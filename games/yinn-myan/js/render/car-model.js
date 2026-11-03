// Code-built placeholder cars (v6). To be replaced by CC-licensed glTF models, Mark II first.
import * as THREE from 'three';
import { clamp } from '../core/util.js';

let TEX = null;
export function setCarTextures(t) { TEX = t; }

const PROFILES={
  markii:{body:[[-2.38,0.34],[-2.38,0.66],[-2.3,0.9],[-1.62,0.97],[1.0,0.93],[2.12,0.8],[2.38,0.64],[2.38,0.34]],
          glass:[[-1.62,0.95],[-0.98,1.39],[0.22,1.41],[1.02,0.92]],roof:[[-0.95,1.37],[0.2,1.395]]},
  crown:{body:[[-2.42,0.36],[-2.42,0.7],[-2.34,0.95],[-1.7,1.0],[1.05,0.97],[2.18,0.85],[2.42,0.7],[2.42,0.36]],
          glass:[[-1.7,0.98],[-1.05,1.45],[0.28,1.46],[1.06,0.96]],roof:[[-1.02,1.43],[0.25,1.455]]},
  ev:{body:[[-2.23,0.42],[-2.23,0.86],[-2.15,1.06],[1.1,1.04],[1.95,0.95],[2.23,0.78],[2.23,0.42]],
          glass:[[-2.12,1.04],[-1.95,1.58],[0.5,1.6],[1.12,1.03]],roof:[[-1.9,1.56],[0.45,1.6]]},
  probox:{body:[[-2.1,0.36],[-2.1,0.98],[1.15,0.96],[1.9,0.88],[2.1,0.7],[2.1,0.36]],
          glass:[[-2.08,0.96],[-2.04,1.48],[0.55,1.5],[1.18,0.95]],roof:[[-2.0,1.46],[0.5,1.5]]},
  hijet:{body:[[-1.7,0.42],[-1.7,0.78],[0.32,0.78],[0.32,1.08],[1.68,1.08],[1.7,0.42]],
          glass:[[0.36,1.06],[0.38,1.72],[1.46,1.74],[1.66,1.06]],roof:[[0.4,1.7],[1.44,1.78]]},
};
function shapeSides(g,y0,y1,k,bulge){const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const y=p.getY(i);const t=clamp((y-y0)/(y1-y0),0,1);let f=1-k*t;if(bulge){const m=(y-(y0+y1)/2)/((y1-y0)/2);f*=1-bulge*m*m;}p.setX(i,p.getX(i)*f);}
  g.computeVertexNormals();}
function extrude(points,width,mat,bevel){
  const sh=new THREE.Shape();sh.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)sh.lineTo(points[i][0],points[i][1]);sh.closePath();
  const b=bevel===undefined?0.07:bevel;
  const g=new THREE.ExtrudeGeometry(sh,{depth:Math.max(0.01,width-2*b),bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelSegments:4,curveSegments:8});
  g.translate(0,0,-(width-2*b)/2);g.rotateY(-Math.PI/2);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m;}
function bodyWithArches(pts,spec,mat){
  const sh=new THREE.Shape();sh.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)sh.lineTo(pts[i][0],pts[i][1]);
  const yb=pts[pts.length-1][1],Rr=spec.wr+0.055,cy=spec.wr;
  for(const za of [spec.a,-spec.b]){ // front arch first (we travel front -> rear along the sill)
    sh.lineTo(za+Rr,yb);sh.lineTo(za+Rr,Math.min(yb,cy));sh.absarc(za,cy,Rr,0,Math.PI,false);sh.lineTo(za-Rr,yb);}
  sh.closePath();
  const b=0.085,width=spec.W;
  const g=new THREE.ExtrudeGeometry(sh,{depth:width-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:4,curveSegments:14});
  g.translate(0,0,-(width-2*b)/2);g.rotateY(-Math.PI/2);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m;}
export function buildCar(spec){
  const P=PROFILES[spec.id];const g=new THREE.Group();
  const paint=new THREE.MeshPhysicalMaterial({color:spec.paint,roughness:0.32,metalness:spec.paint<0x333333?0.5:0.15,clearcoat:1,clearcoatRoughness:0.06,envMapIntensity:1.2});
  const glass=new THREE.MeshPhysicalMaterial({color:0x1c262c,roughness:0.04,metalness:0.55,clearcoat:1,envMapIntensity:1.8});
  const trim=new THREE.MeshStandardMaterial({color:0x151617,roughness:0.55});
  const chrome=new THREE.MeshStandardMaterial({color:0xdddddd,roughness:0.12,metalness:1});
  const body=bodyWithArches(P.body,spec,paint);g.add(body);
  shapeSides(body.geometry,0.3,P.body.reduce((m,q)=>Math.max(m,q[1]),0),0,0.06);
  const belt=P.glass[0][1],top=P.glass[2][1];
  const gl=extrude(P.glass,spec.W-0.14,glass,0.05);shapeSides(gl.geometry,belt,top,spec.truck?0.04:0.17);g.add(gl);
  const rf=[[P.roof[0][0],P.roof[0][1]],[P.roof[0][0]+0.05,P.roof[1][1]+0.02],[P.roof[1][0],P.roof[1][1]+0.02],[P.roof[1][0]+0.05,P.roof[0][1]]];
  const roofM=extrude(rf,(spec.W-0.16)*(spec.truck?0.96:0.83),paint,0.03);g.add(roofM);
  // pillars
  const pil=(x0,y0,x1,y1)=>{for(const sd of [1,-1]){const len=Math.hypot(x1-x0,y1-y0);const m=new THREE.Mesh(new THREE.BoxGeometry(0.06,len,0.09),paint);
    m.position.set(sd*(spec.W/2-0.07)*(spec.truck?0.98:0.92),(y0+y1)/2,(x0+x1)/2);m.rotation.x=Math.atan2(x1-x0,y1-y0);m.rotation.z=sd*(spec.truck?0.02:0.12);m.castShadow=true;g.add(m);}};
  pil(P.glass[3][0],P.glass[3][1],P.glass[2][0],P.glass[2][1]);pil(P.glass[0][0],P.glass[0][1],P.glass[1][0],P.glass[1][1]);
  const bx=(P.glass[1][0]+P.glass[2][0])/2;pil(bx,P.glass[0][1]+0.02,bx,P.glass[2][1]);
  const L=spec.L,W=spec.W;const front=L/2,rear=-L/2;
  // bumpers + skirts
  const fb=new THREE.Mesh(new THREE.BoxGeometry(W+0.02,0.2,0.2),trim);fb.position.set(0,0.42,front-0.02);g.add(fb);
  const rb=fb.clone();rb.position.z=rear+0.02;g.add(rb);
  // lights
  const hlMat=new THREE.MeshStandardMaterial({color:0xfff4dc,emissive:0xfff2d0,emissiveIntensity:0.6,roughness:0.1,metalness:0.3});
  const tlMat=new THREE.MeshStandardMaterial({color:0x7a0d0d,emissive:0xff1010,emissiveIntensity:0.35,roughness:0.2});
  const fh=P.body.find(p=>p[0]>=front-0.3&&p[1]>0.5)||[front,0.7];const hy=spec.truck?0.68:Math.min(fh[1],0.78)-0.08;
  for(const sd of [1,-1]){
    const h=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.13,0.05),hlMat);h.position.set(sd*(W/2-0.3),hy,front+0.005);g.add(h);
    const tw2=spec.id==='ev'?0.7:spec.id==='markii'||spec.id==='crown'?0.55:0.3;const t=new THREE.Mesh(new THREE.BoxGeometry(tw2,0.15,0.05),tlMat);t.position.set(sd*(W/2-0.12-tw2/2),spec.truck?0.62:spec.id==='probox'?0.9:0.82,rear-0.005);g.add(t);}
  if(spec.id==='crown'||spec.id==='markii'){const gr=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.16,0.04),spec.id==='crown'?chrome:trim);gr.position.set(0,hy+0.02,front+0.01);g.add(gr);}
  // plates
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(0.42,0.11),new THREE.MeshStandardMaterial({map:spec.taxi?TEX.plateTaxi:TEX.plate,roughness:0.5}));
  plate.position.set(0,0.5,front+0.12);g.add(plate);const p2=plate.clone();p2.position.set(0,0.62,rear-0.12);p2.rotation.y=Math.PI;g.add(p2);
  if(!spec.ev){const ex=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.22,12).rotateX(Math.PI/2),chrome);ex.position.set(spec.id==='markii'?0.55:-0.55,0.3,rear-0.02);g.add(ex);
    if(spec.id==='markii'){const e2=ex.clone();e2.position.x=0.42;g.add(e2);}}
  // mirrors
  for(const sd of [1,-1]){const m=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.12,0.12),paint);m.position.set(sd*(W/2+0.08),P.glass[3][1]+0.12,P.glass[3][0]-0.18);m.castShadow=true;g.add(m);}
  if(spec.taxi){const sign=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.2,0.24),[trim,trim,trim,trim,new THREE.MeshStandardMaterial({map:TEX.taxi,emissive:0x332800,roughness:0.4}),new THREE.MeshStandardMaterial({map:TEX.taxi,roughness:0.4})]);
    sign.position.set(0,P.roof[1][1]+0.13,-0.6);g.add(sign);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(W+0.025,0.08,2.6),new THREE.MeshStandardMaterial({color:0xc4141c,roughness:0.4}));stripe.position.set(0,0.74,-0.2);g.add(stripe);}
  if(spec.truck){ // flatbed with drop sides
    const bedM=new THREE.MeshStandardMaterial({color:0x9a9a96,roughness:0.6,metalness:0.4});
    const floor=new THREE.Mesh(new THREE.BoxGeometry(W,0.06,1.95),bedM);floor.position.set(0,0.8,-0.68);g.add(floor);
    for(const sd of [1,-1]){const s=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.3,1.95),paint);s.position.set(sd*W/2,0.98,-0.68);s.castShadow=true;g.add(s);}
    const tg=new THREE.Mesh(new THREE.BoxGeometry(W,0.3,0.04),paint);tg.position.set(0,0.98,-1.66);g.add(tg);
    const hg=new THREE.Mesh(new THREE.BoxGeometry(W-0.1,0.5,0.05),bedM);hg.position.set(0,1.1,0.29);g.add(hg);
    g.children[0].visible=true;}
  // wheels: tyre + alloy/steel rim with spokes
  const wheels=[];const r=spec.wr,tw=spec.truck?0.15:0.21;
  const tyreG=new THREE.CylinderGeometry(r,r,tw,26);tyreG.rotateZ(Math.PI/2);
  const tyreM=new THREE.MeshStandardMaterial({color:0x161616,roughness:0.9});
  const rimM=new THREE.MeshStandardMaterial({color:spec.id==='markii'?0xbfc4c8:0x9fa4a8,roughness:0.25,metalness:0.9});
  const arch=new THREE.MeshStandardMaterial({color:0x080808,roughness:1});
  const ax=[spec.a,-spec.b];
  ax.forEach((z,ai)=>{for(const sd of [1,-1]){
    const piv=new THREE.Group();piv.position.set(sd*(W/2-tw/2-0.03),r,z);
    const w=new THREE.Group();const tyre=new THREE.Mesh(tyreG,tyreM);tyre.castShadow=true;w.add(tyre);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(r*0.62,r*0.62,tw+0.01,20).rotateZ(Math.PI/2),rimM);w.add(rim);
    const n=spec.truck?0:5;for(let k=0;k<n;k++){const sp=new THREE.Mesh(new THREE.BoxGeometry(tw+0.02,r*0.95,0.05),rimM);sp.rotation.x=k/n*Math.PI;w.add(sp);}
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*0.18,r*0.18,tw+0.03,10).rotateZ(Math.PI/2),trim);w.add(hub);
    piv.add(w);g.add(piv);wheels.push({piv,w,front:ai===0});
    // dark arch liner behind the wheel
    const lin=new THREE.Mesh(new THREE.CylinderGeometry(r+0.06,r+0.06,0.02,20,1,false,0,Math.PI).rotateZ(Math.PI/2),arch);
    lin.position.set(sd*(W/2-tw-0.06),r,z);lin.rotation.x=Math.PI/2;g.add(lin);}});
  g.userData={wheels,tlMat,hlMat,paint};
  return g;
}
