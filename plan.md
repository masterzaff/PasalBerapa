> ✅ STATUS (Phase 1 & 2 COMPLETE — verified by testing agent, backend 7/7 & frontend 11/11, 0 bugs)
> - Client-side PDF text extraction (pdf.js) — VERIFIED
> - Client-side OCR for scanned PDFs (tesseract.js, `ind`) — VERIFIED
> - Configurable external endpoints via Settings + env vars; graceful "waiting for backend" states — VERIFIED
> - Full wrapper flow mask → analyze → unmask → risk dashboard → privacy vault — VERIFIED against reference stub
> - Reference contract stub lives at `{REACT_APP_BACKEND_URL}/api` (`/health`, `/mask`, `/analyze`) for demo/validation; default frontend env is EMPTY so real users see "waiting for backend".
> - Folders: `frontend/` (active), `ai_node/API_CONTRACT.md` (spec for user's real server), `backend/` (placeholder + optional reference stub).
> - NEXT: user provides real backend/ai_node endpoints → plug into Settings, no frontend rewrite needed.


# PasalBerapa? — Development Plan (Frontend-first Wrapper)

## 1) Objectives
- Deliver a **stateless, privacy-first** web app UI for analyzing Indonesian legal/contract PDFs.
- Build a **working core client-side pipeline**: PDF text extraction + OCR (scan PDFs) + extracted-text review.
- Implement a **wrapper integration layer** to call **external endpoints** (user-hosted later) for PII masking + analysis, with **configurable env vars** and clear “not connected” UX.
- Provide **API contract docs** for `backend/` and `ai_node/` so the user’s server can plug in without frontend rewrites.

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation): Client-side PDF→Text/OCR Extraction
**Goal:** Prove the hardest/riskiest part we own right now works: extracting readable text from diverse PDFs.

**User stories (POC):**
1. As a user, I can upload a PDF via drag-and-drop and see a filename + page count.
2. As a user, I can extract **selectable text** from a normal PDF and preview it.
3. As a user, I can run **OCR** on scanned pages and see progress per page.
4. As a user, I can choose extraction mode: **Auto / Text-only / OCR-only**.
5. As a user, I can copy the extracted text and download it as `.txt`.

**Steps:**
- Websearch best-practice for **pdf.js extraction + tesseract.js OCR** performance (page rendering scale, worker usage, memory).
- Add dependencies in `frontend/`: `pdfjs-dist`, `tesseract.js`.
- Implement a minimal “POC page” with:
  - Upload PDF → list pages
  - Text extraction via pdf.js
  - OCR pipeline: render page to canvas → tesseract recognize (`ind` language) → accumulate text
  - Progress UI + cancel/stop
- Validate on at least 2 sample PDFs (1 text PDF, 1 scanned).
- Fix until stable (no crashes, usable speed, clear errors).

**Output:** working extraction module + UI that can be reused in the app.

---

### Phase 2 — V1 App Development (Frontend Wrapper + UX)
**Goal:** Build the real app around proven extraction core; integrate configurable external endpoints (no real AI/PII yet).

**User stories (V1):**
1. As a user, I can upload a contract PDF and see extracted text in a readable editor panel.
2. As a user, I can open **Settings** to configure `AI_NODE_URL / PII_ENDPOINT / ANALYZE_ENDPOINT` and see connection status.
3. As a user, I can click **Bedah Risiko / Ringkas Isi / Jelaskan Pasal Terpenting** and see a clear “waiting for backend” message if not connected.
4. As a user, I can view an **analysis dashboard** with color-coded risk sections (red/yellow/green) once results exist.
5. As a user, I can keep the app stateless: refresh clears session, and no text is saved server-side by the frontend.

**Steps:**
- Repo/folder structure:
  - `frontend/` (active app)
  - `backend/` (placeholder + contract)
  - `ai_node/` (placeholder + contract)
