import os

replacements = {
    '—': '—',
    '–': '–',
    '‘': '‘',
    '’': '’',
    '“': '“',
    '”\u009d': '”',
    '”': '”', # fallback for right double quote if previous doesn't match
    '→': '→',
    'â†\u0090': '←',
    '”¦': '…',
    '§': '§',
}

for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith('.md') or file.endswith('.html') or file.endswith('.py'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content
                for bad, good in replacements.items():
                    new_content = new_content.replace(bad, good)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Fixed {path}')
            except Exception as e:
                pass
