#!/usr/bin/env node
/**
 * generate.js — Auto-generates GitHub Profile README with per-repo SVG components.
 *
 * Fetches all public repos from GitHub API, categorizes them, generates SVG cards,
 * language breakdown, stats panel, and assembles the full README.md.
 *
 * Usage: node scripts/generate.js
 * Zero dependencies — uses Node.js built-in https module.
 */

"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────
const USERNAME = "twomathematicians-code";
const BASE_URL = `https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated&direction=desc&type=public`;
const REPO_URL = `https://github.com/${USERNAME}`;

// Paths (relative to repo root)
const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const REPOS_DIR = path.join(ASSETS_DIR, "repos");
const README_PATH = path.join(ROOT, "README.md");

// ──────────────────────────────────────────────
// Design System — GitHub Dark Theme
// ──────────────────────────────────────────────
const DS = {
  bg: "#0d1117",
  cardBg: "#161b22",
  border: "#30363d",
  text: "#c9d1d9",
  muted: "#8b949e",
  accent: "#58a6ff",
  green: "#3fb950",
  orange: "#f78166",
  purple: "#bc8cff",
  indigo: "#6366f1",
  font: "Segoe UI,system-ui,sans-serif",
  mono: "SF Mono,Consolas,monospace",
};

// Category accent colors (left bar + category header)
const CAT_COLORS = {
  "ai-infrastructure": DS.accent,
  "ml-engineering": DS.green,
  "nlp-ai": DS.purple,
  analytics: DS.orange,
  "domain-ml": "#f78166",
  research: "#79c0ff",
  "systems-tools": "#d2a8ff",
  mathematics: "#ffa657",
  experimental: "#7ee787",
  uncategorized: DS.muted,
};

// Category display names + emojis
const CAT_META = {
  "ai-infrastructure": { label: "AI Infrastructure", emoji: "\u{1F3D7}\uFE0F" },
  "ml-engineering": { label: "ML Engineering", emoji: "\u{1F3ED}" },
  "nlp-ai": { label: "NLP & AI", emoji: "\u{1F4AC}" },
  analytics: { label: "Analytics", emoji: "\u{1F4CA}" },
  "domain-ml": { label: "Domain ML", emoji: "\u{1F3AF}" },
  research: { label: "Research", emoji: "\u{1F52C}" },
  "systems-tools": { label: "Systems & Tools", emoji: "\u{2699}\uFE0F" },
  mathematics: { label: "Mathematics", emoji: "\u{1F4D0}" },
  experimental: { label: "Experimental", emoji: "\u{1F9EA}" },
  uncategorized: { label: "Other Projects", emoji: "\u{1F4E6}" },
};

// Language color map (GitHub language colors)
const LANG_COLORS = {
  Python: "#3572A5",
  R: "#198CE7",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  "Jupyter Notebook": "#DA5B0B",
  HTML: "#e34c26",
  TeX: "#3D6117",
  MATLAB: "#e16737",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Shell: "#89e051",
  CSS: "#563d7c",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
};

// Category assignment rules
const CAT_RULES = {
  "ai-infrastructure": {
    repos: ["archon", "raix", "paix", "deep-computational-research-lab"],
    topics: ["ai", "ml-platform", "meta-platform", "ai-platform"],
  },
  "ml-engineering": {
    repos: [
      "engineer-credit-risk",
      "fraud-detection",
      "demand-forecasting",
      "CausalInference-Toolkit",
      "Manifold-DB-Repo",
    ],
    topics: ["mlops", "production", "ml-engineering", "pipeline"],
  },
  "nlp-ai": {
    repos: ["nlp-toolkit", "chatbot-deployment", "sentiment-analysis-suite", "chen"],
    topics: ["nlp", "nlu", "conversational-ai", "llm"],
  },
  analytics: {
    repos: ["customer-analytics", "recommender-systems", "EP_Analytics"],
    topics: ["analytics", "bi", "business-intelligence"],
  },
  "domain-ml": {
    repos: [
      "fingraph-sentinel",
      "healthcare-analytics",
      "financial-forecasting",
      "computer-vision",
    ],
    topics: ["domain", "healthcare", "finance", "computer-vision"],
  },
  research: {
    repos: [
      "bartlett-correction-sem",
      "mathematical-research-collection",
      "ViVAE-Research-Project",
      "mahesh-portfolio",
    ],
    topics: ["research", "academic", "thesis"],
  },
  "systems-tools": {
    repos: [
      "AgentForge",
      "crypto-swarm-trader",
      "ollama-rstudio-assistant",
      "notebooklm-video-agent",
    ],
    topics: ["tool", "agent", "system", "automation"],
  },
  mathematics: {
    repos: [
      "CDL-Monograph-Markdown",
      "Python-Advanced-Calculus-Analysis",
      "python_numerical_methods",
      "ccp_numerical_methods",
      "matric-space",
    ],
    topics: ["math", "mathematics", "calculus", "numerical"],
  },
  experimental: {
    repos: [
      "mantis_optimization",
      "EcoDrive-Net",
      "EcoDrive-Net_finalized",
      "agnblue-vyakarana",
      "Mind-Not-Brain",
      "Hybrid_Game_Recommendation",
      "post-quantum-computations",
      "Final_SEMLRT",
      "maisuclaw",
    ],
    topics: ["experimental", "prototype"],
  },
};

