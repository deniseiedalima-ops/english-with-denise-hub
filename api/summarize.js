// Turns a class transcript into a teacher-ready summary in Portuguese.
// POST JSON { transcript, student, lesson, level }  →  { summary }
const L = require("./_lib");

const SYSTEM = `Você é assistente pedagógica da professora Denise (English with Denise), que dá aulas de inglês online para brasileiros.
Recebe a transcrição automática de uma aula (pode ter erros de reconhecimento, mistura de inglês e português e falas sem identificação de quem fala).
Escreva em português, em texto simples (sem markdown, sem asteriscos), com estas seções e títulos exatamente assim:

RESUMO DA AULA
2 a 4 frases sobre o que foi trabalhado.

VOCABULÁRIO E ESTRUTURAS
Lista com "- " das palavras, expressões e pontos gramaticais em inglês que apareceram.

ERROS E PONTOS DE ATENÇÃO
Lista com "- " no formato: o que o aluno disse → forma correta (explicação curta). Só inclua erros que de fato aparecem na transcrição.

PARTICIPAÇÃO
Uma linha por aluno quando for possível identificar; caso contrário, uma observação geral.

PRÓXIMOS PASSOS
Sugestões de homework e do que retomar na próxima aula.

Não invente conteúdo que não esteja na transcrição. Se a transcrição estiver curta ou confusa, diga isso.`;

module.exports = async (req, res) => {
  if (!L.checkAuth(req, res)) return;
  try {
    if (!process.env.OPENAI_API_KEY) return L.send(res, 500, { error: "Configure a variável OPENAI_API_KEY na Vercel." });
    const { transcript, student, lesson, level } = await L.readJson(req);
    if (!transcript || transcript.trim().length < 40) return L.send(res, 400, { error: "Transcrição muito curta para resumir." });
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Aluno(s): ${student || "—"}\nNível: ${level || "—"}\nAula: ${lesson || "—"}\n\nTRANSCRIÇÃO:\n${transcript.slice(0, 120000)}` },
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
    L.send(res, 200, { summary: (data.choices?.[0]?.message?.content || "").trim() });
  } catch (e) {
    L.send(res, 500, { error: e.message || String(e) });
  }
};