- Frontend UX (design_agent guidance):
  - Landing layout: branding “PasalBerapa?” + tagline casual
  - Main workspace: Upload → Extract → (Mask) → Analyze
  - Panels: Document preview, Chat/Analysis feed, Risk dashboard
- State management (frontend only):
  - `sessionId` (in-memory)
  - `extractedText`, `ocrText`, `finalText`
  - `piiMapping` dictionary (kept empty until endpoint exists)
  - `analysisMessages`, `analysisResult`
- API service layer (configurable):
  - Read env vars (append only): `REACT_APP_AI_NODE_URL`, `REACT_APP_PII_ENDPOINT`, `REACT_APP_ANALYZE_ENDPOINT`
  - Health checks + graceful errors
  - Request/response typing + timeout handling
- Implement “honest wrapper flow”:
  - If endpoints missing/unreachable → disable action buttons + show CTA to configure
  - If reachable → call endpoint and render response
- Client-side unmask utility:
  - Given `piiMapping`, allow toggling “Show originals” (local-only) to replace tags back.
- Documentation:
  - `ai_node/API_CONTRACT.md` describing endpoints + payloads + constraints (preserve PII tags)
  - `backend/API_CONTRACT.md` (if backend is separate gateway)

**End of Phase 2:** run testing_agent for UI flows (upload UI states, settings, action buttons, not-connected states, unmask toggle).

---

### Phase 3 — Hardening + UX Polish + Integration Hooks
**Goal:** Make V1 feel trustworthy, fast, and easy; prepare for user-hosted endpoints.

**User stories (Hardening):**
1. As a user, I can see OCR warnings (blurry pages, low confidence) and suggested fallback.
2. As a user, I can cancel OCR mid-way to avoid waiting.
3. As a user, I can export “analysis report” as Markdown/PDF (client-side) once results exist.
4. As a user, I can see which parts are “formal/teknis” (pasal references) vs “casual explanation”.
5. As a user, I can troubleshoot connectivity from a single diagnostics panel.

**Steps:**
- Performance: OCR batching, page scaling options, worker config, memory-safe page processing.
- Better result rendering: risk cards, citations placeholders, expandable sections.
- Add diagnostics: last request payload preview (redacted), latency, endpoint reachability.
- Expand API contract with examples + error shapes.
- Testing_agent round: regressions + edge states.

---

### Phase 4 — Backend/ai_node Integration (Later, when user provides endpoints)
**Goal:** Swap from “waiting” to real PII+RAG+LLM without frontend redesign.

**User stories (Integration):**
1. As a user, I can mask PII via server endpoint and see tag-preserved text returned.
2. As a user, I can run RAG analysis and see citations to relevant regulations.
3. As a user, I can unmask locally (or via endpoint) to produce a final private report.
4. As a user, I can verify tags are preserved end-to-end (no leakage).
5. As a user, I can run multiple sessions without data persisting.

**Steps:**
- Wire real endpoints; validate payloads match contract.
- Ensure LLM prompt rules: preserve tags, red flags, mixed casual+formal output.
- End-to-end tests with real server.

## 3) Next Actions
1. Run design_agent to lock UI style guide (legal-tech trustworthy + casual).
2. Implement Phase 1 POC extraction screen in `frontend/`.
3. Validate extraction on 2 PDFs; iterate until stable.
4. Build V1 shell around extraction core + Settings + wrapper calls.
5. Add API contracts in `ai_node/` and `backend/`.

## 4) Success Criteria
- Client-side: PDF text extraction works; OCR works with progress + cancel; produces a usable combined text.
- Frontend wrapper: settings-driven endpoints; clear “not connected” UX; no crashes if endpoints missing.
- Stateless: refresh clears session; no login; no persistence.
- Contracts: documented endpoint shapes; easy for user to implement server-side.
- UI: quick actions + dashboard components present; risk colors consistent; mixed casual + formal sections supported.