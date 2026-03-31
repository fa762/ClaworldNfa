import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { ShelterScene } from './scenes/ShelterScene';
import { TaskScene } from './scenes/TaskScene';
import { PKScene } from './scenes/PKScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  const w = parent.clientWidth;
  const h = parent.clientHeight;

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: w,
    height: h,
    pixelArt: true,
    backgroundColor: '#0a0a0a',
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, ShelterScene, TaskScene, PKScene],
  };

  return new Phaser.Game(config);
}
