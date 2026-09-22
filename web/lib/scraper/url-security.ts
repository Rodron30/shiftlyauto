import { lookup } from "node:dns/promises";
import net from "node:net";

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (net.isIPv4(normalized)) {
    const [a, b, c, d] = normalized.split(".").map(Number);

    return (
      // Unspecified / current host
      a === 0 ||

      // Loopback
      a === 127 ||

      // Private networks
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||

      // Link-local
      (a === 169 && b === 254) ||

      // Carrier-grade NAT
      (a === 100 && b >= 64 && b <= 127) ||

      // IETF special-use / documentation / benchmarking
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 18) ||
      (a === 198 && b === 19) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||

      // Multicast
      a >= 224
    );
  }

  if (net.isIPv6(normalized)) {
    // IPv4-mapped IPv6 addresses, e.g. ::ffff:127.0.0.1
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);

      if (net.isIPv4(mapped)) {
        return isPrivateOrReservedIp(mapped);
      }

      const parts = mapped.split(":");
      if (parts.length === 2 && parts.every((part) => /^[0-9a-f]{1,4}$/.test(part))) {
        const high = parseInt(parts[0], 16);
        const low = parseInt(parts[1], 16);

        const ipv4 =
          `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;

        return isPrivateOrReservedIp(ipv4);
      }
    }

    return (
      // Unspecified
      normalized === "::" ||

      // Loopback
      normalized === "::1" ||

      // Unique local addresses
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||

      // Link-local
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||

      // Multicast
      normalized.startsWith("ff") ||

      // Documentation
      normalized.startsWith("2001:db8:") ||

      // Benchmarking
      normalized.startsWith("2001:2:")
    );
  }

  return true;
}

export async function validateScrapeUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Localhost addresses are not allowed");
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Private or reserved IP addresses are not allowed");
    }
    return;
  }

  const addresses = await lookup(hostname, { all: true });

  if (!addresses.length) {
    throw new Error("Unable to resolve destination host");
  }

  for (const address of addresses) {
    if (isPrivateOrReservedIp(address.address)) {
      throw new Error(
        "Destination resolves to a private or reserved IP address"
      );
    }
  }
}