import { useEffect, useState } from "react";
import { getJSON } from "./api";
import { AppContext } from "./lib/app";
import { AgenticRag } from "./tabs/AgenticRag";
import { Evals } from "./tabs/Evals";
import { HybridRag } from "./tabs/HybridRag";
import { LangGraphRag } from "./tabs/LangGraphRag";
import { Overview } from "./tabs/Overview";
import { RetrievalLab } from "./tabs/RetrievalLab";
import { SimpleRag } from "./tabs/SimpleRag";
import type { Example, Status } from "./types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "retrieval", label: "Retrieval" },
  { id: "rag", label: "RAG" },
  { id: "hybrid", label: "Hybrid RAG" },
  { id: "agentic", label: "Agentic RAG" },
  { id: "langgraph", label: "LangGraph RAG" },
  { id: "evals", label: "Evals" },
];

const fromHash = () => {
  const id = window.location.hash.replace("#", "");
  return TABS.some((tab) => tab.id === id) ? id : "overview";
};

export default function App() {
  const [tab, setTab] = useState(fromHash);
  const [status, setStatus] = useState<Status>({ live: false, missing: [], roles: [] });
  const [examples, setExamples] = useState<Record<string, Example[]>>({});
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    Promise.all([getJSON<Status>("/api/status"), getJSON<Record<string, Example[]>>("/api/examples")]).then(
      ([s, e]) => {
        setStatus(s);
        setExamples(e);
      },
      () => setOffline(true),
    );
    const onHash = () => setTab(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: string) => {
    window.location.hash = id;
    setTab(id);
    window.scrollTo({ top: 0 });
  };

  // Every tab stays mounted so a run keeps streaming while you look at another tab.
  const pane = (id: string, node: React.ReactNode) => (
    <div key={id} hidden={tab !== id} className="pane">
      {node}
    </div>
  );

  return (
    <AppContext.Provider value={{ status, examples }}>
      <header className="topbar">
        <button className="brand" onClick={() => go("overview")}>
          <span className="logo" />
          RAG Lab
        </button>
        <nav>
          {TABS.map((item) => (
            <button key={item.id} className={tab === item.id ? "on" : ""} onClick={() => go(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <span className={`livepill ${status.live ? "live" : "replay"}`} title={status.missing.length ? `Missing: ${status.missing.join(", ")}` : "Vertex AI and the indexes are available"}>
          <i />
          {status.live ? "Live" : "Replay"}
        </span>
      </header>

      {offline && <div className="banner">The backend is not reachable. Start it with: uvicorn app.main:app --port 8000 (from webapp/backend).</div>}

      <div className="page">
        {pane("overview", <Overview go={go} />)}
        {pane("retrieval", <RetrievalLab />)}
        {pane("rag", <SimpleRag />)}
        {pane("hybrid", <HybridRag />)}
        {pane("agentic", <AgenticRag />)}
        {pane("langgraph", <LangGraphRag />)}
        {pane("evals", <Evals />)}
      </div>
    </AppContext.Provider>
  );
}
