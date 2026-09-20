import ipaddress
import socket
from urllib.parse import urlparse


class SSRFSecurityViolation(Exception):
    pass


BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),  # Cloud metadata
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def validate_outbound_url(url: str) -> str:
    """Strict SSRF validator enforcing HTTPS, resolving DNS, and blocking private/loopback IPs."""
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise SSRFSecurityViolation(f"SSRF block: Only https:// protocol is permitted, got {parsed.scheme}")
    
    hostname = parsed.hostname
    if not hostname:
        raise SSRFSecurityViolation("SSRF block: Missing hostname in URL")

    try:
        addr_info = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
        for _, _, _, _, sockaddr in addr_info:
            ip = ipaddress.ip_address(sockaddr[0])
            for blocked in BLOCKED_NETWORKS:
                if ip in blocked:
                    raise SSRFSecurityViolation(f"SSRF block: Destination IP {ip} falls into restricted range {blocked}")
    except socket.gaierror:
        # DNS resolution failure treated safely as expired or unreachable
        raise SSRFSecurityViolation(f"SSRF block: Hostname {hostname} cannot be resolved")
        
    return url
