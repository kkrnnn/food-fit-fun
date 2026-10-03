import Phaser from 'phaser';
import { BreakfastOption } from '../types';
import { soundSynth } from '../audio/SoundSynth';

export class MenuScene extends Phaser.Scene {
  private selectedBreakfast: BreakfastOption = 'OATMEAL';
  private breakfastCards: { [key in BreakfastOption]: Phaser.GameObjects.Container } = {} as any;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Bright Cotton Candy Pastel Background
    this.cameras.main.setBackgroundColor('#fff0f5');

    // Soft Sugar Grid Lines
    const grid = this.add.graphics();
    grid.lineStyle(1, 0xfbcfe8, 0.6);
    for (let x = 0; x < width; x += 60) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 60) {
      grid.lineBetween(0, y, width, y);
    }

    // Title Marquee 3D Candy Text
    const titleText = this.add.text(width / 2, 75, 'FOOD FIT FUN', {
      font: 'bold 64px "Press Start 2P", monospace',
      color: '#db2777'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: titleText,
      scale: { from: 0.98, to: 1.03 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.add.text(width / 2, 135, '— CANDY WORLD RUNNER & BODY BALANCE —', {
      font: '18px "Chakra Petch", sans-serif',
      color: '#0284c7'
    }).setOrigin(0.5);

    // High Score Box
    const highScores = this.getHighScores();
    const topScore = highScores.length > 0 ? highScores[0].score : 1000;
    this.add.text(width / 2, 175, `HIGH SCORE: ${topScore.toLocaleString()} PTS`, {
      font: '18px "Press Start 2P", monospace',
      color: '#d97706'
    }).setOrigin(0.5);

    // Roguelite Breakfast Selector Header
    this.add.text(width / 2, 235, 'CHOOSE YOUR BREAKFAST', {
      font: 'bold 20px "Press Start 2P", monospace',
      color: '#831843'
    }).setOrigin(0.5);

    this.add.text(width / 2, 268, 'Your pre-run meal sets your starting stats & stamina balance:', {
      font: '15px "Chakra Petch", sans-serif',
      color: '#475569'
    }).setOrigin(0.5);

    // Create 3 Pastel Breakfast Cards
    this.createBreakfastCard('DONUT', '🍩 DONUT', '+Speed 10%\n+Sugar +15\n-Stamina -10', width / 2 - 250, 365);
    this.createBreakfastCard('OATMEAL', '🥣 OATMEAL', '+Stamina +15\n+Mood +10\n+Energy +5', width / 2, 365);
    this.createBreakfastCard('EGG', '🍳 EGG', '+Energy +20\n+Stamina +10\n+Sugar 0', width / 2 + 250, 365);

    this.updateBreakfastSelection();

    // Start Button
    const startBg = this.add.rectangle(width / 2, 500, 360, 60, 0xf472b6, 1)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(4, 0xffffff);

    const startText = this.add.text(width / 2, 500, 'TAP TO PLAY!', {
      font: 'bold 22px "Press Start 2P", monospace',
      color: '#ffffff'
    }).setOrigin(0.5);

    startBg.on('pointerover', () => startBg.setFillStyle(0xec4899));
    startBg.on('pointerout', () => startBg.setFillStyle(0xf472b6));
    startBg.on('pointerdown', () => this.startGame());

    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());
    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());

    this.add.text(width / 2, height - 20, 'CONTROLS: [A/D] or [LEFT/RIGHT] Change Lane  |  [SPACE/UP] Jump  |  Touch Enabled', {
      font: '14px "Chakra Petch", sans-serif',
      color: '#64748b'
    }).setOrigin(0.5);
  }

  private createBreakfastCard(option: BreakfastOption, title: string, desc: string, x: number, y: number) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 210, 150, 0xffffff, 0.95)
      .setStrokeStyle(3, 0xf472b6)
      .setInteractive({ useHandCursor: true });

    const titleTxt = this.add.text(0, -48, title, {
      font: 'bold 18px "Chakra Petch", sans-serif',
      color: '#831843'
    }).setOrigin(0.5);

    const descTxt = this.add.text(0, 12, desc, {
      font: '14px "Chakra Petch", sans-serif',
      color: '#334155',
      align: 'center'
    }).setOrigin(0.5);

    container.add([bg, titleTxt, descTxt]);

    bg.on('pointerdown', () => {
      soundSynth.playPickup('WATER');
      this.selectedBreakfast = option;
      this.updateBreakfastSelection();
    });

    this.breakfastCards[option] = container;
  }

  private updateBreakfastSelection() {
    const options: BreakfastOption[] = ['DONUT', 'OATMEAL', 'EGG'];
    options.forEach(opt => {
      const container = this.breakfastCards[opt];
      const bg = container.first as Phaser.GameObjects.Rectangle;
      if (opt === this.selectedBreakfast) {
        bg.setStrokeStyle(4, 0x0284c7);
        bg.setFillStyle(0xe0f2fe, 1);
      } else {
        bg.setStrokeStyle(3, 0xf472b6);
        bg.setFillStyle(0xffffff, 0.95);
      }
    });
  }

  private startGame() {
    soundSynth.playJump();
    soundSynth.startMusic('RUNNER');
    this.scene.start('MainRunScene', { breakfast: this.selectedBreakfast });
  }

  private getHighScores() {
    try {
      const raw = localStorage.getItem('body_rush_high_scores');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
