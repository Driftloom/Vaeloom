import re

for file in ["apps/web/src/components/chat/ChatWindow.tsx", "apps/web/src/components/resume/ResumeBuilder.tsx", "apps/web/src/app/p/[userId]/PublicProfileView.tsx", "apps/web/src/components/dashboard/MorningBriefingCard.tsx", "apps/web/src/components/dashboard/AnticipationFeed.tsx"]:
    with open(file, "r", encoding="utf-8") as fp:
        c = fp.read()
    calls = re.findall(r"(\b[a-zA-Z]+Api\.[a-zA-Z0-9_]+|\bapi\.[a-zA-Z0-9_]+)", c)
    fetches = re.findall(r"fetch\(['\"]([^'\"]+)['\"]", c)
    print(f"FILE: {file}")
    print(f"  API calls: {sorted(list(set(calls)))}")
    print(f"  Fetches: {sorted(list(set(fetches)))}")
