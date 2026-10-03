import {
  DEFAULT_OPTIONS,
  validateOptions,
  type MatchOptions,
} from "../game/config";

const OPTIONS_STORAGE_KEY = "pirate-battle.options.v1";

export interface StoredOptionsResult {
  readonly options: MatchOptions;
  readonly error: string | null;
}

function isMatchOptions(value: unknown): value is MatchOptions {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "durationSec" in value &&
    typeof value.durationSec === "number" &&
    "spawnIntervalSec" in value &&
    typeof value.spawnIntervalSec === "number"
  );
}

export function readStoredOptions(): StoredOptionsResult {
  try {
    const storedValue = window.localStorage.getItem(OPTIONS_STORAGE_KEY);
    if (storedValue === null) {
      return { options: { ...DEFAULT_OPTIONS }, error: null };
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!isMatchOptions(parsedValue)) {
      return {
        options: { ...DEFAULT_OPTIONS },
        error: "Saved options are invalid. Review and save new options.",
      };
    }

    const errors = validateOptions(parsedValue);
    if (Object.keys(errors).length > 0) {
      return {
        options: { ...DEFAULT_OPTIONS },
        error: "Saved options are outside the allowed limits. Review and save new options.",
      };
    }

    return { options: { ...parsedValue }, error: null };
  } catch (error: unknown) {
    return {
      options: { ...DEFAULT_OPTIONS },
      error:
        error instanceof Error
          ? `Options could not be loaded: ${error.message}`
          : "Options could not be loaded from this browser.",
    };
  }
}

export function saveStoredOptions(options: MatchOptions): void {
  const errors = validateOptions(options);
  if (Object.keys(errors).length > 0) {
    throw new RangeError("Cannot save invalid match options.");
  }

  window.localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
}
