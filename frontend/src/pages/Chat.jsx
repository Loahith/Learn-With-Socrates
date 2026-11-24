import { useCallback, useEffect, useRef, useState } from "react";
import MarkdownView from "@/components/MarkdownView";
import { Mic, MicOff, Send, Plus, Trash2, HelpCircle, BookOpen, Lightbulb, Sparkles, ListChecks, FileText, MessagesSquare, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import api, { errMsg } from "@/lib/api";
import useSpeech from "@/hooks/useSpeech";
import { cn, isInvalidKeypress } from "@/lib/utils";
import { toast } from "@/store/toast";
import Statue from "@/components/Statue";

const MODES = [
  { code: "socratic", label: "Socratic", icon: HelpCircle },
  { code: "direct", label: "Direct", icon: BookOpen },
];
const ACTIONS = [
  { id: "hint", label: "Hint", icon: Lightbulb },
  { id: "simplify", label: "Explain simply", icon: Sparkles },
  { id: "examples", label: "Examples", icon: ListChecks },
  { id: "summarize", label: "Summarize", icon: FileText },
];
const LANGS = [
  ["en-US", "English (US)"],
  ["en-IN", "English (India)"],
  ["ta-IN", "தமிழ் (Tamil)"],
  ["hi-IN", "हिन्दी (Hindi)"],
  ["te-IN", "తెలుగు (Telugu)"],
  ["kn-IN", "ಕನ್ನಡ (Kannada)"],
  ["ml-IN", "മലയാളം (Malayalam)"],
  ["es-ES", "Español (Spanish)"],
  ["fr-FR", "Français (French)"],
  ["de-DE", "Deutsch (German)"],
];
const STARTERS = ["Teach me how the internet works", "Help me understand recursion", "Explain photosynthesis step by step", "What is supply and demand?"];
const MIC_ERRORS = {
  "not-allowed": "Microphone access was blocked. Click the lock icon in the address bar and allow the microphone.",
  "service-not-allowed": "Microphone access was blocked by the browser.",
  "no-speech": "I didn't hear anything. Try again.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection.",
};

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showList, setShowList] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [lang, setLang] = useState(() => localStorage.getItem("learn-with-socrates-lang") || localStorage.getItem("socraticai-lang") || "en-US");
  const [mode, setMode] = useState("socratic");
  const [difficulty, setDifficulty] = useState("beginner");
  const bottomRef = useRef(null);
  const speech = useSpeech(lang);

  useEffect(() => { localStorage.setItem("learn-with-socrates-lang", lang); }, [lang]);

  const loadList = useCallback(() => api.get("/chat/chats").then((r) => setChats(r.data.chats)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending]);

  const openChat = async (id) => {
    try {
      const r = await api.get(`/chat/chats/${id}`);
      setActiveId(id); setChat(r.data.chat); setMessages(r.data.messages);
      setMode(r.data.chat.mode); setDifficulty(r.data.chat.difficulty);
      if (r.data.chat.language) setLang(r.data.chat.language);
      setShowList(false);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const newChat = () => {
    setActiveId(null); setChat(null); setMessages([]); setShowList(false);
  };

  const removeChat = async (id) => {
    try {
      await api.delete(`/chat/chats/${id}`);
      if (id === activeId) newChat();
      loadList();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const ensureChat = async () => {
    if (activeId) return activeId;
    const r = await api.post("/chat/chats", { mode, difficulty, language: lang });
    setActiveId(r.data.chat.id); setChat(r.data.chat);
    return r.data.chat.id;
  };

  const changeLang = async (newLang) => {
    setLang(newLang);
    if (activeId) {
      try {
        await api.patch(`/chat/chats/${activeId}`, { language: newLang });
      } catch {}
    }
  };

  const send = useCallback(async (text, action) => {
    if (sending) return;
    if (!text && !action) return;
    const label = action ? ACTIONS.find((a) => a.id === action)?.label : text;
    const temp = { id: `tmp-${Date.now()}`, role: "user", content: label };
    setMessages((m) => [...m, temp]);
    setSending(true);
    try {
      const id = await ensureChat();
      const r = await api.post(`/chat/chats/${id}/message`, { message: text || "", action, language: lang });
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), r.data.user_message, r.data.assistant_message]);
      setChat(r.data.chat);
      loadList();
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      toast.error(errMsg(e, "Socrates could not answer."));
    } finally {
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, activeId, mode, difficulty, lang]);

  const submit = (e) => {
    e?.preventDefault();
    const t = input.trim();
    if (!t) return;
    setInput("");
    send(t);
  };

  const toggleMic = () => {
    if (speech.listening) return speech.stopListening();
    if (!speech.supportsSTT) return toast.error("Voice input works in Chrome or Edge. You can still type.");
    speech.listen((text, final, err) => {
      if (err) return toast.error(MIC_ERRORS[err] || `Microphone error: ${err}`);
      setInput(text);
      if (final && autoSend && text.trim()) { setInput(""); send(text.trim()); }
    });
  };

  const changeMode = async (code) => {
    setMode(code);
    if (!activeId) return;
    try { const r = await api.patch(`/chat/chats/${activeId}`, { mode: code }); setChat(r.data.chat); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const changeLevel = async (level) => {
    setDifficulty(level);
    if (!activeId) return;
    try { await api.patch(`/chat/chats/${activeId}`, { difficulty: level }); } catch (e) { toast.error(errMsg(e)); }
  };

  const ChatList = (
    <div className="flex h-full flex-col">
      <Button onClick={newChat} className="mb-3 w-full"><Plus size={16} /> New chat</Button>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {chats.length === 0 && <p className="px-2 text-sm text-grey">Your conversations appear here.</p>}
        {chats.map((c) => (
          <div key={c.id} className={cn("group flex items-center gap-1 rounded-xl px-2 py-2", c.id === activeId ? "bg-brand/10" : "hover:bg-ivory")}>
            <button onClick={() => openChat(c.id)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold">{c.title}</p>
              <p className="text-[11px] capitalize text-grey">{c.mode}</p>
            </button>
            <button onClick={() => removeChat(c.id)} aria-label="Delete chat" className="rounded-lg p-1.5 text-grey opacity-100 hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Ask Socrates</h1>
          <p className="text-sm text-grey">Learn any topic by voice or text. No uploads needed.</p>
        </div>
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowList(true)}><MessagesSquare size={16} /> Chats</Button>
      </div>

      <div className="grid gap-4 lg:h-[calc(100vh-10rem)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="hidden p-3 lg:block">{ChatList}</Card>

        {showList && (
          <div className="fixed inset-0 z-40 flex bg-black/40 lg:hidden" onClick={() => setShowList(false)}>
            <div className="h-full w-72 bg-white p-3" onClick={(e) => e.stopPropagation()}>
              <button className="mb-2 ml-auto block text-grey" onClick={() => setShowList(false)} aria-label="Close"><X size={20} /></button>
              {ChatList}
            </div>
          </div>
        )}

        <Card className="flex min-h-[75vh] flex-col overflow-hidden lg:min-h-0">
          {/* mode + level */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="flex rounded-xl bg-ivory p-1">
              {MODES.map(({ code, label, icon: Icon }) => (
                <button key={code} onClick={() => changeMode(code)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold", mode === code ? "bg-forest text-white shadow-sm" : "text-grey hover:text-forest")}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
            <Select className="h-10 w-auto" value={difficulty} onChange={(e) => changeLevel(e.target.value)} aria-label="Level">
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </Select>
          </div>

          {/* voice input settings */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-ivory/60 px-3 py-2 text-xs">
            <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-forest">
              <input type="checkbox" className="accent-[#28765a]" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
              Send when I stop talking
            </label>
            <div className="flex items-center gap-1.5 text-grey">
              <span>Language:</span>
              <select value={lang} onChange={(e) => changeLang(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1 text-forest" aria-label="Teaching and voice language">
                {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !sending && (
              <div className="mx-auto max-w-md py-8 text-center">
                <Statue className="mx-auto mb-2 h-36 w-auto drop-shadow-[0_10px_14px_rgba(36,59,53,0.25)]" />
                <h2 className="text-lg font-bold">What would you like to learn?</h2>
                <p className="mt-1 text-sm text-grey">Tap the microphone and speak, or type. In Socratic mode I'll guide you with questions.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-forest hover:bg-ivory">{s}</button>)}
                </div>
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white">{m.content}</div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-gold">S</span>
                  <div className="min-w-0 max-w-[92%]">
                    <div className="rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3">
                      <MarkdownView content={m.content} />
                    </div>
                  </div>
                </div>
              )
            )}
            {sending && <div className="flex items-center gap-2 text-sm text-grey"><Spinner /> Thinking…</div>}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="border-t border-line p-3">
            {messages.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {ACTIONS.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => send(null, id)} disabled={sending} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-forest hover:bg-ivory disabled:opacity-50"><Icon size={13} /> {label}</button>
                ))}
              </div>
            )}
            {speech.listening && <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-600"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" /> Listening… speak now</p>}
            {isInvalidKeypress(input) && (
              <div className="mb-2 flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                <AlertCircle size={14} className="shrink-0 text-amber-600" />
                <span>Invalid keypress detected ({input.trim()}). Please type your response clearly.</span>
              </div>
            )}
            <form onSubmit={submit} className="flex items-end gap-2">
              <button type="button" onClick={toggleMic} aria-label={speech.listening ? "Stop listening" : "Speak"}
                className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition", speech.listening ? "border-red-300 bg-red-50 text-red-600" : "border-line bg-white text-brand hover:bg-ivory")}>
                {speech.listening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
                placeholder={mode === "socratic" ? "Type or speak your answer…" : "Ask me anything…"}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              <Button type="submit" size="icon" className="h-11 w-11 rounded-full" disabled={sending || !input.trim()} aria-label="Send"><Send size={18} /></Button>
            </form>
            {!speech.supportsSTT && <p className="mt-2 text-xs text-grey">Voice input is not supported in this browser. Use Chrome or Edge, or type your message.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
