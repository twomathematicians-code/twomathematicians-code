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
// Design System — Monochrome (SpaceX industrial aesthetic)
// ──────────────────────────────────────────────
const DS = {
  bg: "#ffffff",           // pure white
  cardBg: "#ffffff",       // pure white
  border: "#e5e7eb",       // light gray hairline
  text: "#000000",         // pure black
  dark: "#1f2937",         // dark slate — bars, dots, fills
  muted: "#6b7280",        // neutral gray
  faint: "#f3f4f6",        // very light gray — badge backgrounds
  accent: "#000000",       // black is the only accent
  // Legacy keys collapsed to monochrome (kept for stray references)
  green: "#1f2937",
  orange: "#1f2937",
  purple: "#1f2937",
  indigo: "#000000",
  font: "Inter,system-ui,-apple-system,sans-serif",
  mono: "'SF Mono',Consolas,'Roboto Mono',monospace",
  shadowColor: "#000000",
  radius: 3,               // sharp industrial corners
};

// Category accent colors — all monochrome; differentiation via typography
const CAT_COLORS = {
  "ai-infrastructure": DS.text,
  "ml-engineering": DS.text,
  "nlp-ai": DS.text,
  analytics: DS.text,
  "domain-ml": DS.text,
  research: DS.text,
  "systems-tools": DS.text,
  mathematics: DS.text,
  experimental: DS.text,
  uncategorized: DS.text,
};

