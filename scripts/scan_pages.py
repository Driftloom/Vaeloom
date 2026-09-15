import os
import re

base = "apps/web/src/app"
pages = []
for root, dirs, files in os.walk(base):
    for f in files:
        if f == "page.tsx":
            full = os.path.join(root, f)
            rel = os.path.relpath(full, base)
            pages.append((rel, full))

print(f"Total pages found: {len(pages)}")
for rel, full in sorted(pages):
    with open(full, "r", encoding="utf-8") as fp:
        content = fp.read()
    api_calls = re.findall(r"(\b(?:api|authApi|workspaceApi|memoryApi|agentApi|connectorApi|documentApi|jobApi|applicationApi|resumeApi|approvalApi|knowledgeGraphApi|billingApi|auditApi|notificationApi|profileApi|adminApi|featureFlagsApi|marketplaceApi|developerApi|sovereigntyApi|anticipationApi|chatApi)\.[a-zA-Z0-9_]+)", content)
    fetches = re.findall(r"fetch\(['\"]([^'\"]+)['\"]", content)
    mocks = re.findall(r"(\b(?:mock[A-Z0-9_a-z]+|MOCK_[A-Z0-9_]+))", content)
    swr = re.findall(r"useSWR[A-Za-z]*\(['\"]([^'\"]+)['\"]", content)
    print(f"PAGE: {rel}")
    print(f"  API Calls: {sorted(list(set(api_calls)))}")
    print(f"  Fetches: {sorted(list(set(fetches)))}")
    print(f"  SWR Keys: {sorted(list(set(swr)))}")
    print(f"  Mock Identifiers: {sorted(list(set(mocks[:5])))}")
    print("---")
