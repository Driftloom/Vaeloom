"""
SSRF guard for agent-driven URL fetching (browse_job_page / verify_application_link).

Policy (fail-closed):
- https only
- no credentials in URL
- hostname must resolve; EVERY resolved IP must be globally routable
  (loopback, private, link-local, reserved, multicast → denied)
- literal IPs validated without DNS

Closes the injection vector where an LLM-controlled tool argument could make
the server fetch internal endpoints (cloud metadata, admin panels).
"""
import ipaddress
import socket
from urllib.parse import urlparse


class UrlBlockedError(ValueError):
    """URL rejected by SSRF policy."""


class DnsResolutionError(UrlBlockedError):
    """Host could not be resolved — likely a dead/expired domain, not a policy issue."""


def _ip_is_allowed(ip: str) -> bool:
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return parsed.is_global and not parsed.is_multicast and not parsed.is_unspecified


def is_blocked_host(host: str) -> bool:
    lowered = (host or "").lower().strip(".")
    if lowered in ("localhost", "localhost.localdomain", "metadata.google.internal"):
        return True
    if lowered.endswith(".local") or lowered.endswith(".internal"):
        return True
    return False


async def assert_public_http_url(url: str) -> str:
    """
    Validate that `url` is a public https endpoint this process may fetch.
    Returns the normalized URL string; raises UrlBlockedError otherwise.
    """
    import asyncio

    if not url or not isinstance(url, str):
        raise UrlBlockedError("URL is required")
    url = url.strip()
    if len(url) > 2048:
        raise UrlBlockedError("URL too long")

    try:
        parsed = urlparse(url)
    except Exception as e:
        raise UrlBlockedError(f"Unparseable URL: {e}") from e

    if parsed.scheme != "https":
        raise UrlBlockedError(f"Scheme '{parsed.scheme or 'none'}' not allowed — use https")
    host = parsed.hostname
    if not host:
        raise UrlBlockedError("Missing hostname")
    if parsed.username or parsed.password or "@" in (parsed.netloc.rsplit("@", 1)[0] if "@" in parsed.netloc else ""):
        raise UrlBlockedError("Credentials in URL are not allowed")
    if is_blocked_host(host):
        raise UrlBlockedError(f"Host '{host}' is blocked")

    # Literal IP fast-path
    try:
        ipaddress.ip_address(host)
        if not _ip_is_allowed(host):
            raise UrlBlockedError(f"IP host '{host}' is not publicly routable")
        return url
    except ValueError:
        pass  # hostname, needs resolution

    def resolve() -> list[str]:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
        return [info[4][0] for info in infos]

    try:
        addrs = await asyncio.to_thread(resolve)
    except socket.gaierror as e:
        raise DnsResolutionError(f"DNS resolution failed for '{host}': {e}") from e

    if not addrs:
        raise UrlBlockedError(f"No addresses resolved for '{host}'")
    for addr in addrs:
        if not _ip_is_allowed(addr):
            raise UrlBlockedError(
                f"Host '{host}' resolves to non-public address ({addr}) — blocked"
            )
    return url
