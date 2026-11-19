import { useEffect, useMemo, useRef, useState } from "react";
import { getJSON, streamPost } from "../api";
import { ErrorBox, Pill, ScoreBar, Section } from "../components/ui";
import { BEHAVIOR_TEXT, CATEGORY_INFO, PIPELINE_INFO, PIPELINES, PLAIN_METRICS, tone } from "../data/evalcopy";
import { ROLE_INFO } from "../data/content";
import { useApp } from "../lib/app";
import { prettyDoc } from "../lib/events";
import type { Mode, Role, RunEvent } from "../types";

interface Question {
  id: string;
  question: string;
  category: string;
  role: Role;
  expected_behavior: string;
  relevant: Record<string, number>;
  evidence: Record<string, string>;
  reference_answer: string;
  required_facts: string[];
  blocked_docs?: string[];
  distractors?: string[];
  note?: string;
}

interface DocView {
  rank: number;
  doc_id: string;
  chunk_id: string;
  acl: string;
  score: number | null;
  grade: number;
  blocked: boolean;
  snippet?: string;
}

interface View {
  docs: DocView[];
  found: Record<string, number | null>;
  scores: Record<string, number> | null;
  best_score: number | null;
  chunks: number;
}

interface Checks {
  gate: { best_score: number | null; threshold: number; passes: boolean; should_pass: boolean; correct: boolean };
  acl: Record<string, { above_role: number; blocked_retrieved: number }>;
}

const short = (docId: string) => {
  const name = prettyDoc(docId);
  return name.length > 26 ? `${name.slice(0, 25)}...` : name;
};

function Score({ value }: { value: number }) {
  return <span className={`score score-${tone(value)}`}>{value.toFixed(2)}</span>;
}

function RankList({ docs, title }: { docs: DocView[]; title: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ol className="rl" aria-label={title}>
      {docs.slice(0, 6).map((doc) => (
        <li key={doc.doc_id} className={`rl-row grade-${doc.grade} ${doc.blocked ? "rl-blocked" : ""}`}>
          <button onClick={() => setOpen(open === doc.doc_id ? null : doc.doc_id)}>
            <span className="rank-no">{doc.rank}</span>
            <span className="rl-name">{prettyDoc(doc.doc_id)}</span>
            {doc.grade === 2 && <Pill tone="up">right (primary)</Pill>}
            {doc.grade === 1 && <Pill tone="warn">right (supporting)</Pill>}
            {doc.blocked && <Pill tone="down">blocked for this role</Pill>}
            {doc.score != null && <small>{doc.score}/10</small>}
          </button>
          {open === doc.doc_id && <p className="rl-snippet">{doc.snippet}</p>}
        </li>
      ))}
    </ol>
  );
}

function verdict(views: Record<string, View>): string[] {
  const mrr = (name: string) => views[name]?.scores?.MRR ?? 0;
  const positions = (name: string) => (mrr(name) > 0 ? Math.round(1 / mrr(name)) : null);
  const best = Math.max(...PIPELINES.map(mrr));
  const lines: string[] = [];
  if (best === 0) {
    lines.push("No pipeline returned a right document, so this question is a retrieval failure for all of them.");
    return lines;
  }
  const leaders = PIPELINES.filter((name) => mrr(name) === best).map((name) => PIPELINE_INFO[name].label);
  lines.push(
    best === 1
      ? `A right document came first for ${leaders.join(", ")}.`
      : `At best the first right document is at position ${Math.round(1 / best)} (${leaders.join(", ")}).`,
  );
  const missed = PIPELINES.filter((name) => mrr(name) === 0).map((name) => PIPELINE_INFO[name].label);
  if (missed.length) lines.push(`${missed.join(", ")} did not return any right document at all.`);
  const before = positions("ensemble");
  const after = positions("rerank");
  if (before != null && after != null) {
    lines.push(
      before === after
        ? `Reranking did not change where the first right document landed (position ${after}).`
        : after < before
          ? `Reranking moved the first right document from position ${before} to ${after}.`
          : `Reranking made it worse: the first right document went from position ${before} to ${after}.`,
    );
  }
  return lines;
}

