const API = "https://footballxtra-website.onrender.com/api/news";
const SITE = "https://vibesport.vercel.app";

module.exports = async (req, res) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  let items = null;
  try {
    const r = await fetch(API, { signal: ctl.signal });
    if (r.ok) items = (await r.json()).news;
  } catch (e) {
  } finally {
    clearTimeout(t);
  }
  if (!Array.isArray(items)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("unavailable");
  }
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n';
  x += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const n of items) {
    if (!n || !n.id) continue;
    const d = n.published ? String(n.published).slice(0, 10) : "";
    x += "  <url><loc>" + SITE + "/article/" + encodeURIComponent(n.id) + "</loc>";
    if (d) x += "<lastmod>" + d + "</lastmod>";
    x += "</url>\n";
  }
  x += "</urlset>\n";
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  return res.status(200).send(x);
};
