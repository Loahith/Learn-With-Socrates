import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import MarkdownView from "@/components/MarkdownView";
import { Send, Lightbulb, Sparkles, ListChecks, BookOpen, HelpCircle, ArrowLeft, FileText, ClipboardCheck, Check, Circle, CircleDot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Badge, EmptyState, ProgressBar, Skeleton, Spinner } from "@/components/ui/misc";
import api, { errMsg } from "@/lib/api";
import { BLOOM, BLOOM_COLORS, cn, fmtDuration, isInvalidKeypress } from "@/lib/utils";
import { toast } from "@/store/toast";

const MODES = [
  { code: "socratic", label: "Socratic Mode", icon: HelpCircle },
  { code: "direct", label: "Direct Teaching", icon: BookOpen },
];
const ACTIONS = [
  { id: "hint", label: "Hint", icon: Lightbulb },
  { id: "simplify", label: "Explain simply", icon: Sparkles },
  { id: "examples", label: "Examples", icon: ListChecks },
  { id: "summarize", label: "Summarize", icon: FileText },
];

function Message({ m }) {
  if (m.role === "divider") {
    return <div className="py-1 text-center text-xs font-semibold text-grey">— {m.content} —</div>;
  }
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white">{m.content}</div>
      </div>
    );
  }
  const cited = (m.sources || []).filter((s) => s.cited);
  return (
    <div className="flex gap-3">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-gold">S</span>
      <div className="min-w-0 max-w-[92%]">
        <div className="rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3">
          <MarkdownView content={m.content} />
        </div>
        {cited.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cited.map((s) => (
              <span key={s.id} title={s.snippet} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                <FileText size={11} /> {s.id} · {s.resource_title}, {s.location}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Workspace() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [resources, setResources] = useState(null);
  const [outline, setOutline] = useState([]);
  const [data, setData] = useState(null); // session payload
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("chat"); // mobile panel
  const bottomRef = useRef(null);
  const startedRef = useRef(new Set());
  const modeRef = useRef(null);

  const resourceId = params.get("resource") ? Number(params.get("resource")) : null;
  const topicId = params.get("topic") ? Number(params.get("topic")) : null;
  const session = data?.session;
  if (session) modeRef.current = session.mode;

  // 1) list completed resources
  useEffect(() => {
    api.get("/resources", { params: { status: "completed" } })
      .then((r) => {
        setResources(r.data.resources);
        if (!resourceId && r.data.resources[0]) setParams({ resource: r.data.resources[0].id }, { replace: true });
      })
      .catch((e) => { toast.error(errMsg(e)); setResources([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) load outline + session whenever resource/topic changes
  useEffect(() => {
    if (!resourceId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const o = await api.get(`/resources/${resourceId}/topics`);
        if (cancelled) return;
        setOutline(o.data.chapters);
        const firstTopic = o.data.chapters[0]?.topics[0]?.id ?? null;
        const tid = topicId ?? firstTopic;
        const body = { resource_id: resourceId, topic_id: tid };
        if (modeRef.current) body.mode = modeRef.current; // keep the chosen mode while moving between topics
        const s = await api.post("/learning/session", body);
        if (cancelled) return;
        setData(s.data);
        setMessages(s.data.messages);
      } catch (e) {
        if (!cancelled) toast.error(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resourceId, topicId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending]);

  // 3) study-time heartbeat (only while the tab is visible)
  useEffect(() => {
    if (!session?.id) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") api.post(`/learning/session/${session.id}/heartbeat`, { seconds: 60 }).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [session?.id]);

  const refreshSession = useCallback(async (id) => {
    try { const r = await api.get(`/learning/session/${id}`); setData(r.data); } catch {}
  }, []);

  const send = useCallback(async (text, action) => {
    if (!session || sending) return;
    const label = action ? ACTIONS.find((a) => a.id === action)?.label || "Start" : text;
    const temp = { id: `tmp-${Date.now()}`, role: "user", content: action === "start" ? "Let's begin." : label, sources: [] };
    setMessages((m) => [...m, temp]);
    setSending(true);
    try {
      const r = await api.post("/learning/chat", { session_id: session.id, message: text || "", action });
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), r.data.user_message, r.data.assistant_message]);
      setData((d) => ({ ...d, session: r.data.session }));
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      toast.error(errMsg(e, "Socrates could not answer."));
    } finally {
      setSending(false);
    }
  }, [session, sending]);

  // auto-start a brand-new conversation
  useEffect(() => {
    if (session && messages.length === 0 && !startedRef.current.has(session.id) && !loading) {
      startedRef.current.add(session.id);
      send(null, "start");
    }
  }, [session, messages.length, loading, send]);

  const submit = (e) => {
    e?.preventDefault();
    const t = input.trim();
    if (!t) return;
    setInput("");
    send(t);
  };

  const switchMode = async (code) => {
    if (!session || code === session.mode) return;
    try {
      const r = await api.patch(`/learning/session/${session.id}/mode`, { mode: code });
      setData((d) => ({ ...d, session: r.data.session }));
      setMessages((m) => [...m, { id: `div-${Date.now()}`, role: "divider", content: `Switched to ${MODES.find((x) => x.code === code).label}` }]);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const setDifficulty = async (difficulty) => {
    try {
      const r = await api.patch(`/learning/session/${session.id}`, { difficulty });
      setData((d) => ({ ...d, session: r.data.session }));
    } catch (e) { toast.error(errMsg(e)); }
  };

  const chooseTopic = (id) => { setTab("chat"); setParams({ resource: resourceId, topic: id }); };
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  if (!resources) return <Skeleton className="h-[70vh]" />;
  if (resources.length === 0) {
    return (
      <EmptyState icon={FileText} title="No resources ready yet" text="Upload a study resource and wait for it to finish processing, then come back to learn."
        action={<Link to="/resources"><Button>Go to My Resources</Button></Link>} />
    );
  }

  const topic = data?.topic;
  const bloom = data?.bloom;
  const flatTopics = outline.flatMap((c) => c.topics.map((t) => ({ ...t, chapter: c.title })));
  const related = topic ? flatTopics.filter((t) => t.chapter_id === topic.chapter_id && t.id !== topic.id) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button onClick={() => navigate("/resources")} className="flex items-center gap-1 text-sm font-semibold text-grey hover:text-forest"><ArrowLeft size={16} /> Back to Resources</button>
        <Select className="h-10 w-full min-w-0 sm:w-auto sm:max-w-xs" value={resourceId || ""} onChange={(e) => setParams({ resource: e.target.value })} aria-label="Resource">
          {resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </Select>
        {session && (
          <Select className="h-10 w-full min-w-0 sm:ml-auto sm:w-auto" value={session.difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Explanation level">
            <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </Select>
        )}
      </div>

      {/* mobile tabs */}
      <div className="flex gap-1 rounded-xl bg-black/5 p-1 lg:hidden">
        {[["outline", "Outline"], ["chat", "Socrates"], ["insights", "Insights"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("flex-1 rounded-lg py-2 text-sm font-semibold", tab === id ? "bg-white text-forest shadow-sm" : "text-grey")}>{label}</button>
        ))}
      </div>

      <div className="grid gap-4 lg:h-[calc(100vh-11rem)] lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* LEFT: outline */}
        <Card className={cn("overflow-y-auto p-3", tab === "outline" ? "block" : "hidden", "lg:block")}>
          <p className="px-2 pb-2 font-display font-bold">{resources.find((r) => r.id === resourceId)?.title}</p>
          {outline.map((ch) => (
            <div key={ch.id} className="mb-3">
              <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-grey">{ch.title}</p>
              {ch.topics.map((t) => {
                const active = topic?.id === t.id;
                const Icon = t.status === "mastered" ? Check : active ? CircleDot : Circle;
                return (
                  <button key={t.id} onClick={() => chooseTopic(t.id)} className={cn("flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm", active ? "bg-brand/10 font-semibold text-forest" : "hover:bg-ivory")}>
                    <Icon size={16} className={cn("mt-0.5 shrink-0", t.status === "mastered" ? "text-brand" : active ? "text-brand" : "text-grey")} />
                    <span>{t.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </Card>

        {/* CENTER: chat */}
        <Card className={cn("flex min-h-[70vh] flex-col overflow-hidden lg:min-h-0", tab === "chat" ? "flex" : "hidden", "lg:flex")}>
          <div className="flex items-center gap-2 border-b border-line p-3">
            <div className="flex flex-1 rounded-xl bg-ivory p-1">
              {MODES.map(({ code, label, icon: Icon }) => (
                <button key={code} onClick={() => switchMode(code)} disabled={!session}
                  className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition", session?.mode === code ? "bg-forest text-white shadow-sm" : "text-grey hover:text-forest")}>
                  <Icon size={15} /> <span className="hidden sm:inline">{label}</span><span className="sm:hidden">{code === "socratic" ? "Socratic" : "Direct"}</span>
                </button>
              ))}
            </div>
          </div>
          {topic && <div className="border-b border-line bg-ivory/60 px-4 py-2 text-xs text-grey">Topic: <span className="font-semibold text-forest">{topic.title}</span></div>}

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {loading && <Skeleton className="h-24" />}
            {messages.map((m) => <Message key={m.id} m={m} />)}
            {sending && <div className="flex items-center gap-2 text-sm text-grey"><Spinner /> Thinking…</div>}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {ACTIONS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => send(null, id)} disabled={sending || !session} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-forest hover:bg-ivory disabled:opacity-50">
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            {isInvalidKeypress(input) && (
              <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                <AlertCircle size={14} className="shrink-0 text-amber-600" />
                <span>Invalid keypress detected ({input.trim()}). Please type your response clearly.</span>
              </div>
            )}
            <form onSubmit={submit} className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
                rows={1}
                placeholder={session?.mode === "socratic" ? "Type your response…" : "Ask anything about this topic…"}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <Button type="submit" size="icon" className="h-11 w-11 rounded-full" disabled={sending || !input.trim()} aria-label="Send"><Send size={18} /></Button>
            </form>
          </div>
        </Card>

        {/* RIGHT: insights */}
        <div className={cn("space-y-3 overflow-y-auto", tab === "insights" ? "block" : "hidden", "lg:block")}>
          {topic ? (
            <>
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-bold">Key Concepts</h3>
                <div className="flex flex-wrap gap-1.5">
                  {topic.key_concepts.length ? topic.key_concepts.map((k) => <Badge key={k} tone="green">{k}</Badge>) : <p className="text-sm text-grey">None extracted.</p>}
                </div>
                {topic.objectives.length > 0 && (
                  <>
                    <h3 className="mb-1 mt-4 text-sm font-bold">Learning Objectives</h3>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-grey">{topic.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
                  </>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="mb-2 text-sm font-bold">Source References</h3>
                {lastAssistant?.sources?.length ? (
                  <ul className="space-y-2">
                    {lastAssistant.sources.map((s) => (
                      <li key={s.id} className="rounded-xl bg-ivory p-2.5 text-xs">
                        <p className="font-semibold text-forest">{s.id} · {s.resource_title}, {s.location} {s.cited && <Badge tone="green" className="ml-1">cited</Badge>}</p>
                        <p className="mt-0.5 line-clamp-3 text-grey">{s.snippet}…</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-grey">Sources appear with each answer.</p>}
              </Card>

              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold">Bloom's Level</h3>
                  <Badge tone="gold">Level {bloom?.current_level}: {BLOOM[(bloom?.current_level || 1) - 1]}</Badge>
                </div>
                <div className="space-y-1.5">
                  {bloom?.levels.map((l) => (
                    <div key={l.level} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-grey">{l.name}</span>
                      <ProgressBar className="flex-1" value={l.score * 100} color="bg-brand" />
                      <span className="w-8 text-right font-semibold">{l.attempts ? `${Math.round(l.score * 100)}%` : "–"}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-grey">
                  <span>Mastery {Math.round((data.progress.mastery || 0) * 100)}%</span>
                  <span>{fmtDuration(data.progress.time_spent_seconds)} studied</span>
                </div>
                <ProgressBar className="mt-1" value={(data.progress.mastery || 0) * 100} />
                <p className="mt-2 text-[11px] text-grey">Mastery grows through quizzes, not by reading explanations.</p>
                <Link to={`/assessments?resource=${resourceId}&topic=${topic.id}`}>
                  <Button size="sm" variant="soft" className="mt-3 w-full"><ClipboardCheck size={15} /> Quiz me on this topic</Button>
                </Link>
              </Card>

              {session?.misconceptions?.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-2 text-sm font-bold">Areas to revisit</h3>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-grey">{session.misconceptions.slice(-4).map((m) => <li key={m}>{m}</li>)}</ul>
                </Card>
              )}

              {related.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-2 text-sm font-bold">Related Topics</h3>
                  {related.map((t) => <button key={t.id} onClick={() => chooseTopic(t.id)} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ivory">{t.title}</button>)}
                </Card>
              )}
            </>
          ) : <Skeleton className="h-64" />}
        </div>
      </div>
    </div>
  );
}
