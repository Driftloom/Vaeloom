#!/usr/bin/env python3
"""Simple mutation test runner for critical backend modules.

Flips booleans, changes operators, removes early returns,
then runs the existing test suite to compute a mutation score.
"""

import ast
import copy
import importlib.util
import os
import subprocess
import sys
import textwrap
import types
from pathlib import Path
from typing import Any

MUTANTS_DIR = Path(__file__).parent / "__mutants__"

MODULES = [
    "backend/config.py",
    "backend/services/plugin_sandbox.py",
    "backend/middleware/auth.py",
]

TEST_PATHS = ["tests/"]
REPORT: list[dict[str, Any]] = []


def _load_source(module_path: str) -> str:
    full_path = Path(__file__).parent.parent / "src" / module_path
    return full_path.read_text()


class BoolFlipper(ast.NodeTransformer):
    def visit_Constant(self, node: ast.Constant) -> Any:
        if node.value is True:
            return ast.Constant(value=False)
        if node.value is False:
            return ast.Constant(value=True)
        return node


class OperatorSwapper(ast.NodeTransformer):
    def visit_Compare(self, node: ast.Compare) -> Any:
        if len(node.ops) == 1:
            op = node.ops[0]
            if isinstance(op, ast.Eq):
                node.ops[0] = ast.NotEq()
            elif isinstance(op, ast.NotEq):
                node.ops[0] = ast.Eq()
            elif isinstance(op, ast.Lt):
                node.ops[0] = ast.GtE()
            elif isinstance(op, ast.LtE):
                node.ops[0] = ast.Gt()
            elif isinstance(op, ast.Gt):
                node.ops[0] = ast.LtE()
            elif isinstance(op, ast.GtE):
                node.ops[0] = ast.Lt()
            elif isinstance(op, ast.In):
                node.ops[0] = ast.NotIn()
            elif isinstance(op, ast.NotIn):
                node.ops[0] = ast.In()
            elif isinstance(op, ast.Is):
                node.ops[0] = ast.IsNot()
            elif isinstance(op, ast.IsNot):
                node.ops[0] = ast.Is()
        self.generic_visit(node)
        return node

    def visit_BinOp(self, node: ast.BinOp) -> Any:
        if isinstance(node.op, ast.Add):
            node.op = ast.Sub()
        elif isinstance(node.op, ast.Sub):
            node.op = ast.Add()
        elif isinstance(node.op, ast.Mult):
            node.op = ast.Div()
        elif isinstance(node.op, ast.Div):
            node.op = ast.Mult()
        elif isinstance(node.op, ast.And):
            node.op = ast.Or()
        elif isinstance(node.op, ast.Or):
            node.op = ast.And()
        self.generic_visit(node)
        return node


class EarlyReturnRemover(ast.NodeTransformer):
    def visit_If(self, node: ast.If) -> Any:
        body_stmts = []
        for stmt in node.body:
            if isinstance(stmt, ast.Return):
                continue
            if isinstance(stmt, ast.If):
                body_stmts.append(self.visit(stmt))
            else:
                body_stmts.append(stmt)
        node.body = body_stmts or [ast.Pass()]
        self.generic_visit(node)
        return node


def _make_mutant(source: str, transform: ast.NodeTransformer, label: str) -> str:
    tree = ast.parse(source)
    tree = transform.visit(tree)
    ast.fix_missing_locations(tree)
    return ast.unparse(tree)


def _write_mutant(module_path: str, mutant_source: str, label: str) -> Path:
    rel = module_path.replace("/", "_").replace(".py", "")
    safe_label = label.replace(" ", "_").lower()
    mutant_name = f"{rel}_{safe_label}.py"
    mutant_path = MUTANTS_DIR / mutant_name
    mutant_path.parent.mkdir(parents=True, exist_ok=True)
    mutant_path.write_text(mutant_source)
    return mutant_path


def _install_mutant(module_path: str, mutant_path: Path):
    target = Path(__file__).parent.parent / "src" / module_path
    import shutil
    shutil.copy2(str(mutant_path), str(target))


def _restore_original(module_path: str, backup_path: Path):
    target = Path(__file__).parent.parent / "src" / module_path
    import shutil
    shutil.copy2(str(backup_path), str(target))


