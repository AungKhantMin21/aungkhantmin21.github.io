// Renderer, scene, camera, sky, image-based light and sun. (v6 look, to be replaced by the HDRI/PBR pipeline.)
import * as THREE from 'three';
import { $, isTouch } from '../core/util.js';

export function createStage() {
const canvas=$('game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,isTouch?1.5:1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const HAZE=new THREE.Color(0xd4c3a6);
scene.fog=new THREE.Fog(HAZE,70,440);
const camera=new THREE.PerspectiveCamera(58,16/9,0.3,500);
// late-afternoon sun, hazy Yangon sky
const SUN_DIR=new THREE.Vector3(-0.55,0.42,0.72).normalize();
const sky=new THREE.Mesh(new THREE.SphereGeometry(470,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{sun:{value:SUN_DIR}},
  vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}',
  fragmentShader:`varying vec3 vD;uniform vec3 sun;
  void main(){float h=clamp(vD.y,0.,1.);vec3 zen=vec3(.30,.47,.70),hor=vec3(.86,.78,.66);
  vec3 c=mix(hor,zen,pow(h,.55));float s=max(dot(normalize(vD),sun),0.);
  c+=vec3(1.,.82,.55)*pow(s,8.)*.35+vec3(1.,.9,.7)*pow(s,900.)*4.;
  if(vD.y<0.)c=mix(hor,vec3(.45,.42,.36),clamp(-vD.y*4.,0.,1.));
  gl_FragColor=vec4(pow(c,vec3(2.2)),1.);}`}));
sky.userData.dynamic=true;scene.add(sky);
// environment map from the sky for reflections on paint and glass
const pmrem=new THREE.PMREMGenerator(renderer);
const envScene=new THREE.Scene();
const envSky=new THREE.Mesh(new THREE.SphereGeometry(500,32,16),sky.material.clone());
envSky.material.vertexShader='varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
envSky.material.depthTest=false;envScene.add(envSky);
const envGround=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshBasicMaterial({color:0x5b554b}));envGround.rotation.x=-Math.PI/2;envGround.position.y=-2;envScene.add(envGround);
const ENV=pmrem.fromScene(envScene,0.02).texture;scene.environment=ENV;
const hemi=new THREE.HemisphereLight(0xdfe8f5,0x6a5c48,1.1);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe2b8,3.6);sun.castShadow=true;
sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);
Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:1,far:240});sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.03;
scene.add(sun,sun.target);


  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  return { renderer, scene, camera, sky, sun, hemi, ENV, SUN_DIR, HAZE, resize };
}
