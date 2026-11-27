// Gera o feedback pedagógico de cada aluno a partir da transcrição da aula (Google Meet).
// POST JSON { transcript, students:[{name, level, previous}], lesson, lang }  →  { reports: { [name]: {...} } }
const L = require("./_lib");

function system(lang) {
  const out = lang === "en" ? "English (simple, friendly, adapted to the student's level)" : "Brazilian Portuguese (friendly, clear), keeping English examples in English";
  return `You are the teaching assistant of Teacher Denise (English with Denise, online English classes for Brazilians, levels A1–B2).
You receive the automatic transcript of one class (Google Meet). Lines are usually "Speaker: text". Speaker names may be full names; the teacher is Denise. Automatic transcription has recognition errors: never blame the student for something that is clearly a transcription glitch.
For EACH student listed, write an evidence-based feedback report. Only use what is really in the transcript. If a student barely spoke, say so kindly and keep lists short. Never invent stories, errors or facts.
Write all feedback text in ${out}. Field "said" and "correct" must stay exactly in the language spoken (usually English).
Return ONLY JSON: {"reports":{"<student name exactly as given>":{
 "headline": one warm sentence summarizing the class for this student,
 "scores": {"fluency":0-10,"grammar":0-10,"vocabulary":0-10,"confidence":0-10,"participation":0-10} (fair, relative to the student's level, decimals allowed),
 "strengths": [2-5 concrete things they did well, citing what they said],
 "improved": [0-4 things that improved compared with the previous report given (if no previous report, things that went better during this class)],
 "errors": [{"said": what they literally said,"correct": corrected version,"why": short explanation}] (the 3-8 most useful grammar/usage mistakes, real ones only),
 "wrongWords": [{"said": word/expression used wrongly or likely mispronounced (as transcribed),"correct": right word/form,"note": short tip}] (0-6),
 "ptToEn": [{"pt": something they said in Portuguese,"en": natural way to say it in English}] (0-6),
 "topics": [3-6 short main topics discussed],
 "stories": [0-4 short retellings of stories, jokes or funny moments that happened, in 1 sentence each],
 "newVocab": [{"word": English word/expression that appeared and is worth learning,"meaning": short meaning}] (3-8),
 "nextSteps": [3-5 practical next steps / homework ideas],
 "message": a 3-5 sentence encouraging note from Teacher Denise to the student (no signature)
}}}`;
}

module.exports = async (req, res) => {
  if (!L.checkAuth(req, res)) return;
  try {
    if (!process.env.OPENAI_API_KEY) return L.send(res, 500, { error: "Configure a variável OPENAI_API_KEY na Vercel." });
    const { transcript, students, lesson, lang } = await L.readJson(req);
    if (!transcript || transcript.trim().length < 80) return L.send(res, 400, { error: "Transcrição muito curta." });
    const list = (students || []).filter((s) => s && s.name);
    if (!list.length) return L.send(res, 400, { error: "Escolha ao menos um aluno." });
    const who = list.map((s) => `- ${s.name}${s.speaker && s.speaker !== s.name ? ` (appears in the transcript as "${s.speaker}")` : ""} · level ${s.level || "?"}${s.previous ? `\n  Previous report: ${String(s.previous).slice(0, 1500)}` : ""}`).join("\n");
    const messages = [
      { role: "system", content: system(lang) },
      { role: "user", content: `Class: ${lesson || "—"}\nStudents:\n${who}\n\nTRANSCRIPT:\n${transcript.slice(0, 150000)}` },
    ];
    const models = [...new Set([process.env.SUMMARY_MODEL, "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"].filter(Boolean))];
    let data, lastErr;
    for (const model of models) {
      const body = { model, messages, response_format: { type: "json_object" } };
      if (/^gpt-5/.test(model)) body.reasoning_effort = "low";
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { data = d; break; }
      lastErr = d?.error?.message || "OpenAI respondeu " + r.status;
      if (r.status === 401 || r.status === 429) break;
    }
    if (!data) return L.send(res, 500, { error: lastErr });
    let parsed;
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}"); } catch (e) { return L.send(res, 500, { error: "A IA devolveu um formato inválido. Tente de novo." }); }
    L.send(res, 200, { reports: parsed.reports || {} });
  } catch (e) {
    L.send(res, 500, { error: e.message || String(e) });
  }
};
