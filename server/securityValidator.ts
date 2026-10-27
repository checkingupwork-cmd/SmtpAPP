import dns from 'dns/promises';
import net from 'net';

/**
 * Validates a hostname to prevent SSRF and access to internal/private infrastructure.
 * Blocks localhost, link-local, private IPv4, private IPv6, and metadata endpoints.
 */
export async function validateSmtpTarget(host: string): Promise<{ valid: boolean; error?: string }> {
  const trimmed = host.trim().toLowerCase();

  // 1. Basic format & length check
  if (!trimmed || trimmed.length > 255) {
    return { valid: false, error: 'Hostname is empty or excessively long.' };
  }

  // 2. Blacklisted hostnames and metadata endpoints
  const blockedHosts = [
    'localhost',
    'localhost.localdomain',
    'metadata.google.internal',
    '169.254.169.254',
    'metadata',
    'instance-data',
    'broadcasthost',
    'local',
    'internal',
  ];

  if (blockedHosts.includes(trimmed) || trimmed.endsWith('.local') || trimmed.endsWith('.internal')) {
    return {
      valid: false,
      error: 'SSRF Protection: Access to localhost, private domains, and cloud metadata is strictly forbidden.',
    };
  }

  // 3. If direct IP, check directly
  if (net.isIP(trimmed)) {
    if (isPrivateOrRestrictedIp(trimmed)) {
      return {
        valid: false,
        error: `SSRF Protection: IP address ${trimmed} falls within a restricted or private network range.`,
      };
    }
    return { valid: true };
  }

  // 4. Resolve DNS and check resulting IP addresses
  try {
    const lookupResult = await dns.lookup(trimmed, { all: true });
    for (const entry of lookupResult) {
      if (isPrivateOrRestrictedIp(entry.address)) {
        return {
          valid: false,
          error: `SSRF Protection: Hostname resolves to private/reserved IP ${entry.address}. Connection blocked.`,
        };
      }
    }
    return { valid: true };
  } catch (err: any) {
    // If DNS doesn't resolve, let Nodemailer return clean EDNS error
    return { valid: true };
  }
}

/**
 * Checks if an IP is private, loopback, link-local, or reserved.
 */
function isPrivateOrRestrictedIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4) return true;

    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // Unique local address (fc00::/7)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local address (fe80::/10)
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true;
    }
  }

  return false;
}
