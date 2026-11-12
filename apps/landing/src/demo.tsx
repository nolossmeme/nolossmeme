import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DemoPage } from "./DemoPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoPage />
  </StrictMode>,
);
