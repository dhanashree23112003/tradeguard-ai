import { useState } from "react";
import PipelineView from "./pages/PipelineView";
import CaseManagement from "./pages/CaseManagement";
import Analytics from "./pages/Analytics";
import "./App.css";

const NAV = [
  { id: "pipeline", label: "Live Pipeline" },
  { id: "cases", label: "Case Management" },
  { id: "analytics", label: "Analytics" },
];

export default function App() {
  const [page, setPage] = useState("pipeline");

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="brand-icon">⚖</span>
          <span className="brand-name">TradeGuard AI</span>
          <span className="brand-tag">Compliance Monitor</span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-btn ${page === n.id ? "active" : ""}`}
              onClick={() => setPage(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="main">
        {page === "pipeline" && <PipelineView />}
        {page === "cases" && <CaseManagement />}
        {page === "analytics" && <Analytics />}
      </main>
    </div>
  );
}
