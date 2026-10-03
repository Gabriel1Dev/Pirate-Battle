export const NETWORK_SCENARIOS = [
  "success",
  "empty",
  "paginated",
  "slow",
  "variable-latency",
  "timeout",
  "http-4xx",
  "http-5xx",
  "ranking-fail",
  "history-fail",
  "timeout-after-save",
  "offline-on-finish",
] as const;

export type NetworkScenario = (typeof NETWORK_SCENARIOS)[number];

const SCENARIO_STORAGE_KEY = "pirate-battle.network-scenario.v1";

export function getNetworkScenario(): NetworkScenario {
  const queryScenario = new URLSearchParams(window.location.search).get(
    "scenario",
  );
  const storedScenario = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
  const scenario = queryScenario ?? storedScenario;
  return NETWORK_SCENARIOS.find((entry) => entry === scenario) ?? "success";
}

export function setNetworkScenario(scenario: NetworkScenario): void {
  window.localStorage.setItem(SCENARIO_STORAGE_KEY, scenario);
  const url = new URL(window.location.href);
  url.searchParams.set("scenario", scenario);
  window.history.replaceState(null, "", url);
}

export function resetNetworkScenario(): void {
  window.localStorage.removeItem(SCENARIO_STORAGE_KEY);
  window.localStorage.removeItem("pirate-battle.mock-matches.v1");
  window.localStorage.removeItem("pirate-battle.mock-timeout-saves.v1");
  const url = new URL(window.location.href);
  url.searchParams.delete("scenario");
  window.history.replaceState(null, "", url);
}
