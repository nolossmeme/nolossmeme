import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NearProvider } from "near-connect-hooks";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { ToastProvider } from "./components/Toast";
import { NETWORK_ID, network } from "./lib/client";
import "./index.css";

// Static hosts send unknown paths to 404.html, which stashes the path and redirects here.
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const stashed = sessionStorage.getItem("nlm:path");
if (stashed) {
  sessionStorage.removeItem("nlm:path");
  history.replaceState(null, "", stashed);
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NearProvider config={{ network: NETWORK_ID, providers: { [NETWORK_ID]: [network.rpcUrl] } }}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter basename={base}>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </NearProvider>
  </StrictMode>,
);
