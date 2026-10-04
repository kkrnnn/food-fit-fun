import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameEngine3D } from './GameEngine3D';

afterEach(() => vi.unstubAllGlobals());

// Exercise the real pickup -> scene burst -> frame update chain without WebGL.
function sceneHarness() {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ strokeText: vi.fn(), fillText: vi.fn() }) }) });
  const engine: GameEngine3D = Object.create(GameEngine3D.prototype);
  const player = new THREE.Group();
  const scene = new THREE.Scene();scene.add(player);
  Reflect.set(engine, 'scene', scene);Reflect.set(engine, 'playerMesh', player);
  Reflect.set(engine, 'burstEffects', []);
  Reflect.set(engine, 'particlesMesh', new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial()));
  return { engine, player, scene, tick: () => Reflect.get(engine,'updateBurstEffects').call(engine,.05) };
}

it.each([false,true])('keeps the food ring and kcal label with the moving runner (reduced motion=%s)', reduced => {
  const {engine,player,scene,tick}=sceneHarness();
  engine.learningPickup('BANANA',reduced,110);
  const burst=scene.children.find(child=>child!==player)!;
  const height=burst.position.y-player.position.y;
  player.position.set(-2.4,.6,0);tick();
  expect(burst.position.x).toBeCloseTo(player.position.x);
  expect(burst.position.y).toBeCloseTo(player.position.y+height);
  const label=burst.children.find(child=>child instanceof THREE.Sprite)!;
  expect(label.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(player.position.x);
  player.position.x=2.4;tick();expect(burst.position.x).toBeCloseTo(2.4);
});

it('keeps both exercise rings with the moving runner', () => {
  const {engine,player,scene,tick}=sceneHarness();
  engine.learningPickup('SHOES',false,-30);
  player.position.set(2.4,.8,0);tick();
  const bursts=scene.children.filter(child=>child!==player);
  expect(bursts).toHaveLength(2);
  for(const burst of bursts)expect(burst.position.x).toBeCloseTo(player.position.x);
});
