import "node:sqlite";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { analyzeCase, chatWithContext, correlateCaseGroup } from "./gemini.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const envFile = join(root, ".env");
if (existsSync(envFile)) for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
}

const dataDir = resolve(root, process.env.DATA_DIR || "data");
mkdirSync(dataDir, { recursive: true });
const dbFile = process.env.DATABASE_PATH || join(dataDir, "caseintel.sqlite");
mkdirSync(dirname(dbFile), { recursive: true });
const db = new DatabaseSync(dbFile);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
db.exec(`
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_key TEXT NOT NULL UNIQUE,
  external_id TEXT,
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  reported_at TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'UNREVIEWED',
  urgency TEXT NOT NULL DEFAULT 'UNASSESSED',
  assigned_inspector_id INTEGER REFERENCES inspectors(id) ON DELETE SET NULL,
  source_assigned_inspector TEXT,
  source_data TEXT NOT NULL DEFAULT '{}',
  source_hash TEXT,
  ai_json TEXT,
  ai_status TEXT NOT NULL DEFAULT 'NOT_RUN',
  ai_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_source_hash ON cases(source_hash);
CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category);
CREATE INDEX IF NOT EXISTS idx_cases_urgency ON cases(urgency);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_reported_at ON cases(reported_at);
CREATE TABLE IF NOT EXISTS inspectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL DEFAULT 'General Cybercrime',
  availability TEXT NOT NULL DEFAULT 'Available',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE,
  row_count INTEGER NOT NULL,
  imported_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS correlation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_ids_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

const now = () => new Date().toISOString();
const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);
const text = (value) => value == null ? "" : String(value).trim();
const rowOut = (row) => row ? { ...row, source_data: JSON.parse(row.source_data || "{}"), ai: row.ai_json ? JSON.parse(row.ai_json) : null, ai_json: undefined, assigned_inspector_id: row.assigned_inspector_id || null } : null;
const schemaAlias = {
  external_id: [/\b(case|complaint|report|record)?\s*(id|number|no)\b/, /reference/],
  summary: [/complaint|description|narrative|incident|details|message|remarks|summary|subject/],
  category: [/category|crime.?type|offen[cs]e|classification|issue.?type/],
  reported_at: [/date|time|reported|created|filed|timestamp/],
  location: [/location|city|district|state|country|address|region|place/],
  status: [/status|resolution|disposition|case\s+state|complaint\s+state|investigation\s+state/],
  urgency: [/urgency|priority|severity|risk.?level/],
  assigned: [/inspector|assigned.?to|officer|investigator/],
};
function matchingField(keys, field) {
  const normalized = (key) => key.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (field === "external_id") {
    const explicit = keys.find((key) => /\b(case|complaint|report|record)\b/.test(normalized(key)) && /\b(id|number|no|reference)\b/.test(normalized(key)));
    if (explicit) return explicit;
    const general = keys.filter((key) => !/victim|offender|person|user|customer|account/i.test(normalized(key)));
    return general.find((key) => schemaAlias[field].some((pattern) => pattern.test(normalized(key))));
  }
  if (field === "summary") {
    const candidates = keys.filter((key) => !/(^|\s)(id|number|no|date|time|reference)(\s|$)/i.test(normalized(key)));
    return candidates.find((key) => schemaAlias[field].some((pattern) => pattern.test(normalized(key))));
  }
  if (field === "reported_at") {
    const candidates = keys.filter((key) => !/birth|\bdob\b|updated|modified|review/i.test(normalized(key)));
    const explicit = candidates.find((key) => /reported|filed|created|submitted|incident|occurrence/.test(normalized(key)) && /date|time/.test(normalized(key)));
    if (explicit) return explicit;
    return candidates.find((key) => schemaAlias[field].some((pattern) => pattern.test(normalized(key))));
  }
  if (field === "assigned") {
    const explicit = keys.find((key) => /assigned\s*(to|inspector|officer|investigator)/.test(normalized(key)));
    if (explicit) return explicit;
    const candidates = keys.filter((key) => !/\b(id|number|no)\b/.test(normalized(key)));
    return candidates.find((key) => schemaAlias[field].some((pattern) => pattern.test(normalized(key))));
  }
  return keys.find((key) => schemaAlias[field].some((pattern) => pattern.test(normalized(key))));
}
function getMapped(raw, field) { const key = matchingField(Object.keys(raw), field); return key ? text(raw[key]) : ""; }
function normalizeReportDate(value) {
  const raw = text(value);
  const isoDate = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(.*)$/);
  if (isoDate) {
    const [, year, month, day, tail] = isoDate;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}${tail}`;
  }
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(+parsed)) return parsed.toISOString();
  }
  return raw;
}
function normalizedUrgency(value) {
  const priority = text(value).toUpperCase();
  if (/CRITICAL|URGENT|IMMEDIATE/.test(priority)) return "CRITICAL";
  if (/HIGH|SEVERE/.test(priority)) return "HIGH";
  if (/MEDIUM|MODERATE|NORMAL/.test(priority)) return "MEDIUM";
  if (/LOW|ROUTINE/.test(priority)) return "LOW";
  return "UNASSESSED";
}
function parseCsv(csv) {
  const records = []; let row = []; let cell = ""; let quoted = false;
  const input = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) { if (ch === '"' && input[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && input[i + 1] === "\n") i += 1; row.push(cell); cell = ""; if (row.some((v) => v.trim())) records.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some((v) => v.trim())) records.push(row);
  if (records.length < 2) throw new Error("The CSV needs a header row and at least one data row.");
  const headers = records[0].map((value, index) => text(value) || `Column ${index + 1}`);
  const objects = records.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] === undefined || values[index] === "" ? null : values[index]])));
  return { headers, objects };
}
function stableId() { return `CASE-${String(Number(db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS next FROM cases").get().next)).padStart(6, "0")}`; }
function addTimeline(caseId, event, detail = "") { db.prepare("INSERT INTO timeline(case_id,event,detail,created_at) VALUES(?,?,?,?)").run(caseId, event, detail, now()); }
function safeString(value, max = 5000) { return text(value).slice(0, max); }
function safeError(error) {
  let message = String(error?.message || "Gemini analysis failed.");
  for (const secret of [process.env.GEMINI_API_KEY, process.env.DEMO_PASSWORD]) if (secret) message = message.replaceAll(secret, "[redacted]");
  return message.slice(0, 500);
}

