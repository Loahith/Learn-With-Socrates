import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UploadCloud, FileText, Presentation, Image as ImageIcon, Trash2, Pencil, Eye, RefreshCw, Play, Search, FolderOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, EmptyState, Modal, Skeleton, Spinner } from "@/components/ui/misc";
import api, { errMsg } from "@/lib/api";
import { cn, fmtBytes, fmtDate } from "@/lib/utils";
import { toast } from "@/store/toast";

const TYPES = ["all", "pdf", "docx", "pptx", "txt", "md", "image"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "tiff", "bmp", "webp"];
const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.tiff,.bmp,.webp";

const statusTone = { uploaded: "grey", processing: "gold", completed: "green", failed: "red" };
const statusLabel = { uploaded: "Uploaded", processing: "Processing", completed: "Completed", failed: "Failed" };

function TypeIcon({ type }) {
  const Icon = type === "pptx" ? Presentation : IMAGE_EXT.includes(type) ? ImageIcon : FileText;
  const tone = type === "pdf" ? "bg-red-50 text-red-600" : type === "docx" ? "bg-sky-50 text-sky-700" : type === "pptx" ? "bg-orange-50 text-orange-600" : "bg-brand/10 text-brand";
  return <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}><Icon size={22} /></span>;
}

function UploadModal({ open, onClose, subjects, onDone }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) { setFile(null); setTitle(""); setSubject(""); }
  }, [open]);

  const pick = (f) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast.error("File is larger than 25 MB.");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Choose a file first.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    fd.append("subject", subject);
    setBusy(true);
    try {
      await api.post("/resources/upload", fd);
      toast.success("Uploaded. Processing has started.");
      onDone();
      onClose();
    } catch (err) {
      toast.error(errMsg(err, "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload a resource">
      <form onSubmit={submit} className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          className={cn("flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed p-8 text-center transition", drag ? "border-brand bg-brand/5" : "border-line hover:bg-ivory")}
        >
          <UploadCloud className="mb-2 text-brand" size={32} />
          {file ? (
            <p className="font-semibold">{file.name} <span className="font-normal text-grey">({fmtBytes(file.size)})</span></p>
          ) : (
            <>
              <p className="font-semibold">Drag and drop a file here</p>
              <p className="text-sm text-grey">or click to browse · PDF, DOCX, PPTX, TXT, MD, images · max 25 MB</p>
            </>
          )}
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Operating System Notes" /></Field>
        <Field label="Subject" hint="Leave empty and the AI will choose one.">
          <Input list="subject-list" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Computer Science" />
          <datalist id="subject-list">{subjects.map((s) => <option key={s.id} value={s.name} />)}</datalist>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? <Spinner className="text-white" /> : "Upload"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PreviewModal({ resource, onClose }) {
  const [tab, setTab] = useState("topics");
  const [outline, setOutline] = useState(null);
  const [page, setPage] = useState(1);
  const [pg, setPg] = useState(null);

  useEffect(() => {
    if (!resource) return;
    setTab("topics"); setOutline(null); setPage(1); setPg(null);
    api.get(`/resources/${resource.id}/topics`).then((r) => setOutline(r.data.chapters)).catch(() => setOutline([]));
  }, [resource]);

  useEffect(() => {
    if (!resource || tab !== "text") return;
    setPg(null);
    api.get(`/resources/${resource.id}/preview`, { params: { page } }).then((r) => setPg(r.data)).catch((e) => setPg({ error: errMsg(e) }));
  }, [resource, tab, page]);

  if (!resource) return null;
  return (
    <Modal open onClose={onClose} title={resource.title} wide>
      {resource.summary && <p className="mb-4 text-sm text-grey">{resource.summary}</p>}
      <div className="mb-4 flex gap-2">
        {["topics", "text"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", tab === t ? "bg-brand text-white" : "bg-black/5 text-grey")}>
            {t === "topics" ? "Extracted topics" : "Text preview"}
          </button>
        ))}
      </div>
      {tab === "topics" && (
        !outline ? <Skeleton className="h-40" /> :
        outline.length === 0 ? <p className="text-sm text-grey">No topics were extracted.</p> :
        <div className="space-y-4">
          {outline.map((ch) => (
            <div key={ch.id}>
              <h3 className="text-base font-bold">{ch.title}</h3>
              <ul className="mt-1 space-y-1">
                {ch.topics.map((t) => (
                  <li key={t.id} className="rounded-xl bg-ivory px-3 py-2 text-sm">
                    <span className="font-semibold">{t.title}</span>
                    <span className="text-grey"> · {resource.unit}{t.page_end !== t.page_start ? "s" : ""} {t.page_start}{t.page_end !== t.page_start ? `–${t.page_end}` : ""}</span>
                    {t.key_concepts?.length > 0 && <p className="mt-0.5 text-xs text-grey">{t.key_concepts.join(" · ")}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {tab === "text" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} /></Button>
            <span className="text-sm font-semibold">{resource.unit} {page} of {resource.page_count}</span>
            <Button size="sm" variant="outline" disabled={page >= resource.page_count} onClick={() => setPage((p) => p + 1)}><ChevronRight size={16} /></Button>
          </div>
          {!pg ? <Skeleton className="h-40" /> : pg.error ? <p className="text-sm text-grey">{pg.error}</p> : <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-ivory p-4 text-sm">{pg.text}</pre>}
        </div>
      )}
    </Modal>
  );
}

export default function Resources() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [type, setType] = useState("all");
  const [subjectId, setSubjectId] = useState(params.get("subject_id") || "");
  const [sort, setSort] = useState("newest");
  const [upload, setUpload] = useState(false);
  const [preview, setPreview] = useState(null);
  const [rename, setRename] = useState(null);
  const [del, setDel] = useState(null);

  const load = useCallback(() => {
    const p = { sort };
    if (q) p.q = q;
    if (subjectId) p.subject_id = subjectId;
    if (type !== "all" && type !== "image") p.type = type;
    return api.get("/resources", { params: p }).then((r) => {
      let list = r.data.resources;
      if (type === "image") list = list.filter((x) => IMAGE_EXT.includes(x.file_type));
      setItems(list);
    }).catch((e) => toast.error(errMsg(e)));
  }, [q, type, subjectId, sort]);

  const loadSubjects = () => api.get("/subjects").then((r) => setSubjects(r.data.subjects)).catch(() => {});
  useEffect(() => { loadSubjects(); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // poll while anything is still processing
  useEffect(() => {
    if (!items?.some((r) => r.status === "uploaded" || r.status === "processing")) return;
    const t = setInterval(() => { load(); loadSubjects(); }, 3000);
    return () => clearInterval(t);
  }, [items, load]);

  const doDelete = async () => {
    try {
      await api.delete(`/resources/${del.id}`);
      toast.success("Resource deleted.");
      setDel(null); load(); loadSubjects();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const doRename = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/resources/${rename.id}`, { title: rename.title, subject: rename.subject });
      toast.success("Saved.");
      setRename(null); load(); loadSubjects();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const reprocess = async (r) => {
    try { await api.post(`/resources/${r.id}/reprocess`); toast.info("Processing again..."); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">My Resources</h1>
          <p className="text-grey">Your study materials, organised by subject.</p>
        </div>
        <Button onClick={() => setUpload(true)}><UploadCloud size={18} /> Upload Resource</Button>
      </div>

      <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line px-3 text-grey">
          <Search size={16} className="shrink-0" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setParams({}); }} placeholder="Search your resources..." className="h-10 w-full min-w-0 bg-transparent text-sm text-charcoal outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <Select className="h-10 w-full min-w-0 sm:w-auto" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.resource_count})</option>)}
          </Select>
          <Select className="h-10 w-full min-w-0 sm:w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1 sm:pt-0">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setType(t)} className={cn("rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold uppercase transition-colors", type === t ? "bg-forest text-white" : "bg-black/5 text-grey hover:bg-black/10")}>{t}</button>
          ))}
        </div>
      </Card>

      {!items ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No resources found" text="Upload a PDF, document, slide deck or scanned notes to get started." action={<Button onClick={() => setUpload(true)}><UploadCloud size={18} /> Upload Resource</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => (
            <Card key={r.id} className="flex min-w-0 flex-col gap-3 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <TypeIcon type={r.file_type} />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate font-bold text-forest" title={r.title}>{r.title}</p>
                  <p className="truncate text-xs text-grey">{r.file_type.toUpperCase()} · {fmtBytes(r.file_size)} · {fmtDate(r.created_at)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={statusTone[r.status]}>
                  {r.status === "processing" && <Spinner className="!h-3 !w-3" />}
                  {statusLabel[r.status]}
                </Badge>
                {r.subject && <Badge tone="blue">{r.subject.name}</Badge>}
                {r.status === "completed" && <span className="text-xs text-grey">{r.chapter_count} chapters · {r.topic_count} topics</span>}
              </div>
              {r.status === "failed" && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-600 break-words">{r.error_message}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                {r.status === "completed" && (
                  <Link to={`/workspace?resource=${r.id}`}><Button size="sm"><Play size={14} /> Learn</Button></Link>
                )}
                {r.status === "completed" && <Button size="sm" variant="outline" onClick={() => setPreview(r)}><Eye size={14} /> Preview</Button>}
                {r.status === "failed" && <Button size="sm" variant="outline" onClick={() => reprocess(r)}><RefreshCw size={14} /> Retry</Button>}
                <div className="ml-auto flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Rename" onClick={() => setRename({ id: r.id, title: r.title, subject: r.subject?.name || "" })}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 hover:text-red-600" aria-label="Delete" onClick={() => setDel(r)}><Trash2 size={16} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <UploadModal open={upload} onClose={() => setUpload(false)} subjects={subjects} onDone={() => { load(); loadSubjects(); }} />
      <PreviewModal resource={preview} onClose={() => setPreview(null)} />

      <Modal open={!!rename} onClose={() => setRename(null)} title="Edit resource">
        {rename && (
          <form onSubmit={doRename} className="space-y-4">
            <Field label="Title"><Input value={rename.title} onChange={(e) => setRename({ ...rename, title: e.target.value })} /></Field>
            <Field label="Subject"><Input value={rename.subject} onChange={(e) => setRename({ ...rename, subject: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRename(null)}>Cancel</Button><Button type="submit">Save</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete resource?">
        <p className="text-sm text-grey">“{del?.title}”, its extracted topics, and related study sessions and quizzes will be permanently deleted.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDel(null)}>Cancel</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