def _run_tests() -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, "-m", "pytest", *TEST_PATHS, "-q", "--timeout=30"],
        capture_output=True, text=True, timeout=120,
        cwd=Path(__file__).parent.parent,
    )
    if result.returncode == 0:
        return True, result.stdout
    if "FAILED" in result.stdout or "FAILED" in result.stderr:
        return False, result.stdout + result.stderr
    if result.returncode != 0:
        return False, result.stdout + result.stderr
    return True, result.stdout


def _generate_mutants(module_path: str, source: str) -> list[tuple[str, ast.NodeTransformer, str]]:
    mutants = []

    depth = source.count("True") + source.count("False")
    if depth > 0:
        mutants.append((module_path, BoolFlipper(), "flip_bools"))

    mutants.append((module_path, OperatorSwapper(), "swap_operators"))

    has_early_return = "return" in source and "if" in source
    if has_early_return:
        mutants.append((module_path, EarlyReturnRemover(), "remove_early_returns"))

    return mutants


def _run_single_mutant(module_path: str, source: str, transform: ast.NodeTransformer, label: str) -> dict:
    try:
        mutant_source = _make_mutant(source, transform, label)
    except Exception as e:
        return {"module": module_path, "mutant": label, "status": "build_failed", "error": str(e)}

    mutant_path = _write_mutant(module_path, mutant_source, label)
    target_path = Path(__file__).parent.parent / "src" / module_path

    backup = target_path.with_suffix(".py.bak")
    import shutil
    shutil.copy2(str(target_path), str(backup))

    try:
        _install_mutant(module_path, mutant_path)
        killed, output = _run_tests()
        return {
            "module": module_path,
            "mutant": label,
            "status": "killed" if killed else "survived",
            "output_preview": output[:300] if not killed else "",
        }
    except subprocess.TimeoutExpired:
        return {"module": module_path, "mutant": label, "status": "timeout"}
    except Exception as e:
        return {"module": module_path, "mutant": label, "status": "error", "error": str(e)}
    finally:
        _restore_original(module_path, backup)
        backup.unlink(missing_ok=True)
        mutant_path.unlink(missing_ok=True)


def _generate_report(results: list[dict]):
    total = len(results)
    killed = sum(1 for r in results if r["status"] == "killed")
    survived = sum(1 for r in results if r["status"] == "survived")
    errors = sum(1 for r in results if r["status"] in ("build_failed", "error", "timeout"))
    score = (killed / total * 100) if total > 0 else 0.0

    report_lines = [
        "=" * 60,
        "MUTATION TEST REPORT",
        "=" * 60,
        f"Total mutants : {total}",
        f"Killed       : {killed}",
        f"Survived     : {survived}",
        f"Errors       : {errors}",
        f"Score        : {score:.1f}%",
        "",
        "Details:",
        "-" * 60,
    ]

    for r in results:
        icon = "KILLED" if r["status"] == "killed" else "SURVIVED" if r["status"] == "survived" else r["status"].upper()
        detail = f"  {icon:12s} | {r['module']:45s} | {r['mutant']}"
        report_lines.append(detail)

    report = "\n".join(report_lines)
    print(report)

    report_path = MUTANTS_DIR.parent / "mutation_report.txt"
    report_path.write_text(report)
    print(f"\nReport saved to: {report_path}")

    return score


def main():
    if MUTANTS_DIR.exists():
        import shutil
        shutil.rmtree(MUTANTS_DIR)

    results = []

    for module_path in MODULES:
        print(f"\n{'='*60}")
        print(f"Mutating: {module_path}")
        print(f"{'='*60}")

        source = _load_source(module_path)
        mutants = _generate_mutants(module_path, source)

        if not mutants:
            print("  No applicable mutations found.")
            continue

        for mod, transform, label in mutants:
            result = _run_single_mutant(mod, source, transform, label)
            results.append(result)
            status_icon = "✓" if result["status"] == "killed" else "✗" if result["status"] == "survived" else "?"
            print(f"  {status_icon} {label:25s} -> {result['status']}")

    print("\n")
    score = _generate_report(results)

    if score < 60:
        print("\n⚠️  Mutation score below 60% — consider adding more tests.")
        return 1
    print(f"\n✅ Mutation score {score:.1f}% meets threshold (>= 60%).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