function insertCase(sourceData, { importHash = null, initialStatus = "UNREVIEWED" } = {}) {
  const raw = sourceData && typeof sourceData === "object" && !Array.isArray(sourceData) ? sourceData : {};
  const created = now();
  const externalId = getMapped(raw, "external_id");
  const summary = getMapped(raw, "summary") || Object.entries(raw).filter(([, val]) => val != null && String(val).trim()).sort((a, b) => String(b[1]).length - String(a[1]).length)[0]?.[1]?.toString().slice(0, 320) || "";
  const category = getMapped(raw, "category");
  const reportedAt = normalizeReportDate(getMapped(raw, "reported_at"));
  const location = getMapped(raw, "location");
  const status = getMapped(raw, "status") || initialStatus;
  const urgency = normalizedUrgency(getMapped(raw, "urgency"));
  const sourceAssignee = getMapped(raw, "assigned");
  const hash = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
  const result = db.prepare("INSERT INTO cases(case_key,external_id,summary,category,reported_at,location,status,urgency,source_assigned_inspector,source_data,source_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(stableId(), externalId || null, safeString(summary), safeString(category, 150), safeString(reportedAt, 200), safeString(location, 300), safeString(status, 100) || "UNREVIEWED", urgency, safeString(sourceAssignee, 200) || null, JSON.stringify(raw), importHash ? `${importHash}:${hash}` : null, created, created);
  const id = Number(result.lastInsertRowid);
  addTimeline(id, "Case created", importHash ? "Imported from CSV" : "Complaint entered by an investigator");
  return Number(id);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "same-origin"); res.setHeader("X-Frame-Options", "DENY"); next(); });
