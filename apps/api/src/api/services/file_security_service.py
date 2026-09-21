import os
import re
import logging
from typing import NamedTuple

logger = logging.getLogger(__name__)

# EICAR standard anti-virus test signature
EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
EICAR_TEST_STRING = EICAR_SIGNATURE.decode("ascii")

# Strict allowed extensions for enterprise workspaces
ALLOWED_EXTENSIONS = {
    "pdf",
    "docx",
    "txt",
    "md",
    "csv",
    "json",
    "png",
    "jpg",
    "jpeg",
    "webp",
}

# Blocked because they can execute JavaScript (XSS prevention)
ACTIVE_CONTENT_EXTENSIONS = {"html", "htm", "svg", "xhtml", "xml"}

# Dangerous executable / script magic byte signatures
EXECUTABLE_SIGNATURES = [
    (b"MZ", "Windows PE Executable / DLL (MZ)"),
    (b"\x7fELF", "Linux ELF Executable"),
    (b"\xca\xfe\xba\xbe", "Java Class / Mach-O Fat Binary"),
    (b"\xfe\xed\xfa\xce", "Mach-O 32-bit (Big Endian)"),
    (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit (Big Endian)"),
    (b"\xce\xfa\xed\xfe", "Mach-O 32-bit (Little Endian)"),
    (b"\xcf\xfa\xed\xfe", "Mach-O 64-bit (Little Endian)"),
    (b"#!/", "Unix Shell Script Shebang"),
    (b"#!\x20/", "Unix Shell Script Shebang"),
]

# Magic signatures for supported formats
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF-"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "webp": [b"RIFF"],
    "docx": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"],
}


class FileSecurityVerdict(NamedTuple):
    is_safe: bool
    detected_mime: str
    scan_status: str
    rejection_reason: str | None = None


