import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";
import { Toaster } from "@/components/ui/sonner";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { RootErrorBoundary } from "@/components/error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";

// Adaptive platform bootstrap — no-op in local mode
if (import.meta.env.VITE_APP_ID !== "local") {
  try {
    const { initializeClientEnvironment } = await import("@adaptive-ai/sdk/client");
    initializeClientEnvironment({
      appId: import.meta.env.VITE_APP_ID,
      rootUrl: import.meta.env.VITE_ROOT_URL,
      baseUrl: import.meta.env.VITE_BASE_URL,
      isTesting: !import.meta.env.PROD,
      realtimeDomain: import.meta.env.VITE_REALTIME_DOMAIN,
      boxId: import.meta.env.VITE_BOX_ID,
    });
  } catch {
    // Not on Adaptive — safe to ignore
  }
}

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={400}>
          <App />
        </TooltipProvider>
        <Toaster />
      </QueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
