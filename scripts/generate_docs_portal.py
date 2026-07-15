#!/usr/bin/env python3
"""
Meridian Documentation Portal Generator
Reads all markdown files from docs/ and generates a single self-contained HTML file
with sidebar navigation, full-text search, dark mode, and Mermaid diagram support.
"""

import os
import sys
import json
import re
import hashlib
from pathlib import Path

DOCS_DIR = Path("docs")
OUTPUT_FILE = Path("docs-portal.html")

# Categories and their display names / icons
CATEGORIES = [
    ("Product", "📋"),
    ("Architecture", "🏗️"),
    ("Frontend", "🎨"),
    ("Backend", "⚙️"),
    ("AI", "🤖"),
    ("Database", "🗄️"),
    ("Security", "🔒"),
    ("DevOps", "🚀"),
    ("Testing", "🧪"),
    ("Engineering", "🔧"),
    ("Operations", "📊"),
    ("Developer_Experience", "💻"),
    ("Project", "📁"),
    ("Enterprise", "🏢"),
    ("Build_Prompts", "📝"),
]

# Files at root level (not in a category folder)
ROOT_DOCS_PREFIX = "Root"

def categorize_file(rel_path: str) -> tuple:
    """Returns (category_name, display_name) for a file path."""
    parts = rel_path.replace("\\", "/").split("/")
    
    for cat_name, icon in CATEGORIES:
        if parts[0] == cat_name:
            display_name = os.path.splitext(parts[-1])[0]
            # Clean up display name
            display_name = display_name.replace("-", " ").replace("_", " ")
            display_name = display_name.title()
            return cat_name, display_name, icon
    
    # Root-level docs
    name = os.path.splitext(parts[-1])[0]
    name = name.replace("-", " ").replace("_", " ")
    name = name.title()
    return "Root", name, "📄"


def read_markdown_files():
    """Read all markdown files and return structured data."""
    docs = []
    
    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        rel_path = str(md_file.relative_to(DOCS_DIR)).replace("\\", "/")
        
        # Skip README.md files in the root (they're category indexes)
        # Include them anyway for completeness
        
        try:
            content = md_file.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            print(f"  ⚠ Error reading {rel_path}: {e}")
            content = f"# Error Loading Document\n\nCould not read `{rel_path}`."
        
        cat, display_name, icon = categorize_file(rel_path)
        
        # Extract title from markdown
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else display_name
        
        # Extract first paragraph as description
        desc_match = re.search(r'^(.+?)\n\n', content.replace('#', '', 1), re.MULTILINE)
        description = desc_match.group(1).strip()[:200] if desc_match else ""
        
        # Clean description of markdown
        description = re.sub(r'[#*`>\[\]]', '', description).strip()
        
        docs.append({
            "path": rel_path,
            "category": cat,
            "icon": icon,
            "title": title,
            "displayName": display_name,
            "description": description,
            "content": content,
        })
    
    return docs


def group_by_category(docs):
    """Group docs by category, maintaining order."""
    groups = []
    seen_cats = set()
    
    for cat_name, icon in CATEGORIES:
        cat_docs = [d for d in docs if d["category"] == cat_name]
        if cat_docs:
            groups.append({
                "name": cat_name.replace("_", " ").title(),
                "icon": icon,
                "docs": cat_docs,
            })
            seen_cats.add(cat_name)
    
    # Root-level docs
    root_docs = [d for d in docs if d["category"] == "Root"]
    if root_docs:
        groups.append({
            "name": "Other Documents",
            "icon": "📄",
            "docs": root_docs,
        })
    
    return groups


def escape_js_string(s: str) -> str:
    """Escape a string for embedding in JavaScript."""
    s = s.replace("\\", "\\\\")
    s = s.replace("'", "\\'")
    s = s.replace("\n", "\\n")
    s = s.replace("\r", "\\r")
    s = s.replace("</script>", "<\\/script>")
    return s


