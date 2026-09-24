import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 30,
      text: 'LOADING 3D CANDY WORLD...',
      style: {
        font: '22px "Press Start 2P", monospace',
        color: '#f472b6'
      }
    }).setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0xfce7f3, 0.9);
    progressBox.fillRect(width / 2 - 160, height / 2, 320, 30);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xdb2777, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 + 5, 300 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    this.createProceduralTextures();
  }

  create() {
    this.scene.start('MenuScene');
  }

  private createProceduralTextures() {
    const g = this.make.graphics({ x: 0, y: 0 });

    const registerTexture = (keyLower: string, keyUpper: string, width: number, height: number) => {
      g.generateTexture(keyLower, width, height);
      g.generateTexture(keyUpper, width, height);
    };

    // 1. PLAYER SPRITE (3D Athletic Runner - 48x92)
    g.clear();
    g.fillStyle(0xffdbac, 1);
    g.fillCircle(24, 18, 14);
    g.fillStyle(0xec4899, 1);
    g.fillRect(8, 10, 32, 6);
    g.fillStyle(0x0284c7, 1);
    g.fillRect(12, 32, 24, 26);
    g.fillStyle(0x475569, 1);
    g.fillRect(12, 58, 24, 12);
    g.fillStyle(0xffdbac, 1);
    g.fillRect(14, 70, 8, 16);
    g.fillRect(26, 70, 8, 16);
    g.fillStyle(0xf472b6, 1);
    g.fillRect(10, 84, 12, 8);
    g.fillRect(24, 84, 12, 8);
    g.generateTexture('player', 48, 92);

    // 2. BURGER SPRITE (64x64)
    g.clear();
    g.fillStyle(0xd97706, 1);
    g.fillCircle(32, 22, 22);
    g.fillStyle(0x451a03, 1);
    g.fillRect(8, 26, 48, 12);
    g.fillStyle(0xfacc15, 1);
    g.fillRect(8, 36, 48, 8);
    g.fillStyle(0x22c55e, 1);
    g.fillRect(8, 42, 48, 8);
    g.fillStyle(0x92400e, 1);
    g.fillRect(12, 48, 40, 10);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(24, 14, 2);
    g.fillCircle(32, 10, 2);
    g.fillCircle(40, 14, 2);
    registerTexture('burger', 'BURGER', 64, 64);

    // 3. COLA SPRITE (64x64)
    g.clear();
    g.fillStyle(0xec4899, 1);
    g.fillRect(16, 20, 32, 38);
    g.fillStyle(0xffffff, 1);
    g.fillRect(12, 14, 40, 8);
    g.fillStyle(0xfde047, 1);
    g.fillRect(36, 2, 6, 16);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(32, 38, 10);
    registerTexture('cola', 'COLA', 64, 64);

    // 4. APPLE SPRITE (64x64)
    g.clear();
    g.fillStyle(0xef4444, 1);
    g.fillCircle(24, 34, 20);
    g.fillCircle(40, 34, 20);
    g.fillStyle(0x16a34a, 1);
    g.fillTriangle(34, 12, 46, 6, 38, 20);
    g.fillStyle(0x78350f, 1);
    g.fillRect(30, 10, 4, 10);
    registerTexture('apple', 'APPLE', 64, 64);

    // 5. WATER BOTTLE (64x64)
    g.clear();
    g.fillStyle(0x38bdf8, 0.9);
    g.fillRect(20, 18, 24, 38);
    g.fillStyle(0x0284c7, 1);
    g.fillRect(24, 10, 16, 8);
    g.fillStyle(0xffffff, 0.95);
    g.fillRect(20, 30, 24, 12);
    registerTexture('water', 'WATER', 64, 64);

    // 6. ENERGY DRINK (64x64)
    g.clear();
    g.fillStyle(0xfacc15, 1);
    g.fillRect(16, 14, 32, 44);
    g.fillStyle(0xca8a04, 1);
    g.fillRect(14, 10, 36, 6);
    g.fillStyle(0x000000, 1);
    g.fillTriangle(32, 20, 24, 36, 34, 36);
    g.fillTriangle(32, 50, 40, 34, 30, 34);
    registerTexture('energy_drink', 'ENERGY_DRINK', 64, 64);

    // 7. EXERCISE BOOST (64x64)
    g.clear();
    g.fillStyle(0xa855f7, 1);
    g.fillRect(10, 16, 12, 32);
    g.fillRect(42, 16, 12, 32);
    g.fillStyle(0xe2e8f0, 1);
    g.fillRect(18, 28, 28, 8);
    registerTexture('exercise', 'EXERCISE', 64, 64);

    // 8. SLEEP TOKEN (64x64)
    g.clear();
    g.fillStyle(0x818cf8, 1);
    g.fillCircle(32, 32, 24);
    g.fillStyle(0xfff0f5, 1);
    g.fillCircle(42, 24, 20);
    registerTexture('sleep', 'SLEEP', 64, 64);

    // 9. LOW GROUND OBSTACLE (Puddle / Chocolate Hurdle - 80x40 MUST JUMP OVER!)
    g.clear();
    g.fillStyle(0x78350f, 1); // Dark chocolate puddle
    g.fillEllipse(40, 25, 36, 12);
    g.fillStyle(0xd97706, 1); // Wafer Hurdle
    g.fillRect(10, 10, 60, 12);
    g.fillStyle(0xffffff, 1); // Warning stripes
    g.fillRect(20, 10, 8, 12);
    g.fillRect(50, 10, 8, 12);
    registerTexture('obstacle_low', 'OBSTACLE_LOW', 80, 40);

    // 10. MID-AIR FLOATING STAR (Golden Star - 64x64 MUST JUMP TO REACH!)
    g.clear();
    g.fillStyle(0xfde047, 1);
    g.fillTriangle(32, 4, 22, 24, 42, 24);
    g.fillTriangle(32, 60, 22, 40, 42, 40);
    g.fillTriangle(4, 32, 24, 22, 24, 42);
    g.fillTriangle(60, 32, 40, 22, 40, 42);
    g.fillCircle(32, 32, 12);
    registerTexture('star_high', 'STAR_HIGH', 64, 64);

    // 11. BOSSES
    g.clear();
    g.fillStyle(0xf43f5e, 1);
    g.fillCircle(60, 60, 52);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(30, 72, 38, 92, 46, 72);
    g.fillTriangle(52, 72, 60, 96, 68, 72);
    g.fillTriangle(74, 72, 82, 92, 90, 72);
    g.fillStyle(0xfacc15, 1);
    g.fillCircle(42, 42, 12);
    g.fillCircle(78, 42, 12);
    g.fillStyle(0x000000, 1);
    g.fillCircle(42, 42, 5);
    g.fillCircle(78, 42, 5);
    registerTexture('sugar_beast', 'SUGAR_BEAST', 120, 120);

    g.clear();
    g.fillStyle(0x78350f, 1);
    g.fillRect(12, 30, 96, 66);
    g.fillStyle(0xb45309, 1);
    g.fillRect(20, 42, 36, 36);
    g.fillRect(64, 42, 36, 36);
    g.fillStyle(0xef4444, 1);
    g.fillRect(32, 20, 16, 10);
    g.fillRect(72, 20, 16, 10);
    registerTexture('couch_monster', 'COUCH_MONSTER', 120, 120);

    g.clear();
    g.fillStyle(0x64748b, 0.85);
    g.fillCircle(60, 54, 48);
    g.fillRect(12, 54, 96, 50);
    g.fillStyle(0x38bdf8, 1);
    g.fillCircle(42, 44, 10);
    g.fillCircle(78, 44, 10);
    registerTexture('energy_crash', 'ENERGY_CRASH', 120, 120);

    // 12. DECISION DOORS
    g.clear();
    g.fillStyle(0xf97316, 0.7);
    g.fillRect(0, 0, 90, 150);
    g.lineStyle(6, 0xef4444, 1);
    g.strokeRect(0, 0, 90, 150);
    registerTexture('door_fast_food', 'DOOR_FAST_FOOD', 90, 150);

    g.clear();
    g.fillStyle(0x16a34a, 0.7);
    g.fillRect(0, 0, 90, 150);
    g.lineStyle(6, 0x22c55e, 1);
    g.strokeRect(0, 0, 90, 150);
    registerTexture('door_healthy', 'DOOR_HEALTHY', 90, 150);

    g.clear();
    g.fillStyle(0x9333ea, 0.7);
    g.fillRect(0, 0, 90, 150);
    g.lineStyle(6, 0xc084fc, 1);
    g.strokeRect(0, 0, 90, 150);
    registerTexture('door_mystery', 'DOOR_MYSTERY', 90, 150);

    g.destroy();
  }
}
