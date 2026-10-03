import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function builder(group:THREE.Group) {
  const materials=new Map<number,THREE.MeshStandardMaterial>();
  const add=(geo:THREE.BufferGeometry,color:number,x=0,y=0,z=0)=>{
    if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));
    const mesh=new THREE.Mesh(geo,materials.get(color)!);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  const box=(w:number,h:number,d:number,color:number,x=0,y=0,z=0,r=.08)=>add(new RoundedBoxGeometry(w,h,d,2,r),color,x,y,z);
  const ball=(r:number,color:number,x=0,y=0,z=0)=>add(new THREE.SphereGeometry(r,16,12),color,x,y,z);
  const cylinder=(r:number,h:number,color:number,x=0,y=0,z=0)=>add(new THREE.CylinderGeometry(r,r,h,12),color,x,y,z);
  return {add,box,ball,cylinder};
}

/** Static pieces in each moving tile share a draw call per material. */
function batchTile(group:THREE.Group):THREE.Group {
  group.updateMatrixWorld(true);
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  const originals:THREE.Mesh[]=[];
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh) || Array.isArray(object.material))return;
    const geometry=object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    if(!batches.has(object.material))batches.set(object.material,[]);
    batches.get(object.material)!.push(geometry);originals.push(object);
  });
  for(const [material,geometries] of batches){
    const geometry=mergeGeometries(geometries,false);
    if(!geometry)throw new Error('Park geometry attributes must match');
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    geometries.forEach(g=>g.dispose());
  }
  originals.forEach(mesh=>{group.remove(mesh);mesh.geometry.dispose();});
  return group;
}

export function createParkHorizon():THREE.Group {
  const group=new THREE.Group();group.name='park-horizon';const {ball,box}=builder(group);
  for(let i=0;i<9;i++){
    const hill=ball(25+i%3*5,[0xa3cdb0,0xb6d8bb,0x8cbaa1][i%3],(i-4)*42,-8,-240-i%2*30);hill.scale.set(1.5,.85,1);
  }
  // An unobtrusive neighborhood silhouette behind the tree line.
  for(let i=0;i<8;i++){
    const side=i%2?-1:1,x=side*(30+i*7),height=7+i%3*3,z=-160-i*9;
    box(8,height,8,[0xefdfcf,0xbcced2,0xd2c4d9][i%3],x,height/2,z,.35);
    box(8.4,.55,8.4,0xf8efdc,x,height,z,.15);
    for(let row=0;row<2;row++)for(let col=0;col<2;col++)box(1.25,1.7,.12,0x809eab,x-2+col*4,2+row*3,z+4.05);
  }
  return batchTile(group);
}

