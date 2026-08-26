"""
LaTeX/Tectonic compiler — backend fallback for Overleaf classic templates.

Option B from the spec: Tectonic (Rust, single binary, auto-downloading TeXLive)
compiled in a FastAPI worker. For MVP, this is a mock that delegates to the
existing Playwright HTML pipeline when `tectonic` binary is absent, so the API
never 500s in dev/CI. In prod, install tectonic via:

  cargo install tectonic
  # or apt: sudo apt-get install tectonic

Then this compiler will use the real binary for pixel-perfect TeX typography
(justification, hyphenation, microtype, math).

Hybrid choice (user #1: do which is better) — WASM Typst for 50ms live,
Tectonic for full TeXLive compat when user picks Jake's/Deedy classic .tex.
"""

import asyncio
import logging
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


class LatexCompilerError(Exception):
    pass


class LatexCompiler:
    """Thin wrapper around `tectonic` with HTML fallback."""

    async def compile_to_pdf(self, latex_source: str, filename: str = "resume.tex") -> bytes:
        """Compile LaTeX source to PDF bytes. Falls back to HTML→PDF if tectonic missing."""
        # Try real tectonic first
        try:
            return await asyncio.to_thread(self._tectonic_sync, latex_source, filename)
        except FileNotFoundError as e:
            logger.info(f"tectonic not installed ({e}), falling back to HTML pipeline for {filename}")
            return await self._html_fallback(latex_source)
        except subprocess.CalledProcessError as e:
            # Parse tectonic log for line numbers → surface to Monaco gutter
            log = (e.stderr or b"").decode("utf-8", errors="ignore")[:4000] if isinstance(e.stderr, bytes) else str(e)
            # Try to extract ! LaTeX Error: ... l.42
            import re

            m = re.search(r"l\.(\d+)", log)
            line = f" at line {m.group(1)}" if m else ""
            raise LatexCompilerError(f"LaTeX compile failed{line}: {log[:500]}") from e
        except Exception as e:
            logger.warning(f"latex compile fallback ({e}), using HTML pipeline")
            return await self._html_fallback(latex_source)

    def _tectonic_sync(self, latex_source: str, filename: str) -> bytes:
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_path = Path(tmpdir) / filename
            tex_path.write_text(latex_source, encoding="utf-8")
            # Tectonic auto-downloads packages, compiles to PDF
            result = subprocess.run(
                ["tectonic", "-X", "compile", str(tex_path), "--outdir", tmpdir],
                capture_output=True,
                check=True,
                timeout=15,
            )
            pdf_path = Path(tmpdir) / "resume.pdf"
            if not pdf_path.exists():
                # tectonic may name output after tex file
                pdf_path = Path(tmpdir) / tex_path.with_suffix(".pdf").name
            if not pdf_path.exists():
                raise LatexCompilerError(f"tectonic produced no PDF; stdout: {result.stdout[:500]!r}")
            return pdf_path.read_bytes()

    async def _html_fallback(self, latex_source: str) -> bytes:
        """Fallback: wrap LaTeX source in minimal HTML and render via Playwright."""
        # Escape LaTeX → HTML: very small, just preserve line breaks and escape <>&
        import html as _html

        escaped = _html.escape(latex_source)
        # Keep \commands readable in fallback PDF
        html = f"""<!DOCTYPE html><html><head><meta charset='utf-8'><style>
          @page {{ size: A4; margin: 14mm 16mm; }}
          body {{ font-family: 'Courier New', monospace; font-size: 9pt; line-height: 1.45; white-space: pre-wrap; color: #1a1a1a; }}
          .fallback-note {{ background: #fef3c7; border: 1px solid #f59e0b; padding: 6pt 8pt; margin-bottom: 10pt; font-family: sans-serif; font-size: 8pt; }}
        </style></head><body>
        <div class='fallback-note'>⚠️ LaTeX fallback preview — install <code>tectonic</code> for pixel-perfect TeX typography. Showing source as monospaced.</div>
        <pre>{escaped[:20000]}</pre></body></html>"""
        from .document_builder import document_builder

        # Use document_builder's internal HTML→PDF path (compile_resume does HTML→PDF via Playwright)
        # For fallback we can directly call its Playwright manager
        from .document_builder import playwright_manager

        return await playwright_manager.render_pdf(html)

    def parse_log(self, log: str) -> list[dict]:
        """Parse tectonic/latex log into Monaco markers: {line, severity, message}."""
        import re

        markers: list[dict] = []
        for line in log.splitlines():
            # ! LaTeX Error: ...  or ! Undefined control sequence. l.42
            m = re.search(r"!\s*(.+)", line)
            if m:
                msg = m.group(1).strip()
                lm = re.search(r"l\.(\d+)", line)
                markers.append({"line": int(lm.group(1)) if lm else 1, "severity": "error", "message": msg[:300]})
            elif "Warning" in line and "l." in line:
                lm = re.search(r"l\.(\d+)", line)
                markers.append({"line": int(lm.group(1)) if lm else 1, "severity": "warning", "message": line.strip()[:300]})
        return markers[:20]


latex_compiler = LatexCompiler()
