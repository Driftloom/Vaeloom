import html
import secrets
from typing import Any


def fence_untrusted_input(label: str, content: Any, nonce: str | None = None) -> str:
    """Wraps untrusted external data in nonced XML boundary tags with escaping.
    
    Prevents prompt injection by cleanly separating instructions from external data.
    """
    if content is None:
        return f"<{label} nonce=\"{nonce or 'empty'}\">EMPTY</{label}>"
    
    safe_nonce = nonce or secrets.token_hex(4)
    text_content = str(content)
    # Escape existing tags to prevent breakout attacks
    sanitized = text_content.replace(f"</{label}>", f"&lt;/{label}&gt;")
    return f"<{label} nonce=\"{safe_nonce}\">\n{sanitized}\n</{label}>"
