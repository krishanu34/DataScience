import { useState } from "react";
import { Intro } from "../evals/Intro";
import { Results } from "../evals/Results";
import { ScoreOne } from "../evals/ScoreOne";

type View = "intro" | "one" | "results";

const VIEWS: { id: View; label: string; blurb: string }[] = [
  { id: "intro", label: "Start here", blurb: "What an evaluation is and what the scores mean" },
  { id: "one", label: "Score one question", blurb: "Pick a test question, run it, and see how it scores" },
  { id: "results", label: "Results for all questions", blurb: "How the four pipelines compare overall" },
];

export function Evals() {
  const [view, setView] = useState<View>("intro");
  return (
    <div className="evals">
      <nav className="subtabs">
        {VIEWS.map((item, index) => (
          <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => setView(item.id)}>
            <b>
              {index + 1}. {item.label}
            </b>
            <span>{item.blurb}</span>
          </button>
        ))}
      </nav>
      {view === "intro" && <Intro go={(id) => setView(id as View)} />}
      {view === "one" && <ScoreOne />}
      {view === "results" && <Results />}
    </div>
  );
}
