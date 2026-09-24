import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { MainRunScene } from './scenes/MainRunScene';
import { BossScene } from './scenes/BossScene';

export const PhaserGame: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameContainerRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: gameContainerRef.current,
      width: 1024,
      height: 600,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      scene: [PreloadScene, MenuScene, MainRunScene, BossScene]
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    return () => {
      game.destroy(true);
      gameInstanceRef.current = null;
    };
  }, []);

  return (
    <div 
      ref={gameContainerRef} 
      className="w-full h-full min-h-[500px] md:min-h-[620px] rounded-xl overflow-hidden border-4 border-fuchsia-600 shadow-[0_0_40px_rgba(255,0,255,0.6)]" 
    />
  );
};
