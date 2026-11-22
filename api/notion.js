// EWD Studio ⇄ Notion. One endpoint, several actions (POST JSON {action, ...}).
const L = require("./_lib");
const { IDS, notion } = L;

// ---------- Snapshot (full dashboard copy stored as JSON code blocks) ----------
async function loadSnapshot() {
  const blocks = await L.listChildren(IDS.snapshot);
  const groups = {};
  for (const b of blocks) {
    if (b.type !== "code") continue;
    const stamp = (b.code.caption || []).map((x) => x.plain_text).join("") || "0";
    const body = (b.code.rich_text || []).map((x) => x.plain_text).join("");
    (groups[stamp] = groups[stamp] || []).push(body);
  }
  const stamps = Object.keys(groups).sort((a, b) => Number(b) - Number(a));
  for (const s of stamps) {
    try { return { data: JSON.parse(groups[s].join("")), savedAt: Number(s) }; } catch (e) { /* incomplete group, try older */ }
  }
  return { data: null, savedAt: 0 };
}

async function saveSnapshot(data) {
  const json = JSON.stringify(data);
  if (json.length > 1_800_000) throw new Error("Backup grande demais para o Notion. Exporte um backup JSON e limpe transcrições antigas.");
  const stamp = String(Date.now());
  const perBlock = 100 * 1990;
  const children = [];
  for (let i = 0; i < json.length; i += perBlock) {
    children.push({ object: "block", type: "code", code: { language: "json", caption: L.rt(stamp, 1), rich_text: L.rt(json.slice(i, i + perBlock), 100) } });
  }
  const before = await L.listChildren(IDS.snapshot);
  await L.appendChildren(IDS.snapshot, children);
  // Remove previous copies only after the new one is written.
  for (const b of before) {
    if (b.type === "code") await notion(`/blocks/${b.id}`, "DELETE").catch(() => {});
  }
  return { savedAt: Number(stamp), bytes: json.length };
}

// ---------- Turmas ----------
function studentProps(s, key, active) {
  const members = Array.isArray(s.members) && s.members.length ? s.members : String(s.name || "").split("+").map((x) => x.trim()).filter(Boolean);
  return {
    Turma: L.title(s.name),
    Chave: L.text(key),
    "Nível": L.select(s.level),
    Dia: L.select(s.day),
    "Horário": L.text(s.time),
    Tipo: L.select(s.group || "Individual"),
    Alunos: L.text(members.join(", ")),
    "Última aula": L.text(s.last),
    Progresso: L.num(s.progress === undefined || s.progress === "" ? null : Number(s.progress) / 100),
    "Link Google Meet": L.url(s.meet),
    "Observações": L.text(active ? s.notes : ["Inativo", s.reason].filter(Boolean).join(" — ")),
    Ativo: L.check(active),
  };
}

async function upsertStudent({ student, key, oldKey, active = true }) {
  if (!student || !key) throw new Error("Turma sem dados.");
  let page = (oldKey && oldKey !== key && (await L.findByText(IDS.turmas, "Chave", oldKey))) || (await L.findByText(IDS.turmas, "Chave", key));
  // Inactive students may have been stored with an empty-day key.
  if (!page) page = await L.findByText(IDS.turmas, "Chave", `${student.name}||`);
  const properties = studentProps(student, key, active);
  if (page) { await notion(`/pages/${page.id}`, "PATCH", { properties }); return { id: page.id, url: page.url }; }
  const created = await notion("/pages", "POST", { parent: { database_id: IDS.turmas }, properties });
  return { id: created.id, url: created.url };
}

async function turmaRelation(key, name) {
  let page = await L.findByText(IDS.turmas, "Chave", key);
  if (!page && name) {
    const r = await notion(`/databases/${IDS.turmas}/query`, "POST", { filter: { property: "Turma", title: { equals: name } }, page_size: 1 });
    page = r.results[0];
  }
  return page ? { relation: [{ id: page.id }] } : { relation: [] };
}

