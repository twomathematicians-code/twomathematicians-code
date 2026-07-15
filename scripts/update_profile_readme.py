#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError


README_PATH = Path(__file__).resolve().parents[1] / "README.md"
START_MARKER = "<!-- AUTO-STATS:START -->"
END_MARKER = "<!-- AUTO-STATS:END -->"
DEFAULT_USERNAME = "twomathematicians-code"
MAX_REPOS = 100


def fetch_json(url: str, token: str | None = None) -> Any:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "profile-readme-updater",
    }
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def replace_section(content: str, replacement: str) -> str:
    start_index = content.find(START_MARKER)
    end_index = content.find(END_MARKER)
    if start_index == -1 or end_index == -1 or start_index > end_index:
        raise ValueError("README markers for AUTO-STATS section are missing or malformed.")
    end_index += len(END_MARKER)
    block = f"{START_MARKER}\n{replacement}\n{END_MARKER}"
    return content[:start_index] + block + content[end_index:]


def build_section(username: str, profile: dict[str, Any], repos: list[dict[str, Any]]) -> str:
    non_forks = [repo for repo in repos if not repo.get("fork")]
    stars = sum(repo.get("stargazers_count", 0) for repo in non_forks)
    forks = sum(repo.get("forks_count", 0) for repo in non_forks)
    watchers = sum(repo.get("watchers_count", 0) for repo in non_forks)
    open_issues = sum(repo.get("open_issues_count", 0) for repo in non_forks)

    top_starred = sorted(
        non_forks,
        key=lambda repo: (repo.get("stargazers_count", 0), repo.get("pushed_at", "")),
        reverse=True,
    )[:5]
    latest_repos = sorted(non_forks, key=lambda repo: repo.get("pushed_at", ""), reverse=True)[:5]

    languages = Counter(repo.get("language") for repo in non_forks if repo.get("language"))
    top_languages = ", ".join(f"{lang} ({count})" for lang, count in languages.most_common(6)) or "N/A"

    updated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines = [
        f'<p align="center"><img src="https://img.shields.io/badge/AI%20SYNC-ACTIVE-00d4ff?style=for-the-badge&logo=githubactions&logoColor=white" /> '
        f'<img src="https://img.shields.io/badge/LIVE%20SOURCE-GitHub%20API-7c3aed?style=for-the-badge&logo=github&logoColor=white" /></p>',
        "",
        "| Metric | Live Value |",
        "|:--|--:|",
        f"| Public Repositories | {profile.get('public_repos', 0)} |",
        f"| Non-Fork Projects | {len(non_forks)} |",
        f"| Total Stars | {stars} |",
        f"| Total Forks | {forks} |",
        f"| Total Watchers | {watchers} |",
        f"| Open Issues Across Projects | {open_issues} |",
        f"| Top Languages by Repo Count | {top_languages} |",
        "",
        "#### 🚀 Most Starred Repositories",
        "",
        "| Repository | ⭐ Stars | Last Push |",
        "|:--|--:|:--|",
    ]

    for repo in top_starred:
        lines.append(
            f"| [{repo['name']}]({repo['html_url']}) | {repo.get('stargazers_count', 0)} | {repo.get('pushed_at', 'N/A')[:10]} |"
        )

    lines.extend(
        [
            "",
            "#### 🛰️ Latest Updated Repositories",
            "",
            "| Repository | Primary Language | Last Push |",
            "|:--|:--|:--|",
        ]
    )

    for repo in latest_repos:
        lines.append(
            f"| [{repo['name']}]({repo['html_url']}) | {repo.get('language') or 'N/A'} | {repo.get('pushed_at', 'N/A')[:10]} |"
        )

    lines.extend(
        [
            "",
            f"> Last auto-sync: **{updated_at}**",
            f"> Powered by `/scripts/update_profile_readme.py` and GitHub Actions for @{username}.",
        ]
    )

    return "\n".join(lines)


def main() -> None:
    username = os.getenv("PROFILE_USERNAME", DEFAULT_USERNAME)
    token = os.getenv("GITHUB_TOKEN")
    try:
        profile = fetch_json(f"https://api.github.com/users/{username}", token=token)
        repos = fetch_json(
            f"https://api.github.com/users/{username}/repos?per_page={MAX_REPOS}&sort=updated",
            token=token,
        )
    except (HTTPError, URLError, TimeoutError):
        profile = {"public_repos": 0}
        repos = []
    section = build_section(username, profile, repos)
    readme = README_PATH.read_text(encoding="utf-8")
    updated = replace_section(readme, section)
    README_PATH.write_text(updated, encoding="utf-8")


if __name__ == "__main__":
    main()
