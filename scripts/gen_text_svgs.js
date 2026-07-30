// Generates hand-drawn graph-paper text SVGs for the profile README.
// Run: node scripts/gen_text_svgs.js  (writes into ../assets/)
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets");

// ---- shared helpers (plain string concat to avoid template-literal escaping traps) ----
function paper(w, h, idSuf) {
  return (
    '<defs>' +
    '<pattern id="g' + idSuf + '" width="22" height="22" patternUnits="userSpaceOnUse">' +
    '<path d="M22 0 L0 0 0 22" fill="none" stroke="#c9d6e8" stroke-width="0.6" opacity="0.5"/>' +
    '</pattern>' +
    '<pattern id="G' + idSuf + '" width="110" height="110" patternUnits="userSpaceOnUse">' +
    '<path d="M110 0 L0 0 0 110" fill="none" stroke="#a9bdd6" stroke-width="0.9" opacity="0.4"/>' +
    '</pattern>' +
    '<filter id="ink' + idSuf + '" x="-3%" y="-3%" width="106%" height="112%">' +
    '<feTurbulence type="turbulence" baseFrequency="0.013 0.019" numOctaves="2" seed="' + idSuf + '" result="t"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="t" scale="2.1"/>' +
    '</filter>' +
    '</defs>' +
    '<rect width="' + w + '" height="' + h + '" fill="#f7f5ef"/>' +
    '<rect width="' + w + '" height="' + h + '" fill="url(#g' + idSuf + ')"/>' +
    '<rect width="' + w + '" height="' + h + '" fill="url(#G' + idSuf + ')"/>'
  );
}

const FF = "font-family=\"'Caveat','Comic Sans MS','Segoe Script',cursive\"";

function svgOpen(w, h, label) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h +
    '" ' + FF + ' role="img" aria-label="' + label + '">';
}
const svgClose = "</svg>";

function write(name, content) {
  fs.writeFileSync(path.join(OUT, name), content, "utf8");
  console.log("wrote " + name);
}

// ============================================================
// 1. ABOUT ME — handwritten note card (the blockquote)
// ============================================================
(function aboutMe() {
  const w = 820, h = 190;
  let s = svgOpen(w, h, "About me, hand-written note") + paper(w, h, "1");
  // left red margin line (notebook style)
  s += '<line x1="70" y1="20" x2="70" y2="' + (h - 20) + '" stroke="#e6a8a8" stroke-width="1.4" opacity="0.7"/>';
  // heading
  s += '<text x="96" y="52" fill="#c0392b" font-size="30" filter="url(#ink1)">' + "About Me" + "</text>";
  // body lines (wrapped manually)
  const lines = [
    { t: "I build production ML systems the way a mathematician", c: "#2b3a55", sz: 25 },
    { t: "solves a problem \u2014 from first principles.", c: "#2b3a55", sz: 25 },
    { t: "Python \u00b7 FastAPI \u00b7 Docker \u00b7 PostgreSQL, wired into CI/CD", c: "#3b5998", sz: 25 },
    { t: "pipelines that ship.", c: "#3b5998", sz: 25 },
    { t: "My notebooks move between calculus, probability,", c: "#1e6b3a", sz: 25 },
    { t: "and deployed inference APIs.", c: "#1e6b3a", sz: 25 },
  ];
  let y = 92;
  s += '<g filter="url(#ink1)">';
  for (const ln of lines) {
    s += '<text x="96" y="' + y + '" fill="' + ln.c + '" font-size="' + ln.sz + '">' + ln.t + "</text>";
    y += 16;
  }
  s += "</g>";
  // corner coffee stain
  s += '<ellipse cx="' + (w - 50) + '" cy="40" rx="40" ry="26" fill="#d9c08a" opacity="0.10"/>';
  s += svgClose;
  write("about-me.svg", s);
})();

