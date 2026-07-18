import os
import re

count = 0
for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith('.md'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Find mermaid blocks
                mermaid_blocks = re.findall(r'```mermaid(.*?)```', content, re.DOTALL)
                for i, block in enumerate(mermaid_blocks):
                    # Check for unicode arrows and dashes
                    if '→' in block or '—' in block or '–' in block:
                        print(f'Bad unicode in mermaid block {i} of {path}')
                        count += 1
                        
                        # Replace them
                        new_block = block.replace('→', '-->').replace('—', '--').replace('–', '-')
                        content = content.replace(block, new_block)
                        
                        with open(path, 'w', encoding='utf-8') as fw:
                            fw.write(content)
            except Exception as e:
                pass

print(f'Total bad blocks fixed: {count}')
