#!/usr/bin/env python3
"""Plugin sandbox — executes plugin code in a restricted subprocess.

Reads plugin code from stdin, context from PLUGIN_CONTEXT env var.
Writes JSON result to stdout.
"""
import json
import os
import sys


def main():
    code = sys.stdin.read()

    if not code.strip():
        json.dump({"success": False, "error": "No code to execute"}, sys.stdout)
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
            "tuple": tuple, "type": type, "zip": zip, "reversed": reversed,
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
