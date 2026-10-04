import { formatGameKcal } from '../learning/ExerciseEnergy';
import { formatKcal } from '../../features/health/energy';
import { pickupFeedback } from '../learning/PickupFeedback';
import { ITEM_CATALOG, isExercise, type ItemType as LearningItemType } from '../learning/ItemCatalog';
import { jumpHeight } from '../learning/JumpArc';
import { visibleGateDistance } from '../learning/CoursePresentation';
import { createCollectibleModel } from './CollectibleModels';
import { createParkHorizon, createParkBlock } from './ParkWorld';
import * as THREE from 'three';
import { runnerPose } from './RunnerPose';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BodyStatus, BreakfastOption, ItemType, ActiveCombo, DecisionDoor } from '../types';
import { soundSynth } from '../audio/SoundSynth';
import type { SceneItem, Snapshot } from '../learning/types';
import { COURSE_SPEED } from '../learning/RunSession';

export type GraphicsQuality = 'low' | 'medium' | 'high';

interface BurstEffect {
  mesh: THREE.Group;
  particles: THREE.Points;
  ring: THREE.Mesh;
  label?: THREE.Sprite;
  followPlayerOffset?: THREE.Vector3;
  age: number;
  lifetime: number;
  velocities: THREE.Vector3[];
}

export interface Entity3D {
  mesh: THREE.Group;
  type: string;
  lane: number;
  z: number;
  altitude: number;
  doorInfo?: DecisionDoor;
  itemMesh?: THREE.Object3D;
  floatBaseY?: number;
  floatPhase?: number;
}

export class GameEngine3D {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private timer: THREE.Timer;
  private container: HTMLDivElement;

  public laneX: number[] = [-3.6, 0, 3.6];
  public currentLane: number = 1;
  public targetX: number = 0;

  // Jump & Animation Physics
  public isJumping: boolean = false;
  private jumpVelocity: number = 0;
  private playerY: number = 0;
  public playerMesh!: THREE.Group;
  private playerHeadband!: THREE.Mesh;
  private playerTorso!: THREE.Mesh;
  private playerBackpack!: THREE.Mesh;
  private playerShadow!: THREE.Mesh;
  private landingSquash = 0;
  private readonly burstEffects: BurstEffect[] = [];
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private leftArm!: THREE.Group;
  private rightArm!: THREE.Group;
  private runAnimTimer: number = 0;

  // Lives & Health Challenge System
  public lives: number = 3;
  public isStumbling: boolean = false;
  private stumbleTimer: number = 0;
  public isGameOver: boolean = false;
  public gameOverReason: string = '';

  // Current Breakfast Perk
  public selectedBreakfast: BreakfastOption = 'OATMEAL';

  // Stats & Movement
  public status: BodyStatus = { energy: 70, sugar: 20, stamina: 85, mood: 70 };
  public distance: number = 0;
  public score: number = 0;
  public initialSpeed: number = 14.0;
  public currentSpeed: number = 14.0;
  public speedMultiplier: number = 1.0;
  public isSugarOverloaded: boolean = false;
  public isRunning: boolean = false;
  private paused: boolean = false;
  private manualInputEnabled: boolean = true;
  private colaBoostRemaining: number = 0;
  private cameraShakeRemaining: number = 0;
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  public get isPaused(): boolean {
    return this.paused;
  }

  // Speed level announcements
  public speedLevel: number = 1;
  public speedUpAlert: string | null = null;
  private alertTimer: number = 0;

  // Gate Entry Flash Feedback
  public enteredGatePopup: DecisionDoor | null = null;
  private gatePopupTimer: number = 0;

  // Combos & Environment
  public comboHistory: string[] = [];
  public activeCombo: ActiveCombo = { type: 'NONE', count: 0, multiplier: 1, timer: 0 };
  public isSugarCity: boolean = false;

  // 3D Entity Pool & Scenery
  public entities: Entity3D[] = [];
  private sceneryProps: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private mountainMesh!: THREE.Group;
  private particlesMesh!: THREE.Points;
  private particlePositions!: Float32Array;
  private spawnTimer: number = 0;
  private learningEntities = new Map<string, Entity3D>();
  private learningPrepared = false;
  private nextGateDistance: number = 1000;

  private roadMesh!: THREE.Mesh;
  private roadTexture!: THREE.CanvasTexture;

  private gateTextureCache: Map<string, THREE.CanvasTexture> = new Map();
  private readonly gatePortals: THREE.Mesh[] = [];
  private sunLight!: THREE.DirectionalLight;
  private hemisphereLight!: THREE.HemisphereLight;
  public biome = 'CANDY TOWN';
  public biomeIndex = 0;
  public graphicsQuality: GraphicsQuality = 'medium';
  public feedbackEvent: { id: number; title: string; subtitle: string; kind: 'collect' | 'land' | 'crash' } | null = null;
  private feedbackSequence = 0;
  private lastFeedbackAt = 0;
  private biomeTarget = 0;
  private biomeTransition = 1;
  private biomeFrom = {
    sky: new THREE.Color(0xf6c9d5), fog: new THREE.Color(0xd9d4eb), road: new THREE.Color(0xffffff),
    sun: new THREE.Color(0xffe2bd), hemiSky: new THREE.Color(0x9fd7fa), hemiGround: new THREE.Color(0x66516e)
  };
  private readonly biomePalettes = [
    { name: 'CANDY TOWN', sky: 0xf6c9d5, fog: 0xd9d4eb, road: 0xffffff, sun: 0xffe2bd, hemiSky: 0x9fd7fa, hemiGround: 0x66516e, scenery: 0xffffff },
    { name: 'FRUIT GARDEN', sky: 0xb6e6d4, fog: 0xd3ede1, road: 0xc4eddb, sun: 0xffefc1, hemiSky: 0x9be8dc, hemiGround: 0x527c68, scenery: 0xd4ffe8 },
    { name: 'NIGHT ARCADE', sky: 0x292b53, fog: 0x3d3d67, road: 0xaab4e8, sun: 0xd0c1ff, hemiSky: 0x7f9de9, hemiGround: 0x342c57, scenery: 0xb5c9ff }
  ];

  // Touch Tracking
  private touchStartX: number = 0;
  private touchStartY: number = 0;

  constructor(container: HTMLDivElement) {
    this.container = container;
    container.innerHTML = '';

    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.scene = new THREE.Scene();

    // Calm park colors keep the food silhouettes and gates prominent.
    this.scene.background = new THREE.Color(0xc7e3ed);
    this.scene.fog = new THREE.FogExp2(0xd2e5df, 0.0032);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 3.8, 7.2);
    this.camera.lookAt(0, 1.4, -16);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      powerPreference: 'high-performance' 
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.domElement.style.width = '100vw';
    this.renderer.domElement.style.height = '100vh';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';

    container.appendChild(this.renderer.domElement);

    // Warm Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0xdbe7ff, 0.72);
    this.scene.add(ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffe2bd, 2.25);
    this.sunLight.position.set(-18, 30, 15);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.bias = -0.0005;
    Object.assign(this.sunLight.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
    this.sunLight.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sunLight);

    this.hemisphereLight = new THREE.HemisphereLight(0xc8e7f4, 0x96a482, 0.72);
    this.scene.add(this.hemisphereLight);

    // Build World Elements
    this.buildParkSkyAndHorizon();
    this.build3DRoad();
    this.build3DScenery();
    this.buildSpeedParticles();
    this.build3DPlayer();

