import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, ClipboardCheck, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge, EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import api, { errMsg } from "@/lib/api";
import { BLOOM, cn, fmtDate } from "@/lib/utils";
import { toast } from "@/store/toast";

const TYPE_LABEL = { mcq: "Multiple choice", descriptive: "Descriptive", application: "Application" };

function GenerateForm({ onCreated }) {
  const [params] = useSearchParams();
  const [resources, setResources] = useState([]);
  const [outline, setOutline] = useState([]);
  const [f, setF] = useState({ resource_id: params.get("resource") || "", topic_id: params.get("topic") || "", bloom_level: "", num_questions: 5, difficulty: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/resources", { params: { status: "completed" } }).then((r) => {
      setResources(r.data.resources);
      setF((x) => (x.resource_id || !r.data.resources[0] ? x : { ...x, resource_id: String(r.data.resources[0].id) }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!f.resource_id) return;
    api.get(`/resources/${f.resource_id}/topics`).then((r) => setOutline(r.data.chapters)).catch(() => setOutline([]));
  }, [f.resource_id]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value, ...(k === "resource_id" ? { topic_id: "" } : {}) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.resource_id) return toast.error("Choose a resource first.");
    setBusy(true);
    try {
      const body = { resource_id: Number(f.resource_id), num_questions: Number(f.num_questions) };
      if (f.topic_id) body.topic_id = Number(f.topic_id);
      if (f.bloom_level) body.bloom_level = Number(f.bloom_level);
      if (f.difficulty) body.difficulty = f.difficulty;
      const r = await api.post("/assessments/generate", body);
      onCreated(r.data.assessment);
    } catch (err) {
      toast.error(errMsg(err, "Could not create the quiz."));
    } finally {
      setBusy(false);
    }
  };

  if (resources.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="Nothing to quiz on yet" text="Upload and process a resource first." action={<Link to="/resources"><Button>Go to resources</Button></Link>} />;
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Wand2 size={18} className="text-brand" /> Create a quiz from your material</h2>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Resource">
          <Select value={f.resource_id} onChange={set("resource_id")}>{resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</Select>
        </Field>
        <Field label="Topic">
          <Select value={f.topic_id} onChange={set("topic_id")}>
            <option value="">Whole resource (no Bloom tracking)</option>
            {outline.map((c) => <optgroup key={c.id} label={c.title}>{c.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</optgroup>)}
          </Select>
        </Field>
        <Field label="Bloom level" hint="Mixed adapts to your current level.">
          <Select value={f.bloom_level} onChange={set("bloom_level")}>
            <option value="">Mixed (adaptive)</option>
            {BLOOM.map((b, i) => <option key={b} value={i + 1}>{i + 1}. {b}</option>)}
          </Select>
        </Field>
        <Field label="Difficulty">
          <Select value={f.difficulty} onChange={set("difficulty")}>
            <option value="">My default</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </Select>
        </Field>
        <Field label="Number of questions"><Input type="number" min={1} max={10} value={f.num_questions} onChange={set("num_questions")} /></Field>
        <div className="flex items-end"><Button type="submit" className="w-full" disabled={busy}>{busy ? <><Spinner className="text-white" /> Generating…</> : "Generate quiz"}</Button></div>
      </form>
    </Card>
  );
}

function QuestionBlock({ q, i, value, onChange, result, reveal }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-grey">Q{i + 1}</span>
        <Badge tone="grey">{TYPE_LABEL[q.type]}</Badge>
        <Badge tone="gold">{BLOOM[q.bloom_level - 1]}</Badge>
      </div>
      <p className="font-semibold">{q.question}</p>

      {q.type === "mcq" ? (
        <div className="mt-3 space-y-2">
          {q.options.map((o, idx) => {
            const correct = (result || reveal) && String(idx) === q.correct_answer;
            const wrong = result && value === String(idx) && !correct;
            return (
              <label key={idx} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", correct ? "border-brand bg-brand/10" : wrong ? "border-red-300 bg-red-50" : value === String(idx) ? "border-brand bg-brand/5" : "border-line hover:bg-ivory")}>
                <input type="radio" name={`q${q.id}`} checked={value === String(idx)} disabled={!!result || reveal} onChange={() => onChange(String(idx))} className="accent-[#28765a]" />
                {o}
              </label>
            );
          })}
        </div>
      ) : (
        !reveal && <Textarea rows={4} className="mt-3" disabled={!!result} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Write your answer…" />
      )}

      {(result || reveal) && (
        <div className="mt-3 space-y-2 rounded-xl bg-ivory p-3 text-sm">
          {result && (
            <p className={cn("flex items-center gap-2 font-semibold", result.score >= 0.7 ? "text-brand" : "text-red-600")}>
              {result.score >= 0.7 ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {Math.round(result.score * 100)}% · {result.feedback}
            </p>
          )}
          {q.type !== "mcq" && <p><span className="font-semibold">Model answer:</span> {q.correct_answer}</p>}
          {q.explanation && <p className="text-grey"><span className="font-semibold text-forest">Why:</span> {q.explanation}</p>}
          {q.source_ref && <p className="text-xs text-grey">Source: {q.source_ref}</p>}
        </div>
      )}
    </Card>
  );
}

function Quiz({ assessment, onExit }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const reveal = assessment.status === "submitted";

  const submit = async () => {
    const unanswered = assessment.questions.filter((q) => !answers[q.id]?.trim()).length;
    if (unanswered && !window.confirm(`${unanswered} question(s) are unanswered. Submit anyway?`)) return;
    setBusy(true);
    try {
      const r = await api.post("/assessments/submit", { assessment_id: assessment.id, answers });
      setResult(r.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const byId = result ? Object.fromEntries(result.questions.map((q) => [q.id, q])) : {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-xl font-bold">{assessment.title}</h2><p className="text-sm text-grey">{assessment.question_count} questions · {assessment.difficulty}</p></div>
        <Button variant="outline" onClick={onExit}>{result || reveal ? "Back" : "Cancel"}</Button>
      </div>
      {result && (
        <Card className="bg-forest p-6 text-white">
          <p className="text-sm text-white/70">Your score</p>
          <p className="font-display text-4xl font-extrabold text-white">{Math.round(result.score_pct)}%</p>
          <p className="text-sm text-white/70">{result.correct_count} of {result.total} questions answered well. Your Bloom progress was updated.</p>
        </Card>
      )}
      {assessment.questions.map((q, i) => (
        <QuestionBlock key={q.id} q={byId[q.id] || q} i={i} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} result={result ? byId[q.id] : null} reveal={reveal} />
      ))}
      {!result && !reveal && <Button size="lg" className="w-full" onClick={submit} disabled={busy}>{busy ? <><Spinner className="text-white" /> Grading…</> : "Submit answers"}</Button>}
    </div>
  );
}

export default function Assessments() {
  const [params, setParams] = useSearchParams();
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState(null);
  const [weak, setWeak] = useState([]);
  const [loadingOpen, setLoadingOpen] = useState(false);

  const loadHistory = () =>
    Promise.all([api.get("/assessments"), api.get("/assessments/results")])
      .then(([a, r]) => { setHistory(a.data.assessments); setWeak(r.data.weak_topics); })
      .catch((e) => toast.error(errMsg(e)));

  useEffect(() => { loadHistory(); }, []);

  const open = async (id) => {
    setLoadingOpen(true);
    try { const r = await api.get(`/assessments/${id}`); setActive(r.data.assessment); }
    catch (e) { toast.error(errMsg(e)); } finally { setLoadingOpen(false); }
  };

  useEffect(() => {
    const id = params.get("open");
    if (id) { open(id); setParams({}, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingOpen) return <Skeleton className="h-64" />;
  if (active) return <Quiz assessment={active} onExit={() => { setActive(null); loadHistory(); }} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">Assessments</h1>
        <p className="text-grey">Questions are generated from your own material and graded with feedback.</p>
      </div>
      <GenerateForm onCreated={setActive} />

      {weak.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">Weak topics</h2>
          <div className="flex flex-wrap gap-2">{weak.map((w) => <Badge key={w.topic} tone="red">{w.topic} · {w.avg_score}%</Badge>)}</div>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold">Assessment history</h2>
        {!history ? <Skeleton className="h-32" /> : history.length === 0 ? (
          <Card className="p-6 text-sm text-grey">No assessments yet.</Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-grey"><th className="p-3">Title</th><th className="p-3">Date</th><th className="p-3">Mode</th><th className="p-3">Score</th><th className="p-3" /></tr></thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="p-3 font-semibold">{a.title}</td>
                    <td className="p-3 text-grey">{fmtDate(a.created_at)}</td>
                    <td className="p-3 capitalize text-grey">{a.mode}</td>
                    <td className="p-3">{a.score_pct != null ? <Badge tone={a.score_pct >= 70 ? "green" : a.score_pct >= 50 ? "gold" : "red"}>{Math.round(a.score_pct)}%</Badge> : <Badge>Not taken</Badge>}</td>
                    <td className="p-3 text-right"><Button size="sm" variant="soft" onClick={() => open(a.id)}>{a.status === "submitted" ? "Review" : "Start"}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