/** One 26-unit tile; scenery never occupies a running lane. */
export function createParkBlock(index:number,side:-1|1):THREE.Group {
  const group=new THREE.Group();group.name=`park-block-${index}-${side}`;
  const {box,ball,cylinder,add}=builder(group);
  const faceRoad=(first:number,x:number,z:number)=>{
    const axis=new THREE.Vector3(0,1,0), angle=-side*Math.PI/2;
    const rotation=new THREE.Quaternion().setFromAxisAngle(axis,angle);
    for(const mesh of group.children.slice(first)){
      mesh.position.sub(new THREE.Vector3(x,0,z)).applyAxisAngle(axis,angle).add(new THREE.Vector3(x,0,z));
      mesh.quaternion.premultiply(rotation);
    }
  };
  const tree=(x:number,z:number,variant:number)=>{
    cylinder(.25,3.65,0xa78464,x,1.85,z);
    const foliage=ball(1.25,variant%2?0x6ca881:0x80b48b,x,4.55,z);foliage.scale.set(1,1.15,.9);
    ball(.85,0x96c399,x-.65,4.85,z+.1);ball(.8,0x74ab86,x+.6,4.15,z-.15);
    const planter=cylinder(1.45,.22,0xcfc7b2,x,.12,z);planter.receiveShadow=true;
    cylinder(1.32,.04,0x9fb580,x,.25,z);
  };
  const window=(x:number,y:number,z:number,w=1.25,h=1.6)=>{
    box(w+.16,h+.16,.12,0xf6edd7,x,y,z);
    box(w,h,.14,0x6e9aab,x,y,z+.04);
    box(.07,h,.16,0xf6edd7,x,y,z+.12);
    box(w,.07,.16,0xf6edd7,x,y,z+.12);
  };
  const neighborhoodBuilding=(x:number,z:number,variant:number,backRow=false)=>{
    const first=group.children.length;
    const kind=variant%4, width=backRow?6.5:6, depth=5.5;
    const height=kind===2?9:kind===1?7.1:5;
    const wall=[0xe4bbae,0xb7ced0,0xefdfcf,0xd2c4db][variant%4];
    box(width,height,depth,wall,x,height/2,z,.18);
    box(width+.2,.32,depth+.2,0xf6edd7,x,.2,z,.08);
    const front=z+depth/2;
    if(kind===0){
      const roof=new THREE.Shape();roof.moveTo(-width/2-.4,0);roof.lineTo(width/2+.4,0);roof.lineTo(0,1.85);roof.closePath();
      add(new THREE.ExtrudeGeometry(roof,{depth:depth+.8,bevelEnabled:false}),0xbb9572,x,height,z-depth/2-.4);
      box(.5,1.2,.6,0xefdfcf,x+1.7,height+1,z-.5);
    }else{
      box(width+.5,.4,depth+.5,0xf6edd7,x,height+.12,z,.1);
      // Parapet and roof equipment give apartments a distinct skyline.
      box(width,.45,.16,wall,x,height+.48,front);
      if(kind===2){cylinder(.65,1.3,0x90b69a,x-1.5,height+.9,z-.8);box(1.4,.5,1.2,0x728f88,x+1.6,height+.55,z-.5);}
    }
    box(1.1,2.45,.2,0x698883,x,1.35,front+.12);
    box(.09,.25,.12,0xe6c689,x+.32,1.35,front+.26);
    const rows=kind===2?3:kind===1?2:1;
    for(let row=0;row<rows;row++)for(const dx of [-1.8,1.8])window(x+dx,2.05+row*2.6,front+.08);
    if(kind===1 || kind===3){
      // Cafe/store canopy, fascia and a geometric cup/leaf sign.
      const accent=kind===1?0x9cbaad:0xd29b7c;
      box(5.3,.8,.18,accent,x,3.5,front+.16);
      for(let stripe=0;stripe<7;stripe++)box(.74,.16,1.35,stripe%2?0xffedce:accent,x-2.22+stripe*.74,3.08,front+.65);
      if(kind===3){
        cylinder(.28,.4,0xffedce,x,3.5,front+.34);
        const handle=add(new THREE.TorusGeometry(.13,.045,6,10),0xffedce,x+.3,3.5,front+.35);handle.rotation.y=Math.PI/2;
      }else{const leaf=ball(.27,0xffedce,x,3.5,front+.32);leaf.scale.set(.6,1,.3);leaf.rotation.z=.45;}
    }
    if(kind===1 || kind===2){
      box(4.9,.18,.8,0xf6edd7,x,4.08,front+.35);
      box(4.9,.08,.08,0x728f88,x,4.75,front+.7);
      for(let post=0;post<8;post++)box(.06,.66,.06,0x728f88,x-2.35+post*.67,4.42,front+.7);
    }
    if(!backRow){
      box(5.4,.18,1.5,0xcfc7b2,x,.14,front+.95);
      if(kind===0){
        // A front garden with a gate opening, rather than a solid wall.
        for(const dx of [-2.2,2.2]){
          for(let post=0;post<4;post++)box(.15,1.05,.15,0xf6edd7,x+dx-.65+post*.43,.55,front+1.6);
          box(1.65,.12,.13,0xf6edd7,x+dx,.85,front+1.6);
        }
        for(const dx of [-2.2,2.2]){cylinder(.4,.55,0xd0ac8b,x+dx,.4,front+.8);ball(.48,0x80b48b,x+dx,1,front+.8);}
      }else if(kind===3){
        // Outdoor cafe table and stools.
        cylinder(.08,.9,0x728f88,x-1.9,.55,front+1.6);cylinder(.65,.12,0xc39d77,x-1.9,1.02,front+1.6);
        for(const dx of [-.95,.95]){cylinder(.12,.5,0x728f88,x-1.9+dx,.35,front+1.6);cylinder(.28,.14,0xc39d77,x-1.9+dx,.65,front+1.6);}
      }
    }
    faceRoad(first,x,z);
  };
  const streetAsset=(x:number,z:number,variant:number)=>{
    const first=group.children.length;
    switch(variant%5){
      case 0: // Bus shelter and route board.
        box(3.8,.18,1.9,0x9cbaad,x,3.35,z);
        for(const dx of [-1.7,1.7])box(.12,3.2,.12,0x728f88,x+dx,1.65,z-.55);
        box(3.3,2,.12,0xb7ced0,x,2,z-.67);
        box(2.5,.18,.65,0xc39d77,x,.82,z-.2);
        for(const dx of [-.9,.9])box(.12,.75,.4,0x728f88,x+dx,.42,z-.2);
        box(.7,1.2,.18,0xf6edd7,x-1.1,2.2,z-.55);
        for(let row=0;row<3;row++)box(.4,.08,.2,0x6e9aab,x-1.1,2.5-row*.25,z-.52);
        break;
      case 1: // Small produce stall with a striped canopy.
        box(2.2,1,.95,0xbb9572,x,.65,z);
        for(const dx of [-1,1])box(.1,2.4,.1,0xbb9572,x+dx,1.3,z-.3);
        for(let stripe=0;stripe<6;stripe++)box(.4,.17,1.4,stripe%2?0xffedce:0x9cbaad,x-1+stripe*.4,2.55,z);
        for(let fruit=0;fruit<6;fruit++)ball(.18,fruit%2?0x91b373:0xe5a466,x-.8+fruit*.32,1.26,z);
        break;
      case 2: { // Bicycle beside a short rack, aligned along the pavement.
        const wheel=(dx:number)=>add(new THREE.TorusGeometry(.45,.065,6,16),0x536b70,x+dx,.55,z);
        wheel(-.8);wheel(.8);
        const bar=(ax:number,ay:number,bx:number,by:number)=>{
          const length=Math.hypot(bx-ax,by-ay);
          const mesh=cylinder(.055,length,0x9cbaad,x+(ax+bx)/2,(ay+by)/2,z);
          mesh.rotation.z=-Math.atan2(bx-ax,by-ay);
        };
        bar(-.8,.55,-.2,1.15);bar(-.2,1.15,.2,.55);bar(.2,.55,-.8,.55);bar(-.2,1.15,.55,1.15);bar(.55,1.15,.2,.55);bar(.55,1.15,.8,.55);
        box(.4,.09,.2,0x536b70,x-.2,1.28,z);bar(.55,1.15,.55,1.45);box(.42,.07,.13,0x536b70,x+.55,1.45,z);
        for(const dx of [-1.3,1.3])cylinder(.055,.9,0x728f88,x+dx,.5,z-.4);
        box(2.6,.08,.08,0x728f88,x,.95,z-.4);
        break;
      }
      case 3: // Mailbox and paired recycling bins.
        cylinder(.07,1.4,0x728f88,x-.65,.75,z);
        box(.65,.65,.55,0x6e9aab,x-.65,1.5,z);
        box(.42,.06,.07,0x536b70,x-.65,1.6,z+.3);
        for(const dx of [.35,1.1]){box(.55,.85,.55,0x9cbaad,x+dx,.5,z);box(.62,.14,.62,0x728f88,x+dx,.98,z);box(.3,.12,.07,0xf6edd7,x+dx,.68,z+.3);}
        break;
      case 4: // Garden pergola with two planter beds.
        for(const dx of [-1.4,1.4])for(const dz of [-.55,.55])box(.14,2.7,.14,0xc39d77,x+dx,1.4,z+dz);
        for(let beam=0;beam<6;beam++)box(.14,.15,1.65,0xc39d77,x-1.6+beam*.64,2.8,z);
        for(const dx of [-1.35,1.35]){box(.7,.45,1.1,0xd0ac8b,x+dx,.3,z);const bush=ball(.55,0x80b48b,x+dx,.9,z);bush.scale.z=1.3;}
        break;
    }
    // Bicycle frames run along the street; shelter/stall fronts face inward.
    faceRoad(first,x,z);
  };
  box(5,.16,26,0xf1e5cc,side*9.5,.015,0,.03);
  // Sparse sidewalk seams; large calm surfaces keep food legible.
  for(const z of [-8,0,8])box(4.8,.015,.035,0xd0c8b6,side*9.5,.104,z,.006);
  tree(side*(10.4+(index%2)*.5),-7,index);
  streetAsset(side*10.2,-.5,index+(side===-1?2:0));
  if(index%3===0) {
    const x=side*8.4,z=8;
    cylinder(.09,4.3,0x728f88,x,2.1,z);
    box(.65,.17,.65,0x536b70,x,4.2,z);
    box(.38,.58,.38,0xffedc6,x,3.86,z,.05);
    box(.66,.18,.66,0x738f85,x,3.52,z);
  } else if(index%3===1) {
    const x=side*8.75,z=8,first=group.children.length;
    for(const offset of [-.7,.7])box(.13,.65,.95,0x718980,x+offset,.38,z);
    for(let i=0;i<3;i++)box(1.95,.13,.15,0xc39d77,x,.75,z-.22+i*.19);
    box(1.95,.72,.12,0xd0ad82,x,1.13,z-.43);
    faceRoad(first,x,z);
  } else {
    const x=side*8.6,z=8,first=group.children.length;
    box(1.6,.55,1,0xd0ac8b,x,.3,z);
    box(1.45,.06,.85,0x7a6c53,x,.6,z);
    for(let i=0;i<4;i++){cylinder(.035,.4,0x70996c,x-.5+i*.33,.82,z);ball(.15,[0xd99caa,0xe4bd77][i%2],x-.5+i*.33,1.05,z);}
    faceRoad(first,x,z);
  }
  const variant=index+(side===-1?3:0);
  neighborhoodBuilding(side*16.7,-5,variant);
  if(index%5!==4)neighborhoodBuilding(side*17.5,7,variant+1);
  else {box(4,1.05,5,0x90b69a,side*17,.55,7,.28);tree(side*19,8,index+1);}
  // A second row fills the gaps without placing tall objects beside the lanes.
  neighborhoodBuilding(side*26,1,variant+2,true);
  // Slight raised verge between the park path and the neighborhood.
  add(new THREE.PlaneGeometry(18,26),0xa5c296,side*23,-.09,0).rotation.x=-Math.PI/2;
  return batchTile(group);
}
