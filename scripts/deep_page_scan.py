import os, re

base = "apps/web/src/app"
pages = []
for root, dirs, files in os.walk(base):
    for f in files:
        if f == "page.tsx":
            full = os.path.join(root, f)
            rel = os.path.relpath(full, base).replace("\\", "/")
            pages.append((rel, full))

print(f"Total Next.js pages: {len(pages)}")
for rel, full in sorted(pages):
    with open(full, "r", encoding="utf-8") as fp:
        c = fp.read()
    
    # Check imports of components
    comp_imports = re.findall(r"import\s+.*?from\s+['\"](@/components/[^'\"]+)['\"]", c)
    lib_imports = re.findall(r"import\s+.*?from\s+['\"](@/lib/[^'\"]+)['\"]", c)
    
    print(f"ROUTE: /{rel.replace('/page.tsx', '').replace('page.tsx', '')}")
    print(f"  File: apps/web/src/app/{rel}")
    if comp_imports:
        print(f"  Components: {comp_imports}")
    if lib_imports:
        print(f"  Libs: {lib_imports}")
    
    # Find all API calls
    calls = re.findall(r"(\b[a-zA-Z]+Api\.[a-zA-Z0-9_]+|\bapi\.[a-zA-Z0-9_]+)", c)
    if calls:
        print(f"  Direct API calls: {sorted(list(set(calls)))}")
    
    # Check if EnterpriseGated is used
    if "EnterpriseGated" in c:
        print("  Enterprise Gated: YES")
        
    print()
