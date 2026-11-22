// Shared helpers for the EWD Studio serverless functions (files starting with "_" are not routes on Vercel).

const NOTION_VERSION = "2022-06-28";

const IDS = {
  turmas: process.env.NOTION_DB_TURMAS || "420628bb387c81a8a62ddb494c53e317",
  aulas: process.env.NOTION_DB_AULAS || "420628bb387c81b1ab82e5ae7be59b87",
  meetings: process.env.NOTION_DB_MEETINGS || "420628bb387c817993d2da4e16fdc40b",
  snapshot: process.env.NOTION_SNAPSHOT_PAGE || "420628bb387c81aa9fd9e0d01871fe76",
  projects: process.env.NOTION_DB_PROJETOS || "420628bb387c81dc9e54c647398fb5df",
  posts: process.env.NOTION_DB_POSTS || "420628bb387c81c3a011dd1517c24c5e",
};

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

// Every call must carry the dashboard password (set EWD_PASSWORD in Vercel).
function checkAuth(req, res) {
  if (req.method !== "POST") { send(res, 405, { error: "Use POST." }); return false; }
  const expected = process.env.EWD_PASSWORD;
  if (!expected) { send(res, 500, { error: "Configure a variável EWD_PASSWORD na Vercel." }); return false; }
  const got = req.headers["x-ewd-password"] || "";
  if (got !== expected) { send(res, 401, { error: "Senha do painel incorreta." }); return false; }
  return true;
}

async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8") || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const txt = Buffer.concat(chunks).toString("utf8");
  return txt ? JSON.parse(txt) : {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notion(path, method = "GET", body) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Configure a variável NOTION_TOKEN na Vercel.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch("https://api.notion.com/v1" + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429 || r.status >= 500) {
      const wait = Number(r.headers.get("retry-after") || 0) * 1000 || 600 * (attempt + 1);
      await sleep(wait);
      continue;
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      let msg = data.message || ("Notion respondeu " + r.status);
      if (r.status === 404 || data.code === "object_not_found") {
        msg += " — conecte a página “EWD Studio — Dashboard (Base de Dados)” à sua integração do Notion (••• → Conexões).";
      }
      if (r.status === 401) msg += " — o NOTION_TOKEN está inválido ou expirou.";
      const e = new Error(msg); e.status = r.status; throw e;
    }
    return data;
  }
  throw new Error("Notion está ocupado (limite de requisições). Tente de novo em instantes.");
}

// Split long text into Notion rich_text objects (max 2000 chars each, max 100 objects).
function rt(text, max = 100) {
  const s = String(text ?? "");
  if (!s) return [];
  const out = [];
  for (let i = 0; i < s.length && out.length < max; i += 1990) {
    out.push({ type: "text", text: { content: s.slice(i, i + 1990) } });
  }
  return out;
}
const title = (t) => ({ title: rt(String(t || "Sem título").slice(0, 1990), 1) });
const text = (t) => ({ rich_text: rt(t) });
const select = (v) => (v ? { select: { name: String(v).replace(/,/g, " ").slice(0, 100) } } : { select: null });
const num = (v) => ({ number: v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v) });
const date = (v) => (v ? { date: { start: String(v).slice(0, 10) } } : { date: null });
const url = (v) => ({ url: v ? String(v) : null });
const check = (v) => ({ checkbox: !!v });

async function findByText(dbId, prop, value) {
  if (!value) return null;
  const r = await notion(`/databases/${dbId}/query`, "POST", {
    filter: { property: prop, rich_text: { equals: String(value).slice(0, 1990) } },
    page_size: 1,
  });
  return r.results && r.results[0] ? r.results[0] : null;
}

// Paragraph blocks for a long transcript (each block ≤ 1990 chars, split on line breaks when possible).
function paragraphs(textBody) {
  const lines = String(textBody || "").split(/\n+/).filter((l) => l.trim());
  const blocks = [];
  let buf = "";
  const flush = () => { if (buf) { blocks.push(buf); buf = ""; } };
  for (const line of lines) {
    if (line.length > 1990) {
      flush();
      for (let i = 0; i < line.length; i += 1990) blocks.push(line.slice(i, i + 1990));
      continue;
    }
    if ((buf + "\n" + line).length > 1990) flush();
    buf = buf ? buf + "\n" + line : line;
  }
  flush();
  return blocks.map((b) => ({ object: "block", type: "paragraph", paragraph: { rich_text: rt(b, 1) } }));
}

async function appendChildren(blockId, children) {
  for (let i = 0; i < children.length; i += 90) {
    await notion(`/blocks/${blockId}/children`, "PATCH", { children: children.slice(i, i + 90) });
  }
}

async function listChildren(blockId) {
  const all = [];
  let cursor;
  do {
    const r = await notion(`/blocks/${blockId}/children?page_size=100${cursor ? "&start_cursor=" + cursor : ""}`);
    all.push(...r.results);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return all;
}

module.exports = { IDS, send, checkAuth, readJson, notion, rt, title, text, select, num, date, url, check, findByText, paragraphs, appendChildren, listChildren, sleep };
