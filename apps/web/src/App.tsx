import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { FaucetPage } from "./pages/Faucet";
import { HomePage } from "./pages/Home";
import { HowItWorksPage } from "./pages/HowItWorks";
import { LaunchPage } from "./pages/Launch";
import { MemePage } from "./pages/Meme";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="memes" element={<Navigate to="/" replace />} />
        <Route path="m/:slug" element={<MemePage />} />
        <Route path="launch" element={<LaunchPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="faucet" element={<FaucetPage />} />
        <Route path="*" element={<p className="text-muted">Nothing here.</p>} />
      </Route>
    </Routes>
  );
}
