import { useEffect, useState } from "react";
import { ROLE_INFO } from "../data/content";
import { useApp } from "../lib/app";
import type { Example, Mode, Role } from "../types";
import { Pill } from "./ui";

interface Props {
  examples: Example[];
  running: boolean;
  runLabel?: string;
  onRun: (question: string, role: Role, mode: Mode) => void;
  onStop?: () => void;
}

export function AskPanel({ examples, running, runLabel = "Run", onRun, onStop }: Props) {
  const { status } = useApp();
  const [question, setQuestion] = useState(examples[0]?.question ?? "");
  const [role, setRole] = useState<Role>(examples[0]?.role ?? "employee");
  const [mode, setMode] = useState<Mode>("auto");
  const [picked, setPicked] = useState(0);

  useEffect(() => {
    if (examples.length && !question) {
      setQuestion(examples[0].question);
      setRole(examples[0].role);
    }
  }, [examples, question]);

  const replay = !status.live || mode === "cached";
  const run = (q = question, r = role) => onRun(q, r, replay ? "cached" : "auto");

  return (
    <section className="card ask">
      <div className="kicker">Ask a question</div>
      <div className="roles">
        {(Object.keys(ROLE_INFO) as Role[]).map((key) => (
          <button key={key} className={`role ${role === key ? "role-on" : ""}`} onClick={() => setRole(key)} title={ROLE_INFO[key].blurb}>
            <b>{ROLE_INFO[key].label}</b>
            <span>{ROLE_INFO[key].reads.join(" + ")}</span>
          </button>
        ))}
      </div>
      <textarea
        value={question}
        rows={3}
        maxLength={500}
        readOnly={replay}
        onChange={(event) => {
          setQuestion(event.target.value);
          setPicked(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !running) run();
        }}
        placeholder="Ask about the Azure documentation or the internal runbooks"
      />
      <div className="ask-actions">
        {status.live ? (
          <div className="toggle">
            <button className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>
              Live
            </button>
            <button className={mode === "cached" ? "on" : ""} onClick={() => setMode("cached")}>
              Replay
            </button>
          </div>
        ) : (
          <Pill tone="warn" title={`Missing: ${status.missing.join(", ")}`}>
            Replay mode: pick an example
          </Pill>
        )}
        {running ? (
          <button className="btn btn-stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button className="btn" onClick={() => run()} disabled={question.trim().length < 3}>
            {runLabel}
          </button>
        )}
      </div>
      <div className="kicker">Examples</div>
      <div className="chips">
        {examples.map((example, index) => (
          <button
            key={`${example.label}-${example.role}`}
            className={`chip ${picked === index ? "chip-on" : ""}`}
            disabled={running}
            onClick={() => {
              setPicked(index);
              setQuestion(example.question);
              setRole(example.role);
              run(example.question, example.role);
            }}
          >
            {example.label}
            <small>{ROLE_INFO[example.role].label}</small>
          </button>
        ))}
      </div>
      {examples[picked] && <p className="why">{examples[picked].why}</p>}
    </section>
  );
}
