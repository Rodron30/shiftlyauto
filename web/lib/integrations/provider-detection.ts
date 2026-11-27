export interface ProviderInfo {
  name: string;
  supported: boolean;
  supportsPublicScan: boolean;
  supportsServerSide: boolean;
  experimental?: boolean;
  note?: string;
}

export interface SupportedProvider {
  name: string;
  experimental?: boolean;
  note?: string;
}

/**
 * Explicit mapping from detected provider name to integration provider ID.
 * Matches the actual values stored in integrations.provider.
 */
const PROVIDER_MAPPING: Record<string, string> = {
  'Tri-City Mitsubishi': 'tricity_mitsubishi',
  'DealerInspire': 'dealerinspire',
};

/**
 * Get the integration provider ID for a detected provider name.
 */
export function getProviderId(providerName: string): string | null {
  return PROVIDER_MAPPING[providerName] || null;
}

/**
 * Detect inventory provider from URL.
 * Uses exact hostname matching only. No wildcard classification.
 */
export function detectProvider(url: string): ProviderInfo {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Exact hostname matches only
    const EXACT_HOSTS: Record<string, ProviderInfo> = {
      'tricitymits.com': {
        name: 'Tri-City Mitsubishi',
        supported: true,
        supportsPublicScan: false,
        supportsServerSide: true,
        note: 'Requires configured integration with authorized API credentials',
      },
      'www.tricitymits.com': {
        name: 'Tri-City Mitsubishi',
        supported: true,
        supportsPublicScan: false,
        supportsServerSide: true,
        note: 'Requires configured integration with authorized API credentials',
      },
      'dealerinspire.com': {
        name: 'DealerInspire',
        supported: true,
        supportsPublicScan: true,
        supportsServerSide: false,
        experimental: true,
        note: 'Public scan available but currently blocked by Cloudflare',
      },
    };

    // Check exact match first
    if (EXACT_HOSTS[hostname]) {
      return EXACT_HOSTS[hostname];
    }

    // Subdomain validation for DealerInspire only
    if (hostname.endsWith('.dealerinspire.com')) {
      const subdomain = hostname.slice(0, -'.dealerinspire.com'.length);
      if (subdomain && subdomain.length > 0) {
        return {
          name: 'DealerInspire',
          supported: true,
          supportsPublicScan: true,
          supportsServerSide: false,
          experimental: true,
          note: 'Public scan available but currently blocked by Cloudflare',
        };
      }
    }

    // Generic fallback for other websites (attempt public scan)
    return {
      name: 'Generic',
      supported: true,
      supportsPublicScan: true,
      supportsServerSide: false,
      note: 'Generic inventory website scanning',
    };
  } catch {
    return {
      name: 'Unknown',
      supported: false,
      supportsPublicScan: false,
      supportsServerSide: false,
    };
  }
}

export function listSupportedProviders(): SupportedProvider[] {
  return [
    { name: 'Tri-City Mitsubishi', note: 'Requires configured integration with authorized API credentials' },
    { name: 'DealerInspire', experimental: true, note: 'Public scan available but currently blocked by Cloudflare' },
    { name: 'Generic', note: 'Generic inventory website scanning' },
  ];
}
