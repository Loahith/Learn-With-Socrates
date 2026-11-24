import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Layers, Target, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, ProgressBar, Skeleton, Spinner } from "@/components/ui/misc";
import api, { errMsg } from "@/lib/api";
import { BLOOM_COLORS, cn } from "@/lib/utils";
import { toast } from "@/store/toast";

const DESC = [
  "Recall definitions, facts and terms.",
  "Explain ideas in your own words.",
  "Use knowledge to solve problems.",
  "Compare, break down, find relationships.",
  "Judge options and justify decisions.",
  "Design something new.",
];

export default function Bloom() {
  const navigate = useNavigate();
  const [prog, setProg] = useState(null);
  const [topics, setTopics] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/bloom/progress"), api.get("/bloom/topics")])
      .then(([p, t]) => { setProg(p.data); setTopics(t.data.topics); })
      .catch((e) => toast.error(errMsg(e)));
  }, []);

  const practice = async (topic_id, bloom_level) => {
    setBusy(`${topic_id}-${bloom_level}`);
    try {
      const r = await api.post("/bloom/assessment", { topic_id, bloom_level, num_questions: 4 });
      navigate(`/assessments?open=${r.data.assessment.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (!prog || !topics) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-72" /><Skeleton className="h-64" /></div>;

  const chart = prog.levels.map((l) => ({ name: l.name, score: Math.round(l.score * 100) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">Bloom's Taxonomy</h1>
        <p className="text-grey">Track how deeply you understand, from remembering to creating.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Performance by level</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5dd" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                    {chart.map((_, i) => <Cell key={i} fill={BLOOM_COLORS[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-forest text-white">
          <CardContent className="flex h-full flex-col justify-center gap-2">
            <Layers className="text-gold" />
            <p className="text-sm text-white/70">Current learning level</p>
            <p className="font-display text-3xl font-extrabold text-white">{prog.current_level}. {prog.current_level_name}</p>
            <p className="text-sm text-white/70">{DESC[prog.current_level - 1]}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prog.levels.map((l) => (
          <Card key={l.level} className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold"><span className="mr-2" style={{ color: BLOOM_COLORS[l.level - 1] }}>{l.level}</span>{l.name}</h3>
              <span className="text-sm font-semibold">{l.topics_assessed ? `${Math.round(l.score * 100)}%` : "–"}</span>
            </div>
            <ProgressBar className="my-2" value={l.score * 100} />
            <p className="text-xs text-grey">{DESC[l.level - 1]}</p>
            <p className="mt-1 text-xs text-grey">{l.topics_assessed} topics assessed · {l.attempts} attempts</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target size={18} className="text-brand" /> Recommended activities</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {prog.recommendations.length === 0 && <p className="text-sm text-grey">Take a quiz to unlock personal recommendations.</p>}
            {prog.recommendations.map((r) => (
              <div key={r.topic_id} className="rounded-xl bg-ivory p-3">
                <p className="text-sm font-semibold">{r.topic}</p>
                <p className="text-xs text-grey">{r.level_name}: {r.activity}</p>
                <Button size="sm" className="mt-2" disabled={busy === `${r.topic_id}-${r.level}`} onClick={() => practice(r.topic_id, r.level)}>
                  {busy === `${r.topic_id}-${r.level}` ? <Spinner className="text-white" /> : `Practice ${r.level_name}`}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-gold" /> Weak concepts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {prog.weak_concepts.length === 0 && <p className="text-sm text-grey">No weak areas detected yet. Nice!</p>}
            {prog.weak_concepts.map((w) => (
              <div key={`${w.topic_id}-${w.level}`} className="flex items-center justify-between rounded-xl bg-ivory p-3">
                <div>
                  <p className="text-sm font-semibold">{w.topic}</p>
                  <p className="text-xs text-grey">{w.level_name} · {Math.round(w.score * 100)}%</p>
                </div>
                <Button size="sm" variant="outline" disabled={busy === `${w.topic_id}-${w.level}`} onClick={() => practice(w.topic_id, w.level)}>Retry</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Topics</h2>
        {topics.length === 0 ? (
          <EmptyState icon={Layers} title="No topics yet" text="Upload and process a resource to see its topics here." action={<Link to="/resources"><Button>Upload a resource</Button></Link>} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-grey">
                  <th className="p-3">Topic</th>
                  {BLOOM_COLORS.map((c, i) => <th key={i} className="p-3 text-center">L{i + 1}</th>)}
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {topics.map((t) => (
                  <tr key={t.topic_id} className="border-b border-line last:border-0">
                    <td className="p-3">
                      <p className="font-semibold">{t.title}</p>
                      <p className="text-xs text-grey">{t.resource_title}</p>
                    </td>
                    {t.levels.map((l) => (
                      <td key={l.level} className="p-3 text-center">
                        <span className={cn("inline-block min-w-9 rounded-lg px-1.5 py-1 text-xs font-bold", l.attempts === 0 ? "bg-black/5 text-grey" : l.score >= 0.7 ? "bg-brand/15 text-brand" : l.score >= 0.5 ? "bg-gold/30 text-[#7a5d22]" : "bg-red-50 text-red-600")}>
                          {l.attempts ? Math.round(l.score * 100) : "–"}
                        </span>
                      </td>
                    ))}
                    <td className="p-3 text-right">
                      <Button size="sm" variant="soft" disabled={busy === `${t.topic_id}-${t.current_level}`} onClick={() => practice(t.topic_id, t.current_level)}>
                        Practice L{t.current_level}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      <Badge tone="grey" className="hidden" />
    </div>
  );
}
