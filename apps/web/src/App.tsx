import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { HomePage } from "./pages/Home";
import { HowItWorksPage } from "./pages/HowItWorks";
import { LandingPage } from "./pages/Landing";
import { LaunchPage } from "./pages/Launch";
import { MemePage } from "./pages/Meme";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="memes" element={<HomePage />} />
        <Route path="m/:slug" element={<MemePage />} />
        <Route path="launch" element={<LaunchPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="*" element={<p className="text-muted">Nothing here.</p>} />
      </Route>
    </Routes>
  );
}
