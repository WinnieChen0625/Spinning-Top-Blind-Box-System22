// Builds dist/index.html from src/app.template.html.
//
// The page republishes itself through claude.use("artifact"), and publish()
// needs a COMPLETE document while the Artifact tool wants a body fragment.
// So the fragment carries a base64 copy of the full document (markers intact)
// in <script id="tpl">, and each publish re-derives the next full document
// from that copy. The template is therefore its own fixed point.

const fs = require("fs");
const path = require("path");

const TM = "__TPL_B64__";
const SM = "/*__STATE__*/null";

const src = path.join(__dirname, "src", "app.template.html");
const outDir = path.join(__dirname, "dist");
const out = path.join(outDir, "index.html");

const tpl = fs.readFileSync(src, "utf8");
if (!tpl.includes(TM)) throw new Error("missing " + TM + " marker");
if (!tpl.includes(SM)) throw new Error("missing state marker");
if (!tpl.includes("<!--SPLIT-->")) throw new Error("missing <!--SPLIT--> marker");

const [head, body] = tpl.split("<!--SPLIT-->");

// Mirrors the head the Artifact host wraps a published fragment in.
const fullTpl =
  '<!doctype html><html lang="zh-CN"><head>' +
  '<meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<style>*{box-sizing:border-box}html{color-scheme:dark}body{margin:0}" +
  "img{max-width:100%}[hidden]{display:none!important}</style>" +
  head +
  "</head><body>" +
  body +
  "</body></html>";

// Optional seed.json carries state forward across a rebuild so a republish
// does not wipe progress the live page already saved.
const seedPath = path.join(__dirname, "seed.json");
const seed = fs.existsSync(seedPath)
  ? JSON.stringify(JSON.parse(fs.readFileSync(seedPath, "utf8")))
  : "null";

const frag = tpl
  .replace(TM, () => Buffer.from(fullTpl, "utf8").toString("base64"))
  .replace(SM, () => seed);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(out, frag, "utf8");

// site/index.html: the standalone page for Netlify/GitHub. It never republishes
// itself, so it carries no base64 copy and no seed -- it reads its state from
// /api/state (Netlify function) and falls back to localStorage.
const siteDir = path.join(__dirname, "site");
const site = fullTpl
  .replace(TM, () => "")
  .replace(SM, () => "null");
fs.mkdirSync(siteDir, { recursive: true });
fs.writeFileSync(path.join(siteDir, "index.html"), site, "utf8");

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log("template " + kb(Buffer.byteLength(tpl)));
console.log("  -> dist/index.html " + kb(Buffer.byteLength(frag)) + "  (Artifact 片段，可自我发布)");
console.log("  -> site/index.html " + kb(Buffer.byteLength(site)) + "  (Netlify 独立页面)");
