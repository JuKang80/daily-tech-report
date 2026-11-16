#!/usr/bin/env python3
"""Verify paper links in a daily-tech-report HTML file and list recently seen items."""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import json
import re
import ssl
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


TRACKED_CLASSES = (
    "section-heading",
    "hn-list",
    "hn-item",
    "hn-rank",
    "hn-tag",
    "hn-desc",
)


class ReportLinkParser(HTMLParser):
    """Extract all <a> hrefs, .hn-link pairs, and structural class counts."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.all_hrefs: list[str] = []
        self.hn_links: list[tuple[str, str]] = []
        self.class_counts: dict[str, int] = {cls: 0 for cls in TRACKED_CLASSES}
        self.has_document_wrapper = False
        self._in_hn_link = False
        self._current_href = ""
        self._text_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        if tag_lower in ("html", "body"):
            self.has_document_wrapper = True
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        classes = attr_map.get("class", "").split()
        for cls in classes:
            if cls in self.class_counts:
                self.class_counts[cls] += 1

        if tag_lower != "a":
            return
        href = attr_map.get("href", "").strip()
        if href:
            self.all_hrefs.append(href)
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
        try:
            resp_ctx = urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.URLError as uerr:
            if "CERTIFICATE_VERIFY_FAILED" in str(uerr):
                ctx = ssl._create_unverified_context()
                resp_ctx = urllib.request.urlopen(req, context=ctx, timeout=timeout)
            else:
                raise
        with resp_ctx as resp:
            status = getattr(resp, "status", 200)
            body = resp.read(32768).decode("utf-8", errors="ignore")
            if not (200 <= status < 300):
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


def check_structure(report_path: Path, parser: ReportLinkParser | None = None) -> list[str]:
    """Validate that a report HTML fragment has the expected sections and item classes."""
    if parser is None:
        parser = parse_report_links(report_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if parser.has_document_wrapper:
        errors.append("must be an HTML fragment without <html> or <body> tags")
    counts = parser.class_counts
    if counts["section-heading"] != 3:
        errors.append(f"expected 3 .section-heading elements, found {counts['section-heading']}")
    if counts["hn-list"] != 3:
        errors.append(f"expected 3 .hn-list elements, found {counts['hn-list']}")
    item_count = counts["hn-item"]
    if item_count == 0:
        errors.append("no .hn-item elements found")
    for required in ("hn-rank", "hn-tag", "hn-desc"):
        if counts[required] != item_count:
            errors.append(f"mismatch: {item_count} .hn-item vs {counts[required]} .{required}")
    if len(parser.hn_links) != item_count:
        errors.append(f"mismatch: {item_count} .hn-item vs {len(parser.hn_links)} .hn-link")
    return errors


def verify_index(reports_dir: Path) -> int:
    """Validate reports/index.json schema, file existence, and HTML fragment structure."""
    index_path = reports_dir / "index.json"
    if not index_path.is_file():
        print(f"[FAIL] Missing index file: {index_path}")
        return 1
    try:
        entries = json.loads(index_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[FAIL] Invalid JSON in {index_path}: {exc}")
        return 1
    if not isinstance(entries, list) or not entries:
        print(f"[FAIL] {index_path} must be a non-empty JSON array")
        return 1

    repo_root = reports_dir.parent
    seen_ids: set[str] = set()
    failures = 0
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            print(f"[FAIL] index.json[{idx}] is not an object")
            failures += 1
            continue
        missing = [k for k in ("id", "date", "slot", "title", "path") if not entry.get(k)]
        if missing:
            print(f"[FAIL] index.json[{idx}] missing keys: {', '.join(missing)}")
            failures += 1
            continue
        entry_id = str(entry["id"])
        if entry_id in seen_ids:
            print(f"[FAIL] Duplicate report id in index.json: {entry_id}")
            failures += 1
        seen_ids.add(entry_id)

        target_path = repo_root / str(entry["path"])
        if not target_path.is_file():
            print(f"[FAIL] {entry_id}: missing file {target_path}")
            failures += 1
            continue
        struct_errors = check_structure(target_path)
        if struct_errors:
            print(f"[FAIL] {entry_id} ({entry['path']}): {'; '.join(struct_errors)}")
            failures += 1
        else:
            print(f"[OK] {entry_id} -> {entry['path']}")

    print(f"\nChecked {len(entries)} index entries: {len(entries) - failures} OK, {failures} failed.")
    return 1 if failures else 0


def verify_report(report_path: Path, offline: bool = False) -> int:
    parser = parse_report_links(report_path.read_text(encoding="utf-8"))
    struct_errors = check_structure(report_path, parser)
    if struct_errors:
        print(f"[FAIL] Structure check failed for {report_path}:")
        for err in struct_errors:
            print(f"       - {err}")
        return 1
    print(f"[OK] Structure valid: {report_path} ({parser.class_counts['hn-item']} items)")

    if offline:
        return 0

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
        "--check-index",
        action="store_true",
        help="Validate reports/index.json and HTML structure of all indexed reports (offline)",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Run only offline structure checks for the target report (skip HTTP checks)",
    )
    parser.add_argument(
        "--reports-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "reports",
        help="Path to reports directory",
    )
    args = parser.parse_args()

    if args.check_index:
        return verify_index(args.reports_dir)
    if args.seen_repos is not None:
        return list_seen_repos(args.reports_dir, args.seen_repos)
    if args.seen_papers is not None:
        return list_seen_papers(args.reports_dir, args.seen_papers)
    if args.report is not None:
        return verify_report(args.report, offline=args.offline)

    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
