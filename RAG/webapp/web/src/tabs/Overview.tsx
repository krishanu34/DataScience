import { useEffect, useState } from "react";
import { getJSON } from "../api";
import { Pill, Section, Stat } from "../components/ui";
import { ROLE_INFO, STEPS } from "../data/content";
import { useApp } from "../lib/app";
import type { Role } from "../types";

interface Corpus {
  repo: string;
  total: number;
  chunks: number | null;
  by_product: Record<string, number>;
  by_acl: Record<string, number>;
  synthetic: { doc_id: string; acl: string; url: string }[];
}

const TABS = [
  { id: "retrieval", title: "Retrieval lab", text: "Compare keyword and vector search chunk by chunk, tune the fusion, and watch the reranker reorder." },
  { id: "rag", title: "RAG", text: "The simplest complete loop: retrieve, build a prompt, answer with citations, refuse when unsure." },
  { id: "hybrid", title: "Hybrid RAG", text: "Both searches, fusion, a Gemini reranker and a relevance gate, with a latency waterfall." },
  { id: "agentic", title: "Agentic RAG", text: "Watch an agent choose tools, read results, reword queries and decide when to stop." },
  { id: "langgraph", title: "LangGraph RAG", text: "A workflow graph that plans, researches in parallel lanes and answers." },
  { id: "evals", title: "Evals", text: "Learn the metrics by playing with them, then read the real results and the golden question set." },
];

export function Overview({ go }: { go: (tab: string) => void }) {
  const { status } = useApp();
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  useEffect(() => {
    getJSON<Corpus>("/api/corpus").then(setCorpus, () => setCorpus(null));
  }, []);
  const maxProduct = Math.max(...Object.values(corpus?.by_product ?? { x: 1 }));

  return (
    <div className="overview">
      <section className="hero">
        <div className="kicker">Interactive learning platform</div>
        <h1>See how a RAG system really works</h1>
        <p>
          Retrieval-augmented generation lets a language model answer from your own documents. This platform runs the real code behind this project, step by step, so you can watch the chunks, scores, decisions and timings instead of
          reading about them.
        </p>
        <div className="hero-actions">
          <button className="btn" onClick={() => go("retrieval")}>
            Start with retrieval
          </button>
          <button className="btn btn-ghost" onClick={() => go("agentic")}>
            Jump to the live agent
          </button>
        </div>
        <div className={`mode-note ${status.live ? "ok" : "warn"}`}>
          {status.live
            ? "Live mode: questions run against Vertex AI and the saved indexes. You can also replay recorded runs."
            : `Replay mode: Vertex AI is not configured (missing ${status.missing.join(", ")}). Example questions replay recorded runs of the real pipeline.`}
        </div>
      </section>

      <Section title="A learning path" hint="Each tab adds one idea. Every tab has the concept, things to try, and the functions it calls.">
        <div className="tabcards">
          {TABS.map((tab, index) => (
            <button key={tab.id} className="tabcard" onClick={() => go(tab.id)}>
              <span className="step-no">{index + 1}</span>
              <b>{tab.title}</b>
              <span>{tab.text}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="The pipeline, one file at a time" hint="Every step file in the project adds one idea on top of the previous one.">
        <ol className="ladder">
          {STEPS.map((step) => (
            <li key={step.file}>
              <div>
                <b>{step.title}</b> <code>{step.file}</code>
                <p>{step.adds}</p>
              </div>
              {step.tab && (
                <button className="link" onClick={() => go(step.tab!)}>
                  Open the tab
                </button>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="The knowledge base" hint="A subset of the Azure documentation plus a few made-up internal documents used to test access control, version conflicts and prompt injection.">
        {corpus ? (
          <>
            <div className="stats">
              <Stat label="Documents" value={corpus.total} />
              <Stat label="Chunks" value={corpus.chunks ?? "n/a"} hint="Documents split into pieces of about 1,200 characters." />
              <Stat label="Public" value={corpus.by_acl.public ?? 0} />
              <Stat label="Internal" value={corpus.by_acl.internal ?? 0} />
              <Stat label="Restricted" value={corpus.by_acl.restricted ?? 0} />
            </div>
            <div className="barsgrid">
              <div className="bars">
                <div className="kicker">Documents per product</div>
                {Object.entries(corpus.by_product)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <div key={name} className="bar-row">
                      <span>{name}</span>
                      <span className="scorebar-track">
                        <span className="scorebar-fill tone-good" style={{ width: `${(count / maxProduct) * 100}%` }} />
                      </span>
                      <b>{count}</b>
                    </div>
                  ))}
              </div>
              <div className="bars">
                <div className="kicker">The made-up internal documents</div>
                {corpus.synthetic.map((doc) => (
                  <div key={doc.doc_id} className="bar-row">
                    <span>{doc.doc_id.replace("synthetic/", "")}</span>
                    <Pill tone={`acl-${doc.acl}`}>{doc.acl}</Pill>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="muted">The backend is not reachable. Start it to see the corpus.</p>
        )}
      </Section>

      <Section title="Roles and access control" hint="Every question runs as a role. Chunks above the role's level are removed before the model or the reranker ever see them.">
        <div className="rolecards">
          {(Object.keys(ROLE_INFO) as Role[]).map((role) => (
            <div key={role} className="rolecard">
              <b>{ROLE_INFO[role].label}</b>
              <span>{ROLE_INFO[role].blurb}</span>
              <div>
                {ROLE_INFO[role].reads.map((level) => (
                  <Pill key={level} tone={`acl-${level}`}>
                    {level}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