const attempts = new Map();
function tokenHash(token) { return createHash("sha256").update(token).digest("hex"); }
function readCookie(req, name) { return (req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1); }
function auth(req, res, next) {
  const token = readCookie(req, "caseintel_session");
  const session = token ? db.prepare("SELECT username,expires_at FROM sessions WHERE token_hash=?").get(tokenHash(decodeURIComponent(token))) : null;
  if (!session || session.expires_at < Date.now()) { if (session) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash(decodeURIComponent(token))); return res.status(401).json({ error: "Please sign in to continue." }); }
  req.user = { username: session.username }; next();
}
app.get("/api/health", (_req, res) => res.json({ ok: true, geminiConfigured: geminiEnabled() }));
app.get("/api/auth/session", auth, (req, res) => res.json({ username: req.user.username }));
app.post("/api/auth/login", (req, res) => {
  const ip = req.socket.remoteAddress || "unknown";
  const state = attempts.get(ip) || { count: 0, start: Date.now() };
  if (Date.now() - state.start > 15 * 60_000) { state.count = 0; state.start = Date.now(); }
  if (state.count >= 10) return res.status(429).json({ error: "Too many sign-in attempts. Try again in 15 minutes." });
  const username = process.env.DEMO_USERNAME || "Team-2";
  const password = process.env.DEMO_PASSWORD || "";
  const submittedUser = String(req.body?.username || ""); const submittedPassword = String(req.body?.password || "");
  const valid = submittedUser === username && password.length > 0 && submittedPassword.length === password.length && timingSafeEqual(scryptSync(submittedPassword, "caseintel-demo-v1", 32), scryptSync(password, "caseintel-demo-v1", 32));
  if (!valid) { state.count += 1; attempts.set(ip, state); return res.status(401).json({ error: "The username or password is incorrect." }); }
  attempts.delete(ip);
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions(token_hash,username,expires_at) VALUES(?,?,?)").run(tokenHash(token), username, Date.now() + 8 * 60 * 60_000);
  res.setHeader("Set-Cookie", `caseintel_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  res.json({ username });
});
app.post("/api/auth/logout", auth, (req, res) => { const token = readCookie(req, "caseintel_session"); if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash(decodeURIComponent(token))); res.setHeader("Set-Cookie", "caseintel_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"); res.json({ ok: true }); });

app.use("/api", (req, res, next) => ["/auth/login", "/health"].includes(req.path) ? next() : auth(req, res, next));

function caseFromId(id) { return rowOut(db.prepare("SELECT * FROM cases WHERE id=?").get(Number(id))); }
function candidateCases(targetId) {
  const target = rowOut(db.prepare("SELECT * FROM cases WHERE id=?").get(targetId));
  if (!target) return [];
  const stop = new Set(["about", "after", "before", "case", "complaint", "from", "have", "into", "that", "this", "their", "there", "these", "those", "with", "were", "when", "where", "which", "would"]);
  const words = (value) => String(value || "").toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  const targetWords = new Set(words(`${target.summary} ${target.category} ${target.location} ${JSON.stringify(target.source_data)}`).filter((word) => !stop.has(word)));
  return db.prepare("SELECT * FROM cases WHERE id<>? ORDER BY updated_at DESC LIMIT 500").all(targetId).map(rowOut).map((candidate) => {
    const candidateWords = new Set(words(`${candidate.summary} ${candidate.category} ${candidate.location} ${JSON.stringify(candidate.source_data)}`).filter((word) => !stop.has(word)));
    const overlap = [...targetWords].filter((word) => candidateWords.has(word)).length;
    const score = overlap + Number(Boolean(target.category && candidate.category === target.category)) * 5 + Number(Boolean(target.location && candidate.location === target.location)) * 4;
    return { candidate, score };
  }).sort((a, b) => b.score - a.score).slice(0, 12).map(({ candidate }) => candidate);
}
function recommendInspector(ai) {
  const inspectors = db.prepare("SELECT i.*,COUNT(c.id) AS workload FROM inspectors i LEFT JOIN cases c ON c.assigned_inspector_id=i.id GROUP BY i.id").all();
  const required = (ai.recommended_inspector_type || ai.case_category || "").toLowerCase();
  const ranked = inspectors.map((inspector) => {
    const available = /available|on duty|active/i.test(inspector.availability);
    const specialization = inspector.specialization.toLowerCase();
    const keywordMatch = required.split(/[^a-z0-9]+/).filter((word) => word.length > 3).some((word) => specialization.includes(word));
    const score = (available ? 100 : 0) + (keywordMatch ? 40 : 0) - Math.min(60, Number(inspector.workload) * 6);
    return { ...inspector, score, available, keywordMatch };
  }).sort((a, b) => b.score - a.score);
  const best = ranked.find((item) => item.available);
  return best ? { id: best.id, name: best.name, specialization: best.specialization, workload: Number(best.workload), availability: best.availability, reason: best.keywordMatch ? `Specialization aligns with ${ai.recommended_inspector_type}; workload and availability were considered.` : `Lowest current workload among available inspectors; the AI suggested ${ai.recommended_inspector_type}.` } : null;
}
async function runAnalysis(id) {
  const record = caseFromId(id); if (!record) throw Object.assign(new Error("Case not found."), { status: 404 });
  db.prepare("UPDATE cases SET ai_status='RUNNING',ai_error=NULL,updated_at=? WHERE id=?").run(now(), id);
  const candidates = candidateCases(Number(id));
  try {
    const ai = await analyzeCase(record, candidates);
    const recommendedInspector = recommendInspector(ai);
    ai.recommended_inspector = recommendedInspector;
    db.prepare("UPDATE cases SET category=CASE WHEN category='' THEN ? ELSE category END, urgency=?, ai_json=?, ai_status='COMPLETE', ai_error=NULL, updated_at=? WHERE id=?")
      .run(ai.case_category, ai.urgency, JSON.stringify(ai), now(), id);
    addTimeline(Number(id), "AI analysis completed", `${ai.urgency} urgency recommendation`);
    return caseFromId(id);
  } catch (error) {
    const message = safeError(error);
    db.prepare("UPDATE cases SET ai_status='ERROR',ai_error=?,updated_at=? WHERE id=?").run(message, now(), id);
    addTimeline(Number(id), "AI analysis failed", "Retry analysis when the Gemini service is available");
    throw Object.assign(new Error(message), { status: error.status });
  }
}

app.get("/api/meta", (_req, res) => {
  const headers = db.prepare("SELECT value FROM app_meta WHERE key='source_columns'").get();
  const categories = db.prepare("SELECT DISTINCT category FROM cases WHERE category<>'' ORDER BY category").all().map((item) => item.category);
  const statuses = db.prepare("SELECT DISTINCT status FROM cases ORDER BY status").all().map((item) => item.status);
  const inspectors = db.prepare("SELECT id,name FROM inspectors ORDER BY name").all();
  res.json({ columns: headers ? JSON.parse(headers.value) : [], categories, statuses, inspectors, geminiConfigured: geminiEnabled(), caseCount: Number(db.prepare("SELECT COUNT(*) AS n FROM cases").get().n) });
});

app.post("/api/import", (req, res) => {
  try {
    const csv = String(req.body?.csv || ""); const filename = safeString(req.body?.filename || "dataset.csv", 200);
    if (!csv || csv.length > 8_000_000) return res.status(413).json({ error: "Choose a CSV smaller than 8 MB." });
    const fileHash = createHash("sha256").update(csv).digest("hex");
    const previous = db.prepare("SELECT * FROM imports WHERE file_hash=?").get(fileHash);
    if (previous) return res.json({ imported: 0, skipped: previous.row_count, repeated: true, columns: JSON.parse(db.prepare("SELECT value FROM app_meta WHERE key='source_columns'").get()?.value || "[]") });
    const { headers, objects } = parseCsv(csv);
    const batch = () => {
      db.exec("BEGIN IMMEDIATE");
      try {
      const importedAt = now();
      const importId = Number(db.prepare("INSERT INTO imports(filename,file_hash,row_count,imported_at) VALUES(?,?,?,?)").run(filename || "dataset.csv", fileHash, objects.length, importedAt).lastInsertRowid);
      db.prepare("INSERT INTO app_meta(key,value) VALUES('source_columns',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(headers));
      let imported = 0;
      for (const item of objects) { insertCase(item, { importHash: `${importId}` }); imported += 1; }
      db.exec("COMMIT");
      return imported;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    };
    const count = batch();
    res.json({ imported: count, skipped: 0, repeated: false, columns: headers });
  } catch (error) { res.status(400).json({ error: error.message || "Could not import this CSV." }); }
});

app.get("/api/dashboard", (_req, res) => {
  const cases = db.prepare("SELECT urgency,status,category,location,reported_at,assigned_inspector_id,source_assigned_inspector,ai_json FROM cases").all();
  const urgency = Object.fromEntries(["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((name) => [name, cases.filter((item) => item.urgency.toUpperCase() === name).length]));
  const statuses = groupBy(cases, (item) => item.status || "UNREVIEWED");
  const categories = groupBy(cases, (item) => item.category || "Unclassified");
  const aiCategories = groupBy(cases.filter((item) => item.ai_json), (item) => JSON.parse(item.ai_json).case_category || "Unclassified");
  const locations = groupBy(cases, (item) => item.location || "Unknown");
  const months = groupBy(cases, (item) => { const found = String(item.reported_at).match(/\d{4}[-/]\d{2}/); return found ? found[0].replace("/", "-") : "Undated"; });
  const inspectors = db.prepare("SELECT i.id,i.name,i.specialization,i.availability,COUNT(c.id) AS workload FROM inspectors i LEFT JOIN cases c ON c.assigned_inspector_id=i.id GROUP BY i.id ORDER BY workload DESC").all();
  res.json({ total: cases.length, newCases: cases.filter((item) => /^new$/i.test(item.status)).length, critical: urgency.CRITICAL, high: urgency.HIGH, medium: urgency.MEDIUM, low: urgency.LOW, assigned: cases.filter((item) => item.assigned_inspector_id || item.source_assigned_inspector).length, unassigned: cases.filter((item) => !item.assigned_inspector_id && !item.source_assigned_inspector).length, resolved: cases.filter((item) => /resolved|closed/i.test(item.status)).length, urgency, statuses, categories: topEntries(categories), aiCategories: topEntries(aiCategories), locations: topEntries(locations), months: topEntries(months).filter((item) => item.name !== "Undated"), inspectors });
});
function groupBy(list, key) { const out = {}; for (const item of list) out[key(item)] = (out[key(item)] || 0) + 1; return out; }
function topEntries(object, max = 8) { return Object.entries(object).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, max); }

app.get("/api/cases", (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const where = []; const args = [];
  for (const [field, value] of [["urgency", req.query.urgency], ["category", req.query.category], ["status", req.query.status], ["assigned_inspector_id", req.query.inspector]]) if (value) { where.push(`${field}=?`); args.push(value); }
  if (req.query.assigned === "yes") where.push("(assigned_inspector_id IS NOT NULL OR COALESCE(source_assigned_inspector,'')<>'')");
  if (req.query.assigned === "no") where.push("(assigned_inspector_id IS NULL AND COALESCE(source_assigned_inspector,'')='')");
  if (req.query.resolved === "yes") where.push("(lower(status) LIKE '%resolved%' OR lower(status) LIKE '%closed%')");
  const term = safeString(req.query.q, 200);
  if (term) { where.push("(case_key LIKE ? OR COALESCE(external_id,'') LIKE ? OR summary LIKE ? OR category LIKE ? OR location LIKE ? OR source_data LIKE ?)"); args.push(...Array(6).fill(`%${term}%`)); }
  const sortColumns = { date: "reported_at", urgency: "CASE urgency WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END", category: "category", updated: "updated_at" };
  const sort = sortColumns[req.query.sort] || "reported_at"; const direction = req.query.dir === "asc" ? "ASC" : "DESC";
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = Number(db.prepare(`SELECT COUNT(*) AS n FROM cases ${clause}`).get(...args).n);
  const rows = db.prepare(`SELECT cases.*, COALESCE(inspectors.name,cases.source_assigned_inspector) AS assigned_inspector FROM cases LEFT JOIN inspectors ON inspectors.id=cases.assigned_inspector_id ${clause} ORDER BY ${sort} ${direction}, id DESC LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit).map((item) => ({ ...rowOut(item), assigned_inspector: item.assigned_inspector }));
  res.json({ rows, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
});
app.get("/api/cases/:id", (req, res) => {
  const item = caseFromId(req.params.id); if (!item) return res.status(404).json({ error: "Case not found." });
  const timeline = db.prepare("SELECT event,detail,created_at FROM timeline WHERE case_id=? ORDER BY id DESC").all(item.id);
  const inspector = item.assigned_inspector_id ? db.prepare("SELECT id,name,specialization,availability FROM inspectors WHERE id=?").get(item.assigned_inspector_id) : item.source_assigned_inspector ? { name: item.source_assigned_inspector, specialization: "As recorded in source dataset", availability: "Source record" } : null;
  res.json({ ...item, timeline, inspector });
});
app.post("/api/cases", async (req, res) => {
  const sourceData = req.body?.sourceData;
  if (!sourceData || typeof sourceData !== "object" || Array.isArray(sourceData) || !Object.values(sourceData).some((value) => text(value))) return res.status(400).json({ error: "Enter at least one case field." });
  try {
    const id = insertCase(sourceData, { initialStatus: "NEW" });
    let record = caseFromId(id); let analysisError = null;
    if (geminiEnabled()) { try { record = await runAnalysis(id); } catch { analysisError = "Case saved. AI analysis could not be completed; retry it from the case details."; } }
    res.status(201).json({ ...record, analysisError });
  } catch (error) { res.status(400).json({ error: "Could not save case. Check that the fields are valid." }); }
});
app.post("/api/cases/:id/analyze", async (req, res) => {
  try { if (!geminiEnabled()) return res.status(503).json({ error: "Gemini is not configured. Add GEMINI_API_KEY in the server .env file." }); res.json(await runAnalysis(Number(req.params.id))); }
  catch (error) { res.status(error.status || 503).json({ error: error.message || "Analysis failed. Please retry." }); }
});
app.post("/api/cases/:id/assign", (req, res) => {
  const caseId = Number(req.params.id); const inspectorId = req.body?.inspectorId ? Number(req.body.inspectorId) : null;
  if (!caseFromId(caseId)) return res.status(404).json({ error: "Case not found." });
  if (inspectorId && !db.prepare("SELECT id FROM inspectors WHERE id=?").get(inspectorId)) return res.status(400).json({ error: "Choose an existing inspector." });
  db.prepare("UPDATE cases SET assigned_inspector_id=?,source_assigned_inspector=NULL,updated_at=? WHERE id=?").run(inspectorId, now(), caseId);
  addTimeline(caseId, inspectorId ? "Inspector assigned" : "Inspector unassigned", inspectorId ? db.prepare("SELECT name FROM inspectors WHERE id=?").get(inspectorId).name : "Assignment cleared by investigator");
  res.json(caseFromId(caseId));
});
app.post("/api/cases/bulk-assign", (req, res) => {
  const caseIds = Array.isArray(req.body?.caseIds) ? [...new Set(req.body.caseIds.map(Number))] : [];
  const inspectorId = Number(req.body?.inspectorId);
  if (!caseIds.length || caseIds.length > 500 || caseIds.some((id) => !Number.isSafeInteger(id) || id < 1)) return res.status(400).json({ error: "Choose one or more valid cases to assign." });
  const inspector = db.prepare("SELECT id,name FROM inspectors WHERE id=?").get(inspectorId);
  if (!inspector) return res.status(400).json({ error: "Choose an existing inspector." });
  const placeholders = caseIds.map(() => "?").join(",");
  const cases = db.prepare(`SELECT id,case_key FROM cases WHERE id IN (${placeholders})`).all(...caseIds);
  if (cases.length !== caseIds.length) return res.status(404).json({ error: "One or more selected cases could not be found." });
  const assignedAt = now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE cases SET assigned_inspector_id=?,source_assigned_inspector=NULL,updated_at=? WHERE id IN (${placeholders})`).run(inspectorId, assignedAt, ...caseIds);
    for (const item of cases) addTimeline(item.id, "Inspector assigned", `${inspector.name} assigned with ${cases.length - 1} other case${cases.length === 2 ? "" : "s"} from a correlation review`);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  res.json({ assigned: cases.length, inspector });
});
app.patch("/api/cases/:id/status", (req, res) => {
  const caseId = Number(req.params.id); const status = safeString(req.body?.status, 100);
  if (!caseFromId(caseId)) return res.status(404).json({ error: "Case not found." }); if (!status) return res.status(400).json({ error: "Choose a status." });
  db.prepare("UPDATE cases SET status=?,updated_at=? WHERE id=?").run(status, now(), caseId); addTimeline(caseId, "Status changed", status); res.json(caseFromId(caseId));
});

app.get("/api/correlations", (req, res) => {
  const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const rows = db.prepare("SELECT id,case_ids_json,result_json,created_by,created_at FROM correlation_runs ORDER BY id DESC LIMIT ?").all(limit).map((item) => {
    const ids = JSON.parse(item.case_ids_json);
    const records = ids.length ? db.prepare(`SELECT case_key FROM cases WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids) : [];
    const result = JSON.parse(item.result_json);
    return { id: item.id, case_count: records.length, case_keys: records.map((record) => record.case_key), summary: result.summary, created_by: item.created_by, created_at: item.created_at };
  });
  res.json(rows);
});
app.get("/api/correlations/:id", (req, res) => {
  const item = db.prepare("SELECT * FROM correlation_runs WHERE id=?").get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: "Correlation run not found." });
  const ids = JSON.parse(item.case_ids_json);
  const records = ids.map((id) => caseFromId(id)).filter(Boolean).map(({ id, case_key, external_id, summary, category, reported_at, location, urgency, status, assigned_inspector_id }) => ({ id, case_key, external_id, summary, category, reported_at, location, urgency, status, assigned_inspector_id }));
  res.json({ id: item.id, cases: records, result: JSON.parse(item.result_json), created_by: item.created_by, created_at: item.created_at });
});
app.post("/api/correlations", async (req, res) => {
  const caseIds = Array.isArray(req.body?.caseIds) ? [...new Set(req.body.caseIds.map(Number))] : [];
  if (caseIds.length < 3) return res.status(400).json({ error: "Select at least three cases for correlation." });
  if (caseIds.length > 15 || caseIds.some((id) => !Number.isSafeInteger(id) || id < 1)) return res.status(400).json({ error: "A correlation run supports up to 15 valid cases." });
  if (!geminiEnabled()) return res.status(503).json({ error: "Gemini is not configured. Add GEMINI_API_KEY in the server .env file." });
  const records = caseIds.map((id) => caseFromId(id));
  if (records.some((item) => !item)) return res.status(404).json({ error: "One or more selected cases could not be found." });
  try {
    const result = await correlateCaseGroup(records);
    result.recommended_inspector = recommendInspector(result);
    const createdAt = now();
    db.exec("BEGIN IMMEDIATE");
    let runId;
    try {
      runId = Number(db.prepare("INSERT INTO correlation_runs(case_ids_json,result_json,created_by,created_at) VALUES(?,?,?,?)").run(JSON.stringify(caseIds), JSON.stringify(result), req.user.username, createdAt).lastInsertRowid);
      for (const item of records) addTimeline(item.id, "Included in case correlation", `Correlation review #${runId} covered ${records.length} selected cases`);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    res.status(201).json({ id: runId, cases: records.map(({ id, case_key, external_id, summary, category, reported_at, location, urgency, status, assigned_inspector_id }) => ({ id, case_key, external_id, summary, category, reported_at, location, urgency, status, assigned_inspector_id })), result, created_by: req.user.username, created_at: createdAt });
  } catch (error) { res.status(error.status || 503).json({ error: safeError(error) }); }
});

app.get("/api/inspectors", (_req, res) => res.json(db.prepare("SELECT i.*,COUNT(c.id) AS workload,SUM(CASE c.urgency WHEN 'CRITICAL' THEN 1 ELSE 0 END) AS critical,SUM(CASE c.urgency WHEN 'HIGH' THEN 1 ELSE 0 END) AS high,SUM(CASE c.urgency WHEN 'MEDIUM' THEN 1 ELSE 0 END) AS medium,SUM(CASE c.urgency WHEN 'LOW' THEN 1 ELSE 0 END) AS low FROM inspectors i LEFT JOIN cases c ON c.assigned_inspector_id=i.id GROUP BY i.id ORDER BY workload DESC").all()));
app.post("/api/inspectors", (req, res) => {
  const name = safeString(req.body?.name, 120); const specialization = safeString(req.body?.specialization, 160); const availability = safeString(req.body?.availability || "Available", 60);
  if (!name || !specialization) return res.status(400).json({ error: "Name and specialization are required." });
  const id = Number(db.prepare("INSERT INTO inspectors(name,specialization,availability,created_at) VALUES(?,?,?,?)").run(name, specialization, availability, now()).lastInsertRowid);
  res.status(201).json(db.prepare("SELECT *,0 AS workload FROM inspectors WHERE id=?").get(id));
});
app.delete("/api/inspectors/:id", (req, res) => {
  const result = db.prepare("DELETE FROM inspectors WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Inspector not found." });
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const question = safeString(req.body?.question, 2000); if (!question) return res.status(400).json({ error: "Enter a question." });
  const words = question.toLowerCase().match(/[a-z0-9-]{3,}/g) || [];
  const urgency = ["critical", "high", "medium", "low"].find((item) => question.toLowerCase().includes(item));
  const query = db.prepare("SELECT * FROM cases ORDER BY updated_at DESC LIMIT 500").all();
  const scored = query.map((item) => {
    const textBlob = `${item.case_key} ${item.external_id || ""} ${item.summary} ${item.category} ${item.location} ${item.status} ${item.urgency} ${item.source_data}`.toLowerCase();
    const score = words.reduce((total, word) => total + Number(textBlob.includes(word)), 0) + Number(urgency && item.urgency.toLowerCase() === urgency);
    return { item, score };
  }).filter(({ item, score }) => score > 0 || query.length <= 12 || /all|total|how many|summary|pattern|workload|inspector/i.test(question)).sort((a, b) => b.score - a.score).slice(0, 12);
  const context = {
    metrics: {
      total_cases: Number(db.prepare("SELECT COUNT(*) AS count FROM cases").get().count),
      by_category: db.prepare("SELECT COALESCE(NULLIF(category,''),'Unclassified') AS name,COUNT(*) AS count FROM cases GROUP BY name ORDER BY count DESC LIMIT 20").all(),
      by_urgency: db.prepare("SELECT urgency AS name,COUNT(*) AS count FROM cases GROUP BY urgency").all(),
      by_status: db.prepare("SELECT status AS name,COUNT(*) AS count FROM cases GROUP BY status").all(),
      by_month: db.prepare("SELECT substr(reported_at,1,7) AS name,COUNT(*) AS count FROM cases WHERE substr(reported_at,1,7) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' GROUP BY name ORDER BY name DESC LIMIT 24").all(),
    },
    context_cases_included: scored.length,
    cases: scored.map(({ item }) => ({ case_id: item.case_key, summary: item.summary.slice(0, 600), category: item.category, reported_at: item.reported_at, location: item.location, status: item.status, urgency: item.urgency, source_data: JSON.parse(item.source_data) })),
    inspectors: db.prepare("SELECT i.name,i.specialization,i.availability,COUNT(c.id) AS assigned_cases FROM inspectors i LEFT JOIN cases c ON c.assigned_inspector_id=i.id GROUP BY i.id ORDER BY assigned_cases DESC").all(),
  };
  try { if (!geminiEnabled()) return res.status(503).json({ error: "The AI Assistant is unavailable until Gemini is configured." }); res.json(await chatWithContext(question, context)); }
  catch { res.status(503).json({ error: "The AI Assistant could not answer right now. Please try again." }); }
});

