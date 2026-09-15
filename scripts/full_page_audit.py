import os
import re

base = "apps/web/src/app"
routes = []
for root, dirs, files in os.walk(base):
    for f in files:
        if f == "page.tsx":
            full = os.path.join(root, f)
            rel = os.path.relpath(full, base).replace("\\", "/")
            routes.append((rel, full))

print(f"Analyzing {len(routes)} pages...")

for rel, full in sorted(routes):
    with open(full, "r", encoding="utf-8") as fp:
        code = fp.read()
    
    route_name = "/" + rel.replace("/page.tsx", "").replace("page.tsx", "")
    if route_name == "/": route_name = "/ (Landing)"
    
    # Check for direct endpoints
    endpoints = set(re.findall(r"['\"](/api/v1/[^'\"]+|/(?:auth|workspaces|memories|agents|events|integrations|billing|sovereignty|anticipation|connectors|documents|jobs|resumes|applications|approvals|health|search|notifications|profile|admin|feature-flags|plugins|provider-keys|webhooks|audit|cognition|council|federation|temporal)[^'\"]*)['\"]", code))
    # Check for api calls
    api_calls = set(re.findall(r"(\b[a-zA-Z]+Api\.[a-zA-Z0-9_]+|\bapi\.[a-zA-Z0-9_]+)", code))
    
    # Check for mocks
    has_mocks = bool(re.search(r"\bmock[A-Z0-9_a-z]+|\bMOCK_[A-Z0-9_]+", code))
    mock_names = set(re.findall(r"(\bmock[A-Z0-9_a-z]+|\bMOCK_[A-Z0-9_]+)", code))
    
    # Check for EnterpriseGated
    is_ent = "EnterpriseGated" in code
    
    print(f"=== {route_name} ===")
    print(f"File: apps/web/src/app/{rel}")
    print(f"Endpoints: {sorted(list(endpoints)) if endpoints else 'None directly string-referenced'}")
    print(f"Client Methods: {sorted(list(api_calls)) if api_calls else 'None'}")
    print(f"Mocks: {sorted(list(mock_names)) if has_mocks else 'None'}")
    print(f"Enterprise Gated: {is_ent}")
