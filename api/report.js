// Público: devolve um relatório de aula publicado (GET ?id=<página>&k=<chave secreta>).
const L = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const u = new URL(req.url, "http://x");
    const id = (u.searchParams.get("id") || "").replace(/[^a-f0-9-]/gi, "");
    const k = u.searchParams.get("k") || "";
    if (!id || k.length < 16) return L.send(res, 404, { error: "Relatório não encontrado." });
    const page = await L.notion(`/pages/${id}`);
    const parent = (page.parent && (page.parent.page_id || "")).replace(/-/g, "");
    if (parent !== String(L.IDS.snapshot).replace(/-/g, "") || page.archived) return L.send(res, 404, { error: "Relatório não encontrado." });
    const blocks = await L.listChildren(id);
    const json = blocks.filter((b) => b.type === "code").map((b) => (b.code.rich_text || []).map((x) => x.plain_text).join("")).join("");
    const data = JSON.parse(json || "{}");
    if (!data.key || data.key !== k) return L.send(res, 404, { error: "Relatório não encontrado." });
    delete data.key;
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    L.send(res, 200, { report: data });
  } catch (e) {
    L.send(res, 404, { error: "Relatório não encontrado." });
  }
};
