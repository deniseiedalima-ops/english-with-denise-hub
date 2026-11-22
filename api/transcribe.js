// Transcribes one short audio segment (≈90 s) recorded in the dashboard.
// POST JSON { audio: <base64>, mimeType, prompt? }  →  { text }
const L = require("./_lib");

const DEFAULT_PROMPT =
  "English class on Google Meet between teacher Denise and Brazilian students. " +
  "They speak English and sometimes Portuguese. Keep each language as spoken.";

async function callOpenAI(model, buf, mimeType, prompt) {
  const ext = /mp4|m4a|aac/.test(mimeType) ? "m4a" : /ogg/.test(mimeType) ? "ogg" : "webm";
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimeType || "audio/webm" }), `segment.${ext}`);
  form.append("model", model);
  form.append("prompt", prompt || DEFAULT_PROMPT);
  form.append("response_format", "json");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
    body: form,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data?.error?.message || "OpenAI respondeu " + r.status); e.status = r.status; throw e; }
  return data.text || "";
}

module.exports = async (req, res) => {
  if (!L.checkAuth(req, res)) return;
  try {
    if (!process.env.OPENAI_API_KEY) return L.send(res, 500, { error: "Configure a variável OPENAI_API_KEY na Vercel para transcrever." });
    const { audio, mimeType, prompt } = await L.readJson(req);
    if (!audio) return L.send(res, 400, { error: "Áudio vazio." });
    const buf = Buffer.from(audio, "base64");
    if (buf.length < 2000) return L.send(res, 200, { text: "" }); // silence / empty segment
    // gpt-transcribe é o modelo atual; os outros ficam como reserva (whisper-1 e gpt-4o-mini-transcribe saem do ar em fev/2027).
    const models = [...new Set([process.env.TRANSCRIBE_MODEL, "gpt-transcribe", "gpt-4o-mini-transcribe", "whisper-1"].filter(Boolean))];
    let text, lastErr;
    for (const model of models) {
      try { text = await callOpenAI(model, buf, mimeType, prompt); break; }
      catch (e) { lastErr = e; if (e.status === 401 || e.status === 429) break; }
    }
    if (text === undefined) throw lastErr;
    L.send(res, 200, { text: text.trim() });
  } catch (e) {
    L.send(res, 500, { error: e.message || String(e) });
  }
};