app.get("/api/reports.csv", (_req, res) => {
  const rows = db.prepare("SELECT case_key,external_id,summary,category,reported_at,location,status,urgency,source_data FROM cases ORDER BY id DESC").all();
  const values = rows.map((row) => [row.case_key, row.external_id, row.summary, row.category, row.reported_at, row.location, row.status, row.urgency, row.source_data]);
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=caseintel-report.csv"); res.send([["case_key", "source_id", "summary", "category", "reported_at", "location", "status", "urgency", "source_data_json"], ...values].map((row) => row.map(quote).join(",")).join("\r\n"));
});

const dist = join(root, "dist");
if (existsSync(dist)) { app.use(express.static(dist)); app.get("*path", (_req, res) => res.sendFile(join(dist, "index.html"))); }
app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });
  const diagnostic = String(error?.message || "Unexpected server error.")
    .replaceAll(process.env.GEMINI_API_KEY || "\u0000", "[redacted]")
    .replaceAll(process.env.DEMO_PASSWORD || "\u0000", "[redacted]");
  console.error("CaseIntel request error:", diagnostic);
  res.status(500).json({ error: "The request could not be completed." });
});
const server = createServer(app);
const port = Number(process.env.PORT) || 5174;
server.listen(port, "127.0.0.1", () => console.log(`CaseIntel API listening on http://127.0.0.1:${port}`));
