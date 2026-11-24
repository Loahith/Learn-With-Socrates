# Learn with Socrates – Resource-Based Intelligent Learning Platform

React + Vite + Tailwind v4 frontend · Flask backend · **MongoDB** database · **Groq** AI (Llama models).

```
socraticai/
├── backend/    Flask API (auth, resources, retrieval tutor, voice-chat tutor, Bloom, assessments, analytics)
│   ├── app/{db.py, serializers.py, cascade.py, routes/, services/}
│   └── .env.example
└── frontend/   React app (landing, auth, dashboard, resources, workspace, voice chat, bloom, quizzes, analytics, settings)
```

## 0. Install once (Windows)
- Node.js 20+ (`node -v`), Python 3.10–3.12 (`python --version`), VS Code.
- **MongoDB** – either:
  - *Local:* install MongoDB Community Server (choose "Install as a Service"), optionally MongoDB Compass to browse data. Default URI: `mongodb://localhost:27017`.
  - *Cloud:* free MongoDB Atlas cluster → Connect → Drivers → copy the `mongodb+srv://...` string (allow your IP in Network Access).
- **Groq key** (free): https://console.groq.com/keys
- Optional OCR for images / scanned PDFs: install Tesseract and set `TESSERACT_CMD` in `.env`.

## 1. Backend (PowerShell)
```powershell
cd socraticai\backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
copy .env.example .env               # then edit: MONGODB_URI and GROQ_API_KEY
python run.py
```
No database setup is needed: collections and indexes are created automatically on first start.
**Checkpoint:** http://127.0.0.1:5000/api/health → `{"status":"ok","database":true,"ai":true,...}`
(`database:false` = MongoDB unreachable, `ai:false` = no Groq key).

## 2. Frontend (second PowerShell window)
```powershell
cd socraticai\frontend
npm install
copy .env.example .env
npm run dev
```
Open http://localhost:5173.

## 3. Test the whole flow
1. Register → Dashboard.
2. My Resources → upload a PDF → Uploaded → Processing → Completed (see topics in Preview).
3. Learning Workspace → try Socratic, switch to Direct and back; the conversation stays.
4. Ask Socrates (Voice) → talk or type without uploading anything (use Chrome or Edge for the microphone).
5. Bloom's Taxonomy / Assessments → generate a quiz → submit → see feedback and progress.
6. Analytics → study time, weekly progress, Socratic-vs-Direct comparison.
In MongoDB Compass, open the `socraticai` database to see the collections (`users`, `resources`, `extracted_topics`, `chat_messages`, `bloom_progress`, ...).

## Design notes
- **Database:** PyMongo with plain documents. Each collection uses integer `_id`s from a `counters` collection, so API ids stay simple numbers. Related data is removed by `app/cascade.py` (MongoDB has no foreign-key cascades). Every query filters by `user_id`, so one student can never read another's data.
- **Retrieval (RAG):** documents → pages → ~900-character chunks (`resource_chunks`) → **BM25 keyword ranking** at question time. Groq has no embeddings API, so retrieval is keyword-based (works well for textbooks and notes; it matches words, not meaning). The top passages go to the model as untrusted `<passage>` blocks, it must cite `[S#]`, and the server maps those to real page/slide/section numbers. If nothing relevant is found, the tutor says so.
- **AI (Groq):** OpenAI-compatible chat completions with JSON mode. Default model `llama-3.3-70b-versatile`; set `GROQ_MODEL=llama-3.1-8b-instant` if you hit free-tier rate limits (faster, higher limits, less capable).
- **Voice:** uses the browser's built-in speech recognition and speech synthesis (no extra service).
- **Mastery** changes only through graded assessments; a topic is mastered when all six Bloom levels are ≥ 70 %.
- **Security:** hashed passwords, JWT with server-side logout (revoked tokens auto-expire via a TTL index), per-user ownership checks, file extension + signature validation, 25 MB limit, rate limiting, CORS allow-list, secrets only in backend `.env`.

## Common errors
| Problem | Fix |
|---|---|
| `database:false` / "Could not reach MongoDB" | Start the MongoDB service (Windows: Services → MongoDB Server → Start), or fix `MONGODB_URI`. For Atlas, whitelist your IP and URL-encode special characters in the password. |
| `pip install pymongo[srv]` quoting error in PowerShell | Run `pip install -r requirements.txt` (quotes are only needed if typing it by hand: `pip install "pymongo[srv]"`). |
| 503 "AI is not configured" | Put `GROQ_API_KEY` in `backend/.env`, restart the backend. |
| 502 "rate limit" / "busy" | Groq free-tier limit. Wait a few seconds, or switch to `llama-3.1-8b-instant`. |
| 502 "model ... decommissioned / not found" | Set `GROQ_MODEL` to a current model from https://console.groq.com/docs/models |
| Browser: "Cannot reach the server" | Backend not running on port 5000, or `CORS_ORIGINS` doesn't match the frontend URL. |
| Resource "Failed: No readable text" | Scanned file without OCR. Install Tesseract and set `TESSERACT_CMD`. |
| Old MySQL data is missing | The database changed to MongoDB; start fresh by registering and re-uploading (no automatic migration). |

## Deployment (after it runs locally)
Backend: `pip install waitress` (Windows) or `gunicorn` (Linux) and serve `run:app`; set `FLASK_DEBUG=0`, strong `SECRET_KEY`/`JWT_SECRET_KEY`, real `CORS_ORIGINS`, an Atlas `MONGODB_URI`, and a persistent `UPLOAD_FOLDER`. Frontend: `npm run build`, host `dist/` with `VITE_API_URL` pointing at the API (and an SPA fallback to `index.html`).
