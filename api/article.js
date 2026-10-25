const fs = require("fs");
const path = require("path");

const API = "https://footballxtra-website.onrender.com/api/news";
const SITE = "https://vibesport.vercel.app";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    return { status: r.status, json: r.ok ? await r.json() : null };
  } catch (e) {
    return { status: 0, json: null };
  } finally {
    clearTimeout(t);
  }
}

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "");
  let html = fs.readFileSync(path.join(process.cwd(), "article.html"), "utf8");
  html = html.replace(/<head(\s[^>]*)?>/i, () => '<head>\n<base href="/">');

  const r = await getJson(API + "/" + encodeURIComponent(id));
  const a = r.json && r.json.article;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!a) {
    res.setHeader("Cache-Control", "no-store");
    html = html.replace("</head>", () => '<meta name="robots" content="noindex">\n</head>');
    return res.status(r.status === 404 ? 404 : 200).send(html);
  }

  const title = a.titleAm || a.headline || "VibeSport";
  const desc = String(a.descriptionAm || a.description || "")
    .replace(/\s+/g, " ").trim().slice(0, 200);
  const url = SITE + "/article/" + encodeURIComponent(id);
  const img = /^https?:\/\//.test(a.image || "") ? a.image : SITE + "/og-image.png";

  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: desc,
    image: [img],
    datePublished: a.published,
    inLanguage: "am",
    mainEntityOfPage: url,
    publisher: { "@type": "Organization", name: "VibeSport" }
  };
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");

  html = html.replace(/<title>[\s\S]*?<\/title>\s*/i, "");
  html = html.replace(/<meta\s+name="description"[^>]*>\s*/gi, "");
  html = html.replace(/<meta\s+property="og:[^>]*>\s*/gi, "");
  html = html.replace(/<meta\s+name="twitter:[^>]*>\s*/gi, "");
  html = html.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");

  const meta = [
    "<title>" + esc(title) + " | VibeSport</title>",
    '<meta name="description" content="' + esc(desc) + '">',
    '<link rel="canonical" href="' + esc(url) + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="VibeSport">',
    '<meta property="og:locale" content="am_ET">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:image" content="' + esc(img) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    '<meta name="twitter:image" content="' + esc(img) + '">',
    '<script type="application/ld+json">' + ldJson + "</script>"
  ].join("\n");

  html = html.replace("</head>", () => meta + "\n</head>");
  html = html.replace(/<body[^>]*>/i, (m) =>
    m + "\n<noscript><h1>" + esc(title) + "</h1><p>" + esc(desc) + "</p></noscript>");

  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  return res.status(200).send(html);
};