// ---------- Registros de aula ----------
function dateBR(iso) { if (!iso) return ""; const [, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}`; }

async function upsertRecord({ record }) {
  const r = record || {};
  if (!r.id) throw new Error("Registro sem ID.");
  const presencas = Array.isArray(r.attendance) ? r.attendance.map((a) => `${a.name}: ${a.status}`).join("\n") : r.status;
  const properties = {
    Aula: L.title(`${dateBR(r.makeupDate || r.date)} · ${r.student} · ${r.lesson || "Aula"}`.slice(0, 200)),
    "ID EWD": L.text(String(r.id)),
    Data: L.date(r.makeupDate || r.date),
    Turma: await turmaRelation(r.schedule, r.student),
    Status: L.select(r.status),
    "Presenças": L.text(presencas),
    "Warm-up": L.text(r.warmup),
    "Lição": L.text(r.lesson),
    Progresso: L.num(r.progress === undefined ? null : Number(r.progress) / 100),
    "Onde parou": L.text(r.stoppedAt),
    "Homework enviado": L.select(r.homeworkDone),
    "Observação": L.text(r.note),
    "Reposição manual": L.check(r.manualMakeup),
  };
  const page = await L.findByText(IDS.aulas, "ID EWD", String(r.id));
  if (page) { await notion(`/pages/${page.id}`, "PATCH", { properties }); return { id: page.id, url: page.url }; }
  const created = await notion("/pages", "POST", { parent: { database_id: IDS.aulas }, properties });
  return { id: created.id, url: created.url };
}

// ---------- Meeting notes + transcrições ----------
function h2(t) { return { object: "block", type: "heading_2", heading_2: { rich_text: L.rt(t, 1) } }; }

async function saveMeeting({ meeting }) {
  const m = meeting || {};
  if (!m.id) throw new Error("Meeting sem ID.");
  const properties = {
    "Título": L.title(m.title || `${m.student || "Meeting geral"} · ${m.date || m.week || ""}`),
    "ID EWD": L.text(String(m.id)),
    Data: L.date(m.date || m.createdAt || m.week),
    Semana: L.date(m.week),
    Turma: m.studentKey || m.student ? await turmaRelation(m.studentKey, m.student) : { relation: [] },
    "Aluno(s)": L.text(m.student || "Meeting geral"),
    "Duração (min)": L.num(m.durationMin),
    "Link Google Meet": L.url(m.meetLink),
    Resumo: L.text(m.summary),
    "Notas da professora": L.text(m.teacherNotes),
    Origem: L.select(m.source === "recorded" ? "🎙️ Gravada no painel" : "📋 Colada manualmente"),
  };
  const children = [];
  if (m.summary) { children.push(h2("✨ Resumo da aula")); children.push(...L.paragraphs(m.summary)); }
  if (m.teacherNotes) { children.push(h2("📝 Notas da professora")); children.push(...L.paragraphs(m.teacherNotes)); }
  children.push(h2("🎙️ Transcrição"));
  children.push(...(m.transcript ? L.paragraphs(m.transcript) : L.paragraphs("(sem transcrição)")));

  const existing = await L.findByText(IDS.meetings, "ID EWD", String(m.id));
  if (existing) await notion(`/pages/${existing.id}`, "PATCH", { archived: true });
  const created = await notion("/pages", "POST", { parent: { database_id: IDS.meetings }, properties, children: children.slice(0, 90) });
  if (children.length > 90) await L.appendChildren(created.id, children.slice(90));
  return { id: created.id, url: created.url };
}

async function deleteMeeting({ id }) {
  const page = await L.findByText(IDS.meetings, "ID EWD", String(id));
  if (page) await notion(`/pages/${page.id}`, "PATCH", { archived: true });
  return { ok: true };
}

// ---------- Projetos 2027 ----------
async function upsertProject({ project }) {
  const pr = project || {};
  if (!pr.id) throw new Error("Projeto sem ID.");
  const steps = Array.isArray(pr.steps) ? pr.steps : [];
  const done = steps.filter((x) => x.done).length;
  const guests = Array.isArray(pr.guests) ? pr.guests : [];
  const properties = {
    Projeto: L.title(pr.name || "Projeto sem nome"),
    "ID EWD": L.text(String(pr.id)),
    Tipo: L.select(pr.type),
    Status: L.select(pr.status),
    Trimestre: L.select(pr.quarter || "Sem data"),
    "Data alvo": L.date(pr.targetDate),
    "Descrição": L.text(pr.description),
    "Público / objetivo": L.text(pr.goal),
    "Próximos passos": L.text(steps.map((x) => (x.done ? "☑ " : "☐ ") + x.text).join("\n")),
    Progresso: L.num(steps.length ? done / steps.length : 0),
    Convidados: L.text(guests.map((g) => [g.name, g.topic, g.status, g.date, g.contact].filter(Boolean).join(" · ")).join("\n")),
  };
  const page = await L.findByText(IDS.projects, "ID EWD", String(pr.id));
  if (page) { await notion(`/pages/${page.id}`, "PATCH", { properties }); return { id: page.id, url: page.url }; }
  const created = await notion("/pages", "POST", { parent: { database_id: IDS.projects }, properties });
  return { id: created.id, url: created.url };
}

// ---------- Instagram: posts & ideias ----------
async function upsertPost({ post }) {
  const p = post || {};
  if (!p.id) throw new Error("Post sem ID.");
  const m = p.metrics || {};
  const n = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
  const inter = [m.likes, m.comments, m.saves, m.shares].map((v) => n(v) || 0).reduce((a, b) => a + b, 0);
  let rel = { relation: [] };
  if (p.projectId) {
    const pg = await L.findByText(IDS.projects, "ID EWD", String(p.projectId));
    if (pg) rel = { relation: [{ id: pg.id }] };
  }
  const properties = {
    Post: L.title(p.title || "Sem título"),
    "ID EWD": L.text(String(p.id)),
    Etapa: L.select(p.stage),
    Formato: L.select(p.format),
    Data: L.date(p.date),
    Pilar: L.select(p.pillar),
    Objetivo: L.select(p.objective),
    "Nível": L.select(p.level),
    Projeto: rel,
    Alcance: L.num(n(m.reach)),
    Curtidas: L.num(n(m.likes)),
    "Comentários": L.num(n(m.comments)),
    Salvos: L.num(n(m.saves)),
    Compartilhamentos: L.num(n(m.shares)),
    Engajamento: L.num(n(m.reach) ? inter / n(m.reach) : null),
    "Notas / roteiro": L.text(p.notes),
  };
  const page = await L.findByText(IDS.posts, "ID EWD", String(p.id));
  if (page) { await notion(`/pages/${page.id}`, "PATCH", { properties }); return { id: page.id, url: page.url }; }
  const created = await notion("/pages", "POST", { parent: { database_id: IDS.posts }, properties });
  return { id: created.id, url: created.url };
}

async function deleteItem({ kind, id }) {
  const db = kind === "project" ? IDS.projects : kind === "post" ? IDS.posts : null;
  if (!db) throw new Error("Tipo desconhecido.");
  const page = await L.findByText(db, "ID EWD", String(id));
  if (page) await notion(`/pages/${page.id}`, "PATCH", { archived: true });
  return { ok: true };
}

async function ping() {
  const p = await notion(`/pages/${IDS.snapshot}`);
  await notion(`/databases/${IDS.turmas}`);
  await notion(`/databases/${IDS.aulas}`);
  await notion(`/databases/${IDS.meetings}`);
  await notion(`/databases/${IDS.projects}`);
  await notion(`/databases/${IDS.posts}`);
  return { ok: true, page: p.url, transcription: !!process.env.OPENAI_API_KEY };
}

const ACTIONS = { ping, load: loadSnapshot, save: ({ data }) => saveSnapshot(data), upsertStudent, upsertRecord, saveMeeting, deleteMeeting, upsertProject, upsertPost, deleteItem };

module.exports = async (req, res) => {
  if (!L.checkAuth(req, res)) return;
  try {
    const body = await L.readJson(req);
    const fn = ACTIONS[body.action];
    if (!fn) return L.send(res, 400, { error: "Ação desconhecida." });
    const out = await fn(body);
    L.send(res, 200, out);
  } catch (e) {
    L.send(res, e.status && e.status < 500 ? e.status : 500, { error: e.message || String(e) });
  }
};
