#!/usr/bin/env python3
"""Plugin sandbox — executes plugin code in a restricted subprocess.

Reads plugin code from stdin, context from PLUGIN_CONTEXT env var.
Writes JSON result to stdout.
"""
import ast
import json
import os
import sys

FORBIDDEN_CALLS = {
    "eval", "exec", "compile", "getattr", "setattr", "delattr",
    "open", "__import__", "globals", "locals", "vars", "breakpoint",
}


class SecurityViolation(Exception):
    """Raised when plugin code violates sandbox security constraints."""
    pass


def validate_ast(code: str) -> None:
    """Validate that plugin code does not use dangerous Python constructs or introspection."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise SecurityViolation(f"Syntax error: {e}") from e

    for node in ast.walk(tree):
        # Disallow import statements
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise SecurityViolation("Import statements are forbidden in plugin sandbox")

        # Disallow access to dunder attributes (blocks __class__, __subclasses__, __bases__, __globals__, etc.)
        if isinstance(node, ast.Attribute):
            if node.attr.startswith("__") and node.attr.endswith("__"):
                raise SecurityViolation(f"Access to private/dunder attribute '{node.attr}' is forbidden")

        # Disallow restricted function names and dunder identifiers
        if isinstance(node, ast.Name):
            if node.id in FORBIDDEN_CALLS:
                raise SecurityViolation(f"Use of restricted primitive '{node.id}' is forbidden")
            if node.id.startswith("__") and node.id.endswith("__"):
                raise SecurityViolation(f"Reference to dunder identifier '{node.id}' is forbidden")


def main():
    code = sys.stdin.read()

    if not code.strip():
        json.dump({"success": False, "error": "No code to execute"}, sys.stdout)
        sys.stdout.flush()
        return

    try:
        validate_ast(code)
    except SecurityViolation as sv:
        json.dump({"success": False, "error": f"SecurityViolation: {str(sv)}"}, sys.stdout)
        sys.stdout.flush()
        return

    context = json.loads(os.environ.get("PLUGIN_CONTEXT", "{}"))
    input_data = context.get("input", {})

    restricted_globals = {
        "__builtins__": {
            "abs": abs, "all": all, "any": any, "bool": bool,
            "dict": dict, "enumerate": enumerate, "filter": filter,
            "float": float, "int": int, "isinstance": isinstance,
            "len": len, "list": list, "map": map, "max": max,
            "min": min, "range": range, "round": round, "set": set,
            "slice": slice, "sorted": sorted, "str": str, "sum": sum,
            "tuple": tuple, "zip": zip, "reversed": reversed,
            "True": True, "False": False, "None": None,
            "Exception": Exception, "ValueError": ValueError,
            "TypeError": TypeError, "KeyError": KeyError,
            "IndexError": IndexError, "AttributeError": AttributeError,
            "RuntimeError": RuntimeError, "StopIteration": StopIteration,
        },
        "input": input_data,
        "context": context,
    }
    local_scope = {}

    try:
        exec(code, restricted_globals, local_scope)
        result_value = local_scope.get("result", local_scope.get("run", lambda: None)())
        output = {"result": result_value} if result_value is not None else None
        json.dump({"success": True, "output": output}, sys.stdout)
    except Exception as e:
        json.dump({"success": False, "error": f"{type(e).__name__}: {str(e)}"}, sys.stdout)
    finally:
        sys.stdout.flush()


if __name__ == "__main__":
    main()

