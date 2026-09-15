import os
import re

targets = [
    "workspace/[workspaceId]/resume/page.tsx",
    "workspace/[workspaceId]/resume/[resumeId]/edit/page.tsx",
    "workspace/[workspaceId]/chat/page.tsx",
    "workspace/[workspaceId]/marketplace/page.tsx",
    "workspace/[workspaceId]/organizations/page.tsx",
    "workspace/[workspaceId]/agents/page.tsx",
    "workspace/[workspaceId]/agents/[agentId]/page.tsx",
    "workspace/[workspaceId]/schedule/page.tsx",
    "p/[userId]/page.tsx",
    "status/page.tsx"
]

base = "apps/web/src/app"
for t in targets:
    path = os.path.join(base, t.replace("/", os.sep))
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as fp:
            c = fp.read()
        imports = re.findall(r"import\s+.*?from\s+['\"]([^'\"]+)['\"]", c)
        print(f"PAGE: {t}")
        print(f"  Imports: {imports}")
        # check for fetch, api, hooks
        hooks = re.findall(r"\b(use[A-Z][a-zA-Z0-9]+)\b", c)
        print(f"  Hooks: {sorted(list(set(hooks)))}")
        lines = len(c.splitlines())
        print(f"  Lines: {lines}")
        print("---")
