import * as THREE from 'three';
import { BodyStatus, BreakfastOption, ItemType, ActiveCombo, DecisionDoor } from '../types';
import { soundSynth } from '../audio/SoundSynth';

export interface Entity3D {
  mesh: THREE.Group;
  type: string;
  lane: number;
  z: number;
  altitude: number;
  doorInfo?: DecisionDoor;
  itemMesh?: THREE.Object3D;
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

  // Touch Tracking
  private touchStartX: number = 0;
  private touchStartY: number = 0;

  constructor(container: HTMLDivElement) {
    this.container = container;
    container.innerHTML = '';

    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();

    // Vibrant Candy Sunset Fog & Background
    this.scene.background = new THREE.Color(0xfde047).lerp(new THREE.Color(0xf472b6), 0.65);
    this.scene.fog = new THREE.FogExp2(0xfbcfe8, 0.0035);

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.domElement.style.width = '100vw';
    this.renderer.domElement.style.height = '100vh';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';

    container.appendChild(this.renderer.domElement);

    // Warm Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0xfff1f2, 1.1);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    sunLight.position.set(30, 50, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0xf472b6, 0.85);
    this.scene.add(hemiLight);

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
    
    // Rich chocolate wafer ground
    ctx.fillStyle = '#581c87';
    ctx.fillRect(0, 0, 512, 512);

    // Track lane surface
    ctx.fillStyle = '#701a75';
    ctx.fillRect(20, 0, 472, 512);

    // Checkered Curbs on Left & Right
    const checkSize = 32;
    for (let y = 0; y < 512; y += checkSize) {
      ctx.fillStyle = (y / checkSize) % 2 === 0 ? '#f43f5e' : '#ffffff';
      ctx.fillRect(0, y, 20, checkSize);
      ctx.fillRect(492, y, 20, checkSize);
    }

    // Glowing Lane Dividers
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(170, 0); ctx.lineTo(170, 512);
    ctx.moveTo(342, 0); ctx.lineTo(342, 512);
    ctx.stroke();

    // Center Gold Dash Lines
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.setLineDash([32, 32]);
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
      roughness: 0.35,
      metalness: 0.15
    });

    this.roadMesh = new THREE.Mesh(geometry, material);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.position.set(0, 0, -120);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);

    // Left and Right 3D Curbs Bars
    const curbGeo = new THREE.BoxGeometry(0.6, 0.4, 320);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 });
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
      this.scene.add(leftProp);
      this.sceneryProps.push(leftProp);

      rightProp.position.set(8.8 + Math.random() * 1.5, 0, z + 8);
      this.scene.add(rightProp);
      this.sceneryProps.push(rightProp);
    }
  }

  private createGlossyLollipop(colorHex: number): THREE.Group {
    const group = new THREE.Group();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 5.5, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    stick.position.y = 2.75;
    stick.castShadow = true;
    group.add(stick);

    const candy = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 32, 32),
      new THREE.MeshStandardMaterial({ 
        color: colorHex, 
        roughness: 0.1, 
        metalness: 0.2,
        emissive: colorHex,
        emissiveIntensity: 0.15
      })
    );
    candy.position.y = 5.8;
    candy.castShadow = true;
    group.add(candy);

    // Lollipop Swirl Ribbon
    const swirl = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, 0.1, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    swirl.position.y = 5.8;
    swirl.rotation.x = Math.PI / 4;
    group.add(swirl);

    return group;
  }

  private createCandyCane(): THREE.Group {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 4.5, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2 })
    );
    stem.position.y = 2.25;
    group.add(stem);

    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.3, 16, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    hook.position.set(-0.8, 4.5, 0);
    hook.rotation.z = Math.PI / 2;
    group.add(hook);

    return group;
  }

  private createGummyCrystal(colorHex: number): THREE.Group {
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6, 0),
      new THREE.MeshPhysicalMaterial({
        color: colorHex,
        roughness: 0.1,
        transmission: 0.75,
        opacity: 0.9,
        transparent: true,
        emissive: colorHex,
        emissiveIntensity: 0.25
      })
    );
    crystal.position.y = 2.0;
    crystal.scale.set(1.0, 1.8, 1.0);
    group.add(crystal);
    return group;
  }

  // --- 4. FLOATING CANDY SPARKLES & SPEED PARTICLES ---
  private buildSpeedParticles() {
    const particleCount = 120;
    const geometry = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      this.particlePositions[i * 3] = (Math.random() - 0.5) * 20;
      this.particlePositions[i * 3 + 1] = Math.random() * 8 + 0.5;
      this.particlePositions[i * 3 + 2] = -Math.random() * 160;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
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
      new THREE.BoxGeometry(1.2, 1.3, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25 })
    );
    this.playerTorso.position.y = 1.45;
    this.playerTorso.castShadow = true;
    this.playerMesh.add(this.playerTorso);

    const zipper = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.32, 0.77),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    zipper.position.y = 1.45;
    this.playerMesh.add(zipper);

    // 2. CANDY RUNNER BACKPACK
    this.playerBackpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.95, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 })
    );
    this.playerBackpack.position.set(0, 1.45, 0.52);
    this.playerBackpack.castShadow = true;
    this.playerMesh.add(this.playerBackpack);

    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.2, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
    );
    buckle.position.set(0, 1.45, 0.54);
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
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const shoeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const shoeColorMat = new THREE.MeshStandardMaterial({ color: 0xec4899 });

    this.leftLeg = new THREE.Group();
    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.6, 16), pantsMat);
    leftThigh.position.y = -0.3;
    this.leftLeg.add(leftThigh);
    const leftCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.45, 16), skinMat);
    leftCalf.position.y = -0.65;
    this.leftLeg.add(leftCalf);
    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.58), shoeColorMat);
    leftShoe.position.set(0, -0.92, -0.08);
    this.leftLeg.add(leftShoe);
    const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.62), shoeWhiteMat);
    leftSole.position.set(0, -1.03, -0.08);
    this.leftLeg.add(leftSole);
    this.leftLeg.position.set(-0.35, 0.95, 0);
    this.leftLeg.castShadow = true;
    this.playerMesh.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.6, 16), pantsMat);
    rightThigh.position.y = -0.3;
    this.rightLeg.add(rightThigh);
    const rightCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.45, 16), skinMat);
    rightCalf.position.y = -0.65;
    this.rightLeg.add(rightCalf);
    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.58), shoeColorMat);
    rightShoe.position.set(0, -0.92, -0.08);
    this.rightLeg.add(rightShoe);
    const rightSole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.62), shoeWhiteMat);
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
    this.playerShadow.position.y = 0.05;
    this.playerMesh.add(this.playerShadow);

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

    this.entities.push({ mesh: group, type, lane, z, altitude, doorInfo, itemMesh });
  }

  // --- 6. HIGH-END CANDY MODELS WITH RICH MATERIALS ---
  private createDetailedBurger(): THREE.Group {
    const g = new THREE.Group();
    g.scale.set(1.4, 1.4, 1.4);

    const bunTop = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.1 })
    );
    bunTop.position.y = 0.65;
    g.add(bunTop);

    const seedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const seedGeo = new THREE.BoxGeometry(0.08, 0.04, 0.12);
    for (let i = 0; i < 10; i++) {
      const seed = new THREE.Mesh(seedGeo, seedMat);
      const angle = (i / 10) * Math.PI * 2;
      seed.position.set(Math.cos(angle) * 0.55, 0.98, Math.sin(angle) * 0.55);
      seed.rotation.y = angle;
      g.add(seed);
    }

    const cheese = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.1, 1.3),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.15 })
    );
    cheese.position.y = 0.5;
    cheese.rotation.y = Math.PI / 4;
    g.add(cheese);

    const patty = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 0.32, 32),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 })
    );
    patty.position.y = 0.3;
    g.add(patty);

    const lettuce = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.05, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3 })
    );
    lettuce.position.y = 0.15;
    g.add(lettuce);

    const bunBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.85, 0.25, 32),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.35 })
    );
    bunBottom.position.y = 0.0;
    g.add(bunBottom);

    return g;
  }

  private createDetailedCola(): THREE.Group {
    const g = new THREE.Group();
    g.scale.set(1.4, 1.4, 1.4);

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.48, 1.4, 32),
      new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.15, emissive: 0xec4899, emissiveIntensity: 0.1 })
    );
    cup.position.y = 0.6;
    g.add(cup);

    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.56, 0.35, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    stripe.position.y = 0.6;
    g.add(stripe);

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 0.15, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    lid.position.y = 1.35;
    g.add(lid);

    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 })
    );
    straw.position.set(0.15, 1.7, 0);
    straw.rotation.z = -0.25;
    g.add(straw);

    return g;
  }

  private createDetailedApple(): THREE.Group {
    const g = new THREE.Group();
    g.scale.set(1.5, 1.5, 1.5);

    const apple = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 32, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xef4444, 
        roughness: 0.1, 
        metalness: 0.15,
        emissive: 0xef4444,
        emissiveIntensity: 0.1
      })
    );
    apple.scale.set(1.0, 0.92, 1.0);
    apple.position.y = 0.6;
    g.add(apple);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 0.35, 12),
      new THREE.MeshStandardMaterial({ color: 0x78350f })
    );
    stem.position.set(0, 1.35, 0);
    stem.rotation.z = 0.2;
    g.add(stem);

    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3 })
    );
    leaf.scale.set(1.5, 0.3, 0.7);
    leaf.position.set(0.2, 1.35, 0);
    leaf.rotation.z = 0.4;
    g.add(leaf);

    return g;
  }

  private createDetailedWater(): THREE.Group {
    const g = new THREE.Group();
    g.scale.set(1.4, 1.4, 1.4);

    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 1.3, 32),
      new THREE.MeshPhysicalMaterial({ 
        color: 0x38bdf8, 
        transparent: true, 
        opacity: 0.85, 
        roughness: 0.08, 
        transmission: 0.75,
        ior: 1.33
      })
    );
    bottle.position.y = 0.65;
    g.add(bottle);

    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.49, 0.49, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    label.position.y = 0.65;
    g.add(label);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 })
    );
    cap.position.y = 1.38;
    g.add(cap);

    return g;
  }

  private createDetailedHurdle(): THREE.Group {
    const group = new THREE.Group();
    group.scale.set(1.2, 1.2, 1.2);

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.6, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 })
    );
    bar.position.y = 0.85;
    bar.castShadow = true;
    group.add(bar);

    const stripeMat1 = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.15 });
    const stripeMat2 = new THREE.MeshStandardMaterial({ color: 0xffffff });

    for (let x = -1.2; x <= 1.2; x += 0.6) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.62, 0.42), x % 1.2 === 0 ? stripeMat1 : stripeMat2);
      stripe.position.set(x, 0.85, 0);
      group.add(stripe);
    }

    const postMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 16), postMat);
    p1.position.set(-1.3, 0.45, 0);
    group.add(p1);

    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 16), postMat);
    p2.position.set(1.3, 0.45, 0);
    group.add(p2);

    return group;
  }

  private createDetailedStar(): THREE.Group {
    const group = new THREE.Group();
    group.scale.set(1.5, 1.5, 1.5);

    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1, 0),
      new THREE.MeshStandardMaterial({ 
        color: 0xfde047, 
        metalness: 0.85, 
        roughness: 0.1,
        emissive: 0xfde047,
        emissiveIntensity: 0.35
      })
    );
    group.add(star);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.08, 16, 32),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    return group;
  }

  private createDetailedGate(door: DecisionDoor): THREE.Group {
    const group = new THREE.Group();

    const pillarColor = door.type === 'FAST_FOOD' ? 0xf97316 : door.type === 'HEALTHY' ? 0x22c55e : 0x0284c7;
    const pillarMat = new THREE.MeshStandardMaterial({ 
      color: pillarColor, 
      roughness: 0.2,
      emissive: pillarColor,
      emissiveIntensity: 0.25
    });

    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6.0, 16), pillarMat);
    p1.position.set(-1.6, 3.0, 0);
    p1.castShadow = true;
    group.add(p1);

    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6.0, 16), pillarMat);
    p2.position.set(1.6, 3.0, 0);
    p2.castShadow = true;
    group.add(p2);

    const crossbar = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    crossbar.position.y = 5.8;
    group.add(crossbar);

    const bannerTex = this.getGateBannerTexture(door);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.2,
      side: THREE.DoubleSide
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.65), bannerMat);
    banner.position.y = 4.8;
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
    if (this.isJumping) {
      this.playerY += this.jumpVelocity * dt;
      this.jumpVelocity -= 36.0 * dt;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.isJumping = false;
        this.jumpVelocity = 0;
      }
    }
    this.playerMesh.position.y = this.playerY;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.targetX * 0.25, 8 * dt);

    // Update Entities Movement & Collision
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.z += effectiveSpeed * dt;
      e.mesh.position.z = e.z;

      if (e.itemMesh && e.type !== 'OBSTACLE_LOW' && !e.doorInfo) {
        e.itemMesh.rotation.y += 2.0 * dt;
        if (e.altitude === 1) {
          e.itemMesh.position.y = 4.6 + Math.sin(this.runAnimTimer + i) * 0.25;
        }
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
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
