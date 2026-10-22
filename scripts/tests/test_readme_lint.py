"""Behavior tests for the offline README policy, using isolated repositories.

Ported from kcenon/common_system scripts/tests/test_readme_lint.py (c2f4037).
The rule tests stay close to upstream so later fixes carry over; the release
tests are replaced by the package.json version checks this repository uses.
"""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "readme_lint.py"
spec = importlib.util.spec_from_file_location("readme_lint", SCRIPT)
lint = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = lint
spec.loader.exec_module(lint)

VERSION = "0.2.0"
RELEASE = f"https://github.com/kcenon/claude_code_agent/releases/tag/v{VERSION}"
WORKFLOW = "https://github.com/kcenon/claude_code_agent/actions/workflows/"
# Four lines, like upstream's, so the line numbers asserted below still hold.
INTRO = f"# Example\n\n**Status: active** | **Version:** [{VERSION}](package.json) (unreleased)\n\n"
MARKER = "<!-- source: docs/BENCHMARKS.md#recorded-run (2026-09-12, Ubuntu / GCC) -->"


class ReadmeLintTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write(".github/workflows/ci.yml", "name: CI\n")
        self.write(".github/workflows/docs.yaml", "name: Documentation\n")
        self.write("codecov.yml", "coverage: {}\n")
        self.write("docs/results.json", "{}\n")
        self.manifest(VERSION)
        self.write("docs/BENCHMARKS.md", "# Evidence\n\n## Recorded Run\n\n"
                   "Environment: Ubuntu / GCC\nMeasurement date: 2026-09-12\n"
                   "Command: `./build/benchmarks/common_benchmarks`\n"
                   "Raw result: [JSON](results.json)\n")

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def manifest(self, version):
        return self.write("package.json", json.dumps({"name": "example", "version": version}) + "\n")

    def page(self, body="", lines=110):
        text = INTRO + body + "\n"
        # Deliberately control denominator for density boundary tests. This is
        # fixture data, not a suggestion to pad real READMEs.
        return text + "Ordinary description.\n" * max(0, lines - len(text.splitlines()))

    def check(self, body="", lines=110):
        return lint.lint_text(self.page(body, lines), self.root / "README.md", self.root)

    def lint(self, text):
        return lint.lint_text(text, Path("README.md"), self.root)

    def rules(self, report):
        return {finding.rule for finding in report.findings}

    def test_valid_readme_and_all_statuses(self):
        for status in ("active", "maintenance", "experimental"):
            with self.subTest(status=status):
                text = self.page().replace("Status: active", f"Status: {status}")
                self.assertFalse(lint.lint_text(text, self.root / "README.md", self.root).findings)

    def test_empty_and_physical_line_limit_without_final_newline(self):
        for text in ("", "\n \n"):
            self.assertIn("empty", self.rules(lint.lint_text(text, Path("README.md"), self.root)))
        self.assertNotIn("length", self.rules(self.check(lines=300)))
        text = self.page(lines=301).rstrip("\n")
        result = lint.lint_text(text, Path("README.md"), self.root)
        self.assertEqual(result.lines, 301)
        self.assertIn("length", self.rules(result))

    def test_missing_invalid_late_and_hidden_front_matter(self):
        variants = {
            "status": self.page().replace("Status: active", "Status: stable"),
            "version": self.page().replace(f"[{VERSION}](package.json)", VERSION),
            "title": self.page().replace("# Example", "Example"),
        }
        for rule, text in variants.items():
            with self.subTest(rule=rule):
                self.assertIn(rule, self.rules(lint.lint_text(text, Path("README.md"), self.root)))
        for text in ("\n" * 20 + INTRO, "```md\n" + INTRO + "```\n", "<!--\n" + INTRO + "-->\n"):
            rules = self.rules(lint.lint_text(text, Path("README.md"), self.root))
            self.assertTrue({"status", "version"} <= rules)
        wrong_release = self.page().replace("](package.json)", f"]({RELEASE.replace(VERSION, '1.0.0')})")
        self.assertIn("version", self.rules(lint.lint_text(wrong_release, Path("README.md"), self.root)))

    def test_english_qualifiers_and_emphasis(self):
        for claim in ("PRODUCTION READY", "enterprise-grade", "battle tested", "blazing",
                      "world-class", "comprehensive", "robust", "seamless", "100%",
                      "guaranteed", "zero overhead", "zero-runtime-overhead",
                      "zero warnings", "zero sanitizer warnings", "zero memory leaks",
                      "zero data races", "no memory leaks", "RAII Grade: A+",
                      "well-tested", "high-performance", "**zero** **overhead**"):
            with self.subTest(claim=claim):
                self.assertIn("qualifier", self.rules(self.check(claim)))

    def test_korean_qualifiers(self):
        for claim in ("제로 오버헤드", "원활한 통합", "제로 경고", "메모리 누수 없음",
                      "데이터 레이스 없음", "RAII 등급: A", "포괄적인 지원", "견고한 설계", "고성능"):
            with self.subTest(claim=claim):
                self.assertIn("qualifier", self.rules(self.check(claim)))

    def test_measurements(self):
        for claim in ("Result<T> is 400x faster", "400× faster", "400배 빠름", "2.3 ns",
                      "12 us", "12 µs", "12 μs", "12 ms", "5M ops/s", "4 K msg/sec",
                      "9 req/s", "3 GB/s", "200 operations per second", "Coverage: 80%",
                      "커버리지: 80%+", "18/18 passing tests", "18/18 테스트 통과",
                      "0 allocations", "0 memory allocations", "Allocation count: 0",
                      "18 tests passed", "18 passing tests", "passed 18 tests", "18개 테스트 통과",
                      "Allocations: 0", "할당: 0회", "0회 할당",
                      "Coverage measured:\n80%"):
            with self.subTest(claim=claim):
                self.assertIn("unsourced-measurement", self.rules(self.check(claim)))

    def test_inline_code_and_visible_labels_do_not_hide_claims(self):
        for claim in ("`Result<T>` is `400x` faster", "`2.3 ns`", "[400x faster](docs/BENCHMARKS.md)",
                      "![400x faster](diagram.png)", '<span>**400x**</span> faster',
                      '<img src="diagram.png" alt="400x faster">'):
            with self.subTest(claim=claim):
                self.assertIn("unsourced-measurement", self.rules(self.check(claim)))

    def test_source_markers_inline_before_and_after(self):
        for body in (f"2.3 ns {MARKER}", f"{MARKER}\n2.3 ns", f"2.3 ns\n{MARKER}"):
            with self.subTest(body=body):
                result = self.check(body)
                self.assertFalse(result.findings)
                self.assertEqual(len(result.claim_lines), 1)
                self.assertGreater(result.density, 0)

    def test_source_never_legalizes_qualifier(self):
        result = self.check(f"2.3 ns with robust design {MARKER}")
        self.assertIn("qualifier", self.rules(result))
        self.assertNotIn("unsourced-measurement", self.rules(result))

    def test_invalid_marker_date_environment_path_and_anchor(self):
        for marker in (MARKER.replace("2026-09-12", "2026-02-30"),
                       MARKER.replace("Ubuntu / GCC", " "),
                       MARKER.replace("docs/BENCHMARKS.md", "docs/missing.md"),
                       MARKER.replace("#recorded-run", "#missing"),
                       MARKER.replace("docs/BENCHMARKS.md", "https://example.com/results.md"),
                       MARKER.replace("docs/BENCHMARKS.md", "../outside.md"),
                       MARKER.replace("Ubuntu / GCC", "Ubuntu\nGCC"), MARKER[:-3]):
            with self.subTest(marker=marker):
                self.assertTrue({"source-marker", "unsourced-measurement"} <=
                                self.rules(self.check(f"2.3 ns {marker}")))

    def test_markers_cannot_exempt_unrelated_claims(self):
        for body in (f"{MARKER}\n\n2.3 ns", f"2.3 ns\n{MARKER}\n4.5 ns",
                     f"Unrelated prose {MARKER}\n2.3 ns", f"2.3 ns `{MARKER}`",
                     f"```md\n{MARKER}\n```\n2.3 ns"):
            with self.subTest(body=body):
                self.assertIn("unsourced-measurement", self.rules(self.check(body)))
        result = self.check(f"2.3 ns {MARKER}\n\n4.5 ns")
        missing = [f.line for f in result.findings if f.rule == "unsourced-measurement"]
        self.assertEqual(missing, [7])

    def test_source_heading_anchors_and_duplicates(self):
        self.assertEqual(lint.anchors("# Result API\n## Run\n## Run\n## foo_bar\n"),
                         {"result-api", "run", "run-1", "foo_bar"})
        self.write("docs/BENCHMARKS.md", "```md\n## Recorded Run\n```\n")
        self.assertIn("source-marker", self.rules(self.check(f"2.3 ns {MARKER}")))

    def test_measurement_tables_with_bare_numbers_even_when_sourced(self):
        for header, value in (("Time (ns)", "12.4"), ("Allocations", "0"),
                              ("시간 (ns)", "12.4"), ("할당", "0"), ("Coverage", "80")):
            with self.subTest(header=header):
                result = self.check(f"| Operation | {header} |\n| --- | ---: |\n| publish | {value} | {MARKER}")
                self.assertIn("measurement-table", self.rules(result))
                self.assertEqual(len(result.claim_lines), 1)
        self.assertFalse(self.check("| Compiler | Version |\n| --- | --- |\n| GCC | 11+ |").findings)

    def test_versions_dates_error_ranges_programs_and_config_are_not_measurements(self):
        body = """C++20 requires GCC 11+, Clang 14+, MSVC 2022 and CMake 3.20.
Published v0.2.0; staged 1.0.0; updated 2026-09-12.
1. Codes -1 to -99 are core errors.
Configured coverage target: 40% project / 60% patch ([policy](codecov.yml)).
설정된 커버리지 목표: 40% ([정책](codecov.yml)).
[reference](https://example.com/400x/3ns/100%)
```cpp
auto sample = ok(100);
// guaranteed 400x faster, 100% coverage
```
"""
        self.assertFalse(self.check(body).findings)
        for claim in ("Coverage target: 80%", "Measured coverage achieved 80% ([policy](codecov.yml)).",
                      "Configured coverage target: 80% ([policy](missing.yml))."):
            self.assertIn("unsourced-measurement", self.rules(self.check(claim)))

    def test_code_fences_comments_and_indented_code(self):
        bodies = ("```cpp\n400x faster\n<!--\n```\nPlain prose.",
                  "~~~text\n100% robust\n~~~", "> ```text\n> 400x faster\n> ```",
                  "- ```text\n  400x faster\n  ```",
                  "- Example:\n\n    ```text\n    400x faster\n    ```",
                  "\n    400x faster\n    guaranteed\n",
                  "<!-- comment\n```\n400x faster\n-->\nPlain prose.")
        for body in bodies:
            with self.subTest(body=body):
                self.assertFalse(self.check(body).findings)
        result = self.check("<!-- hidden\n400x faster --> 4.5 ns")
        self.assertEqual(result.claim_lines, {6})
        self.assertIn("unsourced-measurement", self.rules(self.check("~~~\nignored\n~~~\n400x faster")))
        self.assertIn("unsourced-measurement", self.rules(self.check("    ```text\n400x faster\n    ```")))

    def test_badges_yml_yaml_queries_references_and_html(self):
        for name in ("ci.yml", "docs.yaml"):
            image = WORKFLOW + name + "/badge.svg?branch=main&event=push"
            click = WORKFLOW + name + "?query=branch%3Amain"
            for body in (f"[![CI]({image})]({click})",
                         f"[![CI][image]][run]\n\n[image]: {image}\n[run]: {click}",
                         f"[![CI]({image})][run]\n\n[run]: {click}",
                         f'<a href="{click}"><img alt="CI" src="{image}"></a>',
                         f'<a href="{click}">\n<img alt="CI"\n src="{image}">\n</a>'):
                with self.subTest(body=body):
                    self.assertFalse(self.check(body).findings)

    def test_invalid_badges(self):
        for image, click in ((WORKFLOW + "missing.yml/badge.svg", WORKFLOW + "missing.yml"),
                             (WORKFLOW + "ci.yml/badge.svg", WORKFLOW + "docs.yaml"),
                             (WORKFLOW.replace("kcenon/", "external/") + "ci.yml/badge.svg", WORKFLOW + "ci.yml"),
                             (WORKFLOW + "ci.yml/badge.svg", WORKFLOW.replace("kcenon/", "external/") + "ci.yml"),
                             ("https://img.shields.io/badge/quality-A-green", "https://example.com"),
                             ("https://img.shields.io/github/license/kcenon/claude_code_agent", "LICENSE"),
                             ("https://img.shields.io/badge/Node.js-22.22.1%2B-green.svg", "https://nodejs.org/"),
                             ("https://codecov.io/gh/kcenon/claude_code_agent/branch/main/graph/badge.svg", "https://codecov.io")):
            with self.subTest(image=image, click=click):
                self.assertIn("badge", self.rules(self.check(f"[![CI]({image})]({click})")))
        self.assertIn("badge", self.rules(self.check(f"![CI]({WORKFLOW}ci.yml/badge.svg)")))

    def test_normal_images_text_links_and_example_badges_are_not_badges(self):
        body = f"[workflow]({WORKFLOW}missing.yml)\n![Architecture](diagram.png)\n"
        body += f"```md\n[![CI]({WORKFLOW}missing.yml/badge.svg)]({WORKFLOW}missing.yml)\n```\n"
        body += '`<img alt="badge" src="https://img.shields.io/badge/test">`'
        self.assertFalse(self.check(body).findings)

    def test_density_counts_distinct_lines_and_includes_sourced_figures(self):
        result = self.check(f"robust and seamless, 2.3 ns {MARKER}", lines=100)
        self.assertEqual(result.claim_lines, {5})
        self.assertEqual(result.density, 1.0)
        self.assertNotIn("density", self.rules(result))
        self.assertIn("density", self.rules(self.check("robust", lines=99)))
        result = self.check(f"2.3 ns {MARKER}\n4.5 ns {MARKER}", lines=100)
        self.assertEqual(result.density, 2.0)
        self.assertIn("density", self.rules(result))

    def test_old_performance_block_fails(self):
        result = self.check("""## Performance
| Operation | Time (ns) | Allocations | Notes |
| --- | --- | --- | --- |
| Result creation | 2.3 | 0 | Stack-only |
| Result error check | 0.8 | 0 | Bool check |
| IExecutor submit | 45.2 | 1 | Queue |
| Event publish | 12.4 | 0 | Synchronous |
Result<T> is 400x faster than exceptions.
IExecutor is 53x faster than std::async.
Sanitizer tests: 18/18 passing with zero warnings.
Zero memory leaks; zero data races; RAII Grade: A.
""")
        self.assertTrue({"measurement-table", "unsourced-measurement", "qualifier", "density"} <= self.rules(result))
        self.assertEqual(len(result.claim_lines), 8)

    def test_cli_defaults_help_paths_exit_status_and_unreadable_inputs(self):
        self.write("README.md", self.page())
        def invoke(*args):
            return subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.root), *args],
                                  cwd=self.temp.name, capture_output=True, text=True)
        good = invoke()
        self.assertEqual(good.returncode, 0, good.stdout)
        self.assertEqual(good.stdout.count("density 0.00/100; PASS"), 1)
        # The no-argument command resolves the script's checkout, not cwd.
        copied_script = self.write("scripts/readme_lint.py", SCRIPT.read_text(encoding="utf-8"))
        default_root = subprocess.run([sys.executable, str(copied_script)], cwd="/",
                                      capture_output=True, text=True)
        self.assertEqual(default_root.returncode, 0, default_root.stdout)
        self.assertEqual(invoke("--help").returncode, 0)
        self.write("README.md", self.page("400x faster"))
        bad = invoke()
        self.assertEqual(bad.returncode, 1)
        self.assertIn("README.md:5: unsourced-measurement:", bad.stdout)
        self.write("README.md", self.page())
        self.assertEqual(invoke("README.md").returncode, 0)
        self.assertEqual(invoke("missing.md").returncode, 1)
        self.assertEqual(invoke("docs").returncode, 1)
        (self.root / "invalid.md").write_bytes(b"\xff")
        self.assertEqual(invoke("invalid.md").returncode, 1)

    def test_version_link_must_match_package_json(self):
        # A version bump that leaves README behind, or a label that only
        # contains the version as a prefix or suffix, must fail.
        for value in ("0.3.0", "0.2.01", "10.2.0", "0.2.0-rc.1"):
            with self.subTest(value=value):
                self.manifest(value)
                self.assertIn("version", self.rules(self.check()))
        self.manifest(VERSION)
        self.assertFalse(self.check().findings)
        for content in (None, "", "{", "[]\n", '{"name": "example"}\n', '{"version": "0.2"}\n',
                        '{"version": 2}\n'):
            with self.subTest(content=content):
                if content is None:
                    (self.root / "package.json").unlink()
                else:
                    self.write("package.json", content)
                self.assertIn("version", self.rules(self.check()))

    def test_version_link_targets(self):
        # The label alone is not enough: the link has to reach package.json, or
        # the tag a GitHub release of that version will use.
        accepted = (f"[v{VERSION}]({RELEASE})", f"[`{VERSION}`](package.json)",
                    f"[{VERSION}](./package.json)", f"[Version {VERSION}](package.json)")
        for link in accepted:
            with self.subTest(link=link):
                text = self.page().replace(f"[{VERSION}](package.json)", link)
                self.assertNotIn("version", self.rules(self.lint(text)))
        rejected = (f"[{VERSION}](CHANGELOG.md)",
                    f"[{VERSION}]({RELEASE.replace('kcenon/', 'external/')})",
                    f"[{VERSION}]({RELEASE.replace(VERSION, '0.1.0')})",
                    f"[{VERSION}](missing/package.json)",
                    f"[version](package.json) {VERSION}",
                    f"[x{VERSION}](package.json)")
        for link in rejected:
            with self.subTest(link=link):
                text = self.page().replace(f"[{VERSION}](package.json)", link)
                self.assertIn("version", self.rules(self.lint(text)))
        late = "# Example\n" + "\n" * 20 + INTRO.split("\n", 1)[1]
        self.assertTrue({"status", "version"} <= self.rules(self.lint(late)))

    def test_prerelease_versions_match_whole_tokens(self):
        self.manifest("0.2.0-rc.1")
        text = self.page().replace(f"[{VERSION}](package.json)", "[0.2.0-rc.1](package.json)")
        self.assertFalse(self.lint(text).findings)


if __name__ == "__main__":
    unittest.main()
