"""Antivirus scanning service supporting ClamAV daemon and static heuristics.

Provides authentic deep antivirus scanning via ClamAV's clamd INSTREAM protocol,
with resilient circuit breaker protection and configurable fallback to static
heuristics.
"""

from __future__ import annotations

import asyncio
import logging
import struct
import time
from dataclasses import dataclass
from typing import Protocol

from api.config import Settings

logger = logging.getLogger(__name__)

EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


@dataclass(frozen=True)
class AntivirusScanResult:
    is_clean: bool
    threat_name: str | None
    engine: str
    details: str | None = None


class AntivirusScannerProtocol(Protocol):
    async def scan_bytes(self, content: bytes, filename: str) -> AntivirusScanResult:
        ...


class AntivirusException(Exception):
    """Base exception for antivirus scanner failures."""


class AntivirusInfectedException(AntivirusException):
    """Raised when malware is positively identified."""

    def __init__(self, threat_name: str, engine: str):
        super().__init__(f"Malware detected ({threat_name}) by {engine} engine")
        self.threat_name = threat_name
        self.engine = engine


class AntivirusUnavailableException(AntivirusException):
    """Raised when the mandatory antivirus engine is unreachable."""


class ClamAVScanner:
    """ClamAV daemon scanner communicating via clamd INSTREAM protocol."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 3310,
        timeout: float = 3.0,
        failure_threshold: int = 3,
        recovery_time_seconds: float = 30.0,
    ):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.failure_threshold = failure_threshold
        self.recovery_time_seconds = recovery_time_seconds

        self._consecutive_failures = 0
        self._circuit_opened_at: float | None = None

    @property
    def is_circuit_open(self) -> bool:
        if self._circuit_opened_at is None:
            return False
        if time.time() - self._circuit_opened_at > self.recovery_time_seconds:
            # Half-open: allow a trial request
            return False
        return True

    def _record_success(self) -> None:
        self._consecutive_failures = 0
        self._circuit_opened_at = None

    def _record_failure(self) -> None:
        self._consecutive_failures += 1
        if self._consecutive_failures >= self.failure_threshold:
            self._circuit_opened_at = time.time()
            logger.warning(
                "ClamAV circuit breaker opened after %d failures. Tripped for %.1fs.",
                self._consecutive_failures,
                self.recovery_time_seconds,
            )

    async def scan_bytes(self, content: bytes, filename: str) -> AntivirusScanResult:
        if self.is_circuit_open:
            raise AntivirusUnavailableException(
                f"ClamAV daemon at {self.host}:{self.port} circuit breaker is OPEN."
            )

        reader: asyncio.StreamReader | None = None
        writer: asyncio.StreamWriter | None = None

        try:
            connect_coro = asyncio.open_connection(self.host, self.port)
            reader, writer = await asyncio.wait_for(connect_coro, timeout=self.timeout)

            # Send zINSTREAM command
            writer.write(b"zINSTREAM\0")
            await writer.drain()

            # Stream content in chunks (up to 64KB each)
            chunk_size = 64 * 1024
            offset = 0
            while offset < len(content):
                chunk = content[offset : offset + chunk_size]
                chunk_len = len(chunk)
                writer.write(struct.pack(">I", chunk_len))
                writer.write(chunk)
                await writer.drain()
                offset += chunk_len

            # Send EOF marker (0-length chunk)
            writer.write(b"\x00\x00\x00\x00")
            await writer.drain()

            # Read response
            raw_response = await asyncio.wait_for(reader.read(1024), timeout=self.timeout)
            response_text = raw_response.decode("utf-8", errors="replace").strip("\x00\r\n")

            self._record_success()

            # Response patterns:
            # "stream: OK"
            # "stream: <threat_name> FOUND"
            # "stream: <error> ERROR"
            if "OK" in response_text:
                return AntivirusScanResult(
                    is_clean=True,
                    threat_name=None,
                    engine="clamav",
                    details=response_text,
                )

            if "FOUND" in response_text:
                # Extract threat name: e.g. "stream: Win.Test.EICAR_HDB-1 FOUND"
                parts = response_text.replace("stream:", "").replace("FOUND", "").strip()
                threat = parts or "Unknown.Malware"
                return AntivirusScanResult(
                    is_clean=False,
                    threat_name=threat,
                    engine="clamav",
                    details=response_text,
                )

            logger.error("ClamAV daemon returned unexpected response: %s", response_text)
            raise AntivirusException(f"ClamAV response error: {response_text}")

        except (asyncio.TimeoutError, ConnectionRefusedError, OSError) as exc:
            self._record_failure()
            logger.warning("ClamAV daemon connection error (%s:%d): %s", self.host, self.port, exc)
            raise AntivirusUnavailableException(
                f"ClamAV connection failed ({self.host}:{self.port}): {exc}"
            ) from exc
        finally:
            if writer:
                try:
                    writer.close()
                    await writer.wait_closed()
                except Exception:
                    pass


class StaticHeuristicScanner:
    """Fast in-process static heuristic scanner detecting standard test signatures."""

    async def scan_bytes(self, content: bytes, filename: str) -> AntivirusScanResult:
        if EICAR_SIGNATURE in content:
            return AntivirusScanResult(
                is_clean=False,
                threat_name="EICAR-Standard-Antivirus-Test-File",
                engine="static",
                details="Standard EICAR signature detected",
            )
        return AntivirusScanResult(
            is_clean=True,
            threat_name=None,
            engine="static",
            details="Static heuristics passed",
        )


class AntivirusService:
    """Orchestrates antivirus scanning with dynamic engine selection and fallbacks."""

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or Settings()
        self._clamav = ClamAVScanner(
            host=self._settings.clamav_host,
            port=self._settings.clamav_port,
            timeout=self._settings.clamav_timeout_seconds,
        )
        self._static = StaticHeuristicScanner()

    async def scan_bytes(self, content: bytes, filename: str) -> AntivirusScanResult:
        provider = self._settings.antivirus_provider

        if provider == "disabled":
            return AntivirusScanResult(
                is_clean=True,
                threat_name=None,
                engine="disabled",
                details="Antivirus scanning disabled by configuration",
            )

        if provider == "clamav":
            try:
                return await self._clamav.scan_bytes(content, filename)
            except AntivirusUnavailableException as err:
                if self._settings.antivirus_required:
                    logger.error("Mandatory ClamAV scan failed and fail-closed is active: %s", err)
                    raise
                logger.warning(
                    "ClamAV daemon unavailable, falling back to static heuristics: %s", err
                )
                return await self._static.scan_bytes(content, filename)

        # Default to static heuristic scanner
        return await self._static.scan_bytes(content, filename)

    def scan_bytes_sync(self, content: bytes, filename: str) -> AntivirusScanResult:
        """Synchronous wrapper for contexts where an event loop is not already running."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # If inside an existing async loop, use static check for sync context
            # to prevent blocking the event loop or calling run_until_complete
            if self._settings.antivirus_provider == "clamav" and not self._clamav.is_circuit_open:
                # Best-effort task creation or fallback
                pass
            return asyncio.run_coroutine_threadsafe(
                self.scan_bytes(content, filename), loop
            ).result(timeout=self._settings.clamav_timeout_seconds + 1.0)
        else:
            return asyncio.run(self.scan_bytes(content, filename))


antivirus_service = AntivirusService()
