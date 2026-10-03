import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { isExercise, type ItemType } from '../learning/ItemCatalog';

/** Procedural, bounded silhouettes. Collision/jump rules remain in RunSession. */
export function createCollectibleModel(type: ItemType): THREE.Group {
  const root = new THREE.Group();
  root.name = `item-${type}`;
  const body = new THREE.Group(); root.add(body);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: number, roughness = .48, metalness = 0) => {
    const key = `${color}:${roughness}:${metalness}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({color,roughness,metalness}));
    return materials.get(key)!;
  };
  const add = (geometry: THREE.BufferGeometry, color: number, x=0, y=0, z=0, roughness=.48, metalness=0) => {
    const mesh = new THREE.Mesh(geometry, material(color,roughness,metalness));
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; body.add(mesh); return mesh;
  };
  const sphere = (r:number,color:number,x=0,y=0,z=0) => add(new THREE.SphereGeometry(r,20,14),color,x,y,z);
  const box = (w:number,h:number,d:number,color:number,x=0,y=0,z=0,r=.06) => add(new RoundedBoxGeometry(w,h,d,2,r),color,x,y,z);
  const cylinder = (top:number,bottom:number,height:number,color:number,x=0,y=0,z=0) => add(new THREE.CylinderGeometry(top,bottom,height,24),color,x,y,z);
  const leaf = (color:number,x:number,y:number,z:number,angle=0) => { const mesh=sphere(.22,color,x,y,z);mesh.scale.set(1.8,.18,.7);mesh.rotation.z=angle;return mesh; };
  const tube = (points:THREE.Vector3[],radius:number,color:number) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,radius,8,false),color);
  const cream=0xfff3d6, green=0x53a967, brown=0x885435;

  switch(type) {
    case 'APPLE': {
      const points=[[0,.1],[.35,.03],[.7,.25],[.82,.6],[.72,.98],[.45,1.18],[.17,1.1],[0,1.04]].map(([x,y])=>new THREE.Vector2(x,y));
      add(new THREE.LatheGeometry(new THREE.SplineCurve(points).getPoints(40).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y)),28),0xe8464e);
      cylinder(.045,.065,.32,brown,0,1.24).rotation.z=-.18;
      leaf(green,.27,1.32,0,.25);
      break;
    }
    case 'ORANGE': {
      sphere(.73,0xf6a132).scale.y=.91;
      cylinder(.045,.06,.2,brown,0,.67);
      leaf(green,.19,.78,0,.3);
      for(let i=0;i<18;i++){const angle=i*2.4, y=-.4+(i%6)*.15, radius=Math.sqrt(.73**2-y**2);sphere(.018,0xe18b21,Math.cos(angle)*radius,y,Math.sin(angle)*radius);}
      break;
    }
    case 'BANANA': {
      for(let i=0;i<3;i++) {
        const x=(i-1)*.25, z=(i-1)*.12;
        tube([new THREE.Vector3(x-.55,.55,z),new THREE.Vector3(x-.65,.05,z),new THREE.Vector3(x-.25,-.38,z),new THREE.Vector3(x+.3,-.32,z),new THREE.Vector3(x+.58,.1,z)],.15,0xffd452);
        sphere(.09,brown,x-.55,.55,z);sphere(.07,brown,x+.58,.1,z);
      }
      break;
    }
    case 'BROCCOLI': {
      cylinder(.15,.24,.82,0x85b95b,0,-.3);
      for(const [x,z] of [[-.34,-.15],[.34,-.15],[0,.3],[0,-.33]]){ cylinder(.09,.1,.45,0x85b95b,x*.5,.08,z*.5).rotation.z=-x; sphere(.38,green,x,.4,z); }
      sphere(.41,0x3f985b,0,.58,0);
      for(let i=0;i<9;i++)sphere(.12,0x6db56b,Math.cos(i*2.4)*.45,.6+Math.sin(i)*.12,Math.sin(i*2.4)*.36);
      break;
    }
    case 'CARROT': {
      add(new THREE.ConeGeometry(.3,1.2,20),0xf28b39,0,-.17).rotation.z=Math.PI;
      for(let i=0;i<3;i++) { const l=box(.13,.58,.09,green,(i-1)*.14,.69,0);l.rotation.z=(i-1)*.45; }
      for(let i=0;i<4;i++)box(.23-i*.04,.022,.015,0xd8712d,.02,.15-i*.2,.27-i*.05,.005);
      body.rotation.z=-.22;
      break;
    }
    case 'BURGER': {
      cylinder(.78,.8,.18,0xdf9c4f,0,.03);
      const lettuce=add(new THREE.TorusGeometry(.7,.12,8,24),green,0,.2);lettuce.rotation.x=Math.PI/2;lettuce.scale.set(1,.65,1);
      cylinder(.74,.75,.22,0x75402e,0,.31);
      const cheese=box(1.5,.07,1.5,0xffcf58,0,.47);cheese.rotation.y=.25;
      cylinder(.73,.73,.07,0xde5841,0,.55);
      const bun=add(new THREE.SphereGeometry(.84,28,16,0,Math.PI*2,0,Math.PI/2),0xeeb264,0,.6);bun.scale.y=.62;
      for(let i=0;i<14;i++){const angle=i*2.4,r=.15+.54*Math.sqrt(i/14);const seed=sphere(.043,cream,Math.cos(angle)*r,.6+Math.sqrt(.84**2-r**2)*.62,Math.sin(angle)*r);seed.scale.set(1.4,.4,.65);seed.rotation.y=angle;}
      break;
    }
    case 'PIZZA': {
      const shape=new THREE.Shape();shape.moveTo(0,-.85);shape.lineTo(-.82,.65);shape.quadraticCurveTo(0,.87,.82,.65);shape.closePath();
      const dough=add(new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,steps:1}),0xd89b50);dough.rotation.x=-Math.PI/2;
      const cheese=add(new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false}),0xffd36a,0,.18);cheese.scale.set(.91,.91,1);cheese.rotation.x=-Math.PI/2;
      tube([new THREE.Vector3(-.74,.23,-.65),new THREE.Vector3(0,.26,-.8),new THREE.Vector3(.74,.23,-.65)],.14,0xe4b06a);
      for(const [x,z] of [[-.31,-.32],[.29,-.3],[0,.16]])cylinder(.17,.17,.05,0xd45041,x,.23,z);
      leaf(green,.13,.28,-.5,.1);leaf(green,-.12,.28,.05,-.2);
      body.rotation.x=.65;
      break;
    }
    case 'DONUT': {
      const pastry=add(new THREE.TorusGeometry(.56,.23,12,28),0xd49656);pastry.rotation.x=-Math.PI/2;
      const icing=add(new THREE.TorusGeometry(.56,.18,12,28),0xea91b7,0,.14);icing.rotation.x=-Math.PI/2;
      for(let i=0;i<16;i++){const a=i*2.4,r=.5+(i%3)*.045;const sprinkle=box(.1,.025,.035,[cream,0x81c8b8,0x8e7ec9][i%3],Math.cos(a)*r,.3,Math.sin(a)*r,.008);sprinkle.rotation.y=a;}
      body.rotation.x=.7;
      break;
    }
    case 'MEAL': {
      box(1.75,.17,1.22,0xe4ded0,0,-.08,0,.12);
      box(1.61,.08,1.1,cream);
      box(.065,.08,1.05,0xc8bca8,.08,.06);box(.68,.08,.05,0xc8bca8,.45,.06,.07);
      sphere(.38,0xfffbf0,-.42,.16,0).scale.set(1,.42,1.1);
      for(let i=0;i<9;i++){const rice=sphere(.028,0xe5dacf,-.64+(i%3)*.19,.26,-.25+Math.floor(i/3)*.19);rice.scale.set(1.4,.5,.65);}
      for(let i=0;i<3;i++)box(.16,.13,.36,0xb97845,.24+i*.18,.12,-.28);
      for(let i=0;i<3;i++){sphere(.12,green,.25+i*.18,.13,.33);sphere(.07,0xf39748,.25+i*.18,.17,.23);}
      body.rotation.x=.55;
      break;
    }
    case 'WATER': {
      const profile=[[0,0],[.3,0],[.37,.08],[.37,.9],[.3,1.06],[.17,1.2],[.17,1.35],[0,1.35]].map(([x,y])=>new THREE.Vector2(x,y));
      add(new THREE.LatheGeometry(profile,24),0x80cfe0,0,0,0,.24);
      cylinder(.379,.379,.38,0xf3fcff,0,.58);
      cylinder(.383,.383,.065,0x389fae,0,.43);
      cylinder(.2,.2,.18,0x327e9d,0,1.37);
      const drop=sphere(.11,0x3e9cb8,0,.58,.388);drop.scale.set(.75,1.25,.25);
      for(let i=0;i<3;i++){const rib=add(new THREE.TorusGeometry(.37,.017,6,24),0x66bace,0,.16+i*.1);rib.rotation.x=Math.PI/2;}
      break;
    }
    case 'MILK': {
      box(.73,1.15,.61,0xfff8ea,0,.4);
      const roofShape=new THREE.Shape();roofShape.moveTo(-.36,0);roofShape.lineTo(.36,0);roofShape.lineTo(0,.34);roofShape.closePath();
      add(new THREE.ExtrudeGeometry(roofShape,{depth:.6,bevelEnabled:false}),0x89b9cf,0,.98,-.3);
      box(.11,.08,.62,0x5f99b8,0,1.34);
      box(.75,.35,.63,0x97cbd4,0,.23);
      sphere(.14,0xfff8ea,0,.43,.326).scale.z=.12;
      break;
    }
    case 'COLA': {
      cylinder(.45,.32,1.06,0xe67075,0,.48);
      cylinder(.425,.38,.32,cream,0,.55);
      cylinder(.47,.45,.09,0xfff8ef,0,1.05);
      cylinder(.044,.044,.57,0xa86672,.1,1.34).rotation.z=-.2;
      sphere(.13,0xe67075,0,.55,.405).scale.z=.1;
      break;
    }
    case 'DUMBBELL': {
      const bar=add(new THREE.CylinderGeometry(.09,.09,1.6,12),0xb6c5ce,0,0,0,.35,.55);bar.rotation.z=Math.PI/2;
      for(const x of [-.65,.65]){const plate=cylinder(.36,.36,.27,0x766ba7,x);plate.rotation.z=Math.PI/2;const end=cylinder(.2,.2,.035,0xa197cb,x+Math.sign(x)*.16);end.rotation.z=Math.PI/2;}
      for(let i=0;i<4;i++){const grip=add(new THREE.TorusGeometry(.097,.015,6,12),0x465968,-.18+i*.12);grip.rotation.y=Math.PI/2;}
      break;
    }
    case 'SHOES': {
      for(const x of [-.32,.32]){
        box(.48,.13,1.13,cream,x,-.2,0,.06);
        box(.44,.27,1.04,0x5bb9ba,x,0,0,.1);
        box(.42,.37,.46,0x428f9f,x,.2,-.28,.1);
        for(let i=0;i<3;i++)box(.3,.035,.055,cream,x,.16,-.03+i*.13,.012);
        box(.44,.08,.09,0x315f80,x,-.1,.51,.025);
      }
      body.rotation.x=.35;
      break;
    }
    case 'ROPE': {
      tube([new THREE.Vector3(-.5,.35,0),new THREE.Vector3(-.75,0,0),new THREE.Vector3(-.5,-.55,0),new THREE.Vector3(0,-.65,0),new THREE.Vector3(.5,-.55,0),new THREE.Vector3(.75,0,0),new THREE.Vector3(.5,.35,0)],.045,0x53abb7);
      for(const x of [-.5,.5]){const handle=box(.16,.51,.17,0xeeb366,x,.6,0);handle.rotation.z=-x*.4;cylinder(.11,.11,.09,0x79659b,x,.35);}
      break;
    }
  }
  // Place every model on a common floor and keep ground silhouettes jumpable.
  body.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(body), size=bounds.getSize(new THREE.Vector3());
  const scale=Math.min(2 / Math.max(size.x,size.z), (isExercise(type)?1.65:1.85) / size.y);
  body.scale.setScalar(scale); body.position.y=.12-bounds.min.y*scale;
  root.userData.itemType=type;
  return root;
}
