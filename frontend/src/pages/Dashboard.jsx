import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, UploadCloud, Play, ClipboardCheck, BarChart3, ChevronRight, FileText, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProgressRing from "@/components/ui/progress-ring";
import { Badge, Skeleton } from "@/components/ui/misc";
import api, { errMsg } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { fmtDuration } from "@/lib/utils";
import { toast } from "@/store/toast";
import Statue from "@/components/Statue";

const quick = [
  { label: "Upload Resources", icon: UploadCloud, to: "/resources" },
  { label: "Start Learning", icon: Play, to: "/workspace" },
  { label: "Take Quiz", icon: ClipboardCheck, to: "/assessments" },
  { label: "View Analytics", icon: BarChart3, to: "/analytics" },
];

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/analytics/dashboard").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  const first = (user?.name || "").split(" ")[0];
  if (!d) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-48 lg:col-span-2" /><Skeleton className="h-48" /></div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const c = d.continue_learning;
  const stats = [
    { label: "Topics mastered", value: d.topics_completed },
    { label: "In progress", value: d.topics_in_progress },
    { label: "Learning time", value: fmtDuration(d.study_seconds) },
    { label: "Quiz accuracy", value: d.quiz_accuracy != null ? `${Math.round(d.quiz_accuracy)}%` : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {user?.profile?.avatar_url && (
          <img
            src={user.profile.avatar_url}
            alt={user.name}
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-forest/20 shadow-sm"
          />
        )}
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Welcome back, {first}! 👋</h1>
          <p className="text-grey">
            {user?.profile?.institution
              ? `${user.profile.institution}${user.profile.major ? ` · ${user.profile.major}` : ""}`
              : "Let's continue your learning journey."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="relative overflow-hidden bg-gradient-to-br from-sage/30 to-white lg:col-span-2">
          <Statue className="absolute -bottom-2 right-0 hidden h-[115%] w-auto max-w-none sm:block" />
          <CardContent className="relative flex h-full flex-col justify-between gap-6 p-6 sm:max-w-[60%]">
            {c ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-brand">Continue Learning</p>
                  <h2 className="mt-1 text-2xl font-bold">{c.resource_title}</h2>
                  <p className="text-sm text-grey">{[c.chapter_title, c.topic_title].filter(Boolean).join(" · ") || "Whole resource"}</p>
                </div>
                <Link to={`/workspace?resource=${c.resource_id}${c.topic_id ? `&topic=${c.topic_id}` : ""}`}>
                  <Button>Resume Learning <ArrowRight size={16} /></Button>
                </Link>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-semibold text-brand">Get started</p>
                  <h2 className="mt-1 text-2xl font-bold">Upload your first study resource</h2>
                  <p className="text-sm text-grey">PDF, Word, slides, notes or scans. We'll turn them into topics you can learn.</p>
                </div>
                <Link to="/resources"><Button>Upload a resource <UploadCloud size={16} /></Button></Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center gap-2">
            <ProgressRing value={d.overall_progress} />
            <p className="text-sm text-grey">Overall progress</p>
            <p className="text-center text-xs text-grey">Based on assessed mastery across {d.topics_total} topics</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="font-display text-2xl font-extrabold text-forest">{s.value}</p>
            <p className="text-sm text-grey">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h3 className="mb-3 font-display text-lg font-bold">Quick Access</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {quick.map(({ label, icon: Icon, to }) => (
                <Link key={label} to={to}>
                  <Card className="flex flex-col items-center gap-2 p-4 text-center transition-shadow hover:shadow-md">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon size={22} /></span>
                    <span className="text-sm font-semibold text-forest">{label}</span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Recent Resources</h3>
              <Link to="/resources" className="text-sm font-semibold text-brand">View all</Link>
            </div>
            {d.recent_resources.length === 0 ? (
              <Card className="p-6 text-sm text-grey">No resources yet.</Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.recent_resources.map((r) => (
                  <Link key={r.id} to={r.status === "completed" ? `/workspace?resource=${r.id}` : "/resources"}>
                    <Card className="flex items-center gap-3 p-4 hover:shadow-md">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/25 text-[#7a5d22]"><FileText size={20} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{r.title}</p>
                        <p className="text-xs text-grey">{r.subject?.name || "Unsorted"}</p>
                      </div>
                      <Badge tone={r.status === "completed" ? "green" : r.status === "failed" ? "red" : "gold"}>{r.status}</Badge>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Recommended Topics</CardTitle></CardHeader>
            <CardContent className="space-y-1 pt-3">
              {d.recommended.length === 0 && <p className="text-sm text-grey">Upload a resource to get recommendations.</p>}
              {d.recommended.map((t) => (
                <Link key={t.topic_id} to={`/workspace?resource=${t.resource_id}&topic=${t.topic_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-ivory">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-grey">{t.reason}</p>
                  </div>
                  <ChevronRight size={16} className="text-grey" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>My Subjects</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-3">
              {d.subjects.length === 0 && <p className="text-sm text-grey">Subjects appear when you upload resources.</p>}
              {d.subjects.map((s) => (
                <Link key={s.id} to={`/resources?subject_id=${s.id}`}>
                  <Badge tone="green" className="py-1.5"><FolderOpen size={12} /> {s.name} · {s.resource_count}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
