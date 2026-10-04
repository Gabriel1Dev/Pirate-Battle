import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

function getRootElement(): HTMLElement {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("The application root element is missing.");
  }
  return rootElement;
}
const rootElement = getRootElement();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: true },
  },
});

async function verifyMockApi(): Promise<void> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`The mock API health check returned ${response.status}.`);
  }
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    body.status !== "ok"
  ) {
    throw new Error("The mock API health check returned an invalid response.");
  }
}

function showStartupError(error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : "The mock API could not be initialized.";
  console.error("The mock API could not be initialized.", error);

  createRoot(rootElement).render(
    <main className="app-startup-error" role="alert">
      <h1>Unable to start Pirate Battle</h1>
      <p>The local match service is unavailable. No match data was sent.</p>
      <p>{message}</p>
      <button onClick={() => window.location.reload()} type="button">
        Retry
      </button>
    </main>,
  );
}

async function startApplication(): Promise<void> {
  try {
    const { worker } = await import("./mocks/browser");
    const registration = await worker.start({
      onUnhandledFrame: "bypass",
    });
    if (registration && !navigator.serviceWorker.controller) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            handleControllerChange,
          );
          reject(new Error("The mock service worker did not control this page."));
        }, 10_000);
        const handleControllerChange = (): void => {
          if (!navigator.serviceWorker.controller) {
            return;
          }
          window.clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            handleControllerChange,
          );
          resolve();
        };
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          handleControllerChange,
        );
        handleControllerChange();
      });
    }
    await verifyMockApi();
  } catch (error: unknown) {
    showStartupError(error);
    return;
  }

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void startApplication();
