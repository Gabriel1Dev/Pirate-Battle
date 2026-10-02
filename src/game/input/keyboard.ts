import { EMPTY_INPUT, type InputState } from "../sim/types";

const KEY_ACTIONS: Readonly<Record<string, keyof InputState>> = {
  ArrowUp: "forward",
  w: "forward",
  W: "forward",
  ArrowLeft: "turnLeft",
  a: "turnLeft",
  A: "turnLeft",
  ArrowRight: "turnRight",
  d: "turnRight",
  D: "turnRight",
  " ": "fireFront",
  q: "fireLeft",
  Q: "fireLeft",
  e: "fireRight",
  E: "fireRight",
};

export interface KeyboardInput {
  readonly state: InputState;
  clear(): void;
  setAction(action: keyof InputState, pressed: boolean): void;
  destroy(): void;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest(
        "button, a, input, textarea, select, [role='button'], [contenteditable='true']",
      ) !== null)
  );
}

export function createKeyboardInput(
  state: InputState = { ...EMPTY_INPUT },
): KeyboardInput {
  const pressedKeys = new Set<string>();

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    const action = KEY_ACTIONS[event.key];
    if (!action) {
      return;
    }

    event.preventDefault();
    pressedKeys.add(event.key);
    state[action] = true;
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_ACTIONS[event.key];
    if (!action) {
      return;
    }

    pressedKeys.delete(event.key);
    state[action] = [...pressedKeys].some(
      (key) => KEY_ACTIONS[key] === action,
    );
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return {
    state,
    clear(): void {
      pressedKeys.clear();
      Object.assign(state, EMPTY_INPUT);
    },
    setAction(action, pressed): void {
      state[action] = pressed;
    },
    destroy(): void {
      this.clear();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    },
  };
}