export function ScoreOne() {
  const { status } = useApp();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    getJSON<Question[]>("/api/evals/questions").then(
      (data) => {
        setQuestions(data);
        setSelected((data.find((item) => item.category === "paraphrase") ?? data[0])?.id ?? "");
      },
      (problem) => setError(String(problem.message ?? problem)),
    );
  }, []);

  const choose = (id: string) => {
    controller.current?.abort();
    setSelected(id);
    setEvents([]);
    setError(null);
    setRunning(false);
  };

  const replay = !status.live || mode === "cached";
  const run = async () => {
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;
    setEvents([]);
    setError(null);
    setRunning(true);
    try {
      await streamPost(
        "/api/evals/run",
        { id: selected, mode: replay ? "cached" : "auto" },
        (event) => {
          if (own.signal.aborted) return;
          if (event.event === "error") setError(event.data.message);
          setEvents((previous) => [...previous, event]);
        },
        own.signal,
      );
    } catch (problem) {
      if (!own.signal.aborted) setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      if (controller.current === own) setRunning(false);
    }
  };

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    questions.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
    return [...counts.entries()];
  }, [questions]);

  const q = questions.find((item) => item.id === selected);
  const visible = questions.filter((item) => category === "all" || item.category === category);
  const views: Record<string, View> = {};
  const timings: Record<string, number | null> = {};
  for (const { event, data } of events) {
    if (event === "pipeline") {
      views[data.name] = data.view;
      timings[data.name] = data.ms;
    }
  }
  const checks: Checks | undefined = events.find((e) => e.event === "final")?.data;
  const done = PIPELINES.every((name) => views[name]);
  const answerable = !!q && Object.keys(q.relevant).length > 0;
  const info = CATEGORY_INFO[category];

  return (
    <div className="scoreone">
      <ErrorBox message={error} />

      <Section title="1. Pick a test question" hint="Each test question has been labelled by hand with the documents that really answer it. That is what lets us score the system.">
        <div className="catchips">
          <button className={`chip ${category === "all" ? "chip-on" : ""}`} onClick={() => setCategory("all")}>
            All types<small>{questions.length} questions</small>
          </button>
          {categories.map(([name, count]) => (
            <button key={name} className={`chip ${category === name ? "chip-on" : ""}`} onClick={() => setCategory(name)}>
              {CATEGORY_INFO[name]?.label ?? name}
              <small>{count}</small>
            </button>
          ))}
        </div>
        {info && <p className="why">{info.text}</p>}
        <ul className="qpick">
          {visible.map((item) => (
            <li key={item.id}>
              <button className={selected === item.id ? "on" : ""} onClick={() => choose(item.id)}>
                <code>{item.id}</code> {item.question}
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {q && (
        <Section title="2. What a good system should do with it">
          <div className="goodsys">
            <div className="tags">
              <Pill tone="vector">{CATEGORY_INFO[q.category]?.label ?? q.category}</Pill>
              <Pill>Asked as {ROLE_INFO[q.role].label}</Pill>
              {ROLE_INFO[q.role].reads.map((level) => (
                <Pill key={level} tone={`acl-${level}`}>
                  can read {level}
                </Pill>
              ))}
            </div>
            <h3>{q.question}</h3>
            <p className={q.expected_behavior === "refuse" ? "decision bad" : "decision good"}>{BEHAVIOR_TEXT[q.expected_behavior]}</p>
            {q.note && <p className="hint">{q.note}</p>}
            {answerable ? (
              <>
                <div className="kicker">The right documents (the labels)</div>
                <ul className="labels">
                  {Object.entries(q.relevant).map(([doc, grade]) => (
                    <li key={doc}>
                      <Pill tone={grade === 2 ? "up" : "warn"}>{grade === 2 ? "primary" : "supporting"}</Pill> <b>{prettyDoc(doc)}</b>
                      {q.evidence[doc] && <em>"{q.evidence[doc]}"</em>}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              q.blocked_docs && (
                <p className="hint">
                  The document that would answer it exists but is blocked for this role: <b>{q.blocked_docs.map(prettyDoc).join(", ")}</b>
                </p>
              )
            )}
            <details>
              <summary>Reference answer</summary>
              <p>{q.reference_answer}</p>
            </details>
          </div>

          <div className="runbar">
            {status.live && (
              <div className="toggle">
                <button className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>
                  Run now
                </button>
                <button className={mode === "cached" ? "on" : ""} onClick={() => setMode("cached")}>
                  Saved result
                </button>
              </div>
            )}
            <button className="btn" onClick={run} disabled={running}>
              {running ? "Scoring..." : "Run the four retrieval pipelines and score them"}
            </button>
            <span className="hint">{replay ? "Shows the result saved by the last full evaluation run. Instant." : "Calls the search and Gemini now. Takes about 20 seconds."}</span>
          </div>
        </Section>
      )}

      {q && events.length > 0 && (
        <>
          <Section title="3. What each pipeline returned" hint="Documents in the order each pipeline ranked them. Click a row to read the chunk that matched. Green rows are the right documents.">
            <div className="rankcols">
              {PIPELINES.map((name) => (
                <div key={name} className="rankcol">
                  <header>
                    <Pill tone={PIPELINE_INFO[name].tone}>{PIPELINE_INFO[name].label}</Pill>
                    <small>{views[name] ? (timings[name] != null ? `${timings[name]} ms` : "saved") : "waiting..."}</small>
                  </header>
                  <p className="hint">{PIPELINE_INFO[name].what}</p>
                  {views[name] ? <RankList docs={views[name].docs} title={PIPELINE_INFO[name].label} /> : <span className="spinner" />}
                </div>
              ))}
            </div>
          </Section>

          <Section title="4. The scores" hint="Every score runs from 0 (bad) to 1 (perfect). Hover a heading for what it asks.">
            {answerable ? (
              <div className="table-scroll">
                <table className="scoretable">
                  <thead>
                    <tr>
                      <th>Pipeline</th>
                      <th>Where the right documents landed</th>
                      {PLAIN_METRICS.filter((m) => m.key !== "P@5").map((m) => (
                        <th key={m.key} title={`${m.asks} ${m.how}`}>
                          {m.name}
                          <small>{m.asks}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PIPELINES.map((name) => {
                      const view = views[name];
                      return (
                        <tr key={name}>
                          <td>
                            <Pill tone={PIPELINE_INFO[name].tone}>{PIPELINE_INFO[name].label}</Pill>
                          </td>
                          <td>
                            {view ? (
                              <div className="landed">
                                {Object.entries(view.found).map(([doc, rank]) => (
                                  <Pill key={doc} tone={rank ? (q.relevant[doc] === 2 ? "up" : "warn") : "down"} title={prettyDoc(doc)}>
                                    {short(doc)}: {rank ? `#${rank}` : "not found"}
                                  </Pill>
                                ))}
                              </div>
                            ) : (
                              <span className="spinner" />
                            )}
                          </td>
                          {PLAIN_METRICS.filter((m) => m.key !== "P@5").map((m) => (
                            <td key={m.key}>{view?.scores ? <Score value={view.scores[m.key]} /> : "-"}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="hint">This question has no right documents, so there is no ranking to score. For questions like this the checks below are what matters.</p>
            )}

            {done && answerable && (
              <>
                <div className="kicker">In plain words</div>
                <ul className="explain">
                  {verdict(views).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <details className="calc">
                  <summary>How these numbers were calculated for "Ensemble + rerank"</summary>
                  <ul className="explain">
                    {(() => {
                      const view = views.rerank;
                      const total = Object.keys(q.relevant).length;
                      const inTop5 = Object.values(view.found).filter((rank) => rank != null && rank <= 5).length;
                      const ranks = Object.values(view.found).filter((rank): rank is number => rank != null);
                      const first = ranks.length ? Math.min(...ranks) : null;
                      return (
                        <>
                          <li>
                            <b>Recall@5 = {view.scores?.["R@5"].toFixed(2)}.</b> {total} right document{total > 1 ? "s" : ""} exist{total > 1 ? "" : "s"} and {inTop5} {inTop5 === 1 ? "is" : "are"} in the top 5: {inTop5} / {total}.
                          </li>
                          <li>
                            <b>MRR = {view.scores?.MRR.toFixed(2)}.</b> {first ? `The first right document is at position ${first}: 1 / ${first}.` : "No right document was returned, so the score is 0."}
                          </li>
                          <li>
                            <b>nDCG@5 = {view.scores?.["nDCG@5"].toFixed(2)}.</b> The ideal order puts the primary document first, then the supporting one. This score compares the actual order with that ideal.
                          </li>
                          <li>
                            <b>Precision@5 = {view.scores?.["P@5"].toFixed(2)}.</b> {inTop5} right document{inTop5 === 1 ? "" : "s"} among 5 results. It is low when few documents are right, which is normal.
                          </li>
                        </>
                      );
                    })()}
                  </ul>
                </details>
              </>
            )}
          </Section>

          {checks && (
            <Section title="5. Safety checks" hint="These matter even when there is nothing to rank.">
              <div className="checks">
                <div className={`check ${checks.gate.correct ? "ok" : "fail"}`}>
                  <b>{checks.gate.correct ? "Pass" : "Fail"}: relevance gate</b>
                  <p>
                    The system refuses when the best Gemini score is below {checks.gate.threshold}. Here the best score is{" "}
                    {checks.gate.best_score == null ? "n/a" : <ScoreBar value={checks.gate.best_score} threshold={checks.gate.threshold} />}.
                  </p>
                  <p className="hint">
                    {checks.gate.should_pass
                      ? checks.gate.passes
                        ? "This question has an answer and the gate lets it through. Correct."
                        : "This question has an answer, but the gate would refuse it. A wrong refusal."
                      : checks.gate.passes
                        ? "This question should be refused, but the gate lets it through. The answer model would have to refuse on its own."
                        : "This question should be refused and the gate stops it before the model writes anything. Correct."}
                  </p>
                </div>
                {(() => {
                  const leaks = Object.values(checks.acl).reduce((sum, item) => sum + item.above_role + item.blocked_retrieved, 0);
                  return (
                    <div className={`check ${leaks === 0 ? "ok" : "fail"}`}>
                      <b>{leaks === 0 ? "Pass" : "Fail"}: access control</b>
                      <p>
                        {leaks === 0
                          ? `No chunk above the ${ROLE_INFO[q.role].label.toLowerCase()} access level and no blocked document was retrieved by any pipeline.`
                          : `${leaks} chunk${leaks > 1 ? "s" : ""} that this role should never see were retrieved.`}
                      </p>
                    </div>
                  );
                })()}
              </div>
              <p className="hint">Answer quality (is the generated answer correct and properly cited?) is not scored yet. It is listed as planned under "Start here".</p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
