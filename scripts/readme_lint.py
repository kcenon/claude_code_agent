#!/usr/bin/env python3
"""Offline README policy checks; see scripts/README.md.

Density = 100 * distinct prose lines with qualifiers or measurements / physical
lines (including code/comments). Sourced measurements still count. Source markers
check adjacency, date, environment, local document and anchor, not the scientific
validity of a measurement. Reviewers must check the linked section's environment,
measurement date, command, raw result, and agreement with the claim.

Ported from kcenon/common_system scripts/readme_lint.py (c2f4037) for a single
README.md. This repository has no GitHub release yet and the package is not
published to npm, so the release-link rule is replaced by a version rule: README
links the package.json version, either to package.json or to the release tag
that version will use.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from datetime import date
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


REPOSITORY = "kcenon/claude_code_agent"
SEMVER = r"\d+\.\d+\.\d+(?:[-+][\w.-]+)?"
SEP = r"[\s\-\u2010-\u2015]+"
QUALIFIER = re.compile(
    rf"\b(?:production{SEP}ready|enterprise{SEP}grade|battle{SEP}tested|"
    rf"world{SEP}class|well{SEP}tested|high{SEP}performance|"
    rf"blazing|comprehensive|robust|seamless|guarantee(?:d|s)?|"
    rf"zero{SEP}(?:(?:runtime|memory|data|sanitizer){SEP})?"
    rf"(?:overhead|warnings?|leaks?|races?|cost)|zero-[a-z]+|"
    rf"no{SEP}(?:memory{SEP}leaks?|data{SEP}races?)|"
    rf"faster{SEP}compilation|RAII\s+(?:grade|rating)\s*:?\s*A\+?)\b|"
    r"(?<!\d)100\s*%|제로\s*(?:오버헤드|경고|누수|레이스)|"
    r"원활한\s*통합|메모리\s*누수\s*없(?:음|는)|데이터\s*레이스\s*없(?:음|는)|"
    r"(?:런타임\s*)?(?:비용|오버헤드)\s*없(?:음|는)|"
    r"프로덕션[ -]*(?:준비|레디)|엔터프라이즈[ -]*급|세계[ -]*최고|"
    r"포괄적|견고한|고성능|잘\s*테스트된|보장(?:된|합니다)?|RAII\s*등급\s*:?\s*A\+?",
    re.IGNORECASE,
)
NUMBER = r"(?<![\w.])\d[\d,]*(?:\.\d+)?"
MEASUREMENT = re.compile(
    rf"{NUMBER}\s*(?:x\b|×|배)|"
    rf"{NUMBER}\s*(?:ns|us|µs|μs|ms)\b|"
    rf"{NUMBER}\s*[kmg]?\s*(?:ops|msg|req|operations|messages|requests|items|"
    rf"bytes|[kmgt]?i?b)\s*(?:/\s*(?:s|sec|second)\b|per\s+second\b)|"
    rf"{NUMBER}\s*(?:(?:(?:memory|heap)\s+)?allocations?\b|(?:회\s*)?할당)|"
    rf"(?:allocations?(?:\s+count)?\s*[:=]?\s*|할당\s*[:=]?\s*){NUMBER}|"
    rf"{NUMBER}\s+(?:passing\s+tests?|tests?\s+pass(?:ing|ed)?|passed\s+tests?)\b|"
    rf"passed\s+{NUMBER}\s+tests?\b|{NUMBER}\s*개?\s*테스트\s*통과",
    re.IGNORECASE,
)
TESTS = re.compile(r"tests?|sanitizers?|pass(?:ing|ed)?|테스트|통과", re.IGNORECASE)
TABLE_MEASURE = re.compile(
    r"\b(?:time|latency|throughput|allocations?|coverage|ns|us|µs|μs|ms)\b|"
    r"시간|지연|처리량|할당|커버리지|tests?\s+(?:pass|result)|테스트\s*(?:통과|결과)",
    re.IGNORECASE,
)
SOURCE = re.compile(r"source:\s+(\S+\.md#[^\s]+)\s+\((\d{4}-\d{2}-\d{2}),\s*([^()]+)\)\s*")
REF = re.compile(r"^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+.*)?$")
HTML_TAG = re.compile(r"</?(?:a|img|p|br|div|span|details|summary|strong|em|code|b|i)\b[^>]*>", re.I)


@dataclass
class Finding:
    line: int
    rule: str
    message: str


@dataclass
class Report:
    path: Path
    lines: int
    claim_lines: set[int] = field(default_factory=set)
    findings: list[Finding] = field(default_factory=list)

    @property
    def density(self) -> float:
        return 100 * len(self.claim_lines) / self.lines if self.lines else 0.0

    def add(self, line: int, rule: str, message: str) -> None:
        self.findings.append(Finding(line, rule, message))


def blank(text: str) -> str:
    """Mask hidden content without changing offsets or physical line numbers."""
    return re.sub(r"[^\n]", " ", text)


def prose_blocks(text: str) -> tuple[str, list[tuple[int, str]]]:
    """Mask fenced/indented code and comments; retain source-marker comments.

    Fences may be indented or inside list/blockquote containers. A fence in a
    comment does not open a code block, and comments in code have no effect.
    """
    output, markers = [], []
    fence, comment, comment_line = "", "", 0
    in_comment, indented = False, False
    previous_blank = True
    list_indent = 0
    for line_no, line in enumerate(text.splitlines(keepends=True), 1):
        container = re.sub(r"^(?:\s*>[ \t]?)+", "", line)
        item = re.match(r"^ *(?:[-+*]|\d+[.)]) +", container)
        if item:
            list_indent = len(item[0])
            container = container[list_indent:]
        elif list_indent and container.startswith(" " * list_indent):
            container = container[list_indent:]
        elif container.strip():
            list_indent = 0
        if fence:
            if re.fullmatch(r"\s*" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}\s*", container):
                fence = ""
            output.append(blank(line))
            continue
        # A plain indented block needs a preceding blank line. List marker
        # content is stripped above so ordinary list items remain prose.
        if not in_comment and (previous_blank or indented) and re.match(r"^(?: {4}|\t)\S", container):
            output.append(blank(line))
            indented = True
            continue
        indented = False
        if not in_comment:
            opening = re.match(r" {0,3}(`{3,}|~{3,})(.*)$", container)
            if opening and not (opening[1][0] == "`" and "`" in opening[2]):
                fence = opening[1]
                output.append(blank(line))
                continue
        visible, position = "", 0
        while position < len(line):
            if in_comment:
                end = line.find("-->", position)
                stop = len(line) if end < 0 else end + 3
                comment += line[position:len(line) if end < 0 else end]
                visible += blank(line[position:stop])
                position = stop
                if end >= 0:
                    if re.match(r"\s*source\s*:", comment, re.I):
                        markers.append((comment_line, comment.strip()))
                    comment, in_comment = "", False
            else:
                start = line.find("<!--", position)
                tick = line.find("`", position)
                if tick >= 0 and (start < 0 or tick < start):
                    ticks = re.match(r"`+", line[tick:])[0]
                    end = line.find(ticks, tick + len(ticks))
                    if end >= 0:
                        stop = end + len(ticks)
                        visible += line[position:stop]
                        position = stop
                        continue
                if start < 0:
                    visible += line[position:]
                    break
                visible += line[position:start] + " " * 4
                position, comment_line, in_comment = start + 4, line_no, True
        output.append(visible)
        previous_blank = not line.strip()
    if in_comment and re.match(r"\s*source\s*:", comment, re.I):
        markers.append((comment_line, "unterminated source marker"))
    return "".join(output), markers


def closing(text: str, start: int, left: str, right: str) -> int:
    depth, i = 1, start + 1
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == left:
            depth += 1
        elif text[i] == right:
            depth -= 1
            if not depth:
                return i
        i += 1
    return -1


def reference_key(label: str) -> str:
    return " ".join(label.casefold().split())


def destination(text: str, start: int, label: str, refs: dict) -> tuple[str, int] | None:
    if text[start:start + 1] == "(":
        end = closing(text, start, "(", ")")
        if end >= 0:
            value = text[start + 1:end].strip()
            match = re.match(r"<([^>]+)>|([^\s]+)", value)
            if match:
                return html.unescape(match[1] or match[2]), end + 1
    ref_end, key = start, label
    if text[start:start + 1] == "[":
        end = closing(text, start, "[", "]")
        if end >= 0:
            key, ref_end = text[start + 1:end] or label, end + 1
    value = refs.get(reference_key(key))
    return (value, ref_end) if value is not None else None


class HTMLImages(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.href = ""
        self.images = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            self.href = attrs.get("href", "") or ""
            self.links.append((self.getpos()[0], self.href, ""))
        if tag == "img":
            self.images.append((self.getpos()[0], attrs.get("src", "") or "",
                                self.href, attrs.get("alt", "") or ""))

    def handle_endtag(self, tag):
        if tag == "a":
            self.href = ""


def inline_content(text: str) -> tuple[str, list, list]:
    """Render visible labels while collecting Markdown/reference/HTML images.

    This intentionally handles the README policy's Markdown subset, not layout.
    Inline code remains visible for claims, but cannot create a badge or link.
    """
    refs = {}
    lines = text.splitlines(keepends=True)
    for i, line in enumerate(lines):
        match = REF.match(line.rstrip("\n"))
        if match:
            refs[reference_key(match[1])] = match[2].strip("<>")
            lines[i] = blank(line)
    text = "".join(lines)
    images, links = [], []

    def render(value, line_no=1, href=""):
        out, i = [], 0
        while i < len(value):
            if value[i] == "`":
                ticks = re.match(r"`+", value[i:])[0]
                end = value.find(ticks, i + len(ticks))
                if end >= 0:
                    span = value[i:end + len(ticks)]
                    # Escape HTML inside inline code so it cannot create badges.
                    out.append(html.escape(value[i + len(ticks):end]))
                    line_no += span.count("\n")
                    i += len(span)
                    continue
            is_image = value.startswith("![", i)
            start = i + 1 if is_image else i
            if value[start:start + 1] == "[":
                end = closing(value, start, "[", "]")
                target = destination(value, end + 1, value[start + 1:end], refs) if end >= 0 else None
                if target:
                    url, stop = target
                    label = value[start + 1:end]
                    if is_image:
                        images.append((line_no, url, href, label))
                        out.append(label)
                    else:
                        links.append((line_no, url, label))
                        out.append(render(label, line_no, url))
                    out.append("\n" * value[end + 1:stop].count("\n"))
                    line_no += value[i:stop].count("\n")
                    i = stop
                    continue
            out.append(value[i])
            line_no += value[i] == "\n"
            i += 1
        return "".join(out)

    rendered = render(text)
    parser = HTMLImages()
    parser.feed(rendered)
    images.extend(parser.images)
    links.extend(parser.links)
    # Keep visible alt text when removing HTML images.
    rendered = re.sub(r"<img\b[^>]*>", lambda m: " " +
                      (re.search(r'''\balt=["'](.*?)["']''', m[0], re.I)[1]
                       if re.search(r'''\balt=["'](.*?)["']''', m[0], re.I) else "") +
                      "\n" * m[0].count("\n"), rendered, flags=re.I)
    rendered = HTML_TAG.sub(lambda m: "\n" * m[0].count("\n"), rendered)
    rendered = html.unescape(rendered)
    rendered = re.sub(r"https?://[^\s<>]+", "", rendered)
    # Strip emphasis delimiters while retaining underscores inside identifiers.
    rendered = re.sub(r"(?<!\w)(?:\*{1,2}|_{1,2}|~~)(?=\S)|"
                      r"(?<=\S)(?:\*{1,2}|_{1,2}|~~)(?!\w)", "", rendered)
    return rendered, images, links


def anchors(text: str) -> set[str]:
    blocks, _ = prose_blocks(text)
    rendered, _, _ = inline_content(blocks)
    found, counts = set(), {}
    for line in rendered.splitlines():
        match = re.match(r" {0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$", line)
        if match:
            slug = re.sub(r"[^\w\- ]", "", match[1].lower()).replace(" ", "-")
            duplicate = counts.get(slug, 0)
            counts[slug] = duplicate + 1
            found.add(f"{slug}-{duplicate}" if duplicate else slug)
    found.update(re.findall(r'''<(?:a|span)\b[^>]*(?:id|name)=["']([^"']+)["']''', blocks, re.I))
    return found


def local_file(root: Path, url: str) -> Path | None:
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or not parts.path or parts.path.startswith("/"):
        return None
    path = (root / unquote(parts.path)).resolve()
    return path if root.resolve() in path.parents and path.is_file() else None


def marker_error(marker: str, root: Path) -> str | None:
    match = SOURCE.fullmatch(marker) if "\n" not in marker else None
    if not match or not match[3].strip():
        return "use <!-- source: docs/file.md#anchor (YYYY-MM-DD, environment) --> on one line"
    try:
        date.fromisoformat(match[2])
    except ValueError:
        return "source measurement date is invalid"
    path = local_file(root, match[1])
    if path is None:
        return "source must be an existing local Markdown document inside the repository"
    try:
        if unquote(urlsplit(match[1]).fragment) not in anchors(path.read_text(encoding="utf-8")):
            return "source anchor does not exist"
    except (OSError, UnicodeError) as error:
        return f"cannot read source: {error}"
    return None


def workflow(url: str, image: bool = False) -> str | None:
    parts = urlsplit(url)
    suffix = r"/badge\.svg" if image else ""
    match = re.fullmatch(rf"/{REPOSITORY}/actions/workflows/([^/]+\.ya?ml){suffix}", parts.path)
    return match[1] if parts.scheme == "https" and parts.netloc == "github.com" and match else None


def badge_error(src: str, href: str, alt: str, root: Path) -> str | None:
    is_badge = re.search(r"badge|shields\.io|codecov\.io|coveralls\.io|actions/workflows/", src, re.I)
    is_badge = is_badge or re.search(r"\bbadge\b|배지", alt, re.I)
    if not is_badge:
        return None
    name = workflow(src, image=True)
    if name is None:
        return "badges must use this repository's GitHub workflow badge URL"
    if workflow(href) != name:
        return "badge click target must match its workflow image"
    if not (root / ".github/workflows" / name).is_file():
        return f"workflow file does not exist: {name}"
    return None


def package_version(root: Path) -> tuple[str | None, str | None]:
    """Return (version, None) from package.json, or (None, error)."""
    try:
        manifest = json.loads((root / "package.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError) as error:
        return None, f"cannot read package.json: {error}"
    version = manifest.get("version") if isinstance(manifest, dict) else None
    if not isinstance(version, str) or not re.fullmatch(SEMVER, version):
        return None, "package.json has no semantic version"
    return version, None


def mentions(text: str, version: str) -> bool:
    """Whole-token match with an optional v, so 0.1.0 is not found inside 0.1.01."""
    edge = r"[\w./:@-]"
    return re.search(rf"(?<!{edge})v?{re.escape(version)}(?!{edge})", text) is not None


def version_target(url: str, version: str, root: Path) -> bool:
    """package.json, or the tag a GitHub release of that version will use."""
    if url == f"https://github.com/{REPOSITORY}/releases/tag/v{version}":
        return True
    path = local_file(root, url)
    return path is not None and path == (root / "package.json").resolve()


def configured_policy(line: str, links: list, line_no: int, root: Path) -> bool:
    if not re.search(r"policy|configured|threshold|target|정책|설정|목표", line, re.I):
        return False
    if re.search(r"measured|observed|achieved|actual|측정|달성|실제", line, re.I):
        return False
    return any(n == line_no and local_file(root, url) is not None and
               Path(urlsplit(url).path).suffix in {".yml", ".yaml", ".json", ".toml", ".ini"}
               for n, url, _ in links)


def lint_text(text: str, path: Path, root: Path) -> Report:
    report = Report(path, len(text.splitlines()))
    if not text.strip():
        report.add(1, "empty", "README must not be empty")
    if report.lines > 300:
        report.add(301, "length", f"{report.lines} physical lines; maximum is 300")
    blocks, markers = prose_blocks(text)
    visible, images, links = inline_content(blocks)
    lines = visible.splitlines()
    titles = [i for i, line in enumerate(lines[:20], 1) if re.match(r"^#\s+\S", line)]
    title = titles[0] if titles else 21
    if not titles:
        report.add(1, "title", "put a visible title in the first 20 lines")
    statuses = [(i, re.search(r"\bStatus:\s*(\w+)", line, re.I))
                for i, line in enumerate(lines[:20], 1) if i > title]
    if not any(m and m[1].lower() in {"active", "maintenance", "experimental"} for _, m in statuses):
        report.add(1, "status", "show Status: active|maintenance|experimental after the title within 20 lines")
    # There is no GitHub release to link yet, so the version comes from
    # package.json. A bump that leaves README behind fails here instead of
    # going stale; once the tag exists, the release link passes too.
    version, error = package_version(root)
    if error:
        report.add(1, "version", error)
    elif not any(title < n <= 20 and mentions(label, version) and version_target(url, version, root)
                 for n, url, label in links):
        report.add(1, "version", f"link the package.json version ({version}) after the title "
                                 "within the first 20 lines")

    measured, table_columns = set(), []
    for i, line in enumerate(lines, 1):
        qualifier = QUALIFIER.search(line)
        if qualifier:
            report.add(i, "qualifier", f"remove unsupported qualifier: {qualifier[0]}")
            report.claim_lines.add(i)
        numeric = bool(MEASUREMENT.search(line))
        if re.search(r"\d+(?:\.\d+)?\s*%", line):
            numeric |= not configured_policy(line, links, i, root)
        if TESTS.search(line) and re.search(r"\b\d+\s*/\s*\d+\b", line):
            numeric = True
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        next_line = lines[i] if i < len(lines) else ""
        delimiter = re.fullmatch(r"\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*", next_line)
        if "|" in line and delimiter:
            table_columns = [j for j, cell in enumerate(cells) if TABLE_MEASURE.search(cell)]
            if table_columns:
                report.add(i, "measurement-table", "move measurement tables to benchmark documentation, even if sourced")
        elif "|" not in line:
            table_columns = []
        elif any(j < len(cells) and re.search(r"\d", cells[j]) for j in table_columns):
            numeric = True
        if numeric:
            measured.add(i)
            report.claim_lines.add(i)

    sourced = set()
    for line_no, marker in markers:
        error = marker_error(marker, root)
        if error:
            report.add(line_no, "source-marker", error)
            continue
        candidates = {line_no} & measured
        if not candidates and not lines[line_no - 1].strip():
            candidates = {line_no - 1, line_no + 1} & measured
        if len(candidates) != 1:
            report.add(line_no, "source-marker", "marker must be immediately adjacent to exactly one measurement line")
        else:
            sourced.update(candidates)
    for line_no in sorted(measured - sourced):
        report.add(line_no, "unsourced-measurement", "move the figure to docs or attach an adjacent valid source marker")
    for line_no, src, href, alt in images:
        error = badge_error(src, href, alt, root)
        if error:
            report.add(line_no, "badge", error)
    if report.density > 1.0:
        report.add(min(report.claim_lines), "density", f"{report.density:.4f} claim lines per 100 lines; maximum is 1.0")
    report.findings.sort(key=lambda item: (item.line, item.rule))
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", help="README paths relative to --root (default: README.md)")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1],
                        help="repository root; defaults to the script's repository")
    args = parser.parse_args(argv)
    failed = False
    for name in args.files or ["README.md"]:
        path = args.root / name
        try:
            report = lint_text(path.read_text(encoding="utf-8"), path, args.root)
        except (OSError, UnicodeError) as error:
            print(f"{path}:1: input: {error}")
            failed = True
            continue
        for finding in report.findings:
            print(f"{path}:{finding.line}: {finding.rule}: {finding.message}")
        print(f"{path}: {report.lines} lines; {len(report.claim_lines)} qualifier/figure lines; "
              f"density {report.density:.2f}/100; {'FAIL' if report.findings else 'PASS'}")
        failed |= bool(report.findings)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
