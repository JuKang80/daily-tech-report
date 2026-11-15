#!/usr/bin/env python3
"""Verify paper links in a daily-tech-report HTML file and list recently seen items."""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

PAPER_DOMAINS = (
    "arxiv.org",
    "biorxiv.org",
    "medrxiv.org",
    "pubmed.ncbi.nlm.nih.gov",
    "doi.org",
)

GITHUB_REPO_RE = re.compile(r"^https?://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


class ReportLinkParser(HTMLParser):
    """Extract all <a> hrefs and .hn-link (href, title) pairs regardless of attribute order."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.all_hrefs: list[str] = []
        self.hn_links: list[tuple[str, str]] = []
        self._in_hn_link = False
        self._current_href = ""
        self._text_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        href = attr_map.get("href", "").strip()
        if href:
            self.all_hrefs.append(href)
        classes = attr_map.get("class", "").split()
        if "hn-link" in classes and href:
            self._in_hn_link = True
            self._current_href = href
            self._text_parts = []

    def handle_data(self, data: str) -> None:
        if self._in_hn_link:
            self._text_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._in_hn_link:
            title = " ".join("".join(self._text_parts).split())
            self.hn_links.append((self._current_href, title))
            self._in_hn_link = False
            self._current_href = ""
            self._text_parts = []


def parse_report_links(html_text: str) -> ReportLinkParser:
    parser = ReportLinkParser()
    parser.feed(html_text)
    parser.close()
    return parser


def is_paper_url(url: str) -> bool:
    netloc = urllib.parse.urlparse(url).netloc.lower()
    return any(netloc == domain or netloc.endswith(f".{domain}") for domain in PAPER_DOMAINS)


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
            match = TITLE_RE.search(body)
            page_title = html.unescape(" ".join(match.group(1).split())) if match else ""
            lower_title = page_title.lower()
            if "not found" in lower_title or "404" in lower_title or lower_title == "error":
                return False, f"Suspicious page title: {page_title!r}"
            return True, page_title or "HTTP 200"
    except urllib.error.HTTPError as exc:
        return False, f"HTTP {exc.code}"
    except Exception as exc:
        return False, str(exc)


def verify_report(report_path: Path) -> int:
    parser = parse_report_links(report_path.read_text(encoding="utf-8"))
    paper_links = [(url, title) for url, title in parser.hn_links if is_paper_url(url)]

    if not paper_links:
        print(f"No paper links found in {report_path}")
        return 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(lambda item: check_url(item[0]), paper_links))

    failures = 0
    for (url, title), (ok, info) in zip(paper_links, results):
        status = "OK" if ok else "FAIL"
        print(f"[{status}] {title}\n       {url} -> {info}")
        if not ok:
            failures += 1

    print(
        f"\nChecked {len(paper_links)} paper links: "
        f"{len(paper_links) - failures} OK, {failures} failed."
    )
    return 1 if failures else 0


def recent_report_files(reports_dir: Path, limit_files: int) -> list[Path]:
    return sorted(
        (p for p in reports_dir.glob("*.html") if "sample" not in p.name),
        reverse=True,
    )[:limit_files]


def collect_unique_items(reports_dir: Path, limit_files: int, extractor) -> list[str]:
    seen: list[str] = []
    seen_keys: set[str] = set()
    for path in recent_report_files(reports_dir, limit_files):
        parser = parse_report_links(path.read_text(encoding="utf-8"))
        for value in extractor(parser):
            key = value.lower()
            if key not in seen_keys:
                seen_keys.add(key)
                seen.append(value)
    return seen


def extract_github_repos(parser: ReportLinkParser) -> list[str]:
    repos: list[str] = []
    for href in parser.all_hrefs:
        match = GITHUB_REPO_RE.match(href)
        if match:
            repos.append(match.group(1))
    return repos


def extract_paper_urls(parser: ReportLinkParser) -> list[str]:
    return [url for url, _ in parser.hn_links if is_paper_url(url)]


def list_seen_repos(reports_dir: Path, limit_files: int) -> int:
    for repo in collect_unique_items(reports_dir, limit_files, extract_github_repos):
        print(repo)
    return 0


def list_seen_papers(reports_dir: Path, limit_files: int) -> int:
    for url in collect_unique_items(reports_dir, limit_files, extract_paper_urls):
        print(url)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify report paper links or list recently seen GitHub repos and papers."
    )
    parser.add_argument("report", nargs="?", type=Path, help="Path to report HTML file to verify")
    parser.add_argument(
        "--seen-repos",
        type=int,
        metavar="N",
        help="List unique GitHub repos from the most recent N report files",
    )
    parser.add_argument(
        "--seen-papers",
        type=int,
        metavar="N",
        help="List unique paper URLs from the most recent N report files",
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
    if args.seen_papers is not None:
        return list_seen_papers(args.reports_dir, args.seen_papers)
    if args.report is not None:
        return verify_report(args.report)

    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
