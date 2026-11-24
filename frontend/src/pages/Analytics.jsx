import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BookOpen, Clock, Target, HelpCircle, CheckCircle2, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar, Skeleton } from "@/components/ui/misc";
import api, { errMsg } from "@/lib/api";
import { BLOOM_COLORS, fmtDuration } from "@/lib/utils";
import { toast } from "@/store/toast";

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon size={22} /></span>
      <div><p className="font-display text-2xl font-extrabold text-forest">{value}</p><p className="text-xs text-grey">{label}</p></div>
    </Card>
  );
}

function ModeCard({ title, icon: Icon, m }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 flex items-center gap-2 font-bold"><Icon size={18} className="text-brand" /> {title}</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-grey">Study time</dt><dd className="font-bold">{m.study_minutes} min</dd></div>
        <div><dt className="text-grey">Questions asked</dt><dd className="font-bold">{m.messages}</dd></div>
        <div><dt className="text-grey">Quizzes taken</dt><dd className="font-bold">{m.quizzes}</dd></div>
        <div><dt className="text-grey">Quiz accuracy</dt><dd className="font-bold">{m.quiz_accuracy != null ? `${m.quiz_accuracy}%` : "–"}</dd></div>
      </dl>
    </Card>
  );
}

export default function Analytics() {
  const [dash, setDash] = useState(null);
  const [prog, setProg] = useState(null);
  const [act, setAct] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/analytics/dashboard"), api.get("/analytics/progress"), api.get("/analytics/activity")])
      .then(([d, p, a]) => { setDash(d.data); setProg(p.data); setAct(a.data); })
      .catch((e) => toast.error(errMsg(e)));
  }, []);

  if (!dash || !prog || !act) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid gap-4 sm:grid-cols-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div><Skeleton className="h-72" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">Learning Analytics</h1>
        <p className="text-grey">Built from your real study activity and quiz results.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat icon={BookOpen} label="Topics learned" value={prog.topics_learned} />
        <Stat icon={CheckCircle2} label="Chapters completed" value={prog.chapters_completed} />
        <Stat icon={Clock} label="Total study time" value={fmtDuration(dash.study_seconds)} />
        <Stat icon={Target} label="Quiz accuracy" value={dash.quiz_accuracy != null ? `${Math.round(dash.quiz_accuracy)}%` : "–"} />
        <Stat icon={Layers} label="Quizzes taken" value={dash.quizzes_taken} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Bloom's Taxonomy performance</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prog.bloom}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5dd" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>{prog.bloom.map((_, i) => <Cell key={i} fill={BLOOM_COLORS[i]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Weekly progress</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={prog.weekly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5dd" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11 }} unit="m" />
                  <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="l" dataKey="study_minutes" name="Study minutes" fill="#a8b89a" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="quiz_avg" name="Quiz average" stroke="#28765a" strokeWidth={2.5} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Learning activity · last 30 days</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={act.daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5dd" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} unit="m" />
                <Tooltip />
                <Area type="monotone" dataKey="minutes" name="Minutes" stroke="#28765a" fill="#28765a" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-bold">Socratic vs Direct mode</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ModeCard title="Socratic Learning" icon={HelpCircle} m={act.modes.socratic} />
          <ModeCard title="Direct Teaching" icon={BookOpen} m={act.modes.direct} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Strong concepts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {prog.strong.length === 0 && <p className="text-sm text-grey">Master a topic to see it here.</p>}
            {prog.strong.map((s) => (
              <div key={s.topic}><div className="mb-1 flex justify-between text-sm"><span>{s.topic}</span><span className="font-semibold">{s.mastery}%</span></div><ProgressBar value={s.mastery} /></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Needs more practice</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {prog.weak.length === 0 && <p className="text-sm text-grey">No weak concepts right now.</p>}
            {prog.weak.map((s) => (
              <div key={s.topic}><div className="mb-1 flex justify-between text-sm"><span>{s.topic}</span><span className="font-semibold">{s.mastery}%</span></div><ProgressBar value={s.mastery} color="bg-gold" /></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
