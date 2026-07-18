import os
import re

tagline = 'The AI Operating System for Autonomous Career and Education Management'

def process_markdown(content):
    if tagline in content:
        return content
    def replacer(match):
        return match.group(0) + f'\n\n### {tagline}'
    new_content, count = re.subn(r'^(#\s+Vaeloom.*)$', replacer, content, count=1, flags=re.MULTILINE)
    return new_content

def process_html(content):
    if tagline in content:
        return content
    new_content, count = re.subn(r'<title>Vaeloom[^<]*</title>', f'<title>Vaeloom — {tagline}</title>', content, count=1, flags=re.IGNORECASE)
    def h1_replacer(match):
        return match.group(0) + f'\n<p class="tagline">{tagline}</p>'
    new_content, _ = re.subn(r'(<h1[^>]*>Vaeloom[^<]*</h1>)', h1_replacer, new_content, count=1, flags=re.IGNORECASE)
    return new_content

def process_readme(content):
    if tagline in content:
        return content
    def replacer(match):
        return match.group(0) + f'\n\n> **{tagline}**'
    new_content, count = re.subn(r'^(#\s+Vaeloom.*)$', replacer, content, count=1, flags=re.MULTILINE)
    return new_content

for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root or 'build' in root or 'out' in root or '.next' in root:
        continue
    for file in files:
        path = os.path.join(root, file)
        # Skip build prompts explicitly
        if 'mvp' in root.lower() or 'enterprise' in root.lower() or 'build-prompts' in root.lower() or 'build_prompts' in root.lower():
            continue
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if file.endswith('.md'):
                if 'README' in file:
                    new_content = process_readme(content)
                else:
                    new_content = process_markdown(content)
            elif file.endswith('.html'):
                new_content = process_html(content)
            else:
                continue
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {path}')
        except Exception as e:
            pass
