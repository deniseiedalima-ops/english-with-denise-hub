// Writes a personal birthday message in English for one student, based on the teacher's notes.
// POST JSON { name, level, notes }  →  { message }
const L = require("./_lib");

const SYSTEM = `You write short, warm birthday messages from Teacher Denise (English with Denise, an online English school in Brazil) to one of her students, to be sent on WhatsApp.
Rules:
- Write in English, adapted to the student's level: A1 = very simple words and short sentences; A2 = simple; B1/B2 = natural everyday English.
- 3 to 5 short sentences. Warm, personal, encouraging, a little playful. 1 to 3 emojis max.
- Use the first name only. Mention 1 or 2 concrete things from the notes (progress, something they did well in class, a topic they enjoy, a goal) so the message feels personal.
- Never invent facts that are not in the notes. If the notes are thin, keep it general but kind.
- Never mention health, family problems, money, payments, absences, mistakes or anything private or negative.
- End with a line signed by Teacher Denise (e.g. "Love, Teacher Denise 💛").
- Output only the message text, nothing else.`;

module.exports = async (req, res) => {
  if (!L.checkAuth(req, res)) return;
  try {
    if (!process.env.OPENAI_API_KEY) return L.send(res, 500, { error: "Configure a variável OPENAI_API_KEY na Vercel." });
    const { name, level, notes } = await L.readJson(req);
    if (!name) return L.send(res, 400, { error: "Aluno sem nome." });
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Student: ${name}\nLevel: ${level || "unknown"}\n\nTeacher's notes and class records (most recent first):\n${String(notes || "(no notes)").slice(0, 12000)}` },
    ];
    const models = [...new Set([process.env.SUMMARY_MODEL, "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"].filter(Boolean))];
    let data, lastErr;
    for (const model of models) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { data = d; break; }
      lastErr = d?.error?.message || "OpenAI respondeu " + r.status;
      if (r.status === 401 || r.status === 429) break;
    }
    if (!data) return L.send(res, 500, { error: lastErr });
    L.send(res, 200, { message: (data.choices?.[0]?.message?.content || "").trim() });
  } catch (e) {
    L.send(res, 500, { error: e.message || String(e) });
  }
};
