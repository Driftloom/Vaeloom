#!/usr/bin/env python3
"""
Fix remaining markdownlint issues across docs/ that auto-fix couldn't handle.

Fixes:
  MD040 — Add 'text' language to fenced code blocks without language specifier
  MD001 — Fix heading level increments (rebalance skipped levels)
  MD056 — Fix table column count mismatches
  MD003 — Fix heading style (ensure consistent ## format)
  
  MD051 — Report only (broken link fragments need manual review)
"""

import re
import sys
from pathlib import Path

DOCS_DIR = Path("docs")
IGNORE_DIRS = ["Engineering/Implementation"]

def should_skip(path):
    for ig in IGNORE_DIRS:
        if ig in str(path):
            return True
    return False


def fix_md040(content):
    """Fix fenced code blocks without language by adding 'text'."""
    # Match ``` at start of line, optionally preceded by whitespace,
    # that is NOT followed immediately by a word character (language)
    count = 0
    lines = content.split('\n')
    result = []
    in_code_block = False
    
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('```') and not in_code_block:
            after_marker = stripped[3:]
            # If no language specified and not closing marker
            if not after_marker and not in_code_block:
                line = line + 'text'
                count += 1
            in_code_block = True
        elif stripped.startswith('```'):
            in_code_block = False
        result.append(line)
    
    return '\n'.join(result), count


def fix_md001(content):
    """Fix heading level increments by rebalancing skipped levels."""
    lines = content.split('\n')
    result = []
    prev_level = 0
    in_code_block = False
    count = 0
    
    for line in lines:
        stripped = line.strip()
        
        # Track code blocks
        if stripped.startswith('```'):
            in_code_block = not in_code_block
        
        if not in_code_block and stripped.startswith('#'):
            # Count heading level
            level = 0
            for ch in stripped:
                if ch == '#':
                    level += 1
                else:
                    break
            
            if level > 0:
                # If heading jumps more than 1 level from previous, fix it
                # But only if it's not the first heading (h1)
                if prev_level > 0 and level > prev_level + 1:
                    new_level = prev_level + 1
                    line = line.replace('#' * level, '#' * new_level, 1)
                    count += 1
                    level = new_level
                prev_level = level
        
        result.append(line)
    
    return '\n'.join(result), count


def fix_md056(content):
    """Fix table column count mismatches (add missing cells)."""
    lines = content.split('\n')
    result = []
    in_table = False
    expected_cols = 0
    count = 0
    
    for line in lines:
        stripped = line.strip()
        
        # Detect table start
        if '|' in stripped:
            cells = [c for c in stripped.split('|') if c.strip() or '---' not in line]
            # Check if separator row
            is_separator = all(re.match(r'^:?-+:?$', c.strip()) for c in stripped.split('|') if c.strip())
            
            if is_separator:
                expected_cols = len([c for c in stripped.split('|') if c.strip()])
                in_table = True
            elif in_table and expected_cols > 0:
                actual_cells = [c for c in stripped.split('|') if c.strip()]
                if len(actual_cells) < expected_cols:
                    # Add empty cells
                    diff = expected_cols - len(actual_cells)
                    # Add to the end
                    parts = stripped.split('|')
                    if stripped.endswith('|'):
                        line = stripped + ' |' * diff
                    else:
                        line = stripped + ' |' * diff + ' '
                    count += 1
                elif len(actual_cells) > expected_cols:
                    pass  # Too many cells — skip (harder to fix automatically)
        else:
            in_table = False
            expected_cols = 0
        
        result.append(line)
    
    return '\n'.join(result), count


def fix_md003(content):
    """Fix heading style (ensure consistent atx style)."""
    # This is usually about mixing '#' and '##' vs '#' and old-style underlines
    # Just a tracking function — usually already correct after MD001 fix
    return content, 0


def main():
    md040_fixed = 0
    md001_fixed = 0
    md056_fixed = 0
    
    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        if should_skip(md_file):
            continue
        
        content = md_file.read_text(encoding="utf-8", errors="replace")
        original = content
        file_changed = False
        
        # MD040: Add language to fenced code blocks
        content, c = fix_md040(content)
        if c > 0:
            md040_fixed += c
            file_changed = True
        
        # MD001: Fix heading level increments
        content, c = fix_md001(content)
        if c > 0:
            md001_fixed += c
            file_changed = True
        
        # MD056: Fix table column counts
        content, c = fix_md056(content)
        if c > 0:
            md056_fixed += c
            file_changed = True
        
        # MD003: Fix heading style
        content, c = fix_md003(content)
        if c > 0:
            file_changed = True
        
        if file_changed and content != original:
            md_file.write_text(content, encoding="utf-8")
            print(f"  Fixed: {md_file}")
    
    print(f"\nSummary:")
    print(f"  MD040 (code language): {md040_fixed} fixes")
    print(f"  MD001 (heading levels): {md001_fixed} fixes")
    print(f"  MD056 (table cols): {md056_fixed} fixes")
    
    # Report MD051 (broken link fragments — need manual review)
    print("\n--- MD051: Broken link fragments (manual review needed) ---")
    md051_count = 0
    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        if should_skip(md_file):
            continue
        content = md_file.read_text(encoding="utf-8", errors="replace")
        # Find all #fragment links that reference headings in the same file
        fragments = re.findall(r'\[([^\]]*)\]\(#([^)]+)\)', content)
        for text, fragment in fragments:
            # Check if a heading with matching anchor exists
            anchor_id = fragment.lower().replace(' ', '-').replace('_', '-')
            anchor_id = re.sub(r'[^a-z0-9-]', '', anchor_id)
            # Look for matching heading
            heading_pattern = rf'^#+\s+{re.escape(fragment.replace("-", " ").replace("-", " "))}'
            has_heading = bool(re.search(heading_pattern, content, re.MULTILINE | re.IGNORECASE))
            
            # Also check for {#custom-anchor} pattern
            custom_anchor = re.search(rf'{{#{re.escape(fragment)}}}', content)
            
            if not has_heading and not custom_anchor:
                print(f"  [{md_file}] Broken fragment: #{fragment} (link: '{text}')")
                md051_count += 1
    
    if md051_count == 0:
        print("  No broken fragments found!")
    else:
        print(f"  Total: {md051_count} broken fragment(s)")
    
    # Report MD001 files with heading structure issues still remaining
    print("\n--- Files with MD001 heading issues ---")
    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        if should_skip(md_file):
            continue
        content = md_file.read_text(encoding="utf-8", errors="replace")
        lines = content.split('\n')
        levels = []
        in_code = False
        for line in lines:
            if line.strip().startswith('```'):
                in_code = not in_code
            if not in_code and line.startswith('#'):
                level = len(line.split(' ')[0])
                levels.append((level, line.strip()))
        
        for i in range(1, len(levels)):
            prev_lvl = levels[i-1][0]
            curr_lvl = levels[i][0]
            if curr_lvl > prev_lvl + 1:
                print(f"  [{md_file}] Jump from h{prev_lvl} to h{curr_lvl}: '{levels[i][1]}'")


if __name__ == "__main__":
    main()