// Repos to skip (the profile repo itself, config repos)
const SKIP_REPOS = [USERNAME.toLowerCase(), "universe", "interactive-viz", "multi-lang-viz-repo"];

// ──────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────
function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s, max) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "\u2026" : s;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function langColor(lang) {
  return LANG_COLORS[lang] || "#8b949e";
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeSvg(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content.trim() + "\n", "utf-8");
}

// ──────────────────────────────────────────────
// GitHub API fetch
// ──────────────────────────────────────────────
function fetchRepos() {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL);
    url.searchParams.set("per_page", "100");
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "User-Agent": "node-generate-profile",
        Accept: "application/vnd.github.v3+json",
      },
    };

    https
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const repos = JSON.parse(data);
              resolve(
                repos
                  .filter((r) => !r.fork && !SKIP_REPOS.includes(r.name.toLowerCase()))
                  .map((r) => ({
                    name: r.name,
                    description: r.description || "",
                    language: r.language || "",
                    stars: r.stargazers_count || 0,
                    forks: r.forks_count || 0,
                    topics: r.topics || [],
                    updatedAt: r.updated_at || "",
                    url: r.html_url || `${REPO_URL}/${r.name}`,
                  }))
              );
            } catch (e) {
              reject(new Error("Failed to parse GitHub API response: " + e.message));
            }
          } else {
            reject(new Error(`GitHub API returned ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

// ──────────────────────────────────────────────
// Categorization
// ──────────────────────────────────────────────
function categorizeRepo(repo) {
  const nameLower = repo.name.toLowerCase();
  const topicsLower = repo.topics.map((t) => t.toLowerCase());

  // Check each category: exact repo name match first, then topic match
  for (const [catSlug, rules] of Object.entries(CAT_RULES)) {
    if (rules.repos && rules.repos.some((r) => r.toLowerCase() === nameLower)) {
      return catSlug;
    }
    if (rules.topics && rules.topics.some((t) => topicsLower.includes(t.toLowerCase()))) {
      return catSlug;
    }
  }

  return "uncategorized";
}

function categorizeRepos(repos) {
  const categories = {};
  for (const repo of repos) {
    const cat = categorizeRepo(repo);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(repo);
  }
  // Sort repos within each category by stars desc, then updated desc
  for (const cat of Object.keys(categories)) {
    categories[cat].sort((a, b) => {
      if (b.stars !== a.stars) return b.stars - a.stars;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }
  return categories;
}

// ──────────────────────────────────────────────
// SVG Generators
// ──────────────────────────────────────────────

function generateHeader() {
  const w = 800, h = 130;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="12" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <rect x="0" y="0" width="${w}" height="4" rx="2" fill="${DS.indigo}"/>
  <text x="32" y="52" font-family="${DS.font}" font-size="28" font-weight="700" fill="#ffffff">Mahesh Solanki</text>
  <text x="32" y="82" font-family="${DS.font}" font-size="16" fill="${DS.accent}">Unified Intelligence Engineer</text>
  <text x="32" y="108" font-family="${DS.font}" font-size="12" fill="${DS.muted}">\u{1F4CD} Ghent, Belgium  \u00B7  Mathematician \u2192 Computational Expert</text>
  <circle cx="720" cy="65" r="35" fill="none" stroke="${DS.indigo}" stroke-width="1" opacity="0.3"/>
  <circle cx="720" cy="65" r="22" fill="none" stroke="${DS.accent}" stroke-width="1" opacity="0.3"/>
  <circle cx="720" cy="65" r="10" fill="${DS.accent}" opacity="0.4"/>
  <line x1="640" y1="85" x2="680" y2="65" stroke="${DS.border}" stroke-width="1"/>
  <line x1="680" y1="65" x2="690" y2="45" stroke="${DS.border}" stroke-width="1"/>
</svg>`;
  return svg;
}

function generateStats(repos) {
  const w = 800, h = 80;
  const totalStars = repos.reduce((s, r) => s + r.stars, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks, 0);
  const totalRepos = repos.length;

  // Count languages
  const langCount = {};
  repos.forEach((r) => {
    if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
  });
  const topLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0];

  const stats = [
    { label: "Repos", value: totalRepos, color: DS.accent },
    { label: "Stars", value: totalStars, color: "#e3b341" },
    { label: "Forks", value: totalForks, color: DS.green },
    { label: "Top Lang", value: topLang ? topLang[0] : "N/A", color: langColor(topLang ? topLang[0] : "") },
  ];

  const slotW = w / stats.length;

  const statBlocks = stats
    .map((s, i) => {
      const cx = slotW * i + slotW / 2;
      return `
    <circle cx="${cx - 40}" cy="40" r="4" fill="${s.color}"/>
    <text x="${cx - 30}" y="34" font-family="${DS.font}" font-size="11" fill="${DS.muted}">${s.label}</text>
    <text x="${cx - 30}" y="54" font-family="${DS.mono}" font-size="16" font-weight="600" fill="#ffffff">${String(s.value)}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="10" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  ${statBlocks}
</svg>`;
  return svg;
}

function generateLanguages(repos) {
  const w = 400, h = 220;
  const langBytes = {};
  let totalBytes = 0;
  repos.forEach((r) => {
    if (r.language) {
      langBytes[r.language] = (langBytes[r.language] || 0) + 1;
      totalBytes += 1;
    }
  });

  const sorted = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  if (top.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="60" viewBox="0 0 ${w} 60">
  <rect width="${w}" height="60" rx="10" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <text x="20" y="38" font-family="${DS.font}" font-size="13" fill="${DS.muted}">No language data</text>
</svg>`;
  }

  const barY0 = 50;
  const barH = 16;
  const barGap = 6;
  const barMaxW = 200;

  const bars = top
    .map((lang, i) => {
      const pct = ((lang[1] / totalBytes) * 100).toFixed(1);
      const barW = Math.max(8, (lang[1] / top[0][1]) * barMaxW);
      const y = barY0 + i * (barH + barGap);
      const color = langColor(lang[0]);
      return `
    <circle cx="24" cy="${y + barH / 2 + 1}" r="4" fill="${color}"/>
    <text x="36" y="${y + barH / 2 + 4}" font-family="${DS.font}" font-size="11" fill="${DS.text}">${escapeXml(lang[0])}</text>
    <rect x="140" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${color}" opacity="0.85"/>
    <text x="${148 + barW + 8}" y="${y + barH / 2 + 4}" font-family="${DS.mono}" font-size="10" fill="${DS.muted}">${pct}%</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="10" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <text x="20" y="32" font-family="${DS.font}" font-size="13" font-weight="600" fill="#ffffff">Languages</text>
  ${bars}
</svg>`;
  return svg;
}

function generatePipelineSvg() {
  const w = 800, h = 200;
  // Pipeline stages: left-to-right flow with connected nodes
  const stages = [
    { label: "Math", color: "#ffa657", items: ["Stats", "LinAlg", "Optim"] },
    { label: "Data", color: "#79c0ff", items: ["SQL", "ETL", "VecDB"] },
    { label: "ML", color: "#533483", items: ["XGBoost", "PyTorch", "NLP/CV"] },
    { label: "AI", color: "#6366f1", items: ["RAG", "Agents", "LLM"] },
    { label: "Prod", color: "#818cf8", items: ["FastAPI", "Docker", "MLOps"] },
    { label: "Impact", color: "#3fb950", items: ["BFSI", "Health", "Supply"] },
  ];

  const gap = 20;
  const totalGaps = (stages.length - 1) * gap;
  const nodeW = Math.floor((w - 60 - totalGaps) / stages.length);
  const nodeH = 130;
  const startY = 50;
  const startX = 30;

  const nodes = stages.map((stage, i) => {
    const x = startX + i * (nodeW + gap);
    // Main box
    let svg = `<rect x="${x}" y="${startY}" width="${nodeW}" height="${nodeH}" rx="8" fill="${DS.cardBg}" stroke="${stage.color}" stroke-width="1.5"/>`;
    // Top accent bar
    svg += `<rect x="${x}" y="${startY}" width="${nodeW}" height="3" rx="2" fill="${stage.color}"/>`;
    // Stage label
    svg += `<text x="${x + nodeW / 2}" y="${startY + 24}" text-anchor="middle" font-family="${DS.font}" font-size="13" font-weight="700" fill="${stage.color}">${stage.label}</text>`;
    // Separator line
    svg += `<line x1="${x + 12}" y1="${startY + 34}" x2="${x + nodeW - 12}" y2="${startY + 34}" stroke="${DS.border}" stroke-width="0.5"/>`;
    // Items
    stage.items.forEach((item, j) => {
      const iy = startY + 54 + j * 26;
      svg += `<circle cx="${x + 20}" cy="${iy}" r="3" fill="${stage.color}" opacity="0.7"/>`;
      svg += `<text x="${x + 30}" y="${iy + 4}" font-family="${DS.font}" font-size="11" fill="${DS.text}">${item}</text>`;
    });
    return svg;
  });

  // Arrows between stages
  const arrows = stages.slice(0, -1).map((_, i) => {
    const x1 = startX + (i + 1) * (nodeW + gap) - gap + 2;
    const x2 = x1 + gap - 4;
    const y = startY + nodeH / 2;
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${DS.muted}" stroke-width="1.5" stroke-dasharray="3,3"/>` +
           `<polygon points="${x2},${y - 4} ${x2 + 6},${y} ${x2},${y + 4}" fill="${DS.muted}"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${nodes.join("\n  ")}
  ${arrows.join("\n  ")}
</svg>`;
}

function generateCategoryHeader(catSlug, count) {
  const meta = CAT_META[catSlug] || CAT_META.uncategorized;
  const color = CAT_COLORS[catSlug] || DS.muted;
  const w = 600, h = 36;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="8" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <rect x="0" y="0" width="4" height="${h}" rx="2" fill="${color}"/>
  <text x="16" y="24" font-family="${DS.font}" font-size="13" font-weight="600" fill="#ffffff">${meta.emoji}  ${meta.label}</text>
  <rect x="${w - 80}" y="8" width="32" height="20" rx="10" fill="${color}" opacity="0.2"/>
  <text x="${w - 64}" y="23" font-family="${DS.mono}" font-size="11" fill="${color}">${count}</text>
</svg>`;
  return svg;
}

function generateRepoCard(repo, catSlug) {
  const w = 380, h = 120;
  const color = CAT_COLORS[catSlug] || DS.muted;
  const desc = truncate(repo.description || "No description", 65);
  const langName = repo.language || "N/A";
  const langColorVal = repo.language ? langColor(repo.language) : DS.muted;
  const updated = formatDate(repo.updatedAt);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="8" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <rect x="0" y="0" width="4" height="${h}" rx="2" fill="${color}"/>
  <text x="16" y="28" font-family="${DS.font}" font-size="14" font-weight="700" fill="#ffffff">${escapeXml(repo.name)}</text>
  <text x="16" y="50" font-family="${DS.font}" font-size="11" fill="${DS.muted}">${escapeXml(desc)}</text>
  <circle cx="24" cy="78" r="5" fill="${langColorVal}"/>
  <text x="34" y="82" font-family="${DS.font}" font-size="11" fill="${DS.text}">${escapeXml(langName)}</text>
  <text x="16" y="102" font-family="${DS.mono}" font-size="10" fill="${DS.muted}">
    ${repo.stars > 0 ? `\u2B50 ${repo.stars}  ` : ""}${repo.forks > 0 ? `\u{1F374} ${repo.forks}  ` : ""}${updated ? `\u{1F4C5} ${updated}` : ""}
  </text>
</svg>`;
  return svg;
}

// ──────────────────────────────────────────────
// README Assembly
// ──────────────────────────────────────────────
function assembleReadme(repos, categories) {
  const lines = [];

  // Header
  lines.push(`<!-- AUTO-GENERATED-START -->`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(`  <img src="assets/header.svg" alt="Mahesh Solanki — Unified Intelligence Engineer" width="100%" />`);
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(
    `  <a href="https://readme-typing-svg.demolab.com/demo/"><img src="https://readme-typing-svg.demolab.com/?lines=Unified+Intelligence+Engineer;ML+Systems+%C2%B7+Production+AI;Mathematics+%E2%8A%95+Code;First+Principles+%C2%B7+End-to-End+ML;Building+AI-Powered+Products&font=Fira+Code&center=true&width=520&height=45&color=6366f1&vCenter=true&pause=2000&size=20" alt="Typing SVG" /></a>`
  );
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(
    `  <a href="https://linkedin.com/in/maheshsolanki-16b9a6a5"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" /></a>`
  );
  lines.push(
    `  <a href="mailto:maheshsinh1910@gmail.com"><img src="https://img.shields.io/badge/Gmail-EA4335?style=flat-square&logo=gmail&logoColor=white" /></a>`
  );
  lines.push(
    `  <a href="https://github.com/twomathematicians-code"><img src="https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white" /></a>`
  );
  lines.push(
    `  <img src="https://komarev.com/ghpvc/?username=twomathematicians-code&label=PROFILE+VIEWS&color=6366f1&style=flat-square" alt="Profile Views" />`
  );
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Stats bar
  lines.push(`<p align="center">`);
  lines.push(`  <img src="assets/stats.svg" alt="Repository statistics" width="100%" />`);
  lines.push(`</p>`);
  lines.push(``);

  // Languages + Stats side by side (using table)
  lines.push(`<p align="center">`);
  lines.push(`  <table>`);
  lines.push(`    <tr>`);
  lines.push(`      <td width="48%" align="center"><img src="assets/languages.svg" alt="Language breakdown" width="100%" /></td>`);
  lines.push(
    `      <td width="48%" align="center"><img src="https://github-readme-stats.vercel.app/api?username=twomathematicians-code&show_icons=true&theme=tokyonight&hide_border=true&count_private=true&include_all_commits=true" width="100%" /></td>`
  );
  lines.push(`    </tr>`);
  lines.push(`  </table>`);
  lines.push(`</p>`);
  lines.push(``);

  // Trophies + Streak side by side
  lines.push(`<p align="center">`);
  lines.push(`  <table>`);
  lines.push(`    <tr>`);
  lines.push(
    `      <td width="48%" align="center"><img src="https://github-readme-streak-stats.herokuapp.com/?user=twomathematicians-code&theme=tokyonight&hide_border=true" width="100%" /></td>`
  );
  lines.push(
    `      <td width="48%" align="center"><img src="https://github-readme-stats.vercel.app/api/top-langs/?username=twomathematicians-code&layout=compact&theme=tokyonight&hide_border=true&langs_count=8&hide=html,css,tex" width="100%" /></td>`
  );
  lines.push(`    </tr>`);
  lines.push(`  </table>`);
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(
    `  <img src="https://github-profile-trophy.vercel.app/?username=twomathematicians-code&theme=tokyonight&no-frame=true&column=7&margin-w=8" width="100%" />`
  );
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Mermaid mindmap
  lines.push(`## \u{1F9E0} Unified Intelligence`);
  lines.push(``);
  lines.push("```mermaid");
  lines.push("mindmap");
  lines.push("  root((Unified Intelligence))");
  lines.push("    ML Engineering");
  lines.push("      Production ML");
  lines.push("        FastAPI / Flask");
  lines.push("        Docker");
  lines.push("        CI/CD");
  lines.push("      MLOps");
  lines.push("        MLflow / DVC");
  lines.push("        Model Registry");
  lines.push("        PostgreSQL");
  lines.push("      Data Engineering");
  lines.push("        ETL Pipelines");
  lines.push("        Vector DBs");
  lines.push("        Stream Processing");
  lines.push("    AI Systems");
  lines.push("      GenAI & RAG");
  lines.push("        LangChain");
  lines.push("        Graph RAG");
  lines.push("        LLM Orchestration");
  lines.push("      NLP");
  lines.push("        Transformers");
  lines.push("        spaCy / NER");
  lines.push("        Sentiment");
  lines.push("      Computer Vision");
  lines.push("        YOLO / OpenCV");
  lines.push("        Face Recognition");
  lines.push("        Segmentation");
  lines.push("      Dev Tools");
  lines.push("        paix (NL\u2192Python)");
  lines.push("        raix (R AI)");
  lines.push("        Archon (Meta-Platform)");
  lines.push("    Mathematics");
  lines.push("      Statistics");
  lines.push("        Bayesian Inference");
  lines.push("        Hypothesis Testing");
  lines.push("        SEM");
  lines.push("      Optimization");
  lines.push("        Gradient Descent");
  lines.push("        Convex Optimization");
  lines.push("      Linear Algebra");
  lines.push("        Matrix Decomposition");
  lines.push("        Tensor Operations");
  lines.push("    Domain Expertise");
  lines.push("      BFSI");
  lines.push("        Credit Risk");
  lines.push("        Fraud Detection");
  lines.push("        AML / KYC");
  lines.push("      Healthcare");
  lines.push("        Diagnostic ML");
  lines.push("        Survival Analysis");
  lines.push("      Supply Chain");
  lines.push("        Demand Forecasting");
  lines.push("```");
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Featured projects (top 4 by stars)
  const featured = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 4);
  lines.push(`## \u{1F680} Featured Projects`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(`  <table>`);
  for (let i = 0; i < featured.length; i += 2) {
    lines.push(`    <tr>`);
    for (let j = 0; j < 2 && i + j < featured.length; j++) {
      const r = featured[i + j];
      lines.push(
        `      <td width="48%" align="center"><a href="${r.url}"><img src="https://github-readme-stats.vercel.app/api/pin/?username=${USERNAME}&repo=${r.name}&theme=tokyonight&hide_border=true" width="100%" /></a></td>`
      );
    }
    lines.push(`    </tr>`);
  }
  lines.push(`  </table>`);
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Repository categories
  lines.push(`## \u{1F4E6} Repository Components`);
  lines.push(``);
  lines.push(`> Each repository is a unique SVG component, auto-generated from live GitHub data.`);
  lines.push(``);

  // Ordered category list
  const catOrder = [
    "ai-infrastructure",
    "ml-engineering",
    "nlp-ai",
    "analytics",
    "domain-ml",
    "research",
    "systems-tools",
    "mathematics",
    "experimental",
    "uncategorized",
  ];

  for (const catSlug of catOrder) {
    const catRepos = categories[catSlug];
    if (!catRepos || catRepos.length === 0) continue;

    const meta = CAT_META[catSlug] || CAT_META.uncategorized;
    lines.push(`<p align="center">`);
    lines.push(`  <img src="assets/category-${catSlug}.svg" alt="${meta.label}" width="75%" />`);
    lines.push(`</p>`);
    lines.push(``);

    // 2-column grid of repo cards
    lines.push(`<p align="center">`);
    lines.push(`  <table>`);
    for (let i = 0; i < catRepos.length; i += 2) {
      lines.push(`    <tr>`);
      for (let j = 0; j < 2 && i + j < catRepos.length; j++) {
        const r = catRepos[i + j];
        lines.push(
          `      <td width="48%" align="center"><a href="${r.url}"><img src="assets/repos/repo-${r.name}.svg" alt="${escapeXml(r.name)}" width="100%" /></a></td>`
        );
      }
      lines.push(`    </tr>`);
    }
    lines.push(`  </table>`);
    lines.push(`</p>`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);

  // Tech Pipeline — SVG (no Mermaid = no loading issues)
  lines.push(`## \u{1F527} Tech Pipeline`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(`  <img src="assets/pipeline.svg" alt="Tech Pipeline — Math \u2192 Data \u2192 ML \u2192 AI \u2192 Prod \u2192 Impact" width="100%" />`);
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // View all repos badge
  lines.push(`<p align="center">`);
  lines.push(
    `  <a href="https://github.com/${USERNAME}?tab=repositories"><img src="https://img.shields.io/badge/View_All_Repos_\u2192-6366f1?style=for-the-badge" alt="View all repositories" /></a>`
  );
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(`  <samp>`);
  lines.push(`    <a href="https://linkedin.com/in/maheshsolanki-16b9a6a5" style="color:#c9d1d9">linkedin</a>`);
  lines.push(`    &nbsp;\u00B7&nbsp;`);
  lines.push(`    <a href="mailto:maheshsinh1910@gmail.com" style="color:#c9d1d9">email</a>`);
  lines.push(`    &nbsp;\u00B7&nbsp;`);
  lines.push(`    <a href="https://github.com/${USERNAME}" style="color:#c9d1d9">github</a>`);
  lines.push(`  </samp>`);
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`<!-- AUTO-GENERATED-END -->`);

  return lines.join("\n");
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
async function main() {
  console.log(`\u{1F50D} Fetching repositories for ${USERNAME}...`);
  const repos = await fetchRepos();
  console.log(`   Found ${repos.length} public repositories.`);

  console.log(`\u{1F4C4} Categorizing repositories...`);
  const categories = categorizeRepos(repos);
  const catNames = Object.keys(categories);
  catNames.forEach((c) => console.log(`   ${CAT_META[c]?.emoji || "\u{1F4E6}"} ${CAT_META[c]?.label || c}: ${categories[c].length} repos`));

  // Ensure directories
  ensureDir(ASSETS_DIR);
  ensureDir(REPOS_DIR);

  // Generate global SVGs
  console.log(`\u{1F3A8} Generating global SVGs...`);
  writeSvg(path.join(ASSETS_DIR, "header.svg"), generateHeader());
  console.log(`   assets/header.svg`);
  writeSvg(path.join(ASSETS_DIR, "stats.svg"), generateStats(repos));
  console.log(`   assets/stats.svg`);
  writeSvg(path.join(ASSETS_DIR, "languages.svg"), generateLanguages(repos));
  console.log(`   assets/languages.svg`);
  writeSvg(path.join(ASSETS_DIR, "pipeline.svg"), generatePipelineSvg());
  console.log(`   assets/pipeline.svg`);

  // Generate category headers
  console.log(`\u{1F4CB} Generating category headers...`);
  for (const catSlug of catNames) {
    writeSvg(path.join(ASSETS_DIR, `category-${catSlug}.svg`), generateCategoryHeader(catSlug, categories[catSlug].length));
    console.log(`   assets/category-${catSlug}.svg`);
  }

  // Generate per-repo cards
  console.log(`\u{1F4E6} Generating ${repos.length} repo cards...`);
  for (const repo of repos) {
    const catSlug = categorizeRepo(repo);
    writeSvg(path.join(REPOS_DIR, `repo-${repo.name}.svg`), generateRepoCard(repo, catSlug));
  }
  console.log(`   assets/repos/repo-*.svg (${repos.length} files)`);

  // Clean up stale repo SVGs (repos that were deleted from GitHub)
  const existingFiles = fs.readdirSync(REPOS_DIR).filter((f) => f.startsWith("repo-") && f.endsWith(".svg"));
  const activeRepoNames = new Set(repos.map((r) => `repo-${r.name}.svg`));
  let cleaned = 0;
  for (const f of existingFiles) {
    if (!activeRepoNames.has(f)) {
      fs.unlinkSync(path.join(REPOS_DIR, f));
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`\u{1F5D1}\uFE0F  Cleaned ${cleaned} stale repo cards.`);

  // Assemble README
  console.log(`\u{1F4DD} Assembling README.md...`);
  const readme = assembleReadme(repos, categories);
  fs.writeFileSync(README_PATH, readme, "utf-8");
  console.log(`   README.md (${readme.split("\n").length} lines)`);

  // Clean up stale category SVGs
  const existingCats = fs.readdirSync(ASSETS_DIR).filter((f) => f.startsWith("category-") && f.endsWith(".svg"));
  const activeCats = new Set(catNames.map((c) => `category-${c}.svg`));
  let cleanedCats = 0;
  for (const f of existingCats) {
    if (!activeCats.has(f)) {
      fs.unlinkSync(path.join(ASSETS_DIR, f));
      cleanedCats++;
    }
  }
  if (cleanedCats > 0) console.log(`\u{1F5D1}\uFE0F  Cleaned ${cleanedCats} stale category headers.`);

  console.log(`\n\u2705 Done! Generated ${repos.length} repo components across ${catNames.length} categories.`);
}

main().catch((err) => {
  console.error(`\u{274C} Error: ${err.message}`);
  process.exit(1);
});