def generate_html(docs_by_cat):
    """Generate the complete HTML file."""
    
    # Prepare the JSON data for embedded docs
    all_docs_flat = []
    for group in docs_by_cat:
        for doc in group["docs"]:
            all_docs_flat.append({
                "path": doc["path"],
                "cat": doc["category"],
                "icon": doc["icon"],
                "title": doc["title"],
                "desc": doc["description"],
                "content": doc["content"],
            })
    
    docs_json = json.dumps(all_docs_flat, ensure_ascii=False)
    groups_json = json.dumps([
        {"name": g["name"], "icon": g["icon"], 
         "docs": [{"path": d["path"], "title": d["title"], "desc": d["description"]} 
                  for d in g["docs"]]}
        for g in docs_by_cat
    ], ensure_ascii=False)
    
    html = f"""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Meridian Documentation Portal</title>

<!-- Libraries from CDN -->
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

<style>
  /* ===== CSS Variables / Theming ===== */
  :root {{
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-tertiary: #e9ecef;
    --bg-sidebar: #1a1d23;
    --bg-sidebar-hover: #2a2d35;
    --bg-sidebar-active: #3a3d45;
    --text-primary: #1a1d23;
    --text-secondary: #495057;
    --text-muted: #868e96;
    --text-sidebar: #c8ccd4;
    --text-sidebar-active: #ffffff;
    --border-color: #dee2e6;
    --accent: #4f8cff;
    --accent-hover: #3a7bff;
    --accent-light: #e8f0ff;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
    --code-bg: #f1f3f5;
    --code-text: #d63384;
    --mermaid-bg: #ffffff;
    --scrollbar-bg: #e9ecef;
    --scrollbar-thumb: #adb5bd;
    --transition-speed: 0.2s;
  }}

  [data-theme="dark"] {{
    --bg-primary: #1a1d23;
    --bg-secondary: #212529;
    --bg-tertiary: #2a2d35;
    --bg-sidebar: #111318;
    --bg-sidebar-hover: #1f2229;
    --bg-sidebar-active: #2a2d35;
    --text-primary: #e9ecef;
    --text-secondary: #adb5bd;
    --text-muted: #6c757d;
    --text-sidebar: #9ca3af;
    --text-sidebar-active: #ffffff;
    --border-color: #343a40;
    --accent: #5b9bff;
    --accent-hover: #4a8aff;
    --accent-light: #1a2744;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
    --code-bg: #2a2d35;
    --code-text: #ff79c6;
    --mermaid-bg: #1a1d23;
    --scrollbar-bg: #2a2d35;
    --scrollbar-thumb: #495057;
  }}

  /* ===== Reset & Base ===== */
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  
  html {{ font-size: 16px; scroll-behavior: smooth; }}
  
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: var(--text-primary);
    background: var(--bg-primary);
    display: flex;
    height: 100vh;
    overflow: hidden;
    transition: background var(--transition-speed), color var(--transition-speed);
  }}

  /* ===== Scrollbar ===== */
  ::-webkit-scrollbar {{ width: 6px; height: 6px; }}
  ::-webkit-scrollbar-track {{ background: transparent; }}
  ::-webkit-scrollbar-thumb {{ background: var(--scrollbar-thumb); border-radius: 3px; }}
  ::-webkit-scrollbar-thumb:hover {{ background: var(--text-muted); }}

  /* ===== Sidebar ===== */
  #sidebar {{
    width: 300px;
    min-width: 300px;
    height: 100vh;
    background: var(--bg-sidebar);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    z-index: 100;
    transition: width var(--transition-speed);
  }}

  #sidebar.collapsed {{
    width: 0;
    min-width: 0;
  }}

  .sidebar-header {{
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  }}

  .sidebar-header h1 {{
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
  }}

  .sidebar-header .subtitle {{
    font-size: 11px;
    color: var(--text-sidebar);
    margin-top: 2px;
    opacity: 0.6;
  }}

  #search-container {{
    padding: 12px 16px;
    flex-shrink: 0;
  }}

  #search-input {{
    width: 100%;
    padding: 8px 12px 8px 36px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: var(--bg-sidebar-hover);
    color: #ffffff;
    font-size: 13px;
    outline: none;
    transition: border-color var(--transition-speed);
  }}

  #search-input::placeholder {{ color: var(--text-sidebar); opacity: 0.5; }}
  #search-input:focus {{ border-color: var(--accent); }}

  .search-icon {{
    position: absolute;
    left: 28px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-sidebar);
    opacity: 0.5;
    font-size: 14px;
    pointer-events: none;
  }}

  #search-results {{
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-sidebar);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 200;
    box-shadow: var(--shadow-lg);
  }}

  #search-results.visible {{ display: block; }}

  .search-result-item {{
    padding: 10px 16px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background var(--transition-speed);
  }}

  .search-result-item:hover {{
    background: var(--bg-sidebar-hover);
  }}

  .search-result-item .result-title {{
    font-size: 13px;
    color: #ffffff;
    font-weight: 600;
  }}

  .search-result-item .result-cat {{
    font-size: 11px;
    color: var(--accent);
    margin-top: 2px;
  }}

  .search-result-item .result-excerpt {{
    font-size: 11px;
    color: var(--text-sidebar);
    margin-top: 2px;
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }}

  #nav-container {{
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 0;
  }}

  .nav-category {{
    margin-bottom: 2px;
  }}

  .nav-category-header {{
    display: flex;
    align-items: center;
    padding: 8px 20px;
    cursor: pointer;
    color: var(--text-sidebar);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: background var(--transition-speed), color var(--transition-speed);
    user-select: none;
  }}

  .nav-category-header:hover {{
    background: var(--bg-sidebar-hover);
    color: #ffffff;
  }}

  .nav-category-header .cat-icon {{
    margin-right: 8px;
    font-size: 14px;
  }}

  .nav-category-header .cat-count {{
    margin-left: auto;
    font-size: 10px;
    opacity: 0.4;
  }}

  .nav-category-header .chevron {{
    margin-left: 6px;
    font-size: 10px;
    transition: transform var(--transition-speed);
    opacity: 0.5;
  }}

  .nav-category-header .chevron.open {{
    transform: rotate(90deg);
  }}

  .nav-docs {{
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.3s ease;
  }}

  .nav-docs.open {{
    max-height: 9999px;
  }}

  .nav-doc {{
    display: block;
    padding: 6px 20px 6px 48px;
    color: var(--text-sidebar);
    font-size: 13px;
    text-decoration: none;
    cursor: pointer;
    transition: background var(--transition-speed), color var(--transition-speed);
    border-left: 2px solid transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}

  .nav-doc:hover {{
    background: var(--bg-sidebar-hover);
    color: var(--text-sidebar-active);
  }}

  .nav-doc.active {{
    background: var(--bg-sidebar-active);
    color: var(--text-sidebar-active);
    border-left-color: var(--accent);
  }}

  /* ===== Main Content ===== */
  #main {{
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }}

  #toolbar {{
    display: flex;
    align-items: center;
    padding: 10px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);
    flex-shrink: 0;
    gap: 12px;
    transition: background var(--transition-speed);
  }}

  #sidebar-toggle {{
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background var(--transition-speed);
  }}

  #sidebar-toggle:hover {{
    background: var(--bg-tertiary);
  }}

  #breadcrumb {{
    font-size: 13px;
    color: var(--text-secondary);
    flex: 1;
  }}

  #breadcrumb .bc-cat {{ color: var(--accent); }}
  #breadcrumb .bc-doc {{ color: var(--text-primary); font-weight: 500; }}

  .toolbar-actions {{
    display: flex;
    gap: 8px;
    align-items: center;
  }}

  #theme-toggle {{
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    transition: all var(--transition-speed);
    display: flex;
    align-items: center;
    gap: 6px;
  }}

  #theme-toggle:hover {{
    background: var(--bg-tertiary);
    border-color: var(--accent);
  }}

  #content-area {{
    flex: 1;
    overflow-y: auto;
    padding: 32px 48px;
    transition: background var(--transition-speed);
  }}

  /* ===== Welcome Screen ===== */
  #welcome {{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-secondary);
  }}

  #welcome .welcome-icon {{ font-size: 64px; margin-bottom: 16px; }}
  #welcome h2 {{ font-size: 28px; color: var(--text-primary); margin-bottom: 8px; }}
  #welcome p {{ font-size: 15px; max-width: 480px; line-height: 1.6; }}
  #welcome .welcome-stats {{ margin-top: 24px; display: flex; gap: 32px; }}
  #welcome .stat {{ text-align: center; }}
  #welcome .stat-num {{ font-size: 24px; font-weight: 700; color: var(--accent); }}
  #welcome .stat-label {{ font-size: 12px; color: var(--text-muted); margin-top: 2px; }}

  /* ===== Document Content ===== */
  #document {{
    display: none;
    max-width: 900px;
    margin: 0 auto;
  }}

  #document.visible {{ display: block; }}

  #document .doc-header {{
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
  }}

  #document .doc-header .doc-meta {{
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
  }}

  #document .doc-header .doc-category {{
    background: var(--accent-light);
    color: var(--accent);
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 600;
  }}

  #document .doc-header .doc-path {{
    color: var(--text-muted);
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 11px;
  }}

  #document .doc-header h1 {{
    font-size: 32px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--text-primary);
  }}

  /* ===== Markdown Content Styling ===== */
  .markdown-body {{
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-primary);
  }}

  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4,
  .markdown-body h5,
  .markdown-body h6 {{
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
  }}

  .markdown-body h1 {{ font-size: 1.8em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }}
  .markdown-body h2 {{ font-size: 1.4em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.2em; }}
  .markdown-body h3 {{ font-size: 1.2em; }}
  .markdown-body h4 {{ font-size: 1.05em; }}

  .markdown-body p {{ margin-bottom: 1em; }}
  .markdown-body p:last-child {{ margin-bottom: 0; }}

  .markdown-body a {{
    color: var(--accent);
    text-decoration: none;
  }}

  .markdown-body a:hover {{
    text-decoration: underline;
  }}

  .markdown-body strong {{ font-weight: 600; }}

  .markdown-body code {{
    background: var(--code-bg);
    color: var(--code-text);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
    font-size: 0.9em;
  }}

  .markdown-body pre {{
    background: var(--code-bg);
    padding: 16px 20px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 1em;
    border: 1px solid var(--border-color);
  }}

  .markdown-body pre code {{
    background: none;
    color: var(--text-primary);
    padding: 0;
    font-size: 13px;
    line-height: 1.5;
  }}

  .markdown-body blockquote {{
    border-left: 4px solid var(--accent);
    padding: 8px 16px;
    margin: 1em 0;
    background: var(--bg-secondary);
    border-radius: 0 8px 8px 0;
    color: var(--text-secondary);
  }}

  .markdown-body ul,
  .markdown-body ol {{
    padding-left: 1.5em;
    margin-bottom: 1em;
  }}

  .markdown-body li {{ margin-bottom: 0.25em; }}

  .markdown-body table {{
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 14px;
  }}

  .markdown-body th,
  .markdown-body td {{
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    text-align: left;
  }}

  .markdown-body th {{
    background: var(--bg-secondary);
    font-weight: 600;
    color: var(--text-primary);
  }}

  .markdown-body td {{ color: var(--text-secondary); }}

  .markdown-body tr:nth-child(even) td {{
    background: var(--bg-secondary);
  }}

  .markdown-body hr {{
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 1.5em 0;
  }}

  .markdown-body img {{
    max-width: 100%;
    border-radius: 8px;
  }}

  /* Mermaid diagram containers */
  .mermaid {{
    background: var(--mermaid-bg);
    padding: 16px;
    border-radius: 8px;
    margin: 1em 0;
    text-align: center;
    border: 1px solid var(--border-color);
  }}

  /* ===== Loading State ===== */
  #loading {{
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
  }}

  .spinner {{
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }}

  @keyframes spin {{ to {{ transform: rotate(360deg); }} }}

  /* ===== Responsive ===== */
  @media (max-width: 768px) {{
    #sidebar {{
      width: 0;
      min-width: 0;
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      z-index: 1000;
      transition: width var(--transition-speed);
    }}

    #sidebar.mobile-open {{
      width: 300px;
      min-width: 300px;
      box-shadow: var(--shadow-lg);
    }}

    #content-area {{
      padding: 16px 20px;
    }}

    #document .doc-header h1 {{ font-size: 24px; }}
  }}

  /* ===== Toast ===== */
  #toast {{
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--bg-sidebar);
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 13px;
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.3s, transform 0.3s;
    pointer-events: none;
    z-index: 9999;
  }}

  #toast.show {{
    opacity: 1;
    transform: translateY(0);
  }}
</style>
</head>
<body>

<!-- ===== Sidebar ===== -->
<aside id="sidebar">
  <div class="sidebar-header">
    <h1>📖 Meridian Docs</h1>
    <div class="subtitle">Documentation Portal</div>
  </div>

  <div id="search-container" style="position:relative">
    <span class="search-icon">🔍</span>
    <input type="text" id="search-input" placeholder="Search documents..." autocomplete="off">
    <div id="search-results"></div>
  </div>

  <nav id="nav-container"></nav>
</aside>

<!-- ===== Main Content ===== -->
<div id="main">
  <div id="toolbar">
    <button id="sidebar-toggle" title="Toggle sidebar">☰</button>
    <div id="breadcrumb">
      <span class="bc-cat" id="bc-cat">Documentation</span>
      <span id="bc-sep" style="display:none"> / </span>
      <span class="bc-doc" id="bc-doc"></span>
    </div>
    <div class="toolbar-actions">
      <button id="theme-toggle" title="Toggle dark mode">🌙 Dark</button>
    </div>
  </div>

  <div id="content-area">
    <div id="loading"><div class="spinner"></div></div>
    <div id="welcome">
      <div class="welcome-icon">📚</div>
      <h2>Meridian Documentation</h2>
      <p>Select a document from the sidebar to begin reading. Use the search bar to find documents by title or content.</p>
      <div class="welcome-stats">
        <div class="stat">
          <div class="stat-num" id="stat-docs">0</div>
          <div class="stat-label">Documents</div>
        </div>
        <div class="stat">
          <div class="stat-num" id="stat-cats">0</div>
          <div class="stat-label">Categories</div>
        </div>
        <div class="stat">
          <div class="stat-num" id="stat-words">0</div>
          <div class="stat-label">Total Words</div>
        </div>
      </div>
    </div>
    <div id="document"></div>
  </div>
</div>

<!-- ===== Toast ===== -->
<div id="toast"></div>

<script>
// ===== EMBEDDED DOCUMENT DATA =====
const DOCS_DATA = {docs_json};

const CATEGORIES_DATA = {groups_json};

// ===== State =====
let currentDocIndex = -1;
let filteredDocs = null;
let currentTheme = localStorage.getItem('meridian-theme') || 'light';
let sidebarOpen = window.innerWidth > 768;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {{
  initTheme();
  buildSidebar();
  buildWelcome();
  initSearch();
  initSidebarToggle();
  document.getElementById('loading').style.display = 'none';

  // Check for hash on load
  if (window.location.hash) {{
    const path = decodeURIComponent(window.location.hash.substring(1));
    const idx = DOCS_DATA.findIndex(d => d.path === path);
    if (idx >= 0) openDoc(idx);
  }}

  // Handle hash changes
  window.addEventListener('hashchange', () => {{
    const path = decodeURIComponent(window.location.hash.substring(1));
    const idx = DOCS_DATA.findIndex(d => d.path === path);
    if (idx >= 0) openDoc(idx);
  }});
}});

// ===== Theme =====
function initTheme() {{
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.getElementById('theme-toggle').innerHTML = 
    currentTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
}}

document.getElementById('theme-toggle').addEventListener('click', () => {{
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('meridian-theme', currentTheme);
  document.getElementById('theme-toggle').innerHTML = 
    currentTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
  
  // Re-render only the content area so mermaid diagrams get the new theme
  // (mermaid.run() can't re-theme already-rendered SVGs; re-creating the DOM fixes this)
  if (currentDocIndex >= 0) reRenderContent(DOCS_DATA[currentDocIndex]);
}});

// ===== Sidebar =====
function buildSidebar() {{
  const nav = document.getElementById('nav-container');
  nav.innerHTML = '';

  CATEGORIES_DATA.forEach((cat, catIdx) => {{
    const catEl = document.createElement('div');
    catEl.className = 'nav-category';

    const header = document.createElement('div');
    header.className = 'nav-category-header';
    header.innerHTML = `
      <span class="cat-icon">${{cat.icon}}</span>
      ${{cat.name}}
      <span class="cat-count">${{cat.docs.length}}</span>
      <span class="chevron open">▶</span>
    `;
    header.addEventListener('click', () => {{
      const docsEl = catEl.querySelector('.nav-docs');
      const chevron = header.querySelector('.chevron');
      docsEl.classList.toggle('open');
      chevron.classList.toggle('open');
    }});

    const docsEl = document.createElement('div');
    docsEl.className = 'nav-docs open';

    cat.docs.forEach((doc, docIdx) => {{
      const a = document.createElement('a');
      a.className = 'nav-doc';
      a.textContent = doc.title;
      a.title = doc.desc || doc.title;
      a.dataset.path = doc.path;

      // Find global index
      const globalIdx = DOCS_DATA.findIndex(d => d.path === doc.path);
      a.dataset.index = globalIdx;

      a.addEventListener('click', (e) => {{
        e.preventDefault();
        openDoc(parseInt(a.dataset.index));
      }});

      docsEl.appendChild(a);
    }});

    catEl.appendChild(header);
    catEl.appendChild(docsEl);
    nav.appendChild(catEl);
  }});
}}

function updateActiveNav(index) {{
  document.querySelectorAll('.nav-doc').forEach(el => el.classList.remove('active'));
  if (index >= 0) {{
    const doc = DOCS_DATA[index];
    const el = document.querySelector(`.nav-doc[data-path="${{doc.path}}"]`);
    if (el) {{
      el.classList.add('active');
      // Ensure parent category is visible
      const parentDocs = el.closest('.nav-docs');
      if (parentDocs) parentDocs.classList.add('open');
    }}
  }}
}}

function initSidebarToggle() {{
  document.getElementById('sidebar-toggle').addEventListener('click', () => {{
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {{
      sidebar.classList.toggle('mobile-open');
    }} else {{
      sidebar.classList.toggle('collapsed');
    }}
  }});
}}

// ===== Welcome =====
function buildWelcome() {{
  document.getElementById('stat-docs').textContent = DOCS_DATA.length;
  document.getElementById('stat-cats').textContent = CATEGORIES_DATA.length;
  const totalWords = DOCS_DATA.reduce((sum, d) => sum + (d.content || '').split(/\\s+/).length, 0);
  document.getElementById('stat-words').textContent = totalWords.toLocaleString();
}}

// ===== Search =====
function initSearch() {{
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  input.addEventListener('input', () => {{
    const query = input.value.trim().toLowerCase();
    if (!query) {{
      results.classList.remove('visible');
      results.innerHTML = '';
      return;
    }}

    // Search titles and content
    const matches = [];
    DOCS_DATA.forEach((doc, idx) => {{
      const titleLower = doc.title.toLowerCase();
      const contentLower = (doc.content || '').toLowerCase();
      
      let score = 0;
      if (titleLower === query) score = 100;
      else if (titleLower.startsWith(query)) score = 80;
      else if (titleLower.includes(query)) score = 60;
      else if (contentLower.includes(query)) {{
        score = 30;
        // Find context
        const pos = contentLower.indexOf(query);
        const start = Math.max(0, pos - 40);
        const end = Math.min(contentLower.length, pos + query.length + 40);
        let excerpt = doc.content.substring(start, end).replace(/\\n/g, ' ');
        if (start > 0) excerpt = '...' + excerpt;
        if (end < doc.content.length) excerpt = excerpt + '...';
        matches.push({{ idx, score, excerpt }});
        return;
      }}
      
      if (score > 0) matches.push({{ idx, score, excerpt: doc.desc }});
    }});

    // Sort by score
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 20);

    if (topMatches.length === 0) {{
      results.innerHTML = '<div class="search-result-item" style="color:var(--text-sidebar);opacity:0.5">No results found</div>';
      results.classList.add('visible');
      return;
    }}

    results.innerHTML = topMatches.map(m => {{
      const doc = DOCS_DATA[m.idx];
      const catInfo = CATEGORIES_DATA.find(c => c.docs.some(d => d.path === doc.path));
      const catName = catInfo ? `${{catInfo.icon}} ${{catInfo.name}}` : '';
      return `
        <div class="search-result-item" data-index="${{m.idx}}">
          <div class="result-title">${{doc.title}}</div>
          <div class="result-cat">${{catName}}</div>
          <div class="result-excerpt">${{m.excerpt || ''}}</div>
        </div>
      `;
    }}).join('');
    results.classList.add('visible');

    // Click handlers
    results.querySelectorAll('.search-result-item').forEach(el => {{
      el.addEventListener('click', () => {{
        const idx = parseInt(el.dataset.index);
        openDoc(idx);
        results.classList.remove('visible');
        input.value = '';
      }});
    }});
  }});

  // Close search on escape or click outside
  document.addEventListener('click', (e) => {{
    if (!e.target.closest('#search-container')) {{
      results.classList.remove('visible');
    }}
  }});

  input.addEventListener('keydown', (e) => {{
    if (e.key === 'Escape') {{
      results.classList.remove('visible');
      input.blur();
    }}
    if (e.key === 'Enter') {{
      const firstResult = results.querySelector('.search-result-item');
      if (firstResult) {{
        firstResult.click();
      }}
    }}
  }});
}}

// ===== Open Document =====
function openDoc(index) {{
  if (index < 0 || index >= DOCS_DATA.length) return;
  
  currentDocIndex = index;
  const doc = DOCS_DATA[index];
  
  document.getElementById('welcome').style.display = 'none';
  document.getElementById('document').className = 'visible';
  
  // Update breadcrumb
  const catInfo = CATEGORIES_DATA.find(c => c.docs.some(d => d.path === doc.path));
  document.getElementById('bc-cat').textContent = catInfo ? `${{catInfo.icon}} ${{catInfo.name}}` : 'Docs';
  document.getElementById('bc-doc').textContent = doc.title;
  document.getElementById('bc-sep').style.display = 'inline';
  
  // Update sidebar
  updateActiveNav(index);
  
  // Update URL hash
  window.location.hash = doc.path;
  
  // Render document
  renderDoc(doc);
  
  // Close mobile sidebar
  if (window.innerWidth <= 768) {{
    document.getElementById('sidebar').classList.remove('mobile-open');
  }}

  // Show toast
  showToast(`Opened: ${{doc.title}}`);
}}

function renderDoc(doc) {{
  const container = document.getElementById('document');
  
  // Detect if content has mermaid blocks
  const hasMermaid = doc.content && doc.content.includes('```mermaid');
  
  // Render markdown
  let html = '';
  try {{
    html = marked.parse(doc.content || '');
  }} catch(e) {{
    html = `<p>Error rendering document: ${{e.message}}</p>`;
  }}
  
  // Add header meta
  const catInfo = CATEGORIES_DATA.find(c => c.docs.some(d => d.path === doc.path));
  const catName = catInfo ? catInfo.name : 'Uncategorized';
  const catIcon = catInfo ? catInfo.icon : '📄';
  
  container.innerHTML = `
    <div class="doc-header">
      <div class="doc-meta">
        <span class="doc-category">${{catIcon}} ${{catName}}</span>
        <span class="doc-path">${{doc.path}}</span>
      </div>
      <h1>${{marked.parse(doc.title)}}</h1>
    </div>
    <div class="markdown-body">${{html}}</div>
  `;
  
  // Render mermaid diagrams
  if (hasMermaid) renderMermaid();
  
  // Scroll to top
  document.getElementById('content-area').scrollTop = 0;
}}

/**
 * Re-render content only — used when theme changes.
 * Unlike renderDoc(), this preserves scroll position and doesn't show toasts
 * or update navigation elements.
 */
function reRenderContent(doc) {{
  const container = document.getElementById('document');
  if (!container || container.style.display === 'none') return;
  
  // Save scroll position
  const contentArea = document.getElementById('content-area');
  const scrollPos = contentArea.scrollTop;
  
  // Re-render markdown
  let html = '';
  try {{
    html = marked.parse(doc.content || '');
  }} catch(e) {{
    html = `<p>Error rendering document: ${{e.message}}</p>`;
  }}
  
  // Replace only the markdown body, keep header intact
  const bodyEl = container.querySelector('.markdown-body');
  if (bodyEl) {{
    bodyEl.innerHTML = html;
  }}
  
  // Render mermaid with new theme
  const hasMermaid = doc.content && doc.content.includes('```mermaid');
  if (hasMermaid) renderMermaid();
  
  // Restore scroll position
  contentArea.scrollTop = scrollPos;
}}

var _mermaidRetries = 0;

function renderMermaid() {{
  try {{
    _mermaidRetries = 0;
    mermaid.run({{
      querySelector: '.mermaid',
      theme: currentTheme === 'dark' ? 'dark' : 'default',
    }});
  }} catch(e) {{
    if (_mermaidRetries++ < 5) {{
      setTimeout(() => renderMermaid(), 500);
    }}
  }}
}}

// ===== Toast =====
function showToast(msg) {{
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2000);
}}

// Handle window resize for sidebar
window.addEventListener('resize', () => {{
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth > 768) {{
    sidebar.classList.remove('mobile-open');
  }}
}});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {{
  // Ctrl/Cmd + K -> Focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {{
    e.preventDefault();
    document.getElementById('search-input').focus();
  }}
}});
</script>
</body>
</html>
"""
    
    return html


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    print("[...] Generating Meridian Documentation Portal...")
    print(f"  Scanning {DOCS_DIR} for markdown files...")
    
    docs = read_markdown_files()
    print(f"  Found {len(docs)} documents")
    
    docs_by_cat = group_by_category(docs)
    print(f"  Organized into {len(docs_by_cat)} categories")
    
    for group in docs_by_cat:
        print(f"    [{group['icon']}] {group['name']}: {len(group['docs'])} docs")
    
    print("\n  Generating HTML...")
    html = generate_html(docs_by_cat)
    
    OUTPUT_FILE.write_text(html, encoding="utf-8")
    
    file_size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\n[OK] Portal generated: {OUTPUT_FILE}")
    print(f"   Size: {file_size_mb:.2f} MB")
    print(f"   Documents: {len(docs)}")
    print(f"   Categories: {len(docs_by_cat)}")
    print("\nOpen docs-portal.html in your browser to view.")


if __name__ == "__main__":
    main()
