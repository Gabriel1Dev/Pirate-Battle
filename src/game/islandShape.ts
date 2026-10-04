import type { Vec2 } from "./config";

const ISLAND_SHAPES = [
  { scaleX: 1.08, scaleY: 0.96, phase: 0.2 },
  { scaleX: 0.96, scaleY: 1.08, phase: 1.4 },
  { scaleX: 1.04, scaleY: 0.94, phase: 2.7 },
] as const;

const OUTLINE_SAMPLES = 64;
const LAND_SCALE = 1.35;

export function getIslandOutline(
  radius: number,
  index: number,
  scale = 1,
): Vec2[] {
  const shape = ISLAND_SHAPES[index % ISLAND_SHAPES.length];
  return Array.from({ length: OUTLINE_SAMPLES }, (_, point) => {
    const angle = (point / OUTLINE_SAMPLES) * Math.PI * 2;
    const variation =
      1 +
      Math.sin(angle * 2 + shape.phase) * 0.07 +
      Math.cos(angle * 3 - shape.phase) * 0.045 +
      Math.sin(angle * 5 + shape.phase * 0.6) * 0.025;
    const distance = radius * LAND_SCALE * scale * variation;
    return {
      x: Math.cos(angle) * distance * shape.scaleX,
      y: Math.sin(angle) * distance * shape.scaleY,
    };
  });
}

export function getIslandShapeScale(index: number): {
  readonly scaleX: number;
  readonly scaleY: number;
} {
  const { scaleX, scaleY } = ISLAND_SHAPES[index % ISLAND_SHAPES.length];
  return { scaleX, scaleY };
}
