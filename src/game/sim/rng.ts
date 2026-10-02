export interface RandomStep {
  readonly value: number;
  readonly nextState: number;
}

const MULBERRY32_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 0x1_0000_0000;

export function nextRandom(rngState: number): RandomStep {
  const nextState = (rngState + MULBERRY32_INCREMENT) >>> 0;
  let value = nextState;

  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

  return {
    value: ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE,
    nextState,
  };
}
