import Phaser from 'phaser';
import { BodyStatus, BreakfastOption, ItemType, ActiveCombo, DecisionDoor } from '../types';
import { soundSynth } from '../audio/SoundSynth';

interface Entity3D {
  sprite: Phaser.GameObjects.Sprite;
  type: string;
  lane: number;
  z: number; // 0.0 (Horizon) -> 1.0 (Camera Foreground)
  altitude: number; // 0: Ground, 1: Mid-air floating
  doorInfo?: DecisionDoor;
}

export class MainRunScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  
  // 3D Perspective Lanes (At Horizon vs At Camera)
  private horizonLanes: number[] = [450, 512, 574]; // Tight at horizon (Z=0)
  private foregroundLanes: number[] = [240, 512, 784]; // Wide fanned out at player (Z=1)
  
  private currentLane: number = 1;
  private isJumping: boolean = false;
  private jumpProgress: number = 0; // 0 -> 1 jump arc
  private playerYOffset: number = 0;

  // Body Status Engine
  public status: BodyStatus = {
    energy: 60,
    sugar: 20,
    stamina: 70,
    mood: 60
  };

  // Run Stats
  public distance: number = 0;
  public score: number = 0;
  public baseSpeed: number = 1.2; // Relaxed control speed
  public speedMultiplier: number = 1.0;
  private isEnergyCrashed: boolean = false;
  private energyCrashTimer: number = 0;

  // Combo System
  public comboHistory: string[] = [];
  public activeCombo: ActiveCombo = {
    type: 'NONE',
    count: 0,
    multiplier: 1,
    timer: 0
  };

  // World Environment State
  public isSugarCity: boolean = false;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private roadScrollZ: number = 0;

  // In-Game Canvas HUD Text Objects
  private hudTextEnergy!: Phaser.GameObjects.Text;
  private hudTextSugar!: Phaser.GameObjects.Text;
  private hudTextStamina!: Phaser.GameObjects.Text;
  private hudTextMood!: Phaser.GameObjects.Text;
  private hudTextStats!: Phaser.GameObjects.Text;

  // 3D Entities Active Pool
  private entities3D: Entity3D[] = [];
  private nextGateDistance: number = 300;
  private nextBossDistance: number = 800;

  constructor() {
    super({ key: 'MainRunScene' });
  }

  init(data: { breakfast?: BreakfastOption }) {
    this.distance = 0;
    this.score = 0;
    this.currentLane = 1;
    this.speedMultiplier = 1.0;
    this.isEnergyCrashed = false;
    this.energyCrashTimer = 0;
    this.comboHistory = [];
    this.activeCombo = { type: 'NONE', count: 0, multiplier: 1, timer: 0 };
    this.nextGateDistance = 300;
    this.nextBossDistance = 800;
    this.entities3D = [];

    const breakfast = data.breakfast || 'OATMEAL';
    if (breakfast === 'DONUT') {
      this.status = { energy: 65, sugar: 35, stamina: 55, mood: 55 };
      this.speedMultiplier = 1.05;
    } else if (breakfast === 'OATMEAL') {
      this.status = { energy: 60, sugar: 15, stamina: 80, mood: 65 };
      this.speedMultiplier = 1.0;
    } else if (breakfast === 'EGG') {
      this.status = { energy: 75, sugar: 20, stamina: 75, mood: 55 };
      this.speedMultiplier = 1.0;
    }
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.bgGraphics = this.add.graphics();
    this.roadGraphics = this.add.graphics();
    this.hudGraphics = this.add.graphics().setDepth(100);

    // Player 3D Foreground Sprite
    this.player = this.add.sprite(this.foregroundLanes[1], 500, 'player').setScale(1.4);
    this.player.setDepth(50);

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-LEFT', () => this.moveLane(-1));
      this.input.keyboard.on('keydown-A', () => this.moveLane(-1));
      this.input.keyboard.on('keydown-RIGHT', () => this.moveLane(1));
      this.input.keyboard.on('keydown-D', () => this.moveLane(1));
      this.input.keyboard.on('keydown-UP', () => this.jump());
      this.input.keyboard.on('keydown-SPACE', () => this.jump());
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < width / 3) {
        this.moveLane(-1);
      } else if (pointer.x > (width * 2) / 3) {
        this.moveLane(1);
      } else {
        this.jump();
      }
    });

    this.createCanvasHUD();

    // Spawn initial 3D entities
    this.spawnEntity3D('BURGER', 0, 0.2, 0);
    this.spawnEntity3D('OBSTACLE_LOW', 1, 0.4, 0); // Ground Hurdle (Must Jump!)
    this.spawnEntity3D('STAR_HIGH', 2, 0.6, 1);    // Mid-air Star (Must Jump!)

    soundSynth.startMusic('RUNNER');
  }

  private createCanvasHUD() {
    const style = { font: 'bold 13px "Press Start 2P", monospace', color: '#ffffff' };

    this.hudTextEnergy = this.add.text(20, 16, '', style).setDepth(101);
    this.hudTextSugar = this.add.text(270, 16, '', style).setDepth(101);
    this.hudTextStamina = this.add.text(520, 16, '', style).setDepth(101);
    this.hudTextMood = this.add.text(770, 16, '', style).setDepth(101);

    this.hudTextStats = this.add.text(20, 52, '', {
      font: 'bold 14px "Press Start 2P", monospace',
      color: '#fde047'
    }).setDepth(101);
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;

    const effectiveSpeed = this.baseSpeed * this.speedMultiplier * (this.isEnergyCrashed ? 0.4 : 1.0);
    this.distance += Math.floor(effectiveSpeed);
    this.score += Math.floor(effectiveSpeed * this.activeCombo.multiplier * (this.status.mood / 50));

    // Player 3D Lane Smooth Lerp
    const targetX = this.foregroundLanes[this.currentLane];
    this.player.x = Phaser.Math.Linear(this.player.x, targetX, 0.25);

    // 3D Jump Arc Animation
    if (this.isJumping) {
      this.jumpProgress += 2.2 * dt;
      this.playerYOffset = Math.sin(this.jumpProgress * Math.PI) * -110; // High 3D Jump Arc
      if (this.jumpProgress >= 1) {
        this.isJumping = false;
        this.jumpProgress = 0;
        this.playerYOffset = 0;
      }
    }
    this.player.y = 500 + this.playerYOffset;

    // Body Status Decay
    this.status.energy = Math.max(0, this.status.energy - 0.3 * dt);
    this.status.stamina = Math.max(0, Math.min(100, this.status.stamina - 0.15 * dt));
    this.status.sugar = Math.max(0, this.status.sugar - 0.25 * dt);

    if (this.status.energy <= 0 || (this.status.sugar > 85 && Math.random() < 0.002)) {
      if (!this.isEnergyCrashed) {
        this.triggerEnergyCrash();
      }
    }

    if (this.isEnergyCrashed) {
      this.energyCrashTimer -= dt;
      if (this.energyCrashTimer <= 0) {
        this.isEnergyCrashed = false;
      }
    }

    const lifestyleScore = (this.status.stamina + this.status.mood + (100 - this.status.sugar)) / 3;
    this.isSugarCity = lifestyleScore < 50;

    // Render 3D Perspective Road & Background
    this.draw3DRoad(effectiveSpeed);

    // Update 3D Entities Projection & Collision
    this.update3DEntities(dt, effectiveSpeed);

    // Random Spawn 3D Entities
    if (this.entities3D.length < 5 && Math.random() < 0.035) {
      const lane = Phaser.Math.Between(0, 2);
      const rand = Math.random();
      if (rand < 0.3) {
        this.spawnEntity3D('OBSTACLE_LOW', lane, 0.05, 0); // Ground barrier (Jump required!)
      } else if (rand < 0.5) {
        this.spawnEntity3D('STAR_HIGH', lane, 0.05, 1);    // Mid-air star (Jump required!)
      } else {
        const itemTypes = ['BURGER', 'COLA', 'APPLE', 'WATER', 'ENERGY_DRINK', 'EXERCISE', 'SLEEP'];
        const chosen = itemTypes[Phaser.Math.Between(0, itemTypes.length - 1)];
        this.spawnEntity3D(chosen, lane, 0.05, 0);
      }
    }

    // Spawn 3D Decision Gates
    if (this.distance >= this.nextGateDistance && !this.entities3D.some(e => e.type.startsWith('DOOR_'))) {
      this.spawn3DDecisionGates();
      this.nextGateDistance += 550;
    }

    if (this.distance >= this.nextBossDistance) {
      this.triggerBossFight();
    }

    this.drawCanvasHUD();

    window.dispatchEvent(new CustomEvent('body-rush-hud-update', {
      detail: {
        status: { ...this.status },
        distance: this.distance,
        score: this.score,
        combo: { ...this.activeCombo },
        isSugarCity: this.isSugarCity,
        isEnergyCrashed: this.isEnergyCrashed
      }
    }));
  }

  private moveLane(dir: number) {
    this.currentLane = Phaser.Math.Clamp(this.currentLane + dir, 0, 2);
    soundSynth.playJump();
  }

  private jump() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.jumpProgress = 0;
      soundSynth.playJump();
    }
  }

  private triggerEnergyCrash() {
    this.isEnergyCrashed = true;
    this.energyCrashTimer = 5.0;
    soundSynth.playCrashWarning();
    this.cameras.main.shake(300, 0.015);
  }

  // --- 3D PERSPECTIVE RENDERING ENGINE ---
  private draw3DRoad(speed: number) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const horizonY = 180;
    const groundHeight = height - horizonY;

    // 1. Draw 3D Sky Background
    this.bgGraphics.clear();
    if (this.isSugarCity) {
      this.bgGraphics.fillGradientStyle(0xf472b6, 0xf472b6, 0xf0abfc, 0xf43f5e, 1);
    } else {
      this.bgGraphics.fillGradientStyle(0x7dd3fc, 0x7dd3fc, 0xfbcfe8, 0xf472b6, 1);
    }
    this.bgGraphics.fillRect(0, 0, width, horizonY);

    // 3D Clouds
    this.bgGraphics.fillStyle(0xffffff, 0.85);
    this.bgGraphics.fillCircle(150, 80, 40);
    this.bgGraphics.fillCircle(190, 75, 50);
    this.bgGraphics.fillCircle(820, 90, 45);

    // 2. Draw 3D Ground & Trapezoidal Fanned Road
    this.roadGraphics.clear();

    // Grass / Candy Out-of-Bounds Field
    this.roadGraphics.fillStyle(this.isSugarCity ? 0x701a75 : 0xa7f3d0, 1);
    this.roadGraphics.fillRect(0, horizonY, width, groundHeight);

    // 3D Chocolate Road Quad (Fanning out from Horizon [380, 644] down to Camera [120, 904])
    this.roadGraphics.fillStyle(this.isSugarCity ? 0x831843 : 0x78350f, 1);
    this.roadGraphics.beginPath();
    this.roadGraphics.moveTo(380, horizonY);
    this.roadGraphics.lineTo(644, horizonY);
    this.roadGraphics.lineTo(904, height);
    this.roadGraphics.lineTo(120, height);
    this.roadGraphics.closePath();
    this.roadGraphics.fillPath();

    // 3D Perspective Lane Divider Lines
    this.roadGraphics.lineStyle(4, this.isSugarCity ? 0xff66cc : 0xffffff, 0.9);
    this.roadGraphics.lineBetween(380, horizonY, 120, height);
    this.roadGraphics.lineBetween(468, horizonY, 380, height);
    this.roadGraphics.lineBetween(556, horizonY, 644, height);
    this.roadGraphics.lineBetween(644, horizonY, 904, height);

    // Moving 3D Horizontal Wafer Stripes
    this.roadScrollZ = (this.roadScrollZ + speed * 0.08) % 1.0;
    for (let i = 0; i < 8; i++) {
      let z = (this.roadScrollZ + i / 8) % 1.0;
      let y = horizonY + groundHeight * Math.pow(z, 2.0);
      let leftX = Phaser.Math.Linear(380, 120, z);
      let rightX = Phaser.Math.Linear(644, 904, z);

      this.roadGraphics.lineStyle(Math.max(1, Math.floor(z * 4)), 0xfcd34d, 0.8);
      this.roadGraphics.lineBetween(leftX, y, rightX, y);
    }
  }

  // --- 3D ENTITY PROJECTION & MOVEMENT ---
  private spawnEntity3D(type: string, lane: number, z: number = 0.05, altitude: number = 0, doorInfo?: DecisionDoor) {
    const sprite = this.add.sprite(512, 180, type);
    sprite.setDepth(Math.floor(z * 40));
    this.entities3D.push({ sprite, type, lane, z, altitude, doorInfo });
  }

  private spawn3DDecisionGates() {
    const doors: DecisionDoor[] = [
      { id: '1', title: 'FAST FOOD', subtitle: '+Energy / +Sugar', type: 'FAST_FOOD', icon: 'DOOR_FAST_FOOD', statsEffect: 'Energy+20 Sugar+15' },
      { id: '2', title: 'HEALTHY', subtitle: '+Stamina / +Mood', type: 'HEALTHY', icon: 'DOOR_HEALTHY', statsEffect: 'Stamina+15 Mood+10' },
      { id: '3', title: 'MYSTERY', subtitle: '? Surprise Buff ?', type: 'MYSTERY', icon: 'DOOR_MYSTERY', statsEffect: 'Random Boost' }
    ];

    doors.forEach((door, idx) => {
      this.spawnEntity3D(door.icon, idx, 0.05, 0, door);
    });
  }

  private update3DEntities(dt: number, speed: number) {
    const horizonY = 180;
    const playerY = 500;

    for (let i = this.entities3D.length - 1; i >= 0; i--) {
      const entity = this.entities3D[i];
      entity.z += speed * 0.12 * dt; // Advance along 3D Z depth

      // Calculate 3D projected screen coordinates
      const laneX = Phaser.Math.Linear(this.horizonLanes[entity.lane], this.foregroundLanes[entity.lane], Math.pow(entity.z, 1.8));
      const projY = horizonY + (playerY - horizonY) * Math.pow(entity.z, 2.0);
      const projScale = 0.15 + 1.4 * Math.pow(entity.z, 2.2);

      // Mid-Air altitude offset
      const altOffset = entity.altitude === 1 ? -80 * projScale : 0;

      entity.sprite.x = laneX;
      entity.sprite.y = projY + altOffset;
      entity.sprite.setScale(projScale);
      entity.sprite.setDepth(Math.floor(entity.z * 45));

      // Check 3D Collisions at Camera Foreground (z >= 0.85)
      if (entity.z >= 0.85 && entity.z <= 0.98 && entity.lane === this.currentLane) {
        
        // GROUND OBSTACLE (Must JUMP over!)
        if (entity.type === 'OBSTACLE_LOW') {
          if (!this.isJumping) {
            // Player TRIPPED over low hurdle!
            soundSynth.playCrashWarning();
            this.status.stamina = Math.max(0, this.status.stamina - 15);
            this.cameras.main.shake(200, 0.02);
            entity.sprite.destroy();
            this.entities3D.splice(i, 1);
            continue;
          }
        } 
        // HIGH MID-AIR STAR (Must JUMP to reach!)
        else if (entity.type === 'STAR_HIGH') {
          if (this.isJumping) {
            soundSynth.playComboSound();
            this.score += 500;
            this.status.stamina = Math.min(100, this.status.stamina + 15);
            entity.sprite.destroy();
            this.entities3D.splice(i, 1);
            continue;
          }
        }
        // DECISION DOORS
        else if (entity.doorInfo) {
          this.enterGate(entity.doorInfo);
          // Clear all active doors
          this.entities3D.filter(e => e.doorInfo).forEach(e => e.sprite.destroy());
          this.entities3D = this.entities3D.filter(e => !e.doorInfo);
          break;
        }
        // REGULAR FOOD PICKUPS
        else if (!this.isJumping) {
          this.collectItem(entity.type);
          entity.sprite.destroy();
          this.entities3D.splice(i, 1);
          continue;
        }
      }

      // Remove entities beyond camera foreground
      if (entity.z > 1.05) {
        entity.sprite.destroy();
        this.entities3D.splice(i, 1);
      }
    }
  }

  private collectItem(type: string) {
    soundSynth.playPickup(type);

    this.comboHistory.push(type);
    if (this.comboHistory.length > 3) this.comboHistory.shift();

    const isHealthy = (t: string) => t === 'APPLE' || t === 'WATER' || t === 'EXERCISE';
    const isCrash = (t: string) => t === 'BURGER' || t === 'COLA';

    if (this.comboHistory.length >= 3 && this.comboHistory.every(isHealthy)) {
      this.activeCombo = { type: 'HEALTHY', count: 3, multiplier: 2.5, timer: 8.0 };
      soundSynth.playComboSound();
      this.status.stamina = Math.min(100, this.status.stamina + 10);
    } else if (this.comboHistory.length >= 3 && this.comboHistory.every(isCrash)) {
      this.activeCombo = { type: 'CRASH', count: 3, multiplier: 0.5, timer: 8.0 };
      soundSynth.playCrashWarning();
      this.status.sugar = Math.min(100, this.status.sugar + 20);
    }

    switch (type) {
      case 'BURGER':
        this.status.energy = Math.min(100, this.status.energy + 20);
        this.status.sugar = Math.min(100, this.status.sugar + 10);
        this.status.stamina = Math.max(0, this.status.stamina - 5);
        break;
      case 'COLA':
        this.status.sugar = Math.min(100, this.status.sugar + 25);
        this.speedMultiplier = 1.25;
        this.time.delayedCall(4000, () => { this.speedMultiplier = 1.0; });
        break;
      case 'APPLE':
        this.status.energy = Math.min(100, this.status.energy + 8);
        this.status.sugar = Math.min(100, this.status.sugar + 2);
        this.status.stamina = Math.min(100, this.status.stamina + 6);
        break;
      case 'WATER':
        this.status.mood = Math.min(100, this.status.mood + 10);
        this.status.stamina = Math.min(100, this.status.stamina + 5);
        this.status.sugar = Math.max(0, this.status.sugar - 15);
        break;
      case 'ENERGY_DRINK':
        this.status.energy = Math.min(100, this.status.energy + 25);
        this.status.sugar = Math.min(100, this.status.sugar + 15);
        break;
      case 'EXERCISE':
        this.status.stamina = Math.min(100, this.status.stamina + 12);
        this.status.mood = Math.min(100, this.status.mood + 8);
        this.status.energy = Math.max(0, this.status.energy - 5);
        break;
      case 'SLEEP':
        this.status.stamina = Math.min(100, this.status.stamina + 25);
        this.status.sugar = Math.max(0, this.status.sugar - 25);
        this.isEnergyCrashed = false;
        break;
    }
  }

  private enterGate(door: DecisionDoor) {
    soundSynth.playComboSound();
    if (door.type === 'FAST_FOOD') {
      this.status.energy = Math.min(100, this.status.energy + 25);
      this.status.sugar = Math.min(100, this.status.sugar + 20);
    } else if (door.type === 'HEALTHY') {
      this.status.stamina = Math.min(100, this.status.stamina + 20);
      this.status.mood = Math.min(100, this.status.mood + 15);
      this.status.sugar = Math.max(0, this.status.sugar - 15);
    } else {
      this.status.energy = 85;
      this.status.stamina = 85;
      this.status.mood = 85;
    }
  }

  private triggerBossFight() {
    this.scene.pause();

    let bossType: string = 'SUGAR_BEAST';
    if (this.status.sugar > 60) {
      bossType = 'SUGAR_BEAST';
    } else if (this.status.stamina < 40) {
      bossType = 'COUCH_MONSTER';
    } else {
      bossType = 'ENERGY_CRASH';
    }

    this.nextBossDistance += 1000;
    soundSynth.startMusic('BOSS');
    this.scene.launch('BossScene', { bossType, status: this.status, score: this.score });
  }

  public resumeFromBoss(won: boolean, bonusScore: number) {
    this.score += bonusScore;
    soundSynth.startMusic('RUNNER');
    this.scene.resume();
  }

  private drawCanvasHUD() {
    this.hudGraphics.clear();

    this.hudGraphics.fillStyle(0x0f172a, 0.85);
    this.hudGraphics.fillRoundedRect(10, 8, 1004, 72, 12);
    this.hudGraphics.lineStyle(3, 0xf472b6, 0.9);
    this.hudGraphics.strokeRoundedRect(10, 8, 1004, 72, 12);

    const energyWidth = (Math.max(0, Math.min(100, this.status.energy)) / 100) * 110;
    this.hudGraphics.fillStyle(0x334155, 1);
    this.hudGraphics.fillRect(130, 16, 110, 16);
    this.hudGraphics.fillStyle(0xeab308, 1);
    this.hudGraphics.fillRect(130, 16, energyWidth, 16);
    this.hudGraphics.lineStyle(1, 0xffffff, 0.8);
    this.hudGraphics.strokeRect(130, 16, 110, 16);
    this.hudTextEnergy.setText(`NRG:${Math.round(this.status.energy)}%`);

    const sugarWidth = (Math.max(0, Math.min(100, this.status.sugar)) / 100) * 110;
    this.hudGraphics.fillStyle(0x334155, 1);
    this.hudGraphics.fillRect(380, 16, 110, 16);
    this.hudGraphics.fillStyle(this.status.sugar > 75 ? 0xef4444 : 0xec4899, 1);
    this.hudGraphics.fillRect(380, 16, sugarWidth, 16);
    this.hudGraphics.lineStyle(1, 0xffffff, 0.8);
    this.hudGraphics.strokeRect(380, 16, 110, 16);
    this.hudTextSugar.setText(`SGR:${Math.round(this.status.sugar)}%`);

    const staminaWidth = (Math.max(0, Math.min(100, this.status.stamina)) / 100) * 110;
    this.hudGraphics.fillStyle(0x334155, 1);
    this.hudGraphics.fillRect(630, 16, 110, 16);
    this.hudGraphics.fillStyle(0x06b6d4, 1);
    this.hudGraphics.fillRect(630, 16, staminaWidth, 16);
    this.hudGraphics.lineStyle(1, 0xffffff, 0.8);
    this.hudGraphics.strokeRect(630, 16, 110, 16);
    this.hudTextStamina.setText(`STM:${Math.round(this.status.stamina)}%`);

    const moodWidth = (Math.max(0, Math.min(100, this.status.mood)) / 100) * 110;
    this.hudGraphics.fillStyle(0x334155, 1);
    this.hudGraphics.fillRect(870, 16, 110, 16);
    this.hudGraphics.fillStyle(0xa855f7, 1);
    this.hudGraphics.fillRect(870, 16, moodWidth, 16);
    this.hudGraphics.lineStyle(1, 0xffffff, 0.8);
    this.hudGraphics.strokeRect(870, 16, 110, 16);
    this.hudTextMood.setText(`MOD:${Math.round(this.status.mood)}%`);

    this.hudTextStats.setText(`DIST: ${this.distance}m  |  SCORE: ${this.score.toLocaleString()}  |  WORLD: ${this.isSugarCity ? 'DONUT CITY' : 'CANDY KINGDOM'}`);
  }
}
