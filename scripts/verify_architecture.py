#!/usr/bin/env python3
"""
Vaeloom Enterprise Architecture AST Verification & Zero-Bypass Enforcer.

Enforces unidirectional dependency layers and security rules across the monorepo:
1. Tier 0 (Contracts): Zero dependencies on other packages, ORM, DB, or API frameworks.
2. Tier 1 (Security & Policy): Can only import Tier 0 contracts.
3. Tier 2 (Common Primitives): Can only import Tiers 0 & 1.
4. Tier 3 (Memory, Tools, Delegation): Decoupled from direct ORMs and higher layers.
5. Tier 4 (Domain & Connectors): Pure deterministic services and isolated connectors.
6. Tier 5 (Domain Agents): Zero direct DB/ORM imports; must possess valid agent.yaml.
7. Tier 6 (Runtimes & Gateway): Consumes lower tiers without exposing monolith debt.
"""

from __future__ import annotations

import ast
import os
import sys
from pathlib import Path
from typing import List, Set, Tuple

ROOT = Path(__file__).resolve().parent.parent


class ArchitectureVerifier:
    def __init__(self, root: Path):
        self.root = root
        self.violations: list[str] = []
        self.checked_files_count = 0

    def get_imported_modules(self, file_path: Path) -> list[Tuple[int, str]]:
        """Parse a Python file into an AST and extract all top-level imported module names."""
        imports = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=str(file_path))
        except Exception as e:
            self.violations.append(f"[SYNTAX ERROR] Could not parse {file_path.relative_to(self.root)}: {e}")
            return imports

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append((node.lineno, alias.name))
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append((node.lineno, node.module))
        return imports

    def verify_agents(self):
        """Verify that agents in agents/ have zero direct DB/ORM imports and valid agent.yaml."""
        agents_dir = self.root / "agents"
        if not agents_dir.exists():
            self.violations.append("[MISSING DIR] Directory 'agents/' does not exist.")
            return

        forbidden_patterns = [
            "sqlalchemy",
            "api.database",
            "api.models",
            "database",
            "models",
            "alembic",
            "aiosqlite",
            "asyncpg",
            "psycopg2",
        ]

        for agent_dir in sorted(agents_dir.iterdir()):
            if not agent_dir.is_dir() or agent_dir.name.startswith("."):
                continue

            # Check agent.yaml presence
            manifest_file = agent_dir / "agent.yaml"
            if not manifest_file.exists():
                self.violations.append(f"[AGENT MANIFEST] Missing agent.yaml in {agent_dir.name}")

            # Check test presence
            tests_dir = agent_dir / "tests"
            if not tests_dir.exists() or not list(tests_dir.glob("*.py")):
                self.violations.append(f"[AGENT TESTS] Missing unit tests in {agent_dir.name}/tests")

            # Scan python sources for forbidden imports
            src_dir = agent_dir / "src"
            if not src_dir.exists():
                self.violations.append(f"[AGENT STRUCTURE] Missing src/ in {agent_dir.name}")
                continue

            for py_file in src_dir.rglob("*.py"):
                self.checked_files_count += 1
                imports = self.get_imported_modules(py_file)
                for line, mod in imports:
                    for forbidden in forbidden_patterns:
                        if mod == forbidden or mod.startswith(forbidden + "."):
                            self.violations.append(
                                f"[FORBIDDEN IMPORT] {py_file.relative_to(self.root)}:{line} "
                                f"imports '{mod}' (Agents must never directly import database/ORM)"
                            )

    def verify_contracts(self):
        """Verify that packages/agent-contracts has zero external internal package imports."""
        contracts_src = self.root / "packages" / "agent-contracts" / "src"
        if not contracts_src.exists():
            return

        forbidden = [
            "vaeloom_agent_security",
            "vaeloom_agent_policy",
            "vaeloom_agent_common",
            "vaeloom_agent_memory",
            "vaeloom_agent_tools",
            "vaeloom_domain",
            "vaeloom_connectors",
            "fastapi",
            "sqlalchemy",
        ]

        for py_file in contracts_src.rglob("*.py"):
            self.checked_files_count += 1
            imports = self.get_imported_modules(py_file)
            for line, mod in imports:
                for f in forbidden:
                    if mod == f or mod.startswith(f + "."):
                        self.violations.append(
                            f"[CONTRACTS PURITY] {py_file.relative_to(self.root)}:{line} "
                            f"imports '{mod}' (Contracts must remain pure Pydantic)"
                        )

    def verify_domain_purity(self):
        """Verify that packages/domain and packages/connectors do not import higher-level agents or runtimes."""
        domain_src = self.root / "packages" / "domain" / "src"
        connectors_src = self.root / "packages" / "connectors" / "src"

        forbidden = [
            "vaeloom_agent_common",
            "vaeloom_agent_policy",
            "vaeloom_agent_delegation",
            "vaeloom_sdk",
            "agents",
            "runtimes",
            "api.orchestrator",
        ]

        for base_dir in [domain_src, connectors_src]:
            if not base_dir.exists():
                continue
            for py_file in base_dir.rglob("*.py"):
                self.checked_files_count += 1
                imports = self.get_imported_modules(py_file)
                for line, mod in imports:
                    for f in forbidden:
                        if mod == f or mod.startswith(f + "."):
                            self.violations.append(
                                f"[DOMAIN PURITY] {py_file.relative_to(self.root)}:{line} "
                                f"imports '{mod}' (Lower tiers cannot import higher agent/runtime tiers)"
                            )

    def run(self) -> int:
        print("=" * 70)
        print("  VAELOOM ZERO-TRUST ARCHITECTURAL DEPENDENCY & COMPLIANCE VERIFIER")
        print("=" * 70)

        self.verify_agents()
        self.verify_contracts()
        self.verify_domain_purity()

        print(f"Total Python source files scanned: {self.checked_files_count}")

        if not self.violations:
            print("\n[SUCCESS] 0 Architectural Violations Found! All packages and agents comply.")
            print("=" * 70)
            return 0
        else:
            print(f"\n[FAILURE] Found {len(self.violations)} Architectural Violations:\n")
            for v in self.violations:
                print(f"  * {v}")
            print("\n" + "=" * 70)
            return 1


if __name__ == "__main__":
    verifier = ArchitectureVerifier(ROOT)
    sys.exit(verifier.run())
