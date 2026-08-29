import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./team.css";
import "./branding.css";
import "./superadmin.css";
import "./daily-details.css";
import "./admin-tabs.css";
import "./order-split.css";
import "./order-split-drinks.css";
import "./planning-method-three.css";
import "./planning-week-banner.css";
import "./mobile.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
