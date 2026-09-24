import Phaser from 'phaser';
import { BodyStatus } from '../types';
import { soundSynth } from '../audio/SoundSynth';
import confetti from 'canvas-confetti';

export class BossScene extends Phaser.Scene {
  private bossType: string = 'SUGAR_BEAST';
  private bossSprite!: Phaser.GameObjects.Sprite;
  private status!: BodyStatus;
  private qteProgress: number = 0;
  private timeLeft: number = 15;
  private timerEvent!: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'BossScene' });
  }

  init(data: { bossType: string; status: BodyStatus; score: number }) {
    this.bossType = data.bossType || 'SUGAR_BEAST';
    this.status = data.status || { energy: 50, sugar: 50, stamina: 50, mood: 50 };
    this.qteProgress = 0;
    this.timeLeft = 15;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Translucent Candy Purple/Pink Boss Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x581c87, 0.75);

    const bossTitleMap: { [key: string]: { name: string; desc: string; texture: string } } = {
      SUGAR_BEAST: { name: 'BOSS: SUGAR BEAST', desc: 'Maintain Sugar level in GREEN TARGET ZONE (35-65)!', texture: 'sugar_beast' },
      COUCH_MONSTER: { name: 'BOSS: COUCH MONSTER', desc: 'MASH SPACEBAR / RUN BUTTON TO BREAK FREE!', texture: 'couch_monster' },
      ENERGY_CRASH: { name: 'BOSS: ENERGY CRASH', desc: 'COLLECT 5 WATER ORBS TO RECOVER FROM CRASH!', texture: 'energy_crash' }
    };

    const info = bossTitleMap[this.bossType] || bossTitleMap.SUGAR_BEAST;

    this.add.text(width / 2, 55, info.name, {
      font: 'bold 30px "Press Start 2P", monospace',
      color: '#f472b6'
    }).setOrigin(0.5);

    this.add.text(width / 2, 95, info.desc, {
      font: '16px "Chakra Petch", sans-serif',
      color: '#7dd3fc'
    }).setOrigin(0.5);

    this.bossSprite = this.add.sprite(width / 2, 210, info.texture).setScale(2.4);
    this.tweens.add({
      targets: this.bossSprite,
      y: 220,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const timerTxt = this.add.text(width / 2, 305, `TIME LEFT: 15s`, {
      font: 'bold 20px "Press Start 2P", monospace',
      color: '#fde047'
    }).setOrigin(0.5);

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: 14,
      callback: () => {
        this.timeLeft--;
        timerTxt.setText(`TIME LEFT: ${this.timeLeft}s`);
        if (this.timeLeft <= 0) {
          this.finishBoss(true);
        }
      }
    });

    if (this.bossType === 'SUGAR_BEAST') {
      this.setupSugarBeastMechanic();
    } else if (this.bossType === 'COUCH_MONSTER') {
      this.setupCouchMonsterQTE();
    } else {
      this.setupEnergyCrashMechanic();
    }
  }

  private setupSugarBeastMechanic() {
    const width = this.cameras.main.width;
    const barBg = this.add.rectangle(width / 2, 390, 500, 42, 0xffffff).setStrokeStyle(3, 0xf472b6);
    const targetZone = this.add.rectangle(width / 2, 390, 180, 34, 0x22c55e, 0.6);
    const sugarPin = this.add.rectangle(width / 2, 390, 14, 50, 0xdb2777);

    this.time.addEvent({
      delay: 1200,
      repeat: 10,
      callback: () => {
        const itemType = Math.random() > 0.5 ? 'apple' : 'cola';
        const item = this.add.sprite(Phaser.Math.Between(160, width - 160), 330, itemType)
          .setScale(1.6)
          .setInteractive({ useHandCursor: true });

        item.on('pointerdown', () => {
          soundSynth.playPickup(itemType === 'apple' ? 'APPLE' : 'COLA');
          if (itemType === 'apple') {
            this.status.sugar = Math.max(0, this.status.sugar - 8);
          } else {
            this.status.sugar = Math.min(100, this.status.sugar + 12);
          }
          item.destroy();
        });

        this.tweens.add({
          targets: item,
          y: 500,
          duration: 2500,
          onComplete: () => item.destroy()
        });
      }
    });

    this.events.on('update', () => {
      const pinX = (width / 2 - 250) + (this.status.sugar / 100) * 500;
      sugarPin.x = pinX;
    });
  }

  private setupCouchMonsterQTE() {
    const width = this.cameras.main.width;
    const barBg = this.add.rectangle(width / 2, 390, 500, 44, 0xffffff).setStrokeStyle(3, 0xef4444);
    const qteFill = this.add.rectangle(width / 2 - 245, 390, 0, 36, 0x22c55e).setOrigin(0, 0.5);

    const mashBtn = this.add.rectangle(width / 2, 490, 300, 60, 0xf472b6)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(4, 0xffffff);

    this.add.text(width / 2, 490, 'TAP / MASH RUN!', {
      font: 'bold 20px "Press Start 2P", monospace',
      color: '#ffffff'
    }).setOrigin(0.5);

    const doMash = () => {
      soundSynth.playQTEMash();
      this.qteProgress = Math.min(100, this.qteProgress + 14);
      qteFill.width = (this.qteProgress / 100) * 490;
      this.cameras.main.shake(100, 0.008);

      if (this.qteProgress >= 100) {
        this.finishBoss(true);
      }
    };

    mashBtn.on('pointerdown', doMash);
    this.input.keyboard?.on('keydown-SPACE', doMash);

    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        this.qteProgress = Math.max(0, this.qteProgress - 3);
        qteFill.width = (this.qteProgress / 100) * 490;
      }
    });
  }

  private setupEnergyCrashMechanic() {
    const width = this.cameras.main.width;
    let collectedCount = 0;

    const countTxt = this.add.text(width / 2, 360, `ORBS COLLECTED: 0 / 5`, {
      font: 'bold 20px "Press Start 2P", monospace',
      color: '#7dd3fc'
    }).setOrigin(0.5);

    for (let i = 0; i < 5; i++) {
      const orb = this.add.sprite(Phaser.Math.Between(180, width - 180), Phaser.Math.Between(410, 520), 'water')
        .setScale(1.8)
        .setInteractive({ useHandCursor: true });

      orb.on('pointerdown', () => {
        soundSynth.playPickup('WATER');
        collectedCount++;
        countTxt.setText(`ORBS COLLECTED: ${collectedCount} / 5`);
        orb.destroy();
        if (collectedCount >= 5) {
          this.finishBoss(true);
        }
      });
    }
  }

  private finishBoss(won: boolean) {
    if (this.timerEvent) this.timerEvent.remove();

    if (won) {
      soundSynth.playBossHit();
      soundSynth.playComboSound();

      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}

      const mainScene = this.scene.get('MainRunScene') as any;
      this.scene.stop();
      mainScene.resumeFromBoss(true, 1000);
    } else {
      soundSynth.playGameOver();
      const mainScene = this.scene.get('MainRunScene') as any;
      this.scene.stop();
      mainScene.resumeFromBoss(false, 200);
    }
  }
}
