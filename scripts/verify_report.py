#!/usr/bin/env python3
"""Verify paper links in a daily-tech-report HTML file and list recently seen GitHub repos."""

from __future__ import annotations

import argparse
import html
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

PAPER_DOMAINS = (
    "arxiv.org",
    "biorxiv.org",
    "medrxiv.org",
    "pubmed.ncbi.nlm.nih.gov",
    "doi.org",
)

LINK_RE = re.compile(
    r'<a\s+[^>]*class="hn-link"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
GITHUB_RE = re.compile(r"https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def extract_links(html_text: str) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    for href, raw_title in LINK_RE.findall(html_text):
        title = re.sub(r"<[^>]+>", "", raw_title)
        title = html.unescape(" ".join(title.split()))
        results.append((href.strip(), title))
    return results


def check_url(url: str, timeout: float = 10.0) -> tuple[bool, str]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "daily-tech-report-verifier/1.0"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = getattr(resp, "status", 200)
            body = resp.read(32768).decode("utf-8", errors="ignore")
            if status != 200:
                return False, f"HTTP {status}"
            m = TITLE_RE.search(body)
            page_title = html.unescape(" ".join(m.group(1).split())) if m else ""
            lower_title = page_title.lower()
            if "not found" in lower_title or "404" in lower_title or "error" == lower_title:
                return False, f"Suspicious page title: {page_title!r}"
            return True, page_title or "HTTP 200"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)


def verify_report(report_path: Path) -> int:
    text = report_path.read_text(encoding="utf-8")
    links = extract_links(text)
    paper_links = [
        (url, title)
        for url, title in links
        if any(domain in url for domain in PAPER_DOMAINS)
    ]

    if not paper_links:
        print(f"No paper links found in {report_path}")
        return 0

    failures = 0
    for url, title in paper_links:
        ok, info = check_url(url)
        status = "OK" if ok else "FAIL"
        print(f"[{status}] {title}\n       {url} -> {info}")
        if not ok:
            failures += 1

    print(f"\nChecked {len(paper_links)} paper links: {len(paper_links) - failures} OK, {failures} failed.")
    return 1 if failures else 0


def list_seen_repos(reports_dir: Path, limit_files: int) -> int:
    files = sorted(
        (p for p in reports_dir.glob("*.html") if "sample" not in p.name),
        reverse=True,
    )[:limit_files]

    seen: list[str] = []
    seen_set: set[str] = set()
    for p in files:
        for repo in GITHUB_RE.findall(p.read_text(encoding="utf-8")):
            key = repo.lower()
            if key not in seen_set:
                seen_set.add(key)
                seen.append(repo)

    for repo in seen:
        print(repo)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify report paper links or list seen GitHub repos.")
    parser.add_argument("report", nargs="?", type=Path, help="Path to report HTML file to verify")
    parser.add_argument(
        "--seen-repos",
        type=int,
        metavar="N",
        help="List unique GitHub repos from the most recent N report files",
    )
    parser.add_argument(
        "--reports-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "reports",
        help="Path to reports directory",
    )
    args = parser.parse_args()

    if args.seen_repos is not None:
        return list_seen_repos(args.reports_dir, args.seen_repos)
    if args.report is not None:
        return verify_report(args.report)

    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
