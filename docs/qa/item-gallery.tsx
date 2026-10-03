// Dev-only model gallery, using the exact production factories; no storage/network.
import * as THREE from 'three';
import { createCollectibleModel } from '../../src/game/three/CollectibleModels';
import { ITEM_CATALOG, type ItemType } from '../../src/game/learning/ItemCatalog';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.domElement.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.getElementById('root')!.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xe8f0e8);scene.add(new THREE.HemisphereLight(0xfffcf0,0x97b5a8,2));const sun=new THREE.DirectionalLight(0xffedca,2.6);sun.position.set(-8,15,10);scene.add(sun);
const camera=new THREE.OrthographicCamera(-12,12,7,-7,.1,80);camera.position.set(0,4.7,24);camera.lookAt(0,.8,0);
const order:ItemType[]=['APPLE','ORANGE','BANANA','BROCCOLI','CARROT','BURGER','PIZZA','DONUT','MEAL','COLA','WATER','MILK','SHOES','DUMBBELL','ROPE'];
const labels:{element:HTMLSpanElement;position:THREE.Vector3}[]=[];
for(let i=0;i<order.length;i++){
  const x=(i%5-2)*4.6,y=(1-Math.floor(i/5))*4.1;
  const model=createCollectibleModel(order[i]);model.position.set(x,y,0);model.rotation.y=.12;scene.add(model);
  const label=document.createElement('span');label.textContent=ITEM_CATALOG[order[i]].name;label.style.cssText='position:fixed;transform:translate(-50%,0);font:600 14px sans-serif;color:#445a58;text-align:center';document.body.append(label);labels.push({element:label,position:new THREE.Vector3(x,y-.27,0)});
}
const title=document.createElement('div');title.textContent='FOOD FIT FUN · โมเดลไอเทม 3D ทั้ง 15 ชนิด · QA';title.style.cssText='position:fixed;top:16px;left:20px;font:700 16px sans-serif;color:#426c62';document.body.append(title);
function draw(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);const halfWidth=Math.max(12.7,7.8*w/h),halfHeight=halfWidth/(w/h);camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.render(scene,camera);for(const label of labels){const p=label.position.clone().project(camera);label.element.style.left=`${(p.x+1)/2*w}px`;label.element.style.top=`${(1-p.y)/2*h}px`;}}draw();window.addEventListener('resize',draw);