// Shadow rect helper — ghost-subtle shadow behind a card
function shadowRect(w, h, rx, dx, dy) {
  return `<rect x="${dx}" y="${dy}" width="${w}" height="${h}" rx="${rx}" fill="${DS.shadowColor}" opacity="0.05"/>`;
}

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
  const w = 800, h = 140;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${shadowRect(w, h, DS.radius, 2, 2)}
  <rect width="${w}" height="${h}" rx="${DS.radius}" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <rect x="0" y="0" width="${w}" height="3" fill="${DS.text}"/>
  <text x="40" y="64" font-family="${DS.font}" font-size="34" font-weight="800" letter-spacing="-0.5" fill="${DS.text}">Mahesh Solanki</text>
  <text x="42" y="94" font-family="${DS.font}" font-size="11" font-weight="600" letter-spacing="2.5" fill="${DS.muted}">UNIFIED INTELLIGENCE ENGINEER</text>
  <line x1="42" y1="108" x2="120" y2="108" stroke="${DS.text}" stroke-width="1.5"/>
  <text x="42" y="128" font-family="${DS.font}" font-size="12" fill="${DS.muted}">Ghent, Belgium  \u00B7  Mathematician \u2192 Computational Expert</text>
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
    { label: "REPOS", value: totalRepos },
    { label: "STARS", value: totalStars },
    { label: "FORKS", value: totalForks },
    { label: "TOP LANGUAGE", value: topLang ? topLang[0] : "N/A" },
  ];

  const slotW = w / stats.length;

  const statBlocks = stats
    .map((s, i) => {
      const cx = slotW * i + slotW / 2;
      return `
    <text x="${cx - 30}" y="32" font-family="${DS.font}" font-size="9" font-weight="600" letter-spacing="1.5" fill="${DS.muted}">${s.label}</text>
    <text x="${cx - 30}" y="58" font-family="${DS.mono}" font-size="20" font-weight="600" fill="${DS.text}">${String(s.value).toUpperCase()}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${shadowRect(w, h, DS.radius, 2, 2)}
  <rect width="${w}" height="${h}" rx="${DS.radius}" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  ${statBlocks}
</svg>`;
  return svg;
}

function generateLanguages(repos) {
  const w = 400, h = 220;
  const langCount = {};
  let total = 0;
  repos.forEach((r) => {
    if (r.language) {
      langCount[r.language] = (langCount[r.language] || 0) + 1;
      total += 1;
    }
  });

  const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  if (top.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="60" viewBox="0 0 ${w} 60">
  <rect width="${w}" height="60" rx="${DS.radius}" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <text x="20" y="38" font-family="${DS.font}" font-size="13" fill="${DS.muted}">No language data</text>
</svg>`;
  }

  const barY0 = 54;
  const barH = 14;
  const barGap = 8;
  const barMaxW = 200;

  const bars = top
    .map((lang, i) => {
      const pct = ((lang[1] / total) * 100).toFixed(1);
      const barW = Math.max(8, (lang[1] / top[0][1]) * barMaxW);
      const y = barY0 + i * (barH + barGap);
      return `
    <text x="20" y="${y + barH / 2 + 4}" font-family="${DS.font}" font-size="11" font-weight="500" fill="${DS.text}">${escapeXml(lang[0])}</text>
    <rect x="140" y="${y}" width="${barW}" height="${barH}" fill="${DS.dark}"/>
    <text x="${148 + barW + 8}" y="${y + barH / 2 + 4}" font-family="${DS.mono}" font-size="10" fill="${DS.muted}">${pct}%</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${shadowRect(w, h, DS.radius, 2, 2)}
  <rect width="${w}" height="${h}" rx="${DS.radius}" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <text x="20" y="30" font-family="${DS.font}" font-size="10" font-weight="600" letter-spacing="1.5" fill="${DS.muted}">LANGUAGES</text>
  <line x1="20" y1="40" x2="${w - 20}" y2="40" stroke="${DS.border}" stroke-width="1"/>
  ${bars}
</svg>`;
  return svg;
}

function generatePipelineSvg() {
  const w = 800, h = 200;
  const stages = [
    { label: "MATH", items: ["Stats", "LinAlg", "Optim"] },
    { label: "DATA", items: ["SQL", "ETL", "VecDB"] },
    { label: "ML", items: ["XGBoost", "PyTorch", "NLP/CV"] },
    { label: "AI", items: ["RAG", "Agents", "LLM"] },
    { label: "PROD", items: ["FastAPI", "Docker", "MLOps"] },
    { label: "IMPACT", items: ["BFSI", "Health", "Supply"] },
  ];

  const gap = 20;
  const totalGaps = (stages.length - 1) * gap;
  const nodeW = Math.floor((w - 60 - totalGaps) / stages.length);
  const nodeH = 130;
  const startY = 50;
  const startX = 30;

  const nodes = stages.map((stage, i) => {
    const x = startX + i * (nodeW + gap);
    let svg = `${shadowRect(nodeW, nodeH, DS.radius, x + 2, startY + 2)}`;
    svg += `<rect x="${x}" y="${startY}" width="${nodeW}" height="${nodeH}" rx="${DS.radius}" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>`;
    // Top accent bar — solid black
    svg += `<rect x="${x}" y="${startY}" width="${nodeW}" height="2" fill="${DS.text}"/>`;
    // Stage label — uppercase tracked
    svg += `<text x="${x + nodeW / 2}" y="${startY + 24}" text-anchor="middle" font-family="${DS.font}" font-size="11" font-weight="700" letter-spacing="1.5" fill="${DS.text}">${stage.label}</text>`;
    // Separator line
    svg += `<line x1="${x + 12}" y1="${startY + 34}" x2="${x + nodeW - 12}" y2="${startY + 34}" stroke="${DS.border}" stroke-width="1"/>`;
    // Items
    stage.items.forEach((item, j) => {
      const iy = startY + 54 + j * 26;
      svg += `<rect x="${x + 18}" y="${iy - 3}" width="4" height="4" fill="${DS.dark}"/>`;
      svg += `<text x="${x + 30}" y="${iy + 4}" font-family="${DS.font}" font-size="11" fill="${DS.text}">${item}</text>`;
    });
    return svg;
  });

  // Arrows between stages — monochrome
  const arrows = stages.slice(0, -1).map((s, i) => {
    const x1 = startX + (i + 1) * (nodeW + gap) - gap + 2;
    const x2 = x1 + gap - 4;
    const y = startY + nodeH / 2;
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${DS.muted}" stroke-width="1.5" stroke-dasharray="3,3"/>` +
           `<polygon points="${x2},${y - 4} ${x2 + 6},${y} ${x2},${y + 4}" fill="${DS.muted}" opacity="0.6"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${nodes.join("\n  ")}
  ${arrows.join("\n  ")}
</svg>`;
}

function generateCategoryHeader(catSlug, count) {
  const meta = CAT_META[catSlug] || CAT_META.uncategorized;
  const w = 600, h = 44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${shadowRect(w, h, DS.radius, 2, 2)}
  <rect width="${w}" height="${h}" rx="${DS.radius}" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <rect x="0" y="0" width="3" height="${h}" fill="${DS.text}"/>
  <text x="18" y="28" font-family="${DS.font}" font-size="12" font-weight="600" letter-spacing="1.5" fill="${DS.text}">${escapeXml(meta.label.toUpperCase())}</text>
  <rect x="${w - 64}" y="12" width="36" height="20" rx="${DS.radius}" fill="${DS.faint}"/>
  <text x="${w - 46}" y="26" text-anchor="middle" font-family="${DS.mono}" font-size="11" font-weight="600" fill="${DS.text}">${count}</text>
</svg>`;
  return svg;
}

function generateRepoCard(repo, catSlug) {
  const w = 380, h = 120;
  const desc = truncate(repo.description || "No description", 65);
  const langName = repo.language || "N/A";
  const updated = formatDate(repo.updatedAt);

  const footerParts = [];
  if (repo.stars > 0) footerParts.push(`\u2605 ${repo.stars}`);
  if (repo.forks > 0) footerParts.push(`\u2442 ${repo.forks}`);
  if (updated) footerParts.push(updated);
  const footer = footerParts.join("  \u00B7  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${shadowRect(w, h, DS.radius, 2, 2)}
  <rect width="${w}" height="${h}" rx="${DS.radius}" fill="${DS.cardBg}" stroke="${DS.border}" stroke-width="1"/>
  <rect x="0" y="0" width="3" height="${h}" fill="${DS.text}"/>
  <text x="16" y="30" font-family="${DS.font}" font-size="15" font-weight="700" letter-spacing="-0.2" fill="${DS.text}">${escapeXml(repo.name)}</text>
  <text x="16" y="52" font-family="${DS.font}" font-size="11" fill="${DS.muted}">${escapeXml(desc)}</text>
  <line x1="16" y1="66" x2="${w - 16}" y2="66" stroke="${DS.border}" stroke-width="1"/>
  <rect x="16" y="76" width="4" height="4" fill="${DS.muted}"/>
  <text x="26" y="82" font-family="${DS.mono}" font-size="10" fill="${DS.muted}">${escapeXml(langName).toUpperCase()}</text>
  <text x="16" y="104" font-family="${DS.mono}" font-size="10" fill="${DS.muted}">${footer}</text>
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
    `  <a href="https://readme-typing-svg.demolab.com/demo/"><img src="https://readme-typing-svg.demolab.com/?lines=Unified+Intelligence+Engineer;ML+Systems+%C2%B7+Production+AI;Mathematics+%E2%8A%95+Code;First+Principles+%C2%B7+End-to-End+ML;Building+AI-Powered+Products&font=Fira+Code&center=true&width=520&height=45&color=000000&vCenter=true&pause=2000&size=20" alt="Typing SVG" /></a>`
  );
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(
    `  <a href="https://linkedin.com/in/maheshsolanki-16b9a6a5"><img src="https://img.shields.io/badge/LinkedIn-000000?style=flat-square&logo=linkedin&logoColor=white" /></a>`
  );
  lines.push(
    `  <a href="mailto:maheshsinh1910@gmail.com"><img src="https://img.shields.io/badge/Gmail-000000?style=flat-square&logo=gmail&logoColor=white" /></a>`
  );
  lines.push(
    `  <a href="https://github.com/twomathematicians-code"><img src="https://img.shields.io/badge/GitHub-000000?style=flat-square&logo=github&logoColor=white" /></a>`
  );
  lines.push(
    `  <img src="https://komarev.com/ghpvc/?username=twomathematicians-code&label=PROFILE+VIEWS&color=000000&style=flat-square" alt="Profile Views" />`
  );
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Stats bar (self-hosted — no external dependency)
  lines.push(`<p align="center">`);
  lines.push(`  <img src="assets/stats.svg" alt="Repository statistics" width="100%" />`);
  lines.push(`</p>`);
  lines.push(``);

  // Languages (self-hosted)
  lines.push(`<p align="center">`);
  lines.push(`  <img src="assets/languages.svg" alt="Language breakdown" width="60%" />`);
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Mermaid mindmap
  lines.push(`## Unified Intelligence`);
  lines.push(``);
  lines.push("```mermaid");
  lines.push("%%{init: {'theme':'base','themeVariables': {'background':'#ffffff','mainBkg':'#000000','secondBkg':'#1f2937','tertiaryBkg':'#374151','primaryColor':'#000000','primaryTextColor':'#ffffff','primaryBorderColor':'#000000','secondaryColor':'#1f2937','secondaryTextColor':'#ffffff','tertiaryColor':'#374151','tertiaryTextColor':'#ffffff','textColor':'#1f2937','lineColor':'#9ca3af','fontFamily':'Inter,system-ui,-apple-system,sans-serif','fontSize':'14px','cScale0':'#000000','cScale1':'#1f2937','cScale2':'#374151','cScale3':'#4b5563','cScale4':'#6b7280','cScale5':'#9ca3af','cScale6':'#d1d5db','cScale7':'#e5e7eb'}}}%%");
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

  // Featured projects (top 4 by stars) — self-hosted repo cards
  const featured = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 4);
  lines.push(`## Featured Projects`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(`  <table>`);
  for (let i = 0; i < featured.length; i += 2) {
    lines.push(`    <tr>`);
    for (let j = 0; j < 2 && i + j < featured.length; j++) {
      const r = featured[i + j];
      lines.push(
        `      <td width="48%" align="center"><a href="${r.url}"><img src="assets/repos/repo-${r.name}.svg" alt="${escapeXml(r.name)}" width="100%" /></a></td>`
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
  lines.push(`## Repository Components`);
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
  lines.push(`## Tech Pipeline`);
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
    `  <a href="https://github.com/${USERNAME}?tab=repositories"><img src="https://img.shields.io/badge/View_All_Repos_\u2192-000000?style=for-the-badge" alt="View all repositories" /></a>`
  );
  lines.push(`</p>`);
  lines.push(``);
  lines.push(`<p align="center">`);
  lines.push(`  <samp>`);
  lines.push(`    <a href="https://linkedin.com/in/maheshsolanki-16b9a6a5">linkedin</a>`);
  lines.push(`    &nbsp;\u00B7&nbsp;`);
  lines.push(`    <a href="mailto:maheshsinh1910@gmail.com">email</a>`);
  lines.push(`    &nbsp;\u00B7&nbsp;`);
  lines.push(`    <a href="https://github.com/${USERNAME}">github</a>`);
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