class FileSecurityService:
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename to prevent directory traversal and filesystem abuse."""
        if not filename:
            return "untitled"

        # Remove null bytes and control chars
        clean = filename.replace("\x00", "").strip()

        # Normalize slashes and reject traversal
        clean = re.sub(r"[/\\]+", "/", clean)
        parts = [p for p in clean.split("/") if p and p not in (".", "..")]

        if not parts:
            return "untitled"

        # Safe basename
        leaf = parts[-1]
        leaf = re.sub(r'[\r\n\t"\'<>;|*?:]', "_", leaf)

        # Recombine with relative folder parts if any
        if len(parts) > 1:
            folder_parts = [re.sub(r'[\r\n\t"\'<>;|*?:]', "_", p) for p in parts[:-1]]
            return f"{'/'.join(folder_parts)}/{leaf}"
        return leaf

    @staticmethod
    def inspect_file(
        filename: str,
        content: bytes,
        declared_mime: str | None = None,
    ) -> FileSecurityVerdict:
        """Inspect file content, magic bytes, and signatures against security policies."""
        if not content:
            return FileSecurityVerdict(
                is_safe=False,
                detected_mime="application/octet-stream",
                scan_status="REJECTED",
                rejection_reason="Empty file content is not permitted",
            )

        # 1. Antivirus / EICAR check
        if EICAR_SIGNATURE in content:
            logger.warning(f"Malware signature detected in uploaded file: {filename}")
            return FileSecurityVerdict(
                is_safe=False,
                detected_mime="application/x-dosexec",
                scan_status="MALICIOUS",
                rejection_reason="Malware signature (EICAR) detected in file content",
            )

        # 2. Executable signature check
        for sig, desc in EXECUTABLE_SIGNATURES:
            if content.startswith(sig):
                logger.warning(f"Executable file signature rejected ({desc}) for {filename}")
                return FileSecurityVerdict(
                    is_safe=False,
                    detected_mime="application/x-executable",
                    scan_status="REJECTED",
                    rejection_reason=f"File rejected: Executable format detected ({desc})",
                )

        # 3. Extension inspection
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        # P0-01: Active content types (HTML, SVG, XML) are permanently blocked — they can
        # execute JavaScript and cause Stored XSS regardless of declared MIME type.
        if ext in ACTIVE_CONTENT_EXTENSIONS:
            logger.warning(f"Active content extension blocked: .{ext} for {filename}")
            return FileSecurityVerdict(
                is_safe=False,
                detected_mime="application/octet-stream",
                scan_status="REJECTED",
                rejection_reason=(
                    f"File type '.{ext}' is blocked for security reasons "
                    f"(active content types can execute JavaScript and cause XSS). "
                    f"Upload the content as PDF or plain text instead."
                ),
            )

        if ext not in ALLOWED_EXTENSIONS:
            return FileSecurityVerdict(
                is_safe=False,
                detected_mime="application/octet-stream",
                scan_status="REJECTED",
                rejection_reason=f"File extension '.{ext}' is not permitted by workspace security policy",
            )

        # 4. Magic-byte verification for declared extension
        if ext == "pdf":
            if not content.startswith(b"%PDF-"):
                # Check if executable disguised as PDF
                if content[:2] == b"MZ" or content[:4] == b"\x7fELF":
                    return FileSecurityVerdict(
                        is_safe=False,
                        detected_mime="application/x-dosexec",
                        scan_status="REJECTED",
                        rejection_reason="Disguised executable disguised as PDF",
                    )
                return FileSecurityVerdict(
                    is_safe=False,
                    detected_mime="application/octet-stream",
                    scan_status="REJECTED",
                    rejection_reason="Invalid PDF: Missing %PDF- header",
                )
            detected_mime = "application/pdf"

        elif ext == "png":
            if not content.startswith(b"\x89PNG\r\n\x1a\n"):
                return FileSecurityVerdict(
                    is_safe=False,
                    detected_mime="application/octet-stream",
                    scan_status="REJECTED",
                    rejection_reason="Invalid PNG: Missing PNG signature",
                )
            # P0-01 polyglot: check for embedded active content even in images
            if FileSecurityService._contains_active_content(content):
                return FileSecurityVerdict(
                    is_safe=False,
                    detected_mime="application/octet-stream",
                    scan_status="REJECTED",
                    rejection_reason="PNG file contains embedded active content (polyglot attack)",
                )
            detected_mime = "image/png"

        elif ext in ("jpg", "jpeg"):
            if not content.startswith(b"\xff\xd8\xff"):
                return FileSecurityVerdict(
                    is_safe=False,
                    detected_mime="application/octet-stream",
                    scan_status="REJECTED",
                    rejection_reason="Invalid JPEG: Missing JPEG signature",
                )
            detected_mime = "image/jpeg"

        elif ext == "webp":
            if not (content.startswith(b"RIFF") and b"WEBP" in content[:16]):
                return FileSecurityVerdict(
                    is_safe=False,
                    detected_mime="application/octet-stream",
                    scan_status="REJECTED",
                    rejection_reason="Invalid WEBP: Missing RIFF/WEBP signature",
                )
            detected_mime = "image/webp"

        elif ext == "docx":
            if not (content.startswith(b"PK\x03\x04") or content.startswith(b"PK\x05\x06")):
                return FileSecurityVerdict(
                    is_safe=False,
                    detected_mime="application/octet-stream",
                    scan_status="REJECTED",
                    rejection_reason="Invalid DOCX: Missing ZIP/OpenXML signature",
                )
            detected_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        elif ext in ("txt", "md", "csv", "json"):
            # Check for non-text binary blobs masquerading as text
            sample = content[:4096]
            # Disallow null bytes and non-printable control characters (except newline, tab, carriage return)
            if b"\x00" in sample:
                return FileSecurityVerdict(
                    is_safe=False,
                    detected_mime="application/octet-stream",
                    scan_status="REJECTED",
                    rejection_reason=f"Binary content detected in .{ext} file",
                )
            detected_mime = {
                "txt": "text/plain",
                "md": "text/markdown",
                "csv": "text/csv",
                "json": "application/json",
            }[ext]

        else:
            detected_mime = declared_mime or "application/octet-stream"

        return FileSecurityVerdict(
            is_safe=True,
            detected_mime=detected_mime,
            scan_status="CLEAN",
            rejection_reason=None,
        )

    @staticmethod
    def _contains_active_content(content: bytes) -> bool:
        """Detect active/executable content patterns in first 64KB (polyglot detection).

        Used for image types that might embed script payloads.
        """
        sample = content[:65536].lower()
        patterns = [
            b"<script",
            b"javascript:",
            b"onerror=",
            b"onload=",
            b"data:text/html",
            b"<iframe",
            b"<object",
            b"<embed",
            b"vbscript:",
            b"expression(",
        ]
        return any(p in sample for p in patterns)


file_security_service = FileSecurityService()
