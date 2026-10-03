import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_OPTIONS,
  LIMITS,
  validateOptions,
  type MatchOptions,
  type OptionsErrors,
} from "../game/config";

interface OptionsScreenProps {
  readonly initialOptions: MatchOptions;
  readonly persistenceError: string | null;
  readonly presentation?: "page" | "dialog";
  readonly onCancel: () => void;
  readonly onSave: (options: MatchOptions) => void;
}

export function OptionsScreen({
  initialOptions,
  persistenceError,
  presentation = "page",
  onCancel,
  onSave,
}: OptionsScreenProps): React.JSX.Element {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [durationSec, setDurationSec] = useState(
    String(initialOptions.durationSec),
  );
  const [spawnIntervalSec, setSpawnIntervalSec] = useState(
    String(initialOptions.spawnIntervalSec),
  );
  const [validationErrors, setValidationErrors] = useState<OptionsErrors>({});
  const isDialog = presentation === "dialog";

  const changeValue = (
    field: keyof MatchOptions,
    amount: number,
  ): void => {
    if (field === "durationSec") {
      const current = Number(durationSec) || initialOptions.durationSec;
      setDurationSec(
        String(
          Math.max(
            LIMITS.durationSec.min,
            Math.min(LIMITS.durationSec.max, current + amount),
          ),
        ),
      );
      return;
    }

    const current = Number(spawnIntervalSec) || initialOptions.spawnIntervalSec;
    setSpawnIntervalSec(
      String(
        Math.max(
          LIMITS.spawnIntervalSec.min,
          Math.min(LIMITS.spawnIntervalSec.max, current + amount),
        ),
      ),
    );
  };

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const submitOptions = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const options: MatchOptions = {
      durationSec: Number(durationSec),
      spawnIntervalSec: Number(spawnIntervalSec),
    };
    const errors = validateOptions(options);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    onSave(options);
  };

  return (
    <main
      className={`menu-screen options-screen${isDialog ? " options-modal" : ""}`}
    >
      <section
        className="menu-card options-card"
        aria-labelledby="options-title"
        aria-modal={isDialog ? true : undefined}
        role={isDialog ? "dialog" : undefined}
      >
        {isDialog && (
          <button
            aria-label="Close options"
            className="asset-icon-button options-close-button"
            onClick={onCancel}
            type="button"
          >
            <img
              src="/assets/png/default/ui/controls/icon_close.png"
              alt=""
            />
          </button>
        )}
        <img
          className="menu-title-image"
          src="/assets/png/default/ui/menu/title_pirate_battle.png"
          alt="Pirate Battle"
        />
        <h1 id="options-title" ref={titleRef} tabIndex={-1}>
          Options
        </h1>
        <p>Choose the rules for your next voyage.</p>

        {persistenceError && (
          <p className="options-error" role="alert">
            {persistenceError}
          </p>
        )}

        <form className="options-form" onSubmit={submitOptions} noValidate>
          <div className="option-field">
            <label htmlFor="durationSec">Game session time</label>
            <span id="duration-help" className="option-hint">
              {LIMITS.durationSec.min}–{LIMITS.durationSec.max} seconds
            </span>
            <div className="option-stepper">
              <button
                aria-label="Decrease game session time"
                className="stepper-button"
                disabled={Number(durationSec) <= LIMITS.durationSec.min}
                onClick={() => changeValue("durationSec", -1)}
                type="button"
              >
                <img
                  src="/assets/png/default/ui/controls/icon_minus.png"
                  alt=""
                />
              </button>
              <input
                aria-describedby={
                  validationErrors.durationSec
                    ? "duration-help duration-error"
                    : "duration-help"
                }
                aria-invalid={Boolean(validationErrors.durationSec)}
                id="durationSec"
                max={LIMITS.durationSec.max}
                min={LIMITS.durationSec.min}
                onChange={(event) => setDurationSec(event.currentTarget.value)}
                step={1}
                type="number"
                value={durationSec}
              />
              <span className="option-unit" aria-hidden="true">
                s
              </span>
              <button
                aria-label="Increase game session time"
                className="stepper-button"
                disabled={Number(durationSec) >= LIMITS.durationSec.max}
                onClick={() => changeValue("durationSec", 1)}
                type="button"
              >
                <img
                  src="/assets/png/default/ui/controls/icon_plus.png"
                  alt=""
                />
              </button>
            </div>
            {validationErrors.durationSec && (
              <span className="options-error" id="duration-error" role="alert">
                {validationErrors.durationSec}
              </span>
            )}
          </div>

          <div className="option-field">
            <label htmlFor="spawnIntervalSec">Enemy spawn time</label>
            <span id="spawn-help" className="option-hint">
              {LIMITS.spawnIntervalSec.min}–{LIMITS.spawnIntervalSec.max}{" "}
              seconds between spawns
            </span>
            <div className="option-stepper">
              <button
                aria-label="Decrease enemy spawn time"
                className="stepper-button"
                disabled={
                  Number(spawnIntervalSec) <= LIMITS.spawnIntervalSec.min
                }
                onClick={() => changeValue("spawnIntervalSec", -1)}
                type="button"
              >
                <img
                  src="/assets/png/default/ui/controls/icon_minus.png"
                  alt=""
                />
              </button>
              <input
                aria-describedby={
                  validationErrors.spawnIntervalSec
                    ? "spawn-help spawn-error"
                    : "spawn-help"
                }
                aria-invalid={Boolean(validationErrors.spawnIntervalSec)}
                id="spawnIntervalSec"
                max={LIMITS.spawnIntervalSec.max}
                min={LIMITS.spawnIntervalSec.min}
                onChange={(event) =>
                  setSpawnIntervalSec(event.currentTarget.value)
                }
                step={1}
                type="number"
                value={spawnIntervalSec}
              />
              <span className="option-unit" aria-hidden="true">
                s
              </span>
              <button
                aria-label="Increase enemy spawn time"
                className="stepper-button"
                disabled={
                  Number(spawnIntervalSec) >= LIMITS.spawnIntervalSec.max
                }
                onClick={() => changeValue("spawnIntervalSec", 1)}
                type="button"
              >
                <img
                  src="/assets/png/default/ui/controls/icon_plus.png"
                  alt=""
                />
              </button>
            </div>
            {validationErrors.spawnIntervalSec && (
              <span className="options-error" id="spawn-error" role="alert">
                {validationErrors.spawnIntervalSec}
              </span>
            )}
          </div>

          <div className="menu-action-row">
            <button className="primary-button menu-button" type="submit">
              {isDialog ? "SAVE OPTIONS" : "MAIN MENU"}
            </button>
          </div>
        </form>
        <p className="options-defaults">
          Defaults: {DEFAULT_OPTIONS.durationSec}s match,{" "}
          {DEFAULT_OPTIONS.spawnIntervalSec}s spawn interval.
        </p>
      </section>
    </main>
  );
}
