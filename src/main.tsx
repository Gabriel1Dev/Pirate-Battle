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

async function startApplication(): Promise<void> {
  try {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledFrame: "bypass" });
  } catch (error: unknown) {
    console.error("The mock API worker could not be started.", error);
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