    this.spawnInitialTrack();

    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.handleKeyDown);
    container.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    container.addEventListener('touchend', this.handleTouchEnd, { passive: true });

    this.renderer.render(this.scene, this.camera);
    this.resizeTimeout = setTimeout(() => {
      this.resizeTimeout = null;
      this.onWindowResize();
    }, 100);
  }

  // --- 1. PARK HORIZON & CLOUDS ---
  private buildParkSkyAndHorizon() {
    this.mountainMesh = new THREE.Group();

    this.mountainMesh = createParkHorizon();
    this.scene.add(this.mountainMesh);

    // Floating Marshmallow Clouds
    for (let i = 0; i < 8; i++) {
      const cloud = this.createMarshmallowCloud();
      cloud.position.set(-60 + Math.random() * 120, 24 + Math.random() * 14, -80 - i * 35);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private createMarshmallowCloud(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      roughness: 0.9,
      emissive: 0xfff0f5,
      emissiveIntensity: 0.25
    });

    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2, 12, 12), mat);
      puff.position.set((i - 2) * 3.5, Math.sin(i) * 1.5, 0);
      group.add(puff);
    }
    return group;
  }

  // --- 2. PARK ROAD WITH CURBS & LANE MARKINGS ---
  private build3DRoad() {
    const roadWidth = 12.5;
    const roadLength = 320;
    const geometry = new THREE.PlaneGeometry(roadWidth, roadLength, 1, 120);
    
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Cool matte asphalt provides contrast against the warm food colors.
    ctx.fillStyle = '#668488';
    ctx.fillRect(0, 0, 512, 512);

    const roadGradient = ctx.createLinearGradient(20, 0, 492, 0);
    roadGradient.addColorStop(0, '#456770');
    roadGradient.addColorStop(0.5, '#527b80');
    roadGradient.addColorStop(1, '#456770');
    ctx.fillStyle = roadGradient;
    ctx.fillRect(20, 0, 472, 512);

    // Fine asphalt aggregate adds texture without visual noise.
    for (let i = 0; i < 720; i++) {
      const x = 26 + Math.random() * 460;
      const y = Math.random() * 512;
      const size = Math.random() * 1.4 + 0.35;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.055)' : 'rgba(24,17,43,.07)';
      ctx.fillRect(x, y, size, size);
    }

    // Checkered Curbs on Left & Right
    const checkSize = 32;
    for (let y = 0; y < 512; y += checkSize) {
      ctx.fillStyle = (y / checkSize) % 2 === 0 ? '#c3c8b5' : '#fff2db';
      ctx.fillRect(0, y, 20, checkSize);
      ctx.fillRect(492, y, 20, checkSize);
    }

    // Double lane markings with a soft warm center stripe.
    ctx.strokeStyle = 'rgba(255,247,224,.8)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(170, 0); ctx.lineTo(170, 512);
    ctx.moveTo(342, 0); ctx.lineTo(342, 512);
    ctx.stroke();

    ctx.strokeStyle = '#c6e0d7';
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 30]);
    ctx.beginPath();
    ctx.moveTo(170, 0); ctx.lineTo(170, 512);
    ctx.moveTo(342, 0); ctx.lineTo(342, 512);
    ctx.stroke();

    this.roadTexture = new THREE.CanvasTexture(canvas);
    this.roadTexture.wrapS = THREE.RepeatWrapping;
    this.roadTexture.wrapT = THREE.RepeatWrapping;
    this.roadTexture.repeat.set(1, 32);

    const material = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.72,
      metalness: 0.02
    });

    this.roadMesh = new THREE.Mesh(geometry, material);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.position.set(0, 0, -120);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);

    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(700, 800), new THREE.MeshStandardMaterial({ color: 0xb1cda0, roughness: 1 }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(0,-.19,-220); lawn.receiveShadow = true; this.scene.add(lawn);

    // Left and Right 3D Curbs Bars
    const curbGeo = new THREE.BoxGeometry(0.6, 0.4, 320);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x9db3ac, roughness: 0.82 });
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-6.5, 0.2, -120);
    this.scene.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(6.5, 0.2, -120);
    this.scene.add(rightCurb);
  }

  // --- 3. PARK TOWN SCENERY ---
  private build3DScenery() {
    for (let index=0;index<10;index++) for (const side of [-1,1] as const) {
      const prop=createParkBlock(index,side);
      prop.position.z=-240+index*26;
      prop.userData.baseY=0;prop.userData.phase=0;prop.userData.baseRotation=0;
      this.scene.add(prop);this.sceneryProps.push(prop);
    }
  }

  private buildSpeedParticles() {
    const particleCount = 96;
    const geometry = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      this.particlePositions[i * 3] = (Math.random() - 0.5) * 20;
      this.particlePositions[i * 3 + 1] = Math.random() * 8 + 0.5;
      this.particlePositions[i * 3 + 2] = -Math.random() * 160;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 32;
    glowCanvas.height = 32;
    const glowContext = glowCanvas.getContext('2d')!;
    const glow = glowContext.createRadialGradient(16, 16, 1, 16, 16, 16);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.25, 'rgba(255,245,194,.95)');
    glow.addColorStop(1, 'rgba(255,210,100,0)');
    glowContext.fillStyle = glow;
    glowContext.fillRect(0, 0, 32, 32);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.PointsMaterial({
      color: 0xfde7a2,
      map: glowTexture,
      alphaTest: 0.025,
      size: 0.3,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.particlesMesh = new THREE.Points(geometry, material);
    this.scene.add(this.particlesMesh);
  }

  // --- 5. DETAILED POLISHED 3D PLAYER MODEL ---
  private build3DPlayer() {
    this.playerMesh = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xf6c7a3, roughness: .62 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xfff5dd, roughness: .65 });
    const navy = new THREE.MeshStandardMaterial({ color: 0x35365c, roughness: .75 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x38283f, roughness: .7 });
    const coral = new THREE.MeshStandardMaterial({ color: 0xf57987, roughness: .48 });
    const ball = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; parent.add(mesh); return mesh;
    };
    // Sculpted pear-shaped sports jersey, with a continuous curved silhouette.
    const profile = [[.25,0],[.41,.06],[.49,.24],[.48,.46],[.44,.68],[.48,.86],[.4,1.02],[.23,1.08]].map(([x,y]) => new THREE.Vector2(x,y));
    this.playerTorso = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), new THREE.MeshStandardMaterial({ color: 0x32bfa7, roughness: .65 }));
    this.playerTorso.position.y = 1.02; this.playerTorso.scale.z = .8;
    this.playerMesh.add(this.playerTorso);
    // Small rounded day pack follows the jersey deformation as a child.
    this.playerBackpack = ball(this.playerTorso, coral, 0,.58,.47,.3,.36,.19);
    ball(this.playerBackpack, cream, 0,-.22,.88,.59,.27,.18);
    ball(this.playerBackpack, navy, 0,.03,1,.16,.16,.08);
    ball(this.playerTorso, navy, 0,.02,0,.42,.21,.45);
    ball(this.playerMesh, skin, 0,2.12,0,.18,.22,.18);
    const head = new THREE.Group(); head.position.set(0,2.57,0); this.playerMesh.add(head);
    ball(head, skin, 0,0,-.03,.52,.57,.47);
    ball(head, skin, -.49,-.02,0,.12,.17,.1); ball(head, skin,.49,-.02,0,.12,.17,.1);
    // Rounded overlapping locks replace pointed spikes and a cylindrical head.
    ball(head, hair, 0,.2,.08,.55,.44,.48);
    for (const [x,y,z,rx] of [[-.35,.32,-.27,-.5],[-.13,.46,-.32,-.25],[.14,.43,-.34,.2],[.36,.25,-.23,.55]]) {
      const lock = ball(head,hair,x,y,z,.23,.29,.2); lock.rotation.z = rx;
    }
    for (const x of [-.19,.19]) {
      ball(head,cream,x,-.03,-.44,.1,.12,.035);
      ball(head,navy,x,-.035,-.474,.047,.067,.018);
      ball(head,cream,x-.012,-.01,-.489,.014,.02,.008);
      ball(head,coral,x*1.5,-.18,-.405,.085,.045,.015);
    }
    ball(head,skin,0,-.12,-.48,.07,.085,.07);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(.1,.012,8,24,Math.PI), navy);
    smile.rotation.z = Math.PI; smile.position.set(0,-.23,-.455); head.add(smile);
    this.playerHeadband = new THREE.Mesh(new THREE.TorusGeometry(.54,.025,8,32,Math.PI), cream);
    this.playerHeadband.rotation.x = -Math.PI/2; this.playerHeadband.position.y = .12; head.add(this.playerHeadband);
    const capsule = (parent: THREE.Object3D, mat: THREE.Material, radius: number, length: number, y: number) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,6,16),mat);
      mesh.position.y = y; mesh.castShadow = true; parent.add(mesh); return mesh;
    };
    const arm = (side: number) => {
      const group = new THREE.Group(); group.position.set(side*.55,1.94,0); group.rotation.z = side*.12;
      capsule(group,cream,.17,.23,-.14);
      const forearm = new THREE.Group(); forearm.position.y = -.37; forearm.rotation.x = .95;
      capsule(forearm,skin,.115,.23,-.15); ball(forearm,skin,0,-.36,0,.14,.16,.13);
      group.add(forearm); this.playerMesh.add(group); return group;
    };
    this.leftArm = arm(-1); this.rightArm = arm(1);
    const leg = (side: number) => {
      const group = new THREE.Group(); group.position.set(side*.25,1.04,0);
      capsule(group,navy,.19,.28,-.19);
      const knee = new THREE.Group(); knee.position.y = -.43;
      capsule(knee,skin,.13,.26,-.19); capsule(knee,cream,.14,.12,-.38);
      ball(knee,coral,0,-.55,-.12,.21,.15,.35);
      ball(knee,cream,0,-.64,-.13,.22,.055,.36);
      ball(knee,cream,0,-.53,-.33,.12,.035,.085);
      group.add(knee); group.userData.knee = knee; this.playerMesh.add(group); return group;
    };
    this.leftLeg = leg(-1); this.rightLeg = leg(1);
    // A single contact shadow avoids duplicated directional silhouettes and self-shadow artifacts.
    this.playerMesh.traverse(obj => { if (obj instanceof THREE.Mesh) obj.castShadow = false; });
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 64;
    const context = shadowCanvas.getContext('2d')!;
    const fade = context.createRadialGradient(32,32,3,32,32,32);
    fade.addColorStop(0,'rgba(51,38,66,.28)');
    fade.addColorStop(.45,'rgba(51,38,66,.16)');
    fade.addColorStop(1,'rgba(51,38,66,0)');
    context.fillStyle = fade; context.fillRect(0,0,64,64);
    this.playerShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.25),new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false }));
    this.playerShadow.rotation.x = -Math.PI/2; this.playerShadow.position.set(0,.035,0);
    this.scene.add(this.playerShadow); this.scene.add(this.playerMesh);
  }

  public previewBreakfast(breakfast: BreakfastOption) {
    this.selectedBreakfast = breakfast;
    if (breakfast === 'DONUT') {
      this.status = { energy: 75, sugar: 45, stamina: 60, mood: 65 };
      if (this.playerHeadband) (this.playerHeadband.material as THREE.MeshStandardMaterial).color.setHex(0xec4899);
      if (this.playerTorso) (this.playerTorso.material as THREE.MeshStandardMaterial).color.setHex(0xdb2777);
      if (this.playerBackpack) (this.playerBackpack.material as THREE.MeshStandardMaterial).color.setHex(0xfb7185);
    } else if (breakfast === 'OATMEAL') {
      this.status = { energy: 70, sugar: 15, stamina: 90, mood: 75 };
      if (this.playerHeadband) (this.playerHeadband.material as THREE.MeshStandardMaterial).color.setHex(0x0ea5e9);
      if (this.playerTorso) (this.playerTorso.material as THREE.MeshStandardMaterial).color.setHex(0x0284c7);
      if (this.playerBackpack) (this.playerBackpack.material as THREE.MeshStandardMaterial).color.setHex(0x38bdf8);
    } else if (breakfast === 'EGG') {
      this.status = { energy: 95, sugar: 20, stamina: 85, mood: 65 };
      if (this.playerHeadband) (this.playerHeadband.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b);
      if (this.playerTorso) (this.playerTorso.material as THREE.MeshStandardMaterial).color.setHex(0xd97706);
      if (this.playerBackpack) (this.playerBackpack.material as THREE.MeshStandardMaterial).color.setHex(0xfacc15);
    }
  }

  public resetToMenu() {
    this.isRunning = false;
    this.paused = false;
    this.manualInputEnabled = true;
    this.isGameOver = false;
    this.gameOverReason = '';
    this.distance = 0;
    this.score = 0;
    this.currentLane = 1;
    this.targetX = 0;
    this.lives = 3;
    this.enteredGatePopup = null;
    this.gatePopupTimer = 0;
    this.speedUpAlert = null;
    this.alertTimer = 0;
    this.speedLevel = 1;
    this.initialSpeed = 14.0;
    this.currentSpeed = 14.0;
    this.isStumbling = false;
    this.stumbleTimer = 0;
    this.isSugarOverloaded = false;
    this.colaBoostRemaining = 0;
    this.speedMultiplier = 1.0;
    this.cameraShakeRemaining = 0;
    this.camera.position.x = 0;
    this.camera.position.y = 3.8;
    this.playerMesh.position.set(0, 0, 0);
    this.playerMesh.rotation.set(0, 0, 0);
    this.playerMesh.scale.set(1, 1, 1);
    this.playerShadow.position.x = 0;
    this.playerShadow.scale.setScalar(1);
    (this.playerShadow.material as THREE.MeshBasicMaterial).opacity = 0.34;
    this.landingSquash = 0;
    this.playerY = 0;
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.runAnimTimer = 0;
    this.comboHistory = [];
    this.activeCombo = { type: 'NONE', count: 0, multiplier: 1, timer: 0 };
    this.nextGateDistance = 1000;
    this.spawnTimer = 0;
    this.previewBreakfast(this.selectedBreakfast);
    this.entities.forEach(e => this.scene.remove(e.mesh));
    this.entities = [];
    this.gatePortals.length = 0;
    this.burstEffects.splice(0).forEach(effect => this.disposeBurst(effect));
    this.setBiome(0);
    this.spawnInitialTrack();
    try {
      soundSynth.stopMusic();
    } catch (e) {}
  }

  public initBreakfast(breakfast: BreakfastOption) {
    this.paused = false;
    this.distance = 0;
    this.score = 0;
    this.currentLane = 1;
    this.targetX = 0;
    this.lives = 3;
    this.isGameOver = false;
    this.gameOverReason = '';
    this.isStumbling = false;
    this.stumbleTimer = 0;
    this.speedLevel = 1;
    this.speedUpAlert = null;
    this.alertTimer = 0;
    this.enteredGatePopup = null;
    this.gatePopupTimer = 0;
    this.initialSpeed = 14.0;
    this.currentSpeed = 14.0;
    this.isSugarOverloaded = false;
    this.colaBoostRemaining = 0;
    this.cameraShakeRemaining = 0;
    this.camera.position.x = 0;
    this.camera.position.y = 3.8;
    this.playerY = 0;
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.runAnimTimer = 0;
    this.playerMesh.position.set(0, 0, 0);
    this.playerMesh.rotation.set(0, 0, 0);
    this.playerMesh.scale.set(1, 1, 1);
    this.playerShadow.position.x = 0;
    this.playerShadow.scale.setScalar(1);
    (this.playerShadow.material as THREE.MeshBasicMaterial).opacity = 0.34;
    this.landingSquash = 0;
    this.comboHistory = [];
    this.activeCombo = { type: 'NONE', count: 0, multiplier: 1, timer: 0 };
    this.nextGateDistance = 1000;
    this.spawnTimer = 0;
    this.isRunning = true;

    this.previewBreakfast(breakfast);

    if (breakfast === 'DONUT') {
      this.speedMultiplier = 1.10;
    } else if (breakfast === 'OATMEAL') {
      this.speedMultiplier = 1.0;
    } else if (breakfast === 'EGG') {
      this.speedMultiplier = 1.0;
    }

    this.entities.forEach(e => this.scene.remove(e.mesh));
    this.entities = [];
    this.gatePortals.length = 0;
    this.burstEffects.splice(0).forEach(effect => this.disposeBurst(effect));
    this.spawnInitialTrack();

    try {
      soundSynth.startMusic('RUNNER');
    } catch (err) {}
  }

  private spawnInitialTrack() {
    this.spawn3DEntity('BURGER', 0, -28, 0);
    this.spawn3DEntity('OBSTACLE_LOW', 1, -55, 0);
    this.spawn3DEntity('STAR_HIGH', 2, -82, 1);
    this.spawn3DEntity('WATER', 1, -110, 0);
    this.spawn3DEntity('APPLE', 0, -138, 0);
  }

  private getGateBannerTexture(door: DecisionDoor): THREE.CanvasTexture {
    const key = `${door.type}_${door.id}_${door.title}_${door.statsEffect}`;
    if (this.gateTextureCache.has(key)) return this.gateTextureCache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    if (door.statsEffect === 'FINISH') {
      grad.addColorStop(0, '#d9982c');
      grad.addColorStop(1, '#9c5920');
    } else if (door.type === 'FAST_FOOD') {
      grad.addColorStop(0, '#ea580c');
      grad.addColorStop(1, '#9a3412');
    } else if (door.type === 'HEALTHY') {
      grad.addColorStop(0, '#16a34a');
      grad.addColorStop(1, '#14532d');
    } else {
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(1, '#0369a1');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(12, 12, 488, 232, 32);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    if (door.id.startsWith('quiz-')) {
      ctx.font = '700 36px "Chakra Petch", sans-serif';
      const lines: string[] = [];
      let line = '';
      for (const char of door.title) {
        if (ctx.measureText(line + char).width > 420) { lines.push(line); line = char; }
        else line += char;
      }
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((text, i) => ctx.fillText(text, 256, 65 + i * 42));
    } else {
      const icon = door.type === 'FAST_FOOD' ? '🍔 ' : door.type === 'HEALTHY' ? '🥗 ' : '✨ ';
      ctx.fillText(icon + door.title, 256, 95);
    }

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 32px "Chakra Petch", sans-serif';
    ctx.fillText(door.statsEffect, 256, door.id.startsWith('quiz-') ? 213 : 175);

    const tex = new THREE.CanvasTexture(canvas);
    this.gateTextureCache.set(key, tex);
    return tex;
  }

  public spawn3DEntity(type: string, lane: number, z: number, altitude: number = 0, doorInfo?: DecisionDoor) {
    const group = new THREE.Group();
    let itemMesh: THREE.Object3D | undefined;

    // Quiet footprint ring separates a collectible from the road.
    const catalog = ITEM_CATALOG[type as LearningItemType];
    const ringColor = catalog ? isExercise(type as LearningItemType) ? 0xd4b867 : catalog.category === 'occasional' ? 0xd99b83 : 0x80b9a5 : type === 'OBSTACLE_LOW' ? 0xef4444 : 0x8dbac4;
    const ringGeo = new THREE.RingGeometry(.92, 1.02, 24);
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: ringColor, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.5
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    if (type === 'OBSTACLE_LOW') {
      itemMesh = this.createDetailedHurdle();
      group.add(itemMesh);
    } else if (type === 'STAR_HIGH') {
      itemMesh = this.createDetailedStar();
      itemMesh.position.y = 4.6;
      group.add(itemMesh);

      const lightBeamGeo = new THREE.CylinderGeometry(0.1, 0.1, 4.6, 16);
      const lightBeamMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.5 });
      const lightBeam = new THREE.Mesh(lightBeamGeo, lightBeamMat);
      lightBeam.position.y = 2.3;
      group.add(lightBeam);

    } else if (type.startsWith('DOOR_') || doorInfo) {
      itemMesh = this.createDetailedGate(doorInfo!);
      group.add(itemMesh);
    } else if (type in ITEM_CATALOG) {
      const catalogType=type as LearningItemType;
      itemMesh=createCollectibleModel(catalogType);
      itemMesh.position.y=isExercise(catalogType) ? 3.6 : 0;
      group.add(itemMesh);
      const contact=new THREE.Mesh(new THREE.CircleGeometry(.85,24),new THREE.MeshBasicMaterial({color:0x3d5350,transparent:true,opacity:.14,depthWrite:false}));
      contact.rotation.x=-Math.PI/2;contact.position.y=.025;group.add(contact);
    }

    group.position.set(this.laneX[lane], 0, z);
    this.scene.add(group);

    const floatBaseY = itemMesh?.position.y ?? 0;
    const floatPhase = (Math.abs(z) + lane * 19) * 0.08;
    this.entities.push({ mesh: group, type, lane, z, altitude, doorInfo, itemMesh, floatBaseY, floatPhase });
  }

  public learningPickup(type: LearningItemType, reducedMotion: boolean, deltaKcal: number | null) {
    const feedback=pickupFeedback(type);
    const position=new THREE.Vector3(this.playerMesh.position.x,1.5+this.playerMesh.position.y,0);
    // The amount is anchored to the collection ring, facing the camera.
    const burst = this.createBurstEffect(position,feedback.color,reducedMotion ? 0 : feedback.particles,1.35,true,feedback.kind==='caution',reducedMotion);
    burst.followPlayerOffset=position.clone().sub(this.playerMesh.position);
    {
      const canvas = document.createElement('canvas'); canvas.width=512; canvas.height=128;
      const ctx=canvas.getContext('2d');
      if (ctx) {
        ctx.font='900 64px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.lineJoin='round';ctx.lineWidth=12;ctx.strokeStyle='#39304f';
        const text=deltaKcal===null?'เก็บแล้ว':`${deltaKcal > 0 ? '+' : ''}${isExercise(type)?formatGameKcal(deltaKcal):formatKcal(deltaKcal)} kcal`;
        ctx.strokeText(text,256,64);ctx.fillStyle='#fff9d9';ctx.fillText(text,256,64);
        const texture=new THREE.CanvasTexture(canvas);
        const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
        label.position.y=.65;label.scale.set(2.85,.7125,1);label.renderOrder=20;
        burst.mesh.add(label);burst.label=label;
      }
    }
    if(feedback.kind==='exercise') {
      const exercise=this.createBurstEffect(new THREE.Vector3(this.playerMesh.position.x,.2,0),0xffdc65,reducedMotion?0:14,.9,true,false,reducedMotion);
      exercise.followPlayerOffset=new THREE.Vector3(0,.2,0).sub(new THREE.Vector3(0,this.playerMesh.position.y,0));
    }
  }

  public learningEffect(correct: boolean, reducedMotion: boolean) {
    if (!reducedMotion) this.createBurstEffect(new THREE.Vector3(this.playerMesh.position.x,1.2,0),correct?0x62edbf:0xffa66b,correct?24:12);
  }

  // --- 6. GATES & CLASSIC OBSTACLE MODELS ---
  private createDetailedHurdle(): THREE.Group {
    const group = new THREE.Group();
    group.scale.set(1.15, 1.15, 1.15);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x26324b, roughness: 0.38, metalness: 0.15 });
    const footGeo = new RoundedBoxGeometry(0.82, 0.16, 0.78, 3, 0.07);
    const postGeo = new RoundedBoxGeometry(0.25, 1.0, 0.3, 3, 0.08);
    const postMat = new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, roughness: 0.28, clearcoat: 0.6 });
    for (const x of [-1.3, 1.3]) {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(x, 0.08, 0);
      foot.castShadow = true;
      group.add(foot);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 0.53, 0);
      post.castShadow = true;
      group.add(post);
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.65, roughness: 0.24 }));
      bolt.position.set(x, 0.53, 0.16);
      group.add(bolt);
    }

    const barGeo = new RoundedBoxGeometry(3.15, 0.54, 0.5, 4, 0.13);
    const bar = new THREE.Mesh(barGeo, new THREE.MeshPhysicalMaterial({ color: 0xfff4dc, roughness: 0.27, clearcoat: 0.65 }));
    bar.position.y = 0.88;
    bar.castShadow = true;
    group.add(bar);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf04b61, roughness: 0.3, metalness: 0.06 });
    for (let x = -1.18; x <= 1.2; x += 0.6) {
      const stripe = new THREE.Mesh(new RoundedBoxGeometry(0.27, 0.57, 0.05, 3, 0.022), stripeMat);
      stripe.position.set(x, 0.88, 0.275);
      stripe.rotation.z = -0.22;
      group.add(stripe);
    }
    const endCapGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.56, 20);
    for (const x of [-1.57, 1.57]) {
      const cap = new THREE.Mesh(endCapGeo, new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.24, metalness: 0.25 }));
      cap.rotation.z = Math.PI / 2;
      cap.position.set(x, 0.88, 0);
      group.add(cap);
    }
    return group;
  }

  private createDetailedStar(): THREE.Group {
    const group = new THREE.Group();
    group.scale.set(1.34, 1.34, 1.34);
    const shape = new THREE.Shape();
    const outer = 1.08;
    const inner = 0.49;
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? outer : inner;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.075, bevelThickness: 0.08, curveSegments: 4 });
    const star = new THREE.Mesh(
      starGeo,
      new THREE.MeshPhysicalMaterial({ color: 0xffca3a, metalness: 0.38, roughness: 0.19, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0xf6a91a, emissiveIntensity: 0.14 })
    );
    star.castShadow = true;
    group.add(star);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.045, 10, 48), new THREE.MeshBasicMaterial({ color: 0xfff0a6, transparent: true, opacity: 0.8 }));
    group.add(rim);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(-0.32, 0.39, 0.42);
    group.add(glint);
    return group;
  }

  private createDetailedGate(door: DecisionDoor): THREE.Group {
    const group = new THREE.Group();
    const pillarColor = door.type === 'FAST_FOOD' ? 0xf97316 : door.type === 'HEALTHY' ? 0x22c55e : 0x0284c7;
    const pillarMat = new THREE.MeshPhysicalMaterial({ color: pillarColor, roughness: 0.27, metalness: 0.12, clearcoat: 0.82, clearcoatRoughness: 0.14, emissive: pillarColor, emissiveIntensity: 0.12 });
    const pillarGeo = new RoundedBoxGeometry(0.55, 5.9, 0.68, 5, 0.16);
    for (const x of [-1.62, 1.62]) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 2.95, 0);
      pillar.castShadow = true;
      group.add(pillar);

      const inset = new THREE.Mesh(new RoundedBoxGeometry(0.11, 4.85, 0.045, 3, 0.018), new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.3, emissive: 0xfff7ed, emissiveIntensity: 0.1 }));
      inset.position.set(x, 2.9, 0.365);
      group.add(inset);

      const base = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.3, 1.02, 4, 0.11), new THREE.MeshStandardMaterial({ color: 0x25243c, roughness: 0.38, metalness: 0.18 }));
      base.position.set(x, 0.16, 0);
      base.castShadow = true;
      group.add(base);
    }

    const crossbar = new THREE.Mesh(new RoundedBoxGeometry(3.72, 0.52, 0.78, 5, 0.16), new THREE.MeshPhysicalMaterial({ color: 0xfff7ed, roughness: 0.25, clearcoat: 0.8 }));
    crossbar.position.y = 5.75;
    crossbar.castShadow = true;
    group.add(crossbar);
    const portal = new THREE.Mesh(new THREE.TorusGeometry(1.23, 0.085, 12, 48), new THREE.MeshBasicMaterial({ color: pillarColor, transparent: true, opacity: 0.72 }));
    portal.position.set(0, 2.95, -0.18);
    portal.scale.y = 1.8;
    portal.userData.baseOpacity = 0.7;
    this.gatePortals.push(portal);
    group.add(portal);

    const bannerTex = this.getGateBannerTexture(door);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.48),
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.28, side: THREE.DoubleSide, metalness: 0.04 })
    );
    banner.position.set(0, 4.8, 0.42);
    banner.castShadow = true;
    group.add(banner);
    return group;
  }

  public moveLane(dir: number) {
    if (!Number.isInteger(dir)) return;
    this.selectLane(THREE.MathUtils.clamp(this.currentLane + dir, 0, 2));
  }

  public selectLane(lane: number) {
    if (!this.isRunning || this.isGameOver || this.paused) return;
    if (!Number.isInteger(lane) || lane < 0 || lane >= this.laneX.length || lane === this.currentLane) return;
    this.currentLane = lane;
    this.targetX = this.laneX[lane];
    try {
      soundSynth.playJump();
    } catch (e) {}
  }

  public jump() {
    if (!this.isRunning || this.isGameOver || this.paused) return;
    if (!this.isJumping) {
      this.isJumping = true;
      this.jumpVelocity = 14.5;
      try {
        soundSynth.playJump();
      } catch (e) {}
    }
  }

  public pause() {
    if (!this.isRunning || this.isGameOver || this.paused) return;
    this.paused = true;
    try { soundSynth.stopMusic(); } catch (e) {}
  }

  public resume() {
    if (!this.isRunning || this.isGameOver || !this.paused) return;
    this.timer.reset();
    this.paused = false;
    try { soundSynth.startMusic('RUNNER'); } catch (e) {}
  }

  public setManualInputEnabled(enabled: boolean) {
    this.manualInputEnabled = enabled;
  }

  /** Rendering adapter only: RunSession owns distance, collision, quiz and score. */
  public renderLearning(snapshot: Snapshot | null, items: SceneItem[], dt: number, avatar: 'mint' | 'rose' | 'amber') {
    if (!this.learningPrepared) {
      this.isRunning = false;
      this.manualInputEnabled = false;
      this.entities.forEach(e => this.disposeLearningEntity(e));
      this.entities = [];
      this.gatePortals.length = 0;
      this.learningPrepared = true;
    }
    this.particlesMesh.visible = false; // Quiet park air keeps distant food and answer gates readable.
    const moving = snapshot && !snapshot.paused && ['running','quiz_approach','quiz_feedback'].includes(snapshot.phase) && !snapshot.waitingForLane;
    const speed = moving ? (snapshot?.motionSpeed ?? COURSE_SPEED) : 0;
    const timeline = snapshot?.record.inputTimeline;
    const cameraInput = timeline?.[timeline.length - 1]?.mode === 'camera';
    // Preserve enough horizontal view for every lane on portrait screens.
    const learningFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(Math.PI / 6) * Math.max(1, 1.1 / this.camera.aspect)));
    if (Math.abs(this.camera.fov - learningFov) > .01) { this.camera.fov = learningFov; this.camera.updateProjectionMatrix(); }
    const lane = snapshot?.lane ?? 1;
    this.currentLane = lane;
    this.targetX = this.laneX[lane];
    this.playerMesh.position.x = THREE.MathUtils.lerp(this.playerMesh.position.x, this.targetX, Math.min(1, dt * 12));
    this.playerMesh.rotation.z = 0;
    if (!snapshot) {
      this.playerMesh.position.y = .09;
      this.playerMesh.rotation.set(0,0,0);
      this.leftArm.rotation.x = this.rightArm.rotation.x = 0;
      this.leftLeg.rotation.x = this.rightLeg.rotation.x = 0;
      (this.leftLeg.userData.knee as THREE.Group).rotation.x = 0;
      (this.rightLeg.userData.knee as THREE.Group).rotation.x = 0;
    }
    if (snapshot && !moving) {
      const settle=Math.min(1,dt*12);
      this.playerMesh.position.y=THREE.MathUtils.lerp(this.playerMesh.position.y,.09,settle);
      this.playerMesh.rotation.x=THREE.MathUtils.lerp(this.playerMesh.rotation.x,0,settle);
      this.playerMesh.rotation.y=THREE.MathUtils.lerp(this.playerMesh.rotation.y,0,settle);
      [this.leftArm,this.rightArm,this.leftLeg,this.rightLeg].forEach(part=>{part.rotation.x=THREE.MathUtils.lerp(part.rotation.x,0,settle);});
      [this.leftLeg,this.rightLeg].forEach(part=>{const knee=part.userData.knee as THREE.Group;knee.rotation.x=THREE.MathUtils.lerp(knee.rotation.x,0,settle);});
    }
    const width = snapshot?.characterWidthScale ?? 1;
    this.playerTorso.scale.x = THREE.MathUtils.lerp(this.playerTorso.scale.x, width, Math.min(1,dt*8));
    this.playerTorso.scale.z = .8 * Math.sqrt(width);
    this.leftArm.position.x = -(.48 * width + .07);
    this.rightArm.position.x = .48 * width + .07;
    this.leftLeg.position.x = -.25 * Math.sqrt(width);
    this.rightLeg.position.x = .25 * Math.sqrt(width);
    (this.playerTorso.material as THREE.MeshStandardMaterial).color.setHex(avatar === 'mint' ? 0x32bfa7 : avatar === 'rose' ? 0xf16e8b : 0xf5b64e);
    this.playerShadow.position.x = this.playerMesh.position.x;
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.targetX * .18, Math.min(1, dt * 8));
    // A higher camera view exposes center-lane food above the runner's head.
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, cameraInput ? 5.4 : 3.8, Math.min(1, dt * 8));
    this.camera.lookAt(this.camera.position.x, 1.4, -16);
    if (moving) {
      this.runAnimTimer += dt * 10;
      const pose = runnerPose(this.runAnimTimer);
      this.playerMesh.position.y = pose.lift;
      this.playerMesh.rotation.y = pose.twist;
      this.playerMesh.rotation.x = -.04;
      this.leftLeg.rotation.x = pose.leftHip;
      this.rightLeg.rotation.x = pose.rightHip;
      (this.leftLeg.userData.knee as THREE.Group).rotation.x = pose.leftKnee;
      (this.rightLeg.userData.knee as THREE.Group).rotation.x = pose.rightKnee;
      this.leftArm.rotation.x = pose.leftShoulder;
      this.rightArm.rotation.x = pose.rightShoulder;
      this.roadTexture.offset.y -= speed * dt * .1;
      this.sceneryProps.forEach(prop => { prop.position.z += speed * dt; if (prop.position.z > 20) prop.position.z -= 260; });
    }
    if(snapshot?.jumpProgress !== undefined && moving) {
      const lift=Math.sin(snapshot.jumpProgress*Math.PI);
      this.playerMesh.position.y=.09+jumpHeight(snapshot.jumpProgress);
      this.leftLeg.rotation.x=this.rightLeg.rotation.x=-.3*lift;
      (this.leftLeg.userData.knee as THREE.Group).rotation.x=-.7*lift;
      (this.rightLeg.userData.knee as THREE.Group).rotation.x=-.7*lift;
      this.leftArm.rotation.x=this.rightArm.rotation.x=-.8*lift;
      this.playerShadow.scale.setScalar(1+lift*.2);
    } else this.playerShadow.scale.setScalar(1);
    const wanted = new Map<string, { type: string; lane: number; z: number; door?: DecisionDoor }>();
    if (snapshot) {
      items.forEach(item => wanted.set(item.id, { type: item.type, lane: item.lane, z: -(item.distance - snapshot.distance) }));
      const gateDistance = visibleGateDistance(snapshot);
      if (gateDistance !== null) {
        for (let i = 0; i < 3; i++) wanted.set(`gate-${snapshot.questionIndex}-${i}`, { type: snapshot.questionIndex === 9 ? 'DOOR_FINISH' : 'DOOR_QUIZ', lane: i,
          z: -gateDistance, door: { id: `quiz-${i}`, title: snapshot.question?.options[i].text ?? '', subtitle: 'คำตอบ', type: 'MYSTERY', icon: '', statsEffect: snapshot.questionIndex === 9 ? 'FINISH' : '' } });
      }
    }
    for (const [id, entity] of this.learningEntities) if (!wanted.has(id)) {
      this.disposeLearningEntity(entity);
      this.learningEntities.delete(id);
    }
    // Rebuild portal animation references from live entities only.
    this.gatePortals.length = 0;
    for (const [id, spec] of wanted) {
      let entity = this.learningEntities.get(id);
      if (!entity) {
        this.spawn3DEntity(spec.type, spec.lane, spec.z, 0, spec.door);
        entity = this.entities.pop()!;
        this.learningEntities.set(id, entity);

        if (id === 'finish') entity.mesh.scale.x = 2.6;
      }
      entity.z = spec.z;
      entity.mesh.position.z = spec.z;
      if (entity.itemMesh && !spec.door) {
        // Boost distant silhouettes for standing camera play; return to the
        // normal clearance near pickup. Scaling does not move the jump target.
        const distanceBoost = THREE.MathUtils.clamp((-spec.z - 4) / 14, 0, 1);
        entity.itemMesh.scale.setScalar(cameraInput ? 1.05 + distanceBoost * .5 : 1);
        // Gentle sway keeps recognizable faces visible instead of spinning them edge-on.
        entity.itemMesh.rotation.y = Math.sin(this.runAnimTimer * .8 + (entity.floatPhase ?? 0)) * .18;
      }
    }
    this.updateBurstEffects(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private disposeLearningEntity(entity: Entity3D) {
    this.scene.remove(entity.mesh);
    entity.mesh.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.userData.ownedTexture?.dispose();
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
  }

  public setGraphicsQuality(quality: GraphicsQuality) {
    this.graphicsQuality = quality;
    const pixelRatio = quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
    this.renderer.shadowMap.enabled = quality !== 'low';
    const shadowSize = quality === 'high' ? 1024 : 512;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.sunLight.shadow.needsUpdate = true;
    this.particlesMesh.visible = quality !== 'low';
    this.renderer.render(this.scene, this.camera);
  }

  private announceFeedback(title: string, subtitle: string, kind: 'collect' | 'land' | 'crash') {
    const now = performance.now();
    if (kind === 'collect' && now - this.lastFeedbackAt < 300) return;
    this.lastFeedbackAt = now;
    this.feedbackEvent = { id: ++this.feedbackSequence, title, subtitle, kind };
  }

  private createBurstEffect(position: THREE.Vector3, color: number, count = 14, lifetime = .62, emphasis = false, warning = false, reduced = false) {
    const group = new THREE.Group();
    group.position.copy(position);
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      velocities.push(new THREE.Vector3((Math.random() - 0.5) * 7, (warning ? .5 + Math.random() * 2 : 1.5 + Math.random() * 6), (Math.random() - 0.5) * 5));
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color, map: emphasis ? (this.particlesMesh.material as THREE.PointsMaterial).map : null, alphaTest: emphasis ? .04 : 0, size: emphasis ? .42 : .28, transparent: true, opacity: 0.95, sizeAttenuation: true, blending: emphasis ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false }));
    group.add(particles);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(emphasis ? 1.05 : .74, emphasis ? .1 : .045, 8, warning ? 6 : 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    this.scene.add(group);
    ring.userData.reduced=reduced;ring.userData.warning=warning;
    this.burstEffects.push({ mesh: group, particles, ring, age: 0, lifetime, velocities });
    if (this.burstEffects.length > 8) {
      const oldest = this.burstEffects.shift()!;
      this.disposeBurst(oldest);
    }
    return this.burstEffects[this.burstEffects.length - 1];
  }

  private disposeBurst(effect: BurstEffect) {
    this.scene.remove(effect.mesh);
    if (effect.label) { effect.label.material.map?.dispose(); effect.label.material.dispose(); }
    effect.particles.geometry.dispose();
    (effect.particles.material as THREE.Material).dispose();
    effect.ring.geometry.dispose();
    (effect.ring.material as THREE.Material).dispose();
  }

  private updateBurstEffects(dt: number) {
    for (let i = this.burstEffects.length - 1; i >= 0; i--) {
      const effect = this.burstEffects[i];
      if(effect.followPlayerOffset)effect.mesh.position.copy(this.playerMesh.position).add(effect.followPlayerOffset);
      effect.age += dt;
      const t = Math.min(1, effect.age / effect.lifetime);
      if (effect.label) {
        effect.label.position.y=.65+(effect.ring.userData.reduced ? 0 : t*.55);
        effect.label.material.opacity=Math.min(1,(1-t)*4);
      }
      const points = effect.particles.geometry.attributes.position as THREE.BufferAttribute;
      const values = points.array as Float32Array;
      for (let p = 0; p < effect.velocities.length; p++) {
        const velocity = effect.velocities[p];
        velocity.y -= 11 * dt;
        values[p * 3] += velocity.x * dt;
        values[p * 3 + 1] += velocity.y * dt;
        values[p * 3 + 2] += velocity.z * dt;
      }
      points.needsUpdate = true;
      (effect.particles.material as THREE.PointsMaterial).opacity = 1 - t;
      (effect.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.82 * (1 - t));
      effect.ring.scale.setScalar(effect.ring.userData.reduced ? 1 : effect.ring.userData.warning ? 1.15 + Math.sin(t*Math.PI)*.25 : .55+t*1.8);
      if (t >= 1) {
        this.burstEffects.splice(i, 1);
        this.disposeBurst(effect);
      }
    }
  }

  private setBiome(index: number) {
    if (index === this.biomeIndex) return;
    const palette = this.biomePalettes[index];
    this.biomeIndex = index;
    this.biome = palette.name;
    this.biomeFrom.sky.copy(this.scene.background instanceof THREE.Color ? this.scene.background : new THREE.Color(palette.sky));
    this.biomeFrom.fog.copy((this.scene.fog as THREE.FogExp2).color);
    this.biomeFrom.road.copy((this.roadMesh.material as THREE.MeshStandardMaterial).color);
    this.biomeFrom.sun.copy(this.sunLight.color);
    this.biomeFrom.hemiSky.copy(this.hemisphereLight.color);
    this.biomeFrom.hemiGround.copy(this.hemisphereLight.groundColor);
    this.biomeTarget = index;
    this.biomeTransition = 0;
    this.announceFeedback(palette.name, `ZONE ${index + 1} • ฉากใหม่`, 'collect');
    for (const prop of this.sceneryProps) {
      prop.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!('color' in material)) continue;
          const colored = material as THREE.MeshStandardMaterial;
          if (!colored.userData.baseBiomeColor) colored.userData.baseBiomeColor = colored.color.clone();
          colored.color.copy(colored.userData.baseBiomeColor).multiply(new THREE.Color(palette.scenery));
        }
      });
    }
  }

  private updateBiome(dt: number) {
    if (this.biomeTransition >= 1) return;
    this.biomeTransition = Math.min(1, this.biomeTransition + dt * 0.48);
    const t = THREE.MathUtils.smoothstep(this.biomeTransition, 0, 1);
    const palette = this.biomePalettes[this.biomeTarget];
    (this.scene.background as THREE.Color).lerpColors(this.biomeFrom.sky, new THREE.Color(palette.sky), t);
    (this.scene.fog as THREE.FogExp2).color.lerpColors(this.biomeFrom.fog, new THREE.Color(palette.fog), t);
    (this.roadMesh.material as THREE.MeshStandardMaterial).color.lerpColors(this.biomeFrom.road, new THREE.Color(palette.road), t);
    this.sunLight.color.lerpColors(this.biomeFrom.sun, new THREE.Color(palette.sun), t);
    this.hemisphereLight.color.lerpColors(this.biomeFrom.hemiSky, new THREE.Color(palette.hemiSky), t);
    this.hemisphereLight.groundColor.lerpColors(this.biomeFrom.hemiGround, new THREE.Color(palette.hemiGround), t);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.manualInputEnabled || !this.isRunning || this.isGameOver || this.paused) return;
    if (e.key === 'ArrowLeft' || e.key === 'KeyA' || e.code === 'KeyA') {
      this.moveLane(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'KeyD' || e.code === 'KeyD') {
      this.moveLane(1);
    } else if (e.key === 'ArrowUp' || e.key === ' ' || e.code === 'Space' || e.key === 'KeyW') {
      this.jump();
    }
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (!this.manualInputEnabled || !this.isRunning || this.isGameOver || this.paused) return;
    if (e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (!this.manualInputEnabled || !this.isRunning || this.isGameOver || this.paused) return;
    if (e.changedTouches.length > 0) {
      const diffX = e.changedTouches[0].clientX - this.touchStartX;
      const diffY = e.changedTouches[0].clientY - this.touchStartY;

      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 25) {
        if (diffX > 0) this.moveLane(1);
        else this.moveLane(-1);
      } else if (diffY < -25) {
        this.jump();
      }
    }
  };

  // --- 3D GAME LOOP ---
  public update() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.updateBiome(dt);
    this.updateBurstEffects(dt);
    for (const portal of this.gatePortals) {
      const material = portal.material as THREE.MeshBasicMaterial;
      material.opacity = portal.userData.baseOpacity * (0.72 + Math.sin(this.timer.getElapsed() * 3.2) * 0.2);
    }

    if (!this.isRunning || this.isGameOver || this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Gradual Speed Acceleration
    const speedBoostFromDistance = Math.min(14.0, (this.distance / 80) * 0.9);
    this.currentSpeed = this.initialSpeed + speedBoostFromDistance;

    const newSpeedLevel = 1 + Math.floor(this.distance / 100);
    if (newSpeedLevel > this.speedLevel) {
      this.speedLevel = newSpeedLevel;
      this.speedUpAlert = `⚡ SPEED UP! LVL ${this.speedLevel}`;
      this.alertTimer = 2.0;
    }

    if (this.speedUpAlert) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) this.speedUpAlert = null;
    }

    if (this.enteredGatePopup) {
      this.gatePopupTimer -= dt;
      if (this.gatePopupTimer <= 0) {
        this.enteredGatePopup = null;
      }
    }

    if (this.colaBoostRemaining > 0) {
      this.colaBoostRemaining = Math.max(0, this.colaBoostRemaining - dt);
      if (this.colaBoostRemaining === 0) {
        this.speedMultiplier = this.selectedBreakfast === 'DONUT' ? 1.10 : 1.0;
      }
    }

    if (this.cameraShakeRemaining > 0) {
      this.cameraShakeRemaining = Math.max(0, this.cameraShakeRemaining - dt);
      if (this.cameraShakeRemaining === 0) this.camera.position.y = 3.8;
    }

    // Stumble Penalty
    const stumbleFactor = this.isStumbling ? 0.75 : 1.0;
    const effectiveSpeed = this.currentSpeed * this.speedMultiplier * stumbleFactor;

    if (this.isStumbling) {
      this.stumbleTimer -= dt;
      if (this.stumbleTimer <= 0) {
        this.isStumbling = false;
      }
    }

    // Road scroll
    if (this.roadTexture) {
      this.roadTexture.offset.y -= (effectiveSpeed * 0.0018) * dt * 60;
    }

    // Scenery Props Recycle
    for (let i = 0; i < this.sceneryProps.length; i++) {
      const prop = this.sceneryProps[i];
      prop.position.z += effectiveSpeed * dt;
      prop.position.y = prop.userData.baseY + Math.sin(this.runAnimTimer * 0.42 + prop.userData.phase) * 0.1;
      prop.rotation.y = prop.userData.baseRotation + Math.sin(this.runAnimTimer * 0.3 + prop.userData.phase) * 0.045;
      if (prop.position.z > 20) {
        prop.position.z -= 260;
      }
    }

    // Floating Clouds Slow Drift
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.position.x += dt * 0.8;
      if (cloud.position.x > 80) {
        cloud.position.x = -80;
      }
    }

    // Speed Particles Stream
    if (this.particlesMesh && this.particlePositions) {
      const positions = (this.particlesMesh.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      const pCount = positions.length / 3;
      for (let i = 0; i < pCount; i++) {
        positions[i * 3 + 2] += effectiveSpeed * 1.4 * dt;
        if (positions[i * 3 + 2] > 10) {
          positions[i * 3 + 2] = -150 - Math.random() * 20;
          positions[i * 3] = (Math.random() - 0.5) * 18;
          positions[i * 3 + 1] = Math.random() * 8 + 0.5;
        }
      }
      this.particlesMesh.geometry.attributes.position.needsUpdate = true;
    }

    // Arms & Legs animation
    this.runAnimTimer += (effectiveSpeed * 0.85) * dt;
    if (!this.isJumping) {
      const swingAngle = Math.sin(this.runAnimTimer) * 0.65;
      if (this.leftLeg) this.leftLeg.rotation.x = swingAngle;
      if (this.rightLeg) this.rightLeg.rotation.x = -swingAngle;
      if (this.leftArm) this.leftArm.rotation.x = -swingAngle * 0.85;
      if (this.rightArm) this.rightArm.rotation.x = swingAngle * 0.85;
    } else {
      if (this.leftArm) this.leftArm.rotation.x = -1.2;
      if (this.rightArm) this.rightArm.rotation.x = -1.2;
      if (this.leftLeg) this.leftLeg.rotation.x = 0.5;
      if (this.rightLeg) this.rightLeg.rotation.x = -0.3;
    }

    // Distance & Score progression
    this.distance += effectiveSpeed * dt * 1.2;
    this.score += effectiveSpeed * dt * 6 * this.activeCombo.multiplier;
    const nextBiome = Math.floor(this.distance / 1000) % this.biomePalettes.length;
    this.setBiome(nextBiome);

    // Sugar Overload Penalty Check (> 75%)
    this.isSugarOverloaded = this.status.sugar >= 75;

    // Fast Energy Decay
    const energyBurnRate = this.isSugarOverloaded ? 3.2 : 1.65;
    this.status.energy = Math.max(0, this.status.energy - energyBurnRate * dt);

    // Fast Stamina Decay
    const baseStaminaRate = this.selectedBreakfast === 'OATMEAL' ? 0.65 : 1.25;
    this.status.stamina = Math.max(0, Math.min(100, this.status.stamina - baseStaminaRate * dt));

    // Slow Natural Sugar Decay
    this.status.sugar = Math.max(0, this.status.sugar - 0.15 * dt);

    // GAME OVER CONDITIONS
    if (this.lives <= 0) {
      this.triggerGameOver('สะดุดสิ่งกีดขวางจนหมดหัวใจ (Out of Lives!)');
      return;
    }
    if (this.status.energy <= 0) {
      this.triggerGameOver('พลังงานหมดเกลี้ยง! (Energy Depleted - ต้องกินอาหารเติมพลัง)');
      return;
    }

    // Continuous Entity Spawner
    this.spawnTimer += dt;
    const spawnInterval = Math.max(0.75, 1.25 - (this.currentSpeed - 14.0) * 0.035);
    if (this.spawnTimer > spawnInterval) {
      this.spawnTimer = 0;
      const spawnLane = Math.floor(Math.random() * 3);
      const rand = Math.random();
      const spawnZ = -120;

      if (rand < 0.30) {
        this.spawn3DEntity('OBSTACLE_LOW', spawnLane, spawnZ, 0);
      } else if (rand < 0.48) {
        this.spawn3DEntity('STAR_HIGH', spawnLane, spawnZ, 1);
      } else {
        const types = ['BURGER', 'COLA', 'APPLE', 'WATER'];
        const chosen = types[Math.floor(Math.random() * types.length)];
        this.spawn3DEntity(chosen, spawnLane, spawnZ, 0);
      }
    }

    // Spawn 3D Decision Gates (EVERY 1,000 METERS / 1 KM)
    if (this.distance >= this.nextGateDistance && !this.entities.some(e => e.doorInfo)) {
      this.spawn3DDecisionGates();
      this.nextGateDistance += 1000;
    }

    // Turning responsiveness
    const turnResponsiveness = this.isSugarOverloaded ? 4.8 : 12.0;
    const prevX = this.playerMesh.position.x;
    this.playerMesh.position.x = THREE.MathUtils.lerp(this.playerMesh.position.x, this.targetX, turnResponsiveness * dt);
    const lateralDelta = this.playerMesh.position.x - prevX;
    this.playerMesh.rotation.z = THREE.MathUtils.lerp(this.playerMesh.rotation.z, -lateralDelta * 0.45, 10 * dt);

    // 3D Jump Arc
    let landed = false;
    if (this.isJumping) {
      this.playerY += this.jumpVelocity * dt;
      this.jumpVelocity -= 36.0 * dt;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.isJumping = false;
        this.jumpVelocity = 0;
        landed = true;
      }
    }
    this.playerMesh.position.y = this.playerY;
    this.landingSquash = Math.max(0, this.landingSquash - dt);
    const squash = this.landingSquash > 0 ? Math.sin((this.landingSquash / 0.18) * Math.PI) * 0.095 : 0;
    this.playerMesh.scale.set(1, 1 - squash, 1);
    this.playerShadow.position.x = this.playerMesh.position.x;
    const shadowT = THREE.MathUtils.clamp(this.playerY / 4.2, 0, 0.68);
    this.playerShadow.scale.setScalar(1 - shadowT * 0.42);
    (this.playerShadow.material as THREE.MeshBasicMaterial).opacity = 0.34 - shadowT * 0.23;
    if (landed) {
      this.landingSquash = 0.18;
      this.createBurstEffect(new THREE.Vector3(this.playerMesh.position.x, 0.16, 0), 0xdff8ff, 10);
    }

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.targetX * 0.25, 8 * dt);

    // Update Entities Movement & Collision
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.z += effectiveSpeed * dt;
      e.mesh.position.z = e.z;

      if (e.itemMesh && e.type !== 'OBSTACLE_LOW' && !e.doorInfo) {
        e.itemMesh.rotation.y += 2.0 * dt;
        const hoverAmount = e.altitude === 1 ? 0.24 : 0.075;
        e.itemMesh.position.y = (e.floatBaseY ?? 0) + Math.sin(this.runAnimTimer * 1.8 + (e.floatPhase ?? i)) * hoverAmount;
      }

      // Collision Detection at Player (Z around 0)
      if (e.z >= -1.0 && e.z <= 1.2 && e.lane === this.currentLane) {
        if (e.type === 'OBSTACLE_LOW') {
          if (this.playerY < 1.1) {
            this.handleStumblePenalty();
            this.scene.remove(e.mesh);
            this.entities.splice(i, 1);
            continue;
          }
        } else if (e.type === 'STAR_HIGH') {
          if (this.playerY >= 1.0) {
            try { soundSynth.playComboSound(); } catch (err) {}
            this.score += 500;
            this.status.stamina = Math.min(100, this.status.stamina + 18);
            this.createBurstEffect(new THREE.Vector3(this.playerMesh.position.x, 2.1, 0), 0xffd34f, 22);
            this.announceFeedback('ดาวพลังงาน +500', 'ฟื้นความอึด +18', 'collect');
            this.scene.remove(e.mesh);
            this.entities.splice(i, 1);
            continue;
          }
        } else if (e.doorInfo) {
          this.enterGate(e.doorInfo);
          this.entities.filter(ent => ent.doorInfo).forEach(ent => this.scene.remove(ent.mesh));
          this.entities = this.entities.filter(ent => !ent.doorInfo);
          break;
        } else if (this.playerY < 1.2) {
          this.collectItem(e.type);
          const effects: Record<string, { color: number; title: string; subtitle: string }> = {
            BURGER: { color: 0xffaa57, title: 'BURGER!', subtitle: 'เติมพลัง • น้ำตาลเพิ่ม' },
            COLA: { color: 0xff7f9a, title: 'COLA!', subtitle: 'เร่งความเร็วชั่วคราว' },
            APPLE: { color: 0x91d35a, title: 'APPLE!', subtitle: 'เติมความสดชื่น' },
            WATER: { color: 0x62d9f2, title: 'WATER!', subtitle: 'ลดน้ำตาล • คืนสมดุล' }
          };
          const effect = effects[e.type];
          if (effect) {
            this.createBurstEffect(new THREE.Vector3(this.playerMesh.position.x, 1.15, 0), effect.color);
            this.announceFeedback(effect.title, effect.subtitle, 'collect');
          }
          this.scene.remove(e.mesh);
          this.entities.splice(i, 1);
          continue;
        }
      }

      if (e.z > 8.0) {
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  // --- STUMBLE PENALTY ---
  private handleStumblePenalty() {
    const livesLost = this.isSugarOverloaded ? 2 : 1;
    this.lives -= livesLost;
    this.isStumbling = true;
    this.stumbleTimer = 1.2;
    this.createBurstEffect(new THREE.Vector3(this.playerMesh.position.x, 0.8, 0), 0xfb7185, 20);
    this.announceFeedback('ชนสิ่งกีดขวาง', `เสีย ${livesLost} หัวใจ`, 'crash');
    this.status.stamina = Math.max(0, this.status.stamina - 25);

    try {
      soundSynth.playCrashWarning();
    } catch (err) {}

    this.camera.position.y = 4.15;
    this.cameraShakeRemaining = 0.14;

    if (this.lives <= 0) {
      this.triggerGameOver(this.isSugarOverloaded ? 'น้ำตาลสูงสะดุดรุนแรงเสีย 2 หัวใจ! (Heavy Crash Damage)' : 'สะดุดสิ่งกีดขวางจนหมดหัวใจ (Out of Lives!)');
    }
  }

  private triggerGameOver(reason: string) {
    this.isGameOver = true;
    this.paused = false;
    this.gameOverReason = reason;
    this.isRunning = false;
    if (this.leftArm && this.rightArm) {
      this.leftArm.rotation.x = -0.45;
      this.rightArm.rotation.x = -0.45;
      this.leftArm.rotation.z = 0.16;
      this.rightArm.rotation.z = -0.16;
      this.playerMesh.rotation.z = 0.035;
    }
    try {
      soundSynth.stopMusic();
    } catch (e) {}
  }

  // --- BALANCED DECISION GATES ---
  private spawn3DDecisionGates() {
    const doors: DecisionDoor[] = [
      { 
        id: '1', 
        title: 'FAST FOOD', 
        subtitle: 'Energy Surge', 
        type: 'FAST_FOOD', 
        icon: 'DOOR_FAST_FOOD', 
        statsEffect: '+25 NRG  +20 SGR' 
      },
      { 
        id: '2', 
        title: 'HEALTHY', 
        subtitle: 'Sugar Detox', 
        type: 'HEALTHY', 
        icon: 'DOOR_HEALTHY', 
        statsEffect: '+15 STM  -18 SGR' 
      },
      { 
        id: '3', 
        title: 'BALANCED', 
        subtitle: 'Minor Boost', 
        type: 'MYSTERY', 
        icon: 'DOOR_MYSTERY', 
        statsEffect: '+12 NRG  +12 STM' 
      }
    ];

    const randomizedLanes = [0, 1, 2].sort(() => Math.random() - 0.5);

    doors.forEach((door, idx) => {
      const assignedLane = randomizedLanes[idx];
      this.spawn3DEntity('DOOR_' + door.type, assignedLane, -120, 0, door);
    });
  }

  private collectItem(type: string) {
    try {
      soundSynth.playPickup(type as ItemType);
    } catch (e) {}

    this.comboHistory.push(type);
    if (this.comboHistory.length > 3) this.comboHistory.shift();

    const isHealthy = (t: string) => t === 'APPLE' || t === 'WATER' || t === 'EXERCISE';
    const isCrash = (t: string) => t === 'BURGER' || t === 'COLA';

    if (this.comboHistory.length >= 3 && this.comboHistory.every(isHealthy)) {
      this.activeCombo = { type: 'HEALTHY', count: 3, multiplier: 2.5, timer: 8.0 };
      try { soundSynth.playComboSound(); } catch (e) {}
      this.status.stamina = Math.min(100, this.status.stamina + 15);
      if (this.lives < 3) this.lives += 1;
    } else if (this.comboHistory.length >= 3 && this.comboHistory.every(isCrash)) {
      this.activeCombo = { type: 'CRASH', count: 3, multiplier: 0.5, timer: 8.0 };
      try { soundSynth.playCrashWarning(); } catch (e) {}
      this.status.sugar = Math.min(100, this.status.sugar + 30);
    }

    switch (type) {
      case 'BURGER':
        this.status.energy = Math.min(100, this.status.energy + 20);
        this.status.sugar = Math.min(100, this.status.sugar + 26);
        this.status.stamina = Math.max(0, this.status.stamina - 8);
        break;
      case 'COLA':
        this.status.sugar = Math.min(100, this.status.sugar + 34);
        this.status.energy = Math.min(100, this.status.energy + 8);
        this.status.stamina = Math.max(0, this.status.stamina - 10);
        this.speedMultiplier = 1.25;
        this.colaBoostRemaining = 3.5;
        break;
      case 'APPLE':
        this.status.energy = Math.min(100, this.status.energy + 7);
        this.status.stamina = Math.min(100, this.status.stamina + 9);
        this.status.sugar = Math.max(0, this.status.sugar - 6);
        break;
      case 'WATER':
        this.status.stamina = Math.min(100, this.status.stamina + 14);
        this.status.mood = Math.min(100, this.status.mood + 10);
        this.status.sugar = Math.max(0, this.status.sugar - 16);
        break;
    }
  }

  private enterGate(door: DecisionDoor) {
    try { soundSynth.playComboSound(); } catch (e) {}
    this.enteredGatePopup = door;
    this.gatePopupTimer = 2.5;

    if (door.type === 'FAST_FOOD') {
      this.status.energy = Math.min(100, this.status.energy + 25);
      this.status.sugar = Math.min(100, this.status.sugar + 20);
    } else if (door.type === 'HEALTHY') {
      this.status.stamina = Math.min(100, this.status.stamina + 15);
      this.status.sugar = Math.max(0, this.status.sugar - 18);
      this.status.mood = Math.min(100, this.status.mood + 10);
    } else {
      this.status.energy = Math.min(100, this.status.energy + 12);
      this.status.stamina = Math.min(100, this.status.stamina + 12);
      this.status.mood = Math.min(100, this.status.mood + 8);
    }
  }

  private onWindowResize = () => {
    if (!this.renderer || !this.camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy() {
    this.timer.dispose();
    (this.playerShadow.material as THREE.MeshBasicMaterial).map?.dispose();
    if (this.resizeTimeout !== null) clearTimeout(this.resizeTimeout);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.container.removeEventListener('touchstart', this.handleTouchStart);
    this.container.removeEventListener('touchend', this.handleTouchEnd);
    this.burstEffects.splice(0).forEach(effect => this.disposeBurst(effect));
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.userData.ownedTexture?.dispose();
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    this.gateTextureCache.forEach(texture => texture.dispose());
    this.roadTexture?.dispose();
    this.learningEntities.clear();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
