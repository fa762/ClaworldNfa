import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { ShelterScene } from './scenes/ShelterScene';
import { TaskScene } from './scenes/TaskScene';
import { PKScene } from './scenes/PKScene';
import { MarketScene } from './scenes/MarketScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  const resolution = Math.min(window.devicePixelRatio || 1, 2);

  const config: Phaser.Types.Core.GameConfig & { resolution: number } = {
    type: Phaser.AUTO,
    parent,
    width: w,
    height: h,
    pixelArt: true,
    resolution,
    autoRound: true,
    antialias: false,
    backgroundColor: '#0a0a0a',
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    dom: {
      createContainer: true,
    },
    scene: [BootScene, ShelterScene, TaskScene, PKScene, MarketScene],
  };

  return new Phaser.Game(config);
}
