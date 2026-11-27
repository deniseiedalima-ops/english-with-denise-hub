/* EWD — relatório de aula para o aluno (usado pelo Studio e pela página pública report.html) */
(function (root) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const arr = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z"/></svg>';

  const T = {
    pt: {
      kicker: "Relatório da aula", title: (n) => `Sua aula, ${n}`, stats: "Seus números na aula", talk: "da conversa foi você",
      english: "Inglês", portuguese: "Português", enWords: "palavras em inglês", unique: "palavras diferentes",
      turns: "vezes que você falou", avg: "palavras por fala (média)", questions: "perguntas que você fez", longest: "sua fala mais longa (palavras)",
      scores: "Como você foi", fluency: "Fluência", grammar: "Gramática", vocabulary: "Vocabulário", confidence: "Confiança", participation: "Participação",
      nailed: "O que você mandou bem", grown: "O que melhorou", fix: "Vamos ajustar", youSaid: "Você disse", better: "Melhor assim",
      polish: "Palavras para lapidar", top: "Suas palavras mais faladas", ptEn: "Do português para o inglês", ptEnHint: "Momentos em que você usou o português — e como dizer em inglês",
      topics: "Do que falamos", stories: "Histórias e momentos divertidos", vocab: "Palavras novas", next: "Próximos passos", note: "Recado da teacher",
      estimate: "Números estimados a partir da transcrição automática do Google Meet.", noSpeakers: "A transcrição não identificava quem falava, então alguns números são da aula toda.",
    },
    en: {
      kicker: "Class report", title: (n) => `Your class, ${n}`, stats: "Your class in numbers", talk: "of the conversation was you",
      english: "English", portuguese: "Portuguese", enWords: "words in English", unique: "different words",
      turns: "times you spoke", avg: "words per turn (average)", questions: "questions you asked", longest: "your longest turn (words)",
      scores: "How you did", fluency: "Fluency", grammar: "Grammar", vocabulary: "Vocabulary", confidence: "Confidence", participation: "Participation",
      nailed: "What you nailed", grown: "Look how you've grown", fix: "Let's fix these", youSaid: "You said", better: "Better",
      polish: "Words to polish", top: "Your most-used words", ptEn: "From Portuguese to English", ptEnHint: "Moments you switched to Portuguese — and how to say it in English",
      topics: "What we talked about", stories: "Stories & fun moments", vocab: "New words", next: "Your next steps", note: "A note from your teacher",
      estimate: "Numbers estimated from the automatic Google Meet transcript.", noSpeakers: "The transcript didn't say who was speaking, so some numbers cover the whole class.",
    },
  };

  function dateLong(iso, lang) {
    if (!iso) return "";
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    try { return new Date(y, m - 1, d).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; }
  }

  function ring(pct) {
    const p = Math.max(0, Math.min(100, Math.round(pct || 0))), r = 44, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 110 110"><circle cx="55" cy="55" r="${r}" fill="none" stroke="#F6E3CF" stroke-width="12"/><circle cx="55" cy="55" r="${r}" fill="none" stroke="#E8821E" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * p) / 100} ${c}" transform="rotate(-90 55 55)"/><text x="55" y="62" text-anchor="middle">${p}%</text></svg>`;
  }

  function render(d) {
    const lang = d.lang === "en" ? "en" : "pt", t = T[lang];
    const s = d.stats || {}, a = d.ai || {}, sc = a.scores || {};
    const first = String(d.student || "").split(" ")[0];
    const top = arr(s.topWords).slice(0, 14), maxTop = Math.max(1, ...top.map((x) => x[1] || 1));
    const en = Math.max(0, Math.min(100, Math.round(100 - (s.ptPct || 0))));
    const sec = (title, body, cls = "") => (body ? `<section class="card ${cls}"><h2>${STAR}<span>${esc(title)}</span></h2>${body}</section>` : "");
    const list = (items, icon) => (arr(items).length ? `<ul class="list">${arr(items).map((x) => `<li><span class="ic">${icon}</span><span>${esc(x)}</span></li>`).join("")}</ul>` : "");
    const scoreRow = (k) => (sc[k] == null || sc[k] === "" ? "" : `<div class="score"><div class="sl"><span>${esc(t[k])}</span><b>${Number(sc[k]).toFixed(Number(sc[k]) % 1 ? 1 : 0)}<small>/10</small></b></div><div class="bar"><i style="width:${Math.max(4, Math.min(100, Number(sc[k]) * 10))}%"></i></div></div>`);
    const scores = ["fluency", "grammar", "vocabulary", "confidence", "participation"].map(scoreRow).join("");

    const tiles = [
      s.talkShare != null && s.speakersKnown !== false ? `<div class="tile big">${ring(s.talkShare)}<div class="tl">${esc(t.talk)}</div></div>` : "",
      `<div class="tile big"><div class="split"><div class="lang"><b>${en}%</b><span>${esc(t.english)}</span></div><div class="lang pt"><b>${100 - en}%</b><span>${esc(t.portuguese)}</span></div></div><div class="sbar"><i style="width:${en}%"></i></div></div>`,
      s.enWords != null ? `<div class="tile"><b>${esc(s.enWords)}</b><span>${esc(t.enWords)}</span></div>` : "",
      s.uniqueWords != null ? `<div class="tile"><b>${esc(s.uniqueWords)}</b><span>${esc(t.unique)}</span></div>` : "",
      s.turns != null && s.speakersKnown !== false ? `<div class="tile"><b>${esc(s.turns)}</b><span>${esc(t.turns)}</span></div>` : "",
      s.avgTurn != null && s.speakersKnown !== false ? `<div class="tile"><b>${esc(s.avgTurn)}</b><span>${esc(t.avg)}</span></div>` : "",
      s.questions != null && s.speakersKnown !== false ? `<div class="tile"><b>${esc(s.questions)}</b><span>${esc(t.questions)}</span></div>` : "",
      s.longest != null && s.speakersKnown !== false ? `<div class="tile"><b>${esc(s.longest)}</b><span>${esc(t.longest)}</span></div>` : "",
    ].join("");

    const errors = arr(a.errors).map((e) => `<div class="fix"><div class="said"><small>${esc(t.youSaid)}</small><s>${esc(e.said)}</s></div><div class="arrow">→</div><div class="right"><small>${esc(t.better)}</small><b>${esc(e.correct)}</b>${e.why ? `<p>${esc(e.why)}</p>` : ""}</div></div>`).join("");
    const wrong = arr(a.wrongWords).map((w) => `<div class="chip2"><s>${esc(w.said)}</s><span>→</span><b>${esc(w.correct)}</b>${w.note ? `<em>${esc(w.note)}</em>` : ""}</div>`).join("");
    const cloud = top.map(([w, n]) => `<span class="w" style="font-size:${(0.95 + (n / maxTop) * 1.1).toFixed(2)}rem;opacity:${(0.65 + (n / maxTop) * 0.35).toFixed(2)}">${esc(w)}<sup>${n}</sup></span>`).join("");
    const pten = arr(a.ptToEn).map((x) => `<div class="pten"><span class="ptx">“${esc(x.pt)}”</span><span class="enx">${esc(x.en)}</span></div>`).join("");
    const topics = arr(a.topics).map((x) => `<span class="pill">${esc(x)}</span>`).join("");
    const stories = arr(a.stories).map((x) => `<blockquote>${esc(x)}</blockquote>`).join("");
    const vocab = arr(a.newVocab).map((v) => `<div class="voc"><b>${esc(v.word || v)}</b>${v.meaning ? `<span>${esc(v.meaning)}</span>` : ""}</div>`).join("");
    const next = arr(a.nextSteps).length ? `<ol class="steps">${arr(a.nextSteps).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "";

    return `<!DOCTYPE html><html lang="${lang === "en" ? "en" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.kicker)} · ${esc(d.student)} · English with Denise</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,400&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--or:#E8821E;--ord:#C96A12;--l:#FCEBDC;--cream:#FBF7F2;--ink:#3A2E26;--mut:#8A7768;--line:#F0E2D3}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Nunito,system-ui,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:28px 18px 60px}
svg{width:1em;height:1em;fill:currentColor}
.hero{position:relative;overflow:hidden;border-radius:28px;padding:34px 30px 30px;background:linear-gradient(135deg,#E8821E 0%,#F2A25A 60%,#F7C08A 100%);color:#fff;box-shadow:0 18px 40px -18px rgba(201,106,18,.55)}
.hero .stars{position:absolute;inset:0;pointer-events:none}.hero .stars svg{position:absolute;fill:rgba(255,255,255,.22)}
.kick{display:inline-flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:.72rem;background:rgba(255,255,255,.18);padding:6px 12px;border-radius:999px}
.hero h1{font-family:Fraunces,Georgia,serif;font-weight:700;font-size:clamp(2rem,6vw,3.1rem);line-height:1.05;margin:16px 0 8px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.meta span{background:rgba(255,255,255,.2);border-radius:999px;padding:4px 12px;font-weight:700;font-size:.85rem}
.headline{font-family:Fraunces,Georgia,serif;font-style:italic;font-size:1.15rem;margin:18px 0 0;max-width:620px;opacity:.97}
.card{background:#fff;border:1px solid var(--line);border-radius:24px;padding:24px 22px;margin-top:18px;box-shadow:0 8px 24px -20px rgba(58,46,38,.35)}
.card h2{display:flex;align-items:center;gap:10px;font-family:Fraunces,Georgia,serif;font-weight:700;font-size:1.35rem;margin:0 0 14px}.card h2 svg{color:var(--or);font-size:1.05rem;flex:none}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.tile{background:var(--cream);border:1px solid var(--line);border-radius:18px;padding:16px 14px;display:flex;flex-direction:column;justify-content:center}
.tile.big{grid-column:span 2;flex-direction:row;align-items:center;gap:14px}.tile b{font-family:Fraunces,Georgia,serif;font-size:2rem;line-height:1;color:var(--ord)}.tile span,.tl{color:var(--mut);font-weight:700;font-size:.85rem;margin-top:6px}
.tl{font-size:1rem;color:var(--ink);margin:0}.ring{width:96px;height:96px;flex:none}.ring text{font-family:Fraunces,Georgia,serif;font-weight:700;font-size:24px;fill:var(--ord)}
.tile.big .split{display:flex;justify-content:space-between;width:100%}.lang{display:flex;flex-direction:column}.lang.pt{text-align:right}.lang.pt b{color:var(--mut)}
.tile.big{flex-wrap:wrap}.sbar{width:100%;height:12px;border-radius:999px;background:#EADFD4;overflow:hidden}.sbar i{display:block;height:100%;background:linear-gradient(90deg,var(--or),#F2A25A);border-radius:999px}
.score{margin:12px 0}.sl{display:flex;justify-content:space-between;font-weight:800}.sl b{font-family:Fraunces,Georgia,serif;color:var(--ord);font-size:1.15rem}.sl small{color:var(--mut);font-size:.75rem}
.bar{height:12px;border-radius:999px;background:var(--l);overflow:hidden;margin-top:6px}.bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#F2A25A,var(--or))}
.two{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.two>:only-child{grid-column:1/-1}.two .card{margin-top:18px}
.list{list-style:none;padding:0;margin:0}.list li{display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed var(--line)}.list li:last-child{border:0}.ic{flex:none;width:24px;height:24px;border-radius:8px;background:var(--l);color:var(--ord);display:grid;place-items:center;font-size:.8rem;font-weight:800}
.fix{display:grid;grid-template-columns:1fr auto 1.3fr;gap:12px;align-items:start;padding:14px;border-radius:16px;background:var(--cream);border:1px solid var(--line);margin-bottom:10px}
.fix small{display:block;color:var(--mut);font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:.66rem;margin-bottom:2px}.fix s{color:#B05A4A;text-decoration-thickness:2px}.fix b{color:#2F7A4F}.fix p{margin:6px 0 0;color:var(--mut);font-size:.9rem}.arrow{color:var(--or);font-weight:800;font-size:1.3rem;padding-top:12px}
.chips{display:flex;flex-wrap:wrap;gap:10px}.chip2{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:var(--cream);border:1px solid var(--line);border-radius:14px;padding:10px 14px}.chip2 s{color:#B05A4A}.chip2 b{color:#2F7A4F}.chip2 span{color:var(--or)}.chip2 em{width:100%;color:var(--mut);font-size:.85rem}
.cloud{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline}.w{font-family:Fraunces,Georgia,serif;font-weight:700;color:var(--ord)}.w sup{font-family:Nunito;font-size:.6rem;color:var(--mut);margin-left:2px}
.hint{color:var(--mut);margin:-6px 0 12px;font-size:.92rem}.pten{display:flex;flex-direction:column;padding:10px 0;border-bottom:1px dashed var(--line)}.pten:last-child{border:0}.ptx{color:var(--mut);font-style:italic}.enx{font-weight:800;color:var(--ink)}.enx:before{content:"→ ";color:var(--or)}
.pill{display:inline-block;background:var(--l);color:var(--ord);font-weight:800;border-radius:999px;padding:7px 14px;margin:0 8px 8px 0}
blockquote{margin:0 0 10px;padding:14px 16px;background:var(--cream);border-left:4px solid var(--or);border-radius:0 14px 14px 0;font-family:Fraunces,Georgia,serif;font-style:italic}
.vocs{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.voc{background:var(--cream);border:1px solid var(--line);border-radius:14px;padding:10px 14px}.voc b{display:block;color:var(--ord)}.voc span{color:var(--mut);font-size:.9rem}
.steps{margin:0;padding:0;list-style:none;counter-reset:s}.steps li{counter-increment:s;display:flex;gap:12px;align-items:flex-start;padding:8px 0}.steps li:before{content:counter(s);flex:none;width:28px;height:28px;border-radius:50%;background:var(--or);color:#fff;font-weight:800;display:grid;place-items:center}
.letter{background:linear-gradient(180deg,#fff, #FFF8F0);}.letter p{font-family:Fraunces,Georgia,serif;font-size:1.12rem;white-space:pre-wrap;margin:0}.sign{margin-top:14px;font-weight:800;color:var(--ord);display:flex;align-items:center;gap:6px}
footer{text-align:center;color:var(--mut);font-size:.82rem;margin-top:26px}footer b{color:var(--ord)}
@media (max-width:640px){.tiles{grid-template-columns:1fr 1fr}.tile.big{grid-column:span 2}.two{grid-template-columns:1fr}.fix{grid-template-columns:1fr}.arrow{display:none}.vocs{grid-template-columns:1fr}.hero{padding:28px 22px}}
@media print{body{background:#fff}.card,.hero{break-inside:avoid;box-shadow:none}}
</style></head><body><div class="wrap">
<header class="hero"><div class="stars">${[[88, 12, 46], [76, 62, 22], [92, 78, 14], [64, 18, 12]].map(([x, y, sz]) => `<svg style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px" viewBox="0 0 24 24"><path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z"/></svg>`).join("")}</div>
<span class="kick">${STAR} English with Denise · ${esc(t.kicker)}</span>
<h1>${esc(t.title(first))}</h1>
<div class="meta">${d.date ? `<span>${esc(dateLong(d.date, lang))}</span>` : ""}${d.lesson ? `<span>${esc(d.lesson)}</span>` : ""}${d.level ? `<span>${esc(d.level)}</span>` : ""}</div>
${a.headline ? `<p class="headline">${esc(a.headline)}</p>` : ""}
</header>
${sec(t.stats, `<div class="tiles">${tiles}</div>`)}
${sec(t.scores, scores)}
<div class="two">${sec(t.nailed, list(a.strengths, "✓"))}${sec(t.grown, list(a.improved, "↑"))}</div>
${sec(t.fix, errors)}
${sec(t.polish, wrong ? `<div class="chips">${wrong}</div>` : "")}
${sec(t.top, cloud ? `<div class="cloud">${cloud}</div>` : "")}
${sec(t.ptEn, pten ? `<p class="hint">${esc(t.ptEnHint)}</p>${pten}` : "")}
<div class="two">${sec(t.topics, topics)}${sec(t.stories, stories)}</div>
${sec(t.vocab, vocab ? `<div class="vocs">${vocab}</div>` : "")}
${sec(t.next, next)}
${a.message ? `<section class="card letter"><h2>${STAR}<span>${esc(t.note)}</span></h2><p>${esc(a.message)}</p><div class="sign">${STAR} Teacher Denise</div></section>` : ""}
<footer><b>English with Denise</b> ★ ${esc(t.estimate)}${s.speakersKnown === false ? " " + esc(t.noSpeakers) : ""}</footer>
</div></body></html>`;
  }

  root.EWDReport = { render };
})(typeof window !== "undefined" ? window : globalThis);
