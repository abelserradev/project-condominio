#!/usr/bin/env python3
"""dep_graph.py — Module-level dependency graph for Python and TS/JS repositories.

Detects: circular dependencies (SCCs), fan-in/fan-out/instability per module,
god-module candidates, orphan modules.

Outputs: <outdir>/dep_graph.json, <outdir>/dep_graph.md
Pure stdlib, read-only.

Usage:
  python3 dep_graph.py /path/to/repo -o /path/to/outdir [--root SUBDIR] [--depth N]
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
             ".next", ".nuxt", "target", "vendor", "coverage", ".pytest_cache",
             ".mypy_cache", ".ruff_cache", ".tox", "migrations", "__snapshots__"}

PY_EXT = {".py"}
TS_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
SRC_ROOTS = {"src", "app", "lib", "packages", "apps", "services"}

TS_IMPORT_RE = re.compile(
    r"""(?:^|\n)\s*(?:import|export)\s+(?:[\w{}\s*,$]+?\s+from\s+)?['"]([^'"]+)['"]"""
    r"""|require\(\s*['"]([^'"]+)['"]\s*\)"""
    r"""|import\(\s*['"]([^'"]+)['"]\s*\)""")


def module_key(rel: Path, depth: int) -> str:
    """Group a file into a module: top dir, or 2 levels under src-style roots."""
    parts = rel.parts
    if len(parts) == 1:
        return "(root)"
    if parts[0] in SRC_ROOTS and len(parts) > 2:
        return "/".join(parts[:min(2 + (depth - 1), len(parts) - 1)][:depth + 1])
    return "/".join(parts[:min(depth, len(parts) - 1)])


def count_loc(p: Path) -> int:
    try:
        return sum(1 for line in p.open("rb") if line.strip())
    except Exception:
        return 0


def resolve_ts(spec: str, file_rel: Path, all_files: set[str]) -> str | None:
    """Resolve a TS/JS import specifier to a repo-relative file path (best effort)."""
    if spec.startswith("."):
        base = (file_rel.parent / spec)
    elif spec.startswith("@/") or spec.startswith("~/"):
        base = Path("src") / spec[2:]
    elif spec.startswith("src/"):
        base = Path(spec)
    else:
        return None  # external package
    base_str = __import__("os").path.normpath(str(base)).replace("\\", "/")
    candidates = [base_str]
    for ext in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"):
        candidates.append(base_str + ext)
        candidates.append(str(Path(base_str) / f"index{ext}"))
    for c in candidates:
        c_norm = str(Path(c))
        if c_norm in all_files:
            return c_norm
    return None


def py_module_of(rel: Path) -> str:
    """Dotted module name of a python file relative to repo root (and src/)."""
    parts = list(rel.with_suffix("").parts)
    if parts and parts[0] in SRC_ROOTS:
        parts = parts[1:]
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("repo", type=Path)
    ap.add_argument("-o", "--outdir", type=Path, required=True)
    ap.add_argument("--root", default=None, help="analyze only this subdirectory")
    ap.add_argument("--depth", type=int, default=2,
                    help="module grouping depth (default 2)")
    args = ap.parse_args()

    repo = args.repo.resolve()
    scan_root = repo / args.root if args.root else repo
    if not scan_root.is_dir():
        print(f"ERROR: {scan_root} is not a directory", file=sys.stderr)
        return 2

    files: dict[str, Path] = {}
    for p in scan_root.rglob("*"):
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.is_file() and p.suffix in (PY_EXT | TS_EXT):
            files[str(p.relative_to(repo))] = p

    all_rel = set(files.keys())
    # Python: dotted-module → file map for absolute import resolution
    py_index: dict[str, str] = {}
    for rel_str, p in files.items():
        if p.suffix in PY_EXT:
            py_index[py_module_of(Path(rel_str))] = rel_str

    file_edges: set[tuple[str, str]] = set()
    parse_errors: list[str] = []

    for rel_str, p in files.items():
        rel = Path(rel_str)
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        targets: list[str] = []
        if p.suffix in PY_EXT:
            try:
                tree = ast.parse(text)
            except SyntaxError:
                parse_errors.append(rel_str)
                continue
            pkg_parts = list(rel.parent.parts)
            if pkg_parts and pkg_parts[0] in SRC_ROOTS:
                pkg_parts = pkg_parts[1:]
            for node in ast.walk(tree):
                mods: list[str] = []
                if isinstance(node, ast.Import):
                    mods = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom):
                    if node.level:  # relative import
                        base = pkg_parts[:len(pkg_parts) - (node.level - 1)]
                        mod = ".".join(base + ([node.module] if node.module else []))
                        mods = [mod]
                    elif node.module:
                        mods = [node.module]
                for m in mods:
                    # longest-prefix match against internal modules
                    segs = m.split(".")
                    for i in range(len(segs), 0, -1):
                        cand = ".".join(segs[:i])
                        if cand in py_index:
                            targets.append(py_index[cand])
                            break
        else:
            for m in TS_IMPORT_RE.finditer(text):
                spec = next(g for g in m.groups() if g)
                resolved = resolve_ts(spec, rel, all_rel)
                if resolved:
                    targets.append(resolved)
        for t in targets:
            if t != rel_str:
                file_edges.add((rel_str, t))

    # ---- Aggregate to module level ----
    mod_of = {f: module_key(Path(f), args.depth) for f in files}
    mod_files: dict[str, list[str]] = defaultdict(list)
    for f, m in mod_of.items():
        mod_files[m].append(f)
    mod_loc = {m: sum(count_loc(files[f]) for f in fs) for m, fs in mod_files.items()}

    mod_edges: dict[tuple[str, str], int] = defaultdict(int)
    for a, b in file_edges:
        ma, mb = mod_of[a], mod_of[b]
        if ma != mb:
            mod_edges[(ma, mb)] += 1

    fan_out: dict[str, set[str]] = defaultdict(set)
    fan_in: dict[str, set[str]] = defaultdict(set)
    for (a, b) in mod_edges:
        fan_out[a].add(b)
        fan_in[b].add(a)

    modules = sorted(mod_files.keys())
    metrics = []
    for m in modules:
        ce, ca = len(fan_out[m]), len(fan_in[m])
        inst = round(ce / (ce + ca), 2) if (ce + ca) else None
        metrics.append({"module": m, "files": len(mod_files[m]), "loc": mod_loc[m],
                        "fan_in": ca, "fan_out": ce, "instability": inst,
                        "coupling_score": ca * ce})
    metrics.sort(key=lambda x: (-x["coupling_score"], -x["loc"]))

    # ---- Cycles: Tarjan SCC (iterative) ----
    adj = defaultdict(set)
    for (a, b) in mod_edges:
        adj[a].add(b)
    index = {}
    low = {}
    on_stack = set()
    stack: list[str] = []
    sccs: list[list[str]] = []
    counter = [0]

    def tarjan(v: str):
        work = [(v, iter(sorted(adj[v])))]
        index[v] = low[v] = counter[0]; counter[0] += 1
        stack.append(v); on_stack.add(v)
        while work:
            node, it = work[-1]
            advanced = False
            for w in it:
                if w not in index:
                    index[w] = low[w] = counter[0]; counter[0] += 1
                    stack.append(w); on_stack.add(w)
                    work.append((w, iter(sorted(adj[w]))))
                    advanced = True
                    break
                elif w in on_stack:
                    low[node] = min(low[node], index[w])
            if advanced:
                continue
            work.pop()
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[node])
            if low[node] == index[node]:
                comp = []
                while True:
                    w = stack.pop(); on_stack.discard(w)
                    comp.append(w)
                    if w == node:
                        break
                if len(comp) > 1:
                    sccs.append(sorted(comp))

    for v in sorted(set(adj) | {b for _, b in mod_edges}):
        if v not in index:
            tarjan(v)

    # 2-cycles explicit (subset of SCCs but clearer to act on)
    two_cycles = sorted({tuple(sorted((a, b))) for (a, b) in mod_edges
                         if (b, a) in mod_edges})

    # God modules: coupling_score in top decile AND above-median LOC
    scores = sorted((m["coupling_score"] for m in metrics), reverse=True)
    locs = sorted((m["loc"] for m in metrics), reverse=True)
    score_thr = scores[max(0, len(scores) // 10)] if scores else 0
    loc_median = locs[len(locs) // 2] if locs else 0
    god = [m for m in metrics
           if m["coupling_score"] >= max(score_thr, 4) and m["loc"] >= loc_median][:5]

    orphans = [m["module"] for m in metrics
               if m["fan_in"] == 0 and m["fan_out"] == 0 and m["module"] != "(root)"]

    result = {
        "repo": str(repo), "scanned_root": str(scan_root),
        "files_analyzed": len(files), "parse_errors": parse_errors,
        "modules": metrics,
        "edges": [{"from": a, "to": b, "imports": n}
                  for (a, b), n in sorted(mod_edges.items(), key=lambda x: -x[1])],
        "cycles_scc": sccs,
        "cycles_pairs": [list(t) for t in two_cycles],
        "god_module_candidates": god,
        "orphan_modules": orphans,
    }

    args.outdir.mkdir(parents=True, exist_ok=True)
    (args.outdir / "dep_graph.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    (args.outdir / "dep_graph.md").write_text(render_md(result), encoding="utf-8")
    print(f"OK: {len(files)} files, {len(mod_files)} modules, "
          f"{len(mod_edges)} edges, {len(sccs)} cycles (SCC), "
          f"{len(god)} god-module candidates. → {args.outdir}/dep_graph.{{json,md}}")
    return 0


def render_md(r: dict) -> str:
    lines = ["# Dependency graph (modules)", "",
             f"**Repo:** `{r['repo']}` · Files: {r['files_analyzed']} · "
             f"Modules: {len(r['modules'])} · Edges: {len(r['edges'])}", ""]

    if r["cycles_scc"]:
        lines += ["## 🔴 Dependency cycles (SCCs) — P1 evidence", ""]
        for i, scc in enumerate(r["cycles_scc"], 1):
            lines.append(f"{i}. `{'` ↔ `'.join(scc)}`")
        lines.append("")
    else:
        lines += ["## Dependency cycles", "", "✅ No module-level cycles.", ""]
    if r["cycles_pairs"]:
        lines += ["### Mutual pairs (A→B and B→A)", ""]
        lines += [f"- `{a}` ↔ `{b}`" for a, b in r["cycles_pairs"]] + [""]

    lines += ["## Metrics per module (sorted by coupling)", "",
              "| Module | Files | LOC | Fan-in | Fan-out | Instability | Score |",
              "|---|---|---|---|---|---|---|"]
    for m in r["modules"][:25]:
        lines.append(f"| `{m['module']}` | {m['files']} | {m['loc']} | {m['fan_in']} "
                     f"| {m['fan_out']} | {m['instability']} | {m['coupling_score']} |")

    if r["god_module_candidates"]:
        lines += ["", "## ⚠️ God-module candidates (verify in Phase 1)", ""]
        for m in r["god_module_candidates"]:
            lines.append(f"- `{m['module']}` — fan-in {m['fan_in']}, fan-out "
                         f"{m['fan_out']}, {m['loc']} LOC")
    if r["orphan_modules"]:
        lines += ["", "## Orphan modules (dead code or entrypoints?)", ""]
        lines += [f"- `{m}`" for m in r["orphan_modules"]]
    if r["parse_errors"]:
        lines += ["", f"## Unparseable files ({len(r['parse_errors'])})", ""]
        lines += [f"- `{f}`" for f in r["parse_errors"][:10]]

    edges = r["edges"]
    if 0 < len(edges) <= 40:
        lines += ["", "## Diagram", "", "```mermaid", "graph LR"]
        for e in edges:
            a = e["from"].replace("/", "_").replace(".", "_").replace("(", "").replace(")", "")
            b = e["to"].replace("/", "_").replace(".", "_").replace("(", "").replace(")", "")
            lines.append(f"  {a}[\"{e['from']}\"] --> {b}[\"{e['to']}\"]")
        lines += ["```"]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    sys.exit(main())
