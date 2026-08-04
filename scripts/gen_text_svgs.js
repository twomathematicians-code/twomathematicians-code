// gen_text_svgs.js — Minimal SVG generator for GitHub Profile README
// Design system: clean sans-serif, no filters, no grid paper, no decorative elements
// Run: node scripts/gen_text_svgs.js

var fs = require("fs");
var path = require("path");

var OUT = path.join(__dirname, "..", "assets");

// --- Color palette ---
var INDIGO  = "#6366F1";
var SLATE   = "#1e293b";
var MUTED   = "#64748b";
var CARD_BG = "#f8fafc";
var BORDER  = "#e2e8f0";
var GREEN   = "#22c55e";
var BLUE    = "#3b82f6";
var PURPLE  = "#8b5cf6";
var RED     = "#ef4444";
var YELLOW  = "#eab308";
var DARK_BG = "#0f172a";
var WHITE   = "#ffffff";

// --- Font stacks ---
var SANS = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif";
var MONO = "'JetBrains Mono','Fira Code','SF Mono','Consolas',monospace";

// --- Helpers ---
function svgOpen(w, h, label) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '
    + w + " " + h
    + '" font-family="' + SANS + '" role="img" aria-label="' + label + '">';
}

function write(name, content) {
  fs.writeFileSync(path.join(OUT, name), content, "utf8");
  console.log("  wrote " + name);
}


// ============================================================
//  1. BANNER  (800 x 200)
// ============================================================
function generateBanner() {
  var s = svgOpen(800, 200, "Banner — Mahesh Solanki, Unified Intelligence Engineer");

  // accent bar at top
  s += '<rect width="800" height="4" fill="' + INDIGO + '"/>';

  // name
  s += '<text x="48" y="80" font-size="36" font-weight="700" fill="'
    + SLATE + '" letter-spacing="-0.5">Mahesh Solanki</text>';

  // subtitle
  s += '<text x="48" y="116" font-size="18" font-weight="400" fill="'
    + INDIGO + '" letter-spacing="0.5">Unified Intelligence Engineer</text>';

  // thin accent line
  s += '<line x1="48" y1="136" x2="280" y2="136" stroke="'
    + INDIGO + '" stroke-width="2" stroke-linecap="round"/>';

  // location
  s += '<text x="48" y="160" font-size="14" fill="' + MUTED + '">Ghent, Belgium</text>';

  // geometric accent — concentric circles
  s += '<circle cx="740" cy="100" r="32" fill="' + INDIGO + '" opacity="0.12"/>';
  s += '<circle cx="740" cy="100" r="18" fill="' + INDIGO + '" opacity="0.20"/>';
  s += '<circle cx="740" cy="100" r="4" fill="' + INDIGO + '" opacity="0.60"/>';

  s += "</svg>";
  write("banner.svg", s);
}


// ============================================================
//  2. ABOUT ME  (720 x 160)
// ============================================================
function generateAboutMe() {
  var s = svgOpen(720, 160, "About Mahesh Solanki — ML Engineer building AI systems");

  // card background
  s += '<rect x="0" y="0" width="720" height="160" rx="12" fill="'
    + CARD_BG + '" stroke="' + BORDER + '" stroke-width="1"/>';

  // label
  s += '<text x="32" y="36" font-size="11" font-weight="600" fill="'
    + INDIGO + '" letter-spacing="2">ABOUT</text>';

  // description — three lines
  var lines = [
    "Mathematician turned ML Engineer. I build production AI systems",
    "where mathematical rigor meets scalable engineering.",
    "Focused on end-to-end ML — from first principles to production."
  ];

  for (var i = 0; i < lines.length; i++) {
    s += '<text x="32" y="' + (62 + i * 24) + '" font-size="15" fill="'
      + SLATE + '">' + lines[i] + "</text>";
  }

  // subtle accent bar on left
  s += '<rect x="0" y="0" width="4" height="160" rx="2" fill="' + INDIGO + '"/>';

  s += "</svg>";
  write("about-me.svg", s);
}


// ============================================================
//  3. CODE CARD  (500 x 280)
// ============================================================
function generateCodeCard() {
  var s = svgOpen(500, 280, "Python code card showing class Mahesh with ML focus areas");

  // dark card background
  s += '<rect x="0" y="0" width="500" height="280" rx="10" fill="'
    + DARK_BG + '" stroke="#334155" stroke-width="1"/>';

  // window dots
  s += '<circle cx="20" cy="18" r="5" fill="' + RED + '"/>';
  s += '<circle cx="38" cy="18" r="5" fill="' + YELLOW + '"/>';
  s += '<circle cx="56" cy="18" r="5" fill="' + GREEN + '"/>';
  // title bar text
  s += '<text x="80" y="22" font-size="11" fill="' + MUTED
    + '" font-family="' + MONO + '">mahesh.py</text>';

  // separator line
  s += '<line x1="0" y1="34" x2="500" y2="34" stroke="#334155" stroke-width="1"/>';

  // code lines
  var lines = [
    { indent: 1, tokens: [{ text: "class ", color: PURPLE }, { text: "Mahesh", color: BLUE }, { text: ":", color: WHITE }] },
    { indent: 2, tokens: [{ text: "def ", color: PURPLE }, { text: "focus", color: BLUE }, { text: "(self):", color: WHITE }] },
    { indent: 3, tokens: [{ text: "return ", color: PURPLE }, { text: "[", color: WHITE }] },
    { indent: 4, tokens: [{ text: '"Docker · CI/CD"', color: GREEN }] },
    { indent: 4, tokens: [{ text: '"MLOps · MLflow"', color: GREEN }] },
    { indent: 4, tokens: [{ text: '"PostgreSQL"', color: GREEN }] },
    { indent: 4, tokens: [{ text: '"PyTorch · XGBoost"', color: GREEN }] },
    { indent: 3, tokens: [{ text: "]", color: WHITE }] },
  ];

  var yBase = 58;
  var lineH = 22;
  var xBase = 24;
  var indentW = 16;

  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    var xPos = xBase + ln.indent * indentW;
    var yPos = yBase + i * lineH;

    var textEl = '<text x="' + xPos + '" y="' + yPos + '" font-family="'
      + MONO + '" font-size="13">';
    for (var j = 0; j < ln.tokens.length; j++) {
      var tk = ln.tokens[j];
      textEl += '<tspan fill="' + tk.color + '">' + tk.text + "</tspan>";
    }
    textEl += "</text>";
    s += textEl;
  }

  // subtle accent bar on left
  s += '<rect x="0" y="0" width="4" height="280" rx="2" fill="' + INDIGO + '"/>';

  s += "</svg>";
  write("code-card.svg", s);
}


// ============================================================
//  MAIN
// ============================================================
console.log("Generating minimal SVGs ...");
generateBanner();
generateAboutMe();
generateCodeCard();
console.log("Done. 3 SVGs written to assets/");
