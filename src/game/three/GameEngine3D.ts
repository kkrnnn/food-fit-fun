import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BodyStatus, BreakfastOption, ItemType, ActiveCombo, DecisionDoor } from '../types';
import { soundSynth } from '../audio/SoundSynth';

export type GraphicsQuality = 'low' | 'medium' | 'high';

interface BurstEffect {
  mesh: THREE.Group;
  particles: THREE.Points;
  ring: THREE.Mesh;
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
  private clock: THREE.Clock;
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

    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();

    // A softer sunset sky keeps the road readable and lets props carry the bright colors.
    this.scene.background = new THREE.Color(0xf6c9d5).lerp(new THREE.Color(0xa9d7ed), 0.42);
    this.scene.fog = new THREE.FogExp2(0xd9d4eb, 0.0028);

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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this.scene.add(this.sunLight);

    this.hemisphereLight = new THREE.HemisphereLight(0x9fd7fa, 0x66516e, 0.62);
    this.scene.add(this.hemisphereLight);

    // Build World Elements
    this.buildCandySkyAndMountains();
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

  // --- 1. HORIZON CANDY MOUNTAINS & CLOUDS ---
  private buildCandySkyAndMountains() {
    this.mountainMesh = new THREE.Group();

    // Distant Frosted Mountains Silhouettes
    const mountainColors = [0xf472b6, 0x38bdf8, 0xc084fc, 0xfbbf24];
    for (let i = 0; i < 16; i++) {
      const col = mountainColors[i % mountainColors.length];
      const radius = 18 + (i % 3) * 8;
      const geo = new THREE.ConeGeometry(radius, 45 + (i % 4) * 10, 8);
      const mat = new THREE.MeshStandardMaterial({ 
        color: col, 
        roughness: 0.8,
        flatShading: true 
      });
      const cone = new THREE.Mesh(geo, mat);
      const side = i % 2 === 0 ? -1 : 1;
      cone.position.set(side * (45 + (i % 5) * 15), 10, -220 - (i * 12));
      this.mountainMesh.add(cone);
    }
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

  // --- 2. CANDY HIGHWAY ROAD WITH CURBS & NEON MARKINGS ---
  private build3DRoad() {
    const roadWidth = 12.5;
    const roadLength = 320;
    const geometry = new THREE.PlaneGeometry(roadWidth, roadLength, 1, 120);
    
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Matte plum asphalt with a subtle shoulder; stronger lane contrast improves distance reading.
    ctx.fillStyle = '#3f3d59';
    ctx.fillRect(0, 0, 512, 512);

    const roadGradient = ctx.createLinearGradient(20, 0, 492, 0);
    roadGradient.addColorStop(0, '#66536f');
    roadGradient.addColorStop(0.5, '#755c78');
    roadGradient.addColorStop(1, '#66536f');
    ctx.fillStyle = roadGradient;
    ctx.fillRect(20, 0, 472, 512);

    // Fine sugar-glass aggregate gives the road a little texture without visual noise.
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
      ctx.fillStyle = (y / checkSize) % 2 === 0 ? '#fb7185' : '#fff2db';
      ctx.fillRect(0, y, 20, checkSize);
      ctx.fillRect(492, y, 20, checkSize);
    }

    // Double lane markings with a soft warm center stripe.
    ctx.strokeStyle = 'rgba(239,232,255,.62)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(170, 0); ctx.lineTo(170, 512);
    ctx.moveTo(342, 0); ctx.lineTo(342, 512);
    ctx.stroke();

    ctx.strokeStyle = '#f9d782';
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

    // Left and Right 3D Curbs Bars
    const curbGeo = new THREE.BoxGeometry(0.6, 0.4, 320);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x7c526d, roughness: 0.82 });
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-6.5, 0.2, -120);
    this.scene.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeo, curbMat);
    rightCurb.position.set(6.5, 0.2, -120);
    this.scene.add(rightCurb);
  }

  // --- 3. ROADSIDE CANDY SCENERY (Lollipops, Candy Canes, Gummy Crystals) ---
  private build3DScenery() {
    for (let z = -240; z < 20; z += 16) {
      const type = (Math.abs(z) / 16) % 3;
      let leftProp: THREE.Group;
      let rightProp: THREE.Group;

      if (type === 0) {
        leftProp = this.createGlossyLollipop(0xec4899);
        rightProp = this.createGlossyLollipop(0x0284c7);
      } else if (type === 1) {
        leftProp = this.createCandyCane();
        rightProp = this.createCandyCane();
        rightProp.scale.x = -1;
      } else {
        leftProp = this.createGummyCrystal(0x10b981);
        rightProp = this.createGummyCrystal(0x8b5cf6);
      }

      leftProp.position.set(-8.8 - Math.random() * 1.5, 0, z);
      leftProp.userData.baseY = leftProp.position.y;
      leftProp.userData.phase = Math.random() * Math.PI * 2;
      leftProp.userData.baseRotation = (Math.random() - 0.5) * 0.2;
      leftProp.scale.multiplyScalar(0.88 + Math.random() * 0.2);
      leftProp.rotation.y = leftProp.userData.baseRotation;
      this.scene.add(leftProp);
      this.sceneryProps.push(leftProp);

      rightProp.position.set(8.8 + Math.random() * 1.5, 0, z + 8);
      rightProp.userData.baseY = rightProp.position.y;
      rightProp.userData.phase = Math.random() * Math.PI * 2;
      rightProp.userData.baseRotation = Math.PI + (Math.random() - 0.5) * 0.2;
      rightProp.scale.multiplyScalar(0.88 + Math.random() * 0.2);
      rightProp.rotation.y = rightProp.userData.baseRotation;
      this.scene.add(rightProp);
      this.sceneryProps.push(rightProp);
    }
  }

  private createGlossyLollipop(colorHex: number): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.24, 32), new THREE.MeshStandardMaterial({ color: 0x45334f, roughness: 0.42, metalness: 0.15 }));
    base.position.y = 0.12;
    base.castShadow = true;
    group.add(base);
    const baseTrim = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.055, 8, 32), new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.25, metalness: 0.22, emissive: colorHex, emissiveIntensity: 0.12 }));
    baseTrim.rotation.x = Math.PI / 2;
    baseTrim.position.y = 0.24;
    group.add(baseTrim);
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 4.9, 24),
      new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.28 })
    );
    stick.position.y = 2.35;
    stick.castShadow = true;
    group.add(stick);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.055, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.35, roughness: 0.25 })
    );
    collar.position.y = 4.65;
    group.add(collar);

    const candyMat = new THREE.MeshPhysicalMaterial({
      color: colorHex, roughness: 0.18, metalness: 0.04,
      clearcoat: 1, clearcoatRoughness: 0.12,
      emissive: colorHex, emissiveIntensity: 0.07
    });
    const candy = new THREE.Mesh(new THREE.SphereGeometry(1.62, 48, 32), candyMat);
    candy.scale.set(1, 1, 0.72);
    candy.position.y = 5.5;
    candy.castShadow = true;
    group.add(candy);

    // A raised sugar ribbon follows the candy's curved face instead of floating as a flat ring.
    const spiralPoints: THREE.Vector3[] = [];
    const turns = 2.35;
    const segments = 150;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const radius = 0.035 + t * 1.34;
      const angle = t * turns * Math.PI * 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      const z = 1.62 * 0.72 * Math.sqrt(Math.max(0.02, 1 - (radius * radius) / (1.62 * 1.62))) + 0.018;
      spiralPoints.push(new THREE.Vector3(x, 5.5 + y, z));
    }
    const spiralCurve = new THREE.CatmullRomCurve3(spiralPoints);
    const spiral = new THREE.Mesh(
      new THREE.TubeGeometry(spiralCurve, segments, 0.075, 8, false),
      new THREE.MeshPhysicalMaterial({ color: 0xfff8ed, roughness: 0.22, clearcoat: 0.8 })
    );
    spiral.castShadow = true;
    group.add(spiral);

    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    glint.position.set(-0.62, 6.05, 0.91);
    group.add(glint);
    return group;
  }

  private createCandyCane(): THREE.Group {
    const group = new THREE.Group();
    const icing = new THREE.MeshPhysicalMaterial({ color: 0xfff7ed, roughness: 0.22, clearcoat: 0.9 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.32, 4.35, 24), icing);
    stem.position.y = 2.18;
    stem.castShadow = true;
    group.add(stem);

    const stripePoints: THREE.Vector3[] = [];
    const turns = 5.4;
    const segments = 180;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * turns * Math.PI * 2;
      stripePoints.push(new THREE.Vector3(0.315 * Math.cos(angle), 0.12 + t * 4.12, 0.315 * Math.sin(angle)));
    }
    const stripe = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripePoints), segments, 0.085, 8, false),
      new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, roughness: 0.24, clearcoat: 0.8 })
    );
    stripe.castShadow = true;
    group.add(stripe);

    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.29, 18, 36, Math.PI), icing);
    hook.position.set(0.5, 4.42, 0);
    hook.rotation.z = Math.PI / 2;
    hook.castShadow = true;
    group.add(hook);
    const hookStripe = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.075, 10, 36, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.25 }));
    hookStripe.position.copy(hook.position);
    hookStripe.rotation.copy(hook.rotation);
    hookStripe.scale.set(0.78, 0.78, 1.01);
    group.add(hookStripe);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.22, 32), new THREE.MeshStandardMaterial({ color: 0x67e8f9, metalness: 0.2, roughness: 0.3 }));
    foot.position.y = 0.12;
    foot.castShadow = true;
    group.add(foot);
    return group;
  }

  private createGummyCrystal(colorHex: number): THREE.Group {
    const group = new THREE.Group();
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.3, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x30254c, metalness: 0.2, roughness: 0.34 })
    );
    foot.position.y = 0.14;
    foot.castShadow = true;
    group.add(foot);

    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.055, 10, 32),
      new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.38, roughness: 0.22, emissive: colorHex, emissiveIntensity: 0.18 })
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.3;
    group.add(trim);

    const crystal = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.12, 1),
      new THREE.MeshPhysicalMaterial({
        color: colorHex, roughness: 0.16, metalness: 0.06,
        clearcoat: 1, clearcoatRoughness: 0.08,
        emissive: colorHex, emissiveIntensity: 0.1, flatShading: false
      })
    );
    crystal.position.y = 2.05;
    crystal.scale.set(0.8, 1.55, 0.72);
    crystal.rotation.y = Math.PI / 5;
    crystal.castShadow = true;
    group.add(crystal);

    const inner = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.68 })
    );
    inner.position.set(-0.15, 2.05, 0.36);
    inner.scale.set(0.55, 1.6, 0.4);
    group.add(inner);
    return group;
  }

  // --- 4. FLOATING CANDY SPARKLES & SPEED PARTICLES ---
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

    // 1. ATHLETIC HOODIE / TORSO
    this.playerTorso = new THREE.Mesh(
      new RoundedBoxGeometry(1.2, 1.25, 0.72, 5, 0.16),
      new THREE.MeshPhysicalMaterial({ color: 0x0284c7, roughness: 0.36, clearcoat: 0.35 })
    );
    this.playerTorso.position.y = 1.45;
    this.playerTorso.castShadow = true;
    this.playerMesh.add(this.playerTorso);

    const zipper = new THREE.Mesh(
      new RoundedBoxGeometry(0.045, 0.92, 0.035, 3, 0.015),
      new THREE.MeshStandardMaterial({ color: 0xf6f4ff, roughness: 0.48 })
    );
    zipper.position.set(0, 1.47, -0.37);
    this.playerMesh.add(zipper);

    const chestPanel = new THREE.Mesh(
      new RoundedBoxGeometry(0.42, 0.31, 0.04, 3, 0.018),
      new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.52 })
    );
    chestPanel.position.set(0.3, 1.62, -0.39);
    this.playerMesh.add(chestPanel);
    const chestMark = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 6, 18), new THREE.MeshStandardMaterial({ color: 0xfde68a, metalness: 0.35, roughness: 0.35 }));
    chestMark.position.set(0.3, 1.63, -0.42);
    this.playerMesh.add(chestMark);

    // 2. CANDY RUNNER BACKPACK
    this.playerBackpack = new THREE.Mesh(
      new RoundedBoxGeometry(0.82, 0.9, 0.42, 5, 0.14),
      new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, roughness: 0.34, clearcoat: 0.5 })
    );
    this.playerBackpack.position.set(0, 1.45, 0.52);
    this.playerBackpack.castShadow = true;
    this.playerMesh.add(this.playerBackpack);

    const backpackPocket = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.38, 0.1, 4, 0.045), new THREE.MeshStandardMaterial({ color: 0x20314f, roughness: 0.46 }));
    backpackPocket.position.set(0, 1.3, 0.78);
    backpackPocket.castShadow = true;
    this.playerMesh.add(backpackPocket);
    const backpackZip = new THREE.Mesh(new RoundedBoxGeometry(0.29, 0.035, 0.025, 3, 0.01), new THREE.MeshStandardMaterial({ color: 0xf6d47a, metalness: 0.25, roughness: 0.3 }));
    backpackZip.position.set(0, 1.31, 0.838);
    this.playerMesh.add(backpackZip);

    const buckle = new THREE.Mesh(
      new RoundedBoxGeometry(0.24, 0.16, 0.06, 3, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.55, roughness: 0.28 })
    );
    buckle.position.set(0, 1.45, 0.75);
    this.playerMesh.add(buckle);

    // 3. HEAD & FACE
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xffdfba, roughness: 0.4 })
    );
    head.position.y = 2.45;
    head.castShadow = true;
    this.playerMesh.add(head);

    const hairMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 });
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hairTop.position.set(0, 2.52, 0);
    this.playerMesh.add(hairTop);

    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 8), hairMat);
      spike.position.set(i * 0.16, 2.65, 0.28);
      spike.rotation.x = 0.5;
      this.playerMesh.add(spike);
    }

    this.playerHeadband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.14, 24),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2 })
    );
    this.playerHeadband.position.y = 2.52;
    this.playerMesh.add(this.playerHeadband);

    const starEmblem = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.62),
      new THREE.MeshStandardMaterial({ color: 0xfde047, metalness: 0.8 })
    );
    starEmblem.position.set(0, 2.52, -0.32);
    this.playerMesh.add(starEmblem);

    // 4. ARMS
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfba });

    this.leftArm = new THREE.Group();
    const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.65, 16), sleeveMat);
    leftSleeve.position.y = -0.32;
    this.leftArm.add(leftSleeve);
    const leftFist = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), skinMat);
    leftFist.position.y = -0.72;
    this.leftArm.add(leftFist);
    this.leftArm.position.set(-0.72, 1.85, 0);
    this.playerMesh.add(this.leftArm);

    this.rightArm = new THREE.Group();
    const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.65, 16), sleeveMat);
    rightSleeve.position.y = -0.32;
    this.rightArm.add(rightSleeve);
    const rightFist = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), skinMat);
    rightFist.position.y = -0.72;
    this.rightArm.add(rightFist);
    this.rightArm.position.set(0.72, 1.85, 0);
    this.playerMesh.add(this.rightArm);

    // 5. LEGS
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x26324c, roughness: 0.62 });
    const shoeWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfff4e6, roughness: 0.36, clearcoat: 0.36 });
    const shoeColorMat = new THREE.MeshPhysicalMaterial({ color: 0xec4899, roughness: 0.28, clearcoat: 0.65 });

    this.leftLeg = new THREE.Group();
    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.6, 16), pantsMat);
    leftThigh.position.y = -0.3;
    this.leftLeg.add(leftThigh);
    const leftCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.45, 16), pantsMat);
    leftCalf.position.y = -0.65;
    this.leftLeg.add(leftCalf);
    const leftShoe = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.25, 0.68, 4, 0.1), shoeColorMat);
    leftShoe.position.set(0, -0.92, -0.08);
    this.leftLeg.add(leftShoe);
    const leftSole = new THREE.Mesh(new RoundedBoxGeometry(0.41, 0.09, 0.7, 4, 0.035), shoeWhiteMat);
    leftSole.position.set(0, -1.03, -0.08);
    this.leftLeg.add(leftSole);
    this.leftLeg.position.set(-0.35, 0.95, 0);
    this.leftLeg.castShadow = true;
    this.playerMesh.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.6, 16), pantsMat);
    rightThigh.position.y = -0.3;
    this.rightLeg.add(rightThigh);
    const rightCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.45, 16), pantsMat);
    rightCalf.position.y = -0.65;
    this.rightLeg.add(rightCalf);
    const rightShoe = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.25, 0.68, 4, 0.1), shoeColorMat);
    rightShoe.position.set(0, -0.92, -0.08);
    this.rightLeg.add(rightShoe);
    const rightSole = new THREE.Mesh(new RoundedBoxGeometry(0.41, 0.09, 0.7, 4, 0.035), shoeWhiteMat);
    rightSole.position.set(0, -1.03, -0.08);
    this.rightLeg.add(rightSole);
    this.rightLeg.position.set(0.35, 0.95, 0);
    this.rightLeg.castShadow = true;
    this.playerMesh.add(this.rightLeg);

    // 6. BLOB SHADOW
    const shadowGeo = new THREE.CircleGeometry(0.95, 24);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
    this.playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(0, 0.025, 0.1);
    this.scene.add(this.playerShadow);

    this.playerMesh.position.set(0, 0, 0);
    this.scene.add(this.playerMesh);
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
    const key = `${door.type}_${door.title}`;
    if (this.gateTextureCache.has(key)) return this.gateTextureCache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    if (door.type === 'FAST_FOOD') {
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
    const icon = door.type === 'FAST_FOOD' ? '🍔 ' : door.type === 'HEALTHY' ? '🥗 ' : '✨ ';
    ctx.fillText(icon + door.title, 256, 95);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 32px "Chakra Petch", sans-serif';
    ctx.fillText(door.statsEffect, 256, 175);

    const tex = new THREE.CanvasTexture(canvas);
    this.gateTextureCache.set(key, tex);
    return tex;
  }

  public spawn3DEntity(type: string, lane: number, z: number, altitude: number = 0, doorInfo?: DecisionDoor) {
    const group = new THREE.Group();
    let itemMesh: THREE.Object3D | undefined;

    // Glowing Neon Ring Base
    const ringColor = type === 'OBSTACLE_LOW' ? 0xef4444 : altitude === 1 ? 0xfacc15 : 0x38bdf8;
    const ringGeo = new THREE.RingGeometry(0.9, 1.25, 24);
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: ringColor, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.85 
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
    } else if (type === 'BURGER') {
      itemMesh = this.createDetailedBurger();
      itemMesh.position.y = 0.6;
      group.add(itemMesh);
    } else if (type === 'COLA') {
      itemMesh = this.createDetailedCola();
      itemMesh.position.y = 0.6;
      group.add(itemMesh);
    } else if (type === 'APPLE') {
      itemMesh = this.createDetailedApple();
      itemMesh.position.y = 0.65;
      group.add(itemMesh);
    } else if (type === 'WATER') {
      itemMesh = this.createDetailedWater();
      itemMesh.position.y = 0.65;
      group.add(itemMesh);
    }

    group.position.set(this.laneX[lane], 0, z);
    this.scene.add(group);

    const floatBaseY = itemMesh?.position.y ?? 0;
    const floatPhase = (Math.abs(z) + lane * 19) * 0.08;
    this.entities.push({ mesh: group, type, lane, z, altitude, doorInfo, itemMesh, floatBaseY, floatPhase });
  }

  // --- 6. HIGH-END CANDY MODELS WITH RICH MATERIALS ---
  private createDetailedBurger(): THREE.Group {
    const g = new THREE.Group();
    g.scale.set(1.25, 1.25, 1.25);
    const bun = new THREE.MeshPhysicalMaterial({ color: 0xe9a849, roughness: 0.42, clearcoat: 0.28 });
    const bunBase = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.93, 0.28, 40), bun);
    bunBase.position.y = 0.02;
    bunBase.castShadow = true;
    g.add(bunBase);

    const lettuceMat = new THREE.MeshStandardMaterial({ color: 0x65a940, roughness: 0.4 });
    const lettuce = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.16, 10, 40), lettuceMat);
    lettuce.position.y = 0.23;
    lettuce.scale.set(1, 0.55, 1);
    g.add(lettuce);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), lettuceMat);
      leaf.scale.set(1.5, 0.28, 0.72);
      leaf.position.set(Math.cos(angle) * 0.88, 0.23, Math.sin(angle) * 0.88);
      leaf.rotation.y = -angle;
      g.add(leaf);
    }

    const pattyMat = new THREE.MeshStandardMaterial({ color: 0x713a27, roughness: 0.78 });
    const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.89, 0.91, 0.32, 40), pattyMat);
    patty.position.y = 0.43;
    patty.castShadow = true;
    g.add(patty);
    for (let i = 0; i < 7; i++) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(0.72 + (i % 2) * 0.08, 0.018, 6, 32, Math.PI * 0.82), new THREE.MeshStandardMaterial({ color: 0x3e211f, roughness: 0.9 }));
      groove.position.y = 0.6 + (i % 3) * 0.025;
      groove.rotation.z = i * 0.88;
      g.add(groove);
    }

    const cheese = new THREE.Mesh(
      new RoundedBoxGeometry(1.9, 0.16, 1.9, 3, 0.09),
      new THREE.MeshPhysicalMaterial({ color: 0xf6c94e, roughness: 0.34, clearcoat: 0.45 })
    );
    cheese.position.y = 0.62;
    cheese.rotation.y = Math.PI / 4;
    cheese.castShadow = true;
    g.add(cheese);

    const top = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), bun);
    top.scale.set(1, 0.74, 0.95);
    top.position.y = 0.73;
    top.castShadow = true;
    g.add(top);

    const sesameMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, roughness: 0.62 });
    const sesame = new THREE.SphereGeometry(0.065, 10, 8);
    for (let i = 0; i < 15; i++) {
      const angle = i * 2.399;
      const radius = 0.18 + 0.64 * Math.sqrt((i + 1) / 16);
      const seed = new THREE.Mesh(sesame, sesameMat);
      seed.scale.set(1.4, 0.45, 0.7);
      seed.position.set(Math.cos(angle) * radius, 1.02 - radius * radius * 0.36, Math.sin(angle) * radius * 0.92);
      seed.rotation.y = -angle;
      g.add(seed);
    }
    return g;
  }

  private createDetailedCola(): THREE.Group {
    const g = new THREE.Group();
    g.scale.set(1.32, 1.32, 1.32);
    const cupMat = new THREE.MeshPhysicalMaterial({ color: 0xe83d67, roughness: 0.23, clearcoat: 0.85, clearcoatRoughness: 0.16 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.49, 1.38, 40), cupMat);
    cup.position.y = 0.62;
    cup.castShadow = true;
    g.add(cup);

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.634, 0.51, 0.62, 40),
      new THREE.MeshStandardMaterial({ color: 0xfff4e8, roughness: 0.52 })
    );
    sleeve.position.y = 0.63;
    g.add(sleeve);

    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 256;
    logoCanvas.height = 128;
    const ctx = logoCanvas.getContext('2d')!;
    ctx.fillStyle = '#fff4e8';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#e83d67';
    ctx.beginPath();
    ctx.arc(128, 64, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8ed';
    ctx.font = '900 23px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RUSH', 128, 65);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.36), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(logoCanvas), transparent: true }));
    logo.position.set(0, 0.65, 0.59);
    g.add(logo);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.66, 0.12, 40), new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.25 }));
    lid.position.y = 1.37;
    lid.castShadow = true;
    g.add(lid);
    const sip = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 24), new THREE.MeshStandardMaterial({ color: 0x9a3153 }));
    sip.position.set(0, 1.438, 0);
    g.add(sip);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.86, 20), new THREE.MeshPhysicalMaterial({ color: 0x67e8f9, roughness: 0.22, clearcoat: 0.7 }));
    straw.position.set(0.15, 1.72, 0);
    straw.rotation.z = -0.22;
    g.add(straw);
    return g;
  }

  private createDetailedApple(): THREE.Group {
    const g = new THREE.Group();
    g.scale.set(1.32, 1.32, 1.32);
    const profile = [
      new THREE.Vector2(0.00, 0.08), new THREE.Vector2(0.24, 0.02), new THREE.Vector2(0.52, 0.12),
      new THREE.Vector2(0.77, 0.34), new THREE.Vector2(0.86, 0.65), new THREE.Vector2(0.78, 0.92),
      new THREE.Vector2(0.56, 1.13), new THREE.Vector2(0.3, 1.18), new THREE.Vector2(0.12, 1.07), new THREE.Vector2(0, 1.0)
    ];
    const appleMat = new THREE.MeshPhysicalMaterial({ color: 0xef4358, roughness: 0.2, clearcoat: 0.95, clearcoatRoughness: 0.12 });
    const apple = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), appleMat);
    apple.position.y = 0.18;
    apple.castShadow = true;
    g.add(apple);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.34, 12), new THREE.MeshStandardMaterial({ color: 0x59321e, roughness: 0.75 }));
    stem.position.set(0, 1.32, 0);
    stem.rotation.z = 0.2;
    g.add(stem);
    const leafMat = new THREE.MeshPhysicalMaterial({ color: 0x6da744, roughness: 0.35, clearcoat: 0.4 });
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 12), leafMat);
    leaf.scale.set(1.55, 0.24, 0.48);
    leaf.position.set(0.25, 1.36, 0.02);
    leaf.rotation.z = 0.42;
    g.add(leaf);
    const vein = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.38, 8), new THREE.MeshStandardMaterial({ color: 0xb9d879 }));
    vein.position.set(0.25, 1.36, 0.04);
    vein.rotation.z = 0.42;
    g.add(vein);

    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe8d9, transparent: true, opacity: 0.8 }));
    highlight.position.set(-0.44, 0.92, 0.48);
    highlight.scale.set(0.48, 1.45, 0.2);
    g.add(highlight);
    return g;
  }

  private createDetailedWater(): THREE.Group {
    const g = new THREE.Group();
    g.scale.set(1.35, 1.35, 1.35);
    const profile = [
      new THREE.Vector2(0, 0.04), new THREE.Vector2(0.31, 0.04), new THREE.Vector2(0.4, 0.12),
      new THREE.Vector2(0.42, 0.94), new THREE.Vector2(0.36, 1.12), new THREE.Vector2(0.2, 1.28),
      new THREE.Vector2(0.19, 1.48), new THREE.Vector2(0.23, 1.5), new THREE.Vector2(0.23, 1.67), new THREE.Vector2(0, 1.67)
    ];
    const bottleMat = new THREE.MeshPhysicalMaterial({ color: 0x8de1f5, roughness: 0.2, clearcoat: 0.95, clearcoatRoughness: 0.12, transparent: true, opacity: 0.78 });
    const bottle = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), bottleMat);
    bottle.position.y = 0.04;
    bottle.castShadow = true;
    g.add(bottle);

    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.35, 0.65, 32), new THREE.MeshPhysicalMaterial({ color: 0x28bde5, roughness: 0.16, transparent: true, opacity: 0.62, clearcoat: 1 }));
    water.position.y = 0.48;
    g.add(water);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.428, 0.423, 0.44, 40), new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.48 }));
    label.position.y = 0.67;
    g.add(label);
    const labelBand = new THREE.Mesh(new THREE.CylinderGeometry(0.433, 0.426, 0.09, 40), new THREE.MeshStandardMaterial({ color: 0x129ac4, roughness: 0.32 }));
    labelBand.position.y = 0.67;
    g.add(labelBand);
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.027, 8, 24), new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.3 }));
    mark.position.set(0, 0.68, 0.432);
    g.add(mark);
    const cap = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.21, 0.36, 3, 0.07), new THREE.MeshStandardMaterial({ color: 0x0c81aa, roughness: 0.35 }));
    cap.position.y = 1.77;
    cap.castShadow = true;
    g.add(cap);
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.018, 6, 24), new THREE.MeshStandardMaterial({ color: 0x08698f }));
      rib.rotation.x = Math.PI / 2;
      rib.position.y = 1.63 + i * 0.035;
      g.add(rib);
    }
    return g;
  }

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
    this.clock.getDelta();
    this.paused = false;
    try { soundSynth.startMusic('RUNNER'); } catch (e) {}
  }

  public setManualInputEnabled(enabled: boolean) {
    this.manualInputEnabled = enabled;
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

  private createBurstEffect(position: THREE.Vector3, color: number, count = 14) {
    const group = new THREE.Group();
    group.position.copy(position);
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      velocities.push(new THREE.Vector3((Math.random() - 0.5) * 7, 1.5 + Math.random() * 6, (Math.random() - 0.5) * 5));
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color, size: 0.28, transparent: true, opacity: 0.95, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(particles);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.045, 8, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    this.scene.add(group);
    this.burstEffects.push({ mesh: group, particles, ring, age: 0, lifetime: 0.62, velocities });
    if (this.burstEffects.length > 8) {
      const oldest = this.burstEffects.shift()!;
      this.disposeBurst(oldest);
    }
  }

  private disposeBurst(effect: BurstEffect) {
    this.scene.remove(effect.mesh);
    effect.particles.geometry.dispose();
    (effect.particles.material as THREE.Material).dispose();
    effect.ring.geometry.dispose();
    (effect.ring.material as THREE.Material).dispose();
  }

  private updateBurstEffects(dt: number) {
    for (let i = this.burstEffects.length - 1; i >= 0; i--) {
      const effect = this.burstEffects[i];
      effect.age += dt;
      const t = Math.min(1, effect.age / effect.lifetime);
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
      effect.ring.scale.setScalar(0.55 + t * 1.8);
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
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.updateBiome(dt);
    this.updateBurstEffects(dt);
    for (const portal of this.gatePortals) {
      const material = portal.material as THREE.MeshBasicMaterial;
      material.opacity = portal.userData.baseOpacity * (0.72 + Math.sin(this.clock.elapsedTime * 3.2) * 0.2);
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
    if (this.resizeTimeout !== null) clearTimeout(this.resizeTimeout);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.container.removeEventListener('touchstart', this.handleTouchStart);
    this.container.removeEventListener('touchend', this.handleTouchEnd);
    this.burstEffects.splice(0).forEach(effect => this.disposeBurst(effect));
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
