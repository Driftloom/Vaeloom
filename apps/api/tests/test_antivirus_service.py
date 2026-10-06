import asyncio
import struct
import pytest

from api.config import Settings
from api.services.antivirus_service import (
    AntivirusService,
    AntivirusUnavailableException,
    ClamAVScanner,
    EICAR_SIGNATURE,
    StaticHeuristicScanner,
)
from api.services.file_security_service import file_security_service


class TestStaticHeuristicScanner:
    @pytest.mark.asyncio
    async def test_clean_content_passes(self):
        scanner = StaticHeuristicScanner()
        res = await scanner.scan_bytes(b"Clean business report content", "report.txt")
        assert res.is_clean is True
        assert res.threat_name is None
        assert res.engine == "static"

    @pytest.mark.asyncio
    async def test_eicar_signature_flagged(self):
        scanner = StaticHeuristicScanner()
        res = await scanner.scan_bytes(EICAR_SIGNATURE, "test.com")
        assert res.is_clean is False
        assert "EICAR" in (res.threat_name or "")
        assert res.engine == "static"


class TestClamAVProtocolMock:
    @pytest.mark.asyncio
    async def test_clamav_clean_response(self):
        async def handle_clamav(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
            # Read zINSTREAM command
            cmd = await reader.readuntil(b"\0")
            assert b"zINSTREAM" in cmd

            # Read chunks until 0-length EOF chunk
            while True:
                length_bytes = await reader.readexactly(4)
                chunk_len = struct.unpack(">I", length_bytes)[0]
                if chunk_len == 0:
                    break
                await reader.readexactly(chunk_len)

            # Reply with clean stream
            writer.write(b"stream: OK\0")
            await writer.drain()
            writer.close()
            await writer.wait_closed()

        server = await asyncio.start_server(handle_clamav, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]

        try:
            scanner = ClamAVScanner(host="127.0.0.1", port=port, timeout=2.0)
            result = await scanner.scan_bytes(b"Safe pdf document bytes", "doc.pdf")
            assert result.is_clean is True
            assert result.threat_name is None
            assert result.engine == "clamav"
        finally:
            server.close()
            await server.wait_closed()

    @pytest.mark.asyncio
    async def test_clamav_infected_response(self):
        async def handle_clamav(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
            cmd = await reader.readuntil(b"\0")
            while True:
                length_bytes = await reader.readexactly(4)
                chunk_len = struct.unpack(">I", length_bytes)[0]
                if chunk_len == 0:
                    break
                await reader.readexactly(chunk_len)

            writer.write(b"stream: Win.Test.EICAR_HDB-1 FOUND\0")
            await writer.drain()
            writer.close()
            await writer.wait_closed()

        server = await asyncio.start_server(handle_clamav, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]

        try:
            scanner = ClamAVScanner(host="127.0.0.1", port=port, timeout=2.0)
            result = await scanner.scan_bytes(EICAR_SIGNATURE, "infected.txt")
            assert result.is_clean is False
            assert "Win.Test.EICAR_HDB-1" in (result.threat_name or "")
            assert result.engine == "clamav"
        finally:
            server.close()
            await server.wait_closed()

    @pytest.mark.asyncio
    async def test_clamav_circuit_breaker_on_daemon_failure(self):
        # Point scanner at an inactive port to trigger connection errors
        scanner = ClamAVScanner(
            host="127.0.0.1",
            port=65432,
            timeout=0.2,
            failure_threshold=3,
            recovery_time_seconds=2.0,
        )

        assert scanner.is_circuit_open is False

        for _ in range(3):
            with pytest.raises(AntivirusUnavailableException):
                await scanner.scan_bytes(b"data", "test.txt")

        # Now circuit must be OPEN
        assert scanner.is_circuit_open is True
        with pytest.raises(AntivirusUnavailableException, match="circuit breaker is OPEN"):
            await scanner.scan_bytes(b"data", "test.txt")


class TestAntivirusServiceOrchestration:
    @pytest.mark.asyncio
    async def test_disabled_provider_passes_all(self):
        settings = Settings(antivirus_provider="disabled")
        service = AntivirusService(settings=settings)
        res = await service.scan_bytes(EICAR_SIGNATURE, "test.txt")
        assert res.is_clean is True
        assert res.engine == "disabled"

    @pytest.mark.asyncio
    async def test_clamav_fallback_to_static_when_not_required(self):
        settings = Settings(
            antivirus_provider="clamav",
            antivirus_required=False,
            clamav_host="127.0.0.1",
            clamav_port=65431,  # Down port
            clamav_timeout_seconds=0.2,
        )
        service = AntivirusService(settings=settings)

        # Clean file falls back to static scanner and passes
        res = await service.scan_bytes(b"Hello world", "hello.txt")
        assert res.is_clean is True
        assert res.engine == "static"

        # EICAR file falls back to static and gets detected
        res_eicar = await service.scan_bytes(EICAR_SIGNATURE, "eicar.txt")
        assert res_eicar.is_clean is False
        assert res_eicar.engine == "static"

    @pytest.mark.asyncio
    async def test_clamav_fail_closed_when_required(self):
        settings = Settings(
            antivirus_provider="clamav",
            antivirus_required=True,
            clamav_host="127.0.0.1",
            clamav_port=65431,  # Down port
            clamav_timeout_seconds=0.2,
        )
        service = AntivirusService(settings=settings)

        with pytest.raises(AntivirusUnavailableException):
            await service.scan_bytes(b"Hello world", "hello.txt")


class TestFileSecurityServiceAsyncIntegration:
    @pytest.mark.asyncio
    async def test_inspect_file_async_clean(self):
        content = b"%PDF-1.4 Valid Document Content"
        verdict = await file_security_service.inspect_file_async("sample.pdf", content, "application/pdf")
        assert verdict.is_safe is True
        assert verdict.scan_status == "CLEAN"

    @pytest.mark.asyncio
    async def test_inspect_file_async_eicar(self):
        verdict = await file_security_service.inspect_file_async("sample.pdf", EICAR_SIGNATURE, "application/pdf")
        assert verdict.is_safe is False
        assert verdict.scan_status == "MALICIOUS"
