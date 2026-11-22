// Público: devolve SOMENTE o conteúdo da página de links (DB.site) publicado pelo Studio.
const L = require("./_lib");
const { loadSnapshot } = require("./notion.js");

let cache = { at: 0, site: null };

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    if (Date.now() - cache.at > 20000) {
      const { data } = await loadSnapshot();
      const site = data && data.site;
      cache = { at: Date.now(), site: site && site.published !== false ? site : null };
    }
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
    res.statusCode = 200; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify({ site: cache.site }));
  } catch (e) {
    L.send(res, 500, { error: "Página indisponível no momento." });
  }
};