// ============================================================
// 2. CODE CARD — the Python class, hand-written on paper
// ============================================================
(function codeCard() {
  const w = 560, h = 360;
  let s = svgOpen(w, h, "Hand-written Python class") + paper(w, h, "2");
  // tape at top (washi-tape look)
  s += '<rect x="230" y="-8" width="100" height="30" fill="#bcd9c6" opacity="0.7" transform="rotate(-3 280 7)"/>';
  const code = [
    { t: "class Mahesh:", c: "#7c5cff", sz: 26, x: 40 },
    { t: 'name     = "Mahesh Solanki"', c: "#2b3a55", sz: 23, x: 70 },
    { t: 'role     = "ML Engineer"', c: "#2b3a55", sz: 23, x: 70 },
    { t: 'location = "Ghent, Belgium"', c: "#2b3a55", sz: 23, x: 70 },
    { t: "", c: "#2b3a55", sz: 23, x: 70 },
    { t: "def focus(self) -> list[str]:", c: "#7c5cff", sz: 23, x: 70 },
    { t: 'return [', c: "#2b3a55", sz: 23, x: 100 },
    { t: '"Containerization & Docker Compose",', c: "#1e6b3a", sz: 22, x: 130 },
    { t: '"CI/CD \u2014 GitLab CI & GitHub Actions",', c: "#1e6b3a", sz: 22, x: 130 },
    { t: '"Advanced Python \u2014 async, Pydantic",', c: "#1e6b3a", sz: 22, x: 130 },
    { t: '"PostgreSQL & SQLAlchemy async ORM",', c: "#1e6b3a", sz: 22, x: 130 },
    { t: '"MLOps \u2014 MLflow, DVC, tracking",', c: "#1e6b3a", sz: 22, x: 130 },
    { t: '"Deep Learning \u2014 PyTorch, XGBoost",', c: "#1e6b3a", sz: 22, x: 130 },
    { t: "]", c: "#2b3a55", sz: 23, x: 100 },
  ];
  let y = 50;
  s += '<g filter="url(#ink2)">';
  for (const ln of code) {
    s += '<text x="' + ln.x + '" y="' + y + '" fill="' + ln.c + '" font-size="' + ln.sz + '">' + ln.t + "</text>";
    y += 22;
  }
  // little doodle: a function box f(x) in corner
  s += '<text x="' + (w - 90) + '" y="' + (h - 20) + '" fill="#7a8699" font-size="22">f(x) = \u03c3(Wx+b)</text>';
  s += "</g>";
  s += svgClose;
  write("code-card.svg", s);
})();

// ============================================================
// 3. SECTION HEADERS — handwritten notebook tabs
// ============================================================
function sectionHeader(name, emoji, title, seed) {
  const w = 520, h = 80;
  let s = svgOpen(w, h, "Section: " + title) + paper(w, h, seed);
  // tab shape on left
  s += '<g filter="url(#ink' + seed + ')">';
  s += '<path d="M30 18 L30 ' + (h - 18) + ' L70 ' + (h - 26) + ' L70 26 Z" fill="#fff3d6" stroke="#c8922a" stroke-width="1.6" opacity="0.85"/>';
  s += '<text x="44" y="48" font-size="26">' + emoji + "</text>";
  s += '<text x="96" y="52" fill="#2b3a55" font-size="34" font-weight="bold">' + title + "</text>";
  // underline scribble
  s += '<path d="M96 62 q 80 -7 160 0 t 150 0" fill="none" stroke="#ff8a3d" stroke-width="2.4" opacity="0.8"/>';
  s += "</g>";
  s += svgClose;
  write(name, s);
}
sectionHeader("section-notebook.svg", "\u{1F4D0}", "The Notebook", "3");
sectionHeader("section-tech.svg", "\u{1F6E0}\uFE0F", "Tech Stack", "4");
sectionHeader("section-projects.svg", "\u{1F680}", "Featured Projects", "5");
sectionHeader("section-telemetry.svg", "\u{1F4E1}", "Live Telemetry", "6");

// ============================================================
// 4. TECH-STACK CATEGORY LABELS — small handwritten chips
// ============================================================
function label(name, txt, color, seed) {
  const w = 300, h = 56;
  let s = svgOpen(w, h, "Label: " + txt) + paper(w, h, seed);
  s += '<g filter="url(#ink' + seed + ')">';
  s += '<rect x="14" y="10" width="' + (w - 28) + '" height="36" rx="10" fill="#fff" stroke="' + color + '" stroke-width="2"/>';
  s += '<circle cx="34" cy="28" r="5" fill="' + color + '"/>';
  s += '<text x="54" y="35" fill="' + color + '" font-size="25" font-weight="bold">' + txt + "</text>";
  s += "</g>";
  s += svgClose;
  write(name, s);
}
label("label-core.svg", "Core", "#3b5998", "7");
label("label-ml.svg", "ML & Data", "#7c5cff", "8");
label("label-tooling.svg", "Tooling", "#1e6b3a", "9");

console.log("\nAll text SVGs generated.");
