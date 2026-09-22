// lib/carfax/config.ts
//
// CARFAX configuration management for Shiftly Auto V1.
// This loads CARFAX configuration from environment variables without
// requiring fake credentials or implementing actual CARFAX API calls.

import type { CarfaxConfiguration } from "./types";
import { DEDUPLICATION_STRATEGY } from "./constants";

/**
 * Load CARFAX configuration from environment variables
 *
 * This safely loads configuration without requiring actual CARFAX credentials.
 * When CARFAX documentation is available, add the actual CARFAX-specific
 * environment variable names and validation logic.
 */
export function loadCarfaxConfiguration(): CarfaxConfiguration {
  const apiKey = process.env.CARFAX_API_KEY?.trim();
  const apiEndpoint = process.env.CARFAX_API_ENDPOINT?.trim();
  const deduplicationStrategy = (process.env.CARFAX_DEDUPLICATION_STRATEGY?.trim().toUpperCase() ||
    "STANDARD") as keyof typeof DEDUPLICATION_STRATEGY;
  const autoFetchEnabled = process.env.CARFAX_AUTO_FETCH_ENABLED?.trim().toLowerCase() === "true";

  // Validate deduplication strategy
  const validStrategies: Array<keyof typeof DEDUPLICATION_STRATEGY> = ["STANDARD", "AGGRESSIVE", "NONE"];
  const validatedStrategy: keyof typeof DEDUPLICATION_STRATEGY = validStrategies.includes(deduplicationStrategy)
    ? deduplicationStrategy
    : "STANDARD";

  return {
    apiKey: apiKey || undefined,
    apiEndpoint: apiEndpoint || undefined,
    deduplicationStrategy: validatedStrategy,
    autoFetchEnabled,
    rateLimit: {
      // Rate limiting configuration will be defined when CARFAX documentation is available
      requestsPerMinute: undefined,
      requestsPerDay: undefined,
    },
  };
}

/**
 * Check if CARFAX configuration is present and valid
 *
 * @returns true if CARFAX configuration appears to be set
 */
export function isCarfaxConfigured(): boolean {
  const config = loadCarfaxConfiguration();
  return Boolean(config.apiKey && config.apiEndpoint);
}

/**
 * Get CARFAX configuration status for UI display
 *
 * @returns Configuration status information
 */
export function getCarfaxConfigurationStatus(): {
  isConfigured: boolean;
  hasApiKey: boolean;
  hasEndpoint: boolean;
  deduplicationStrategy: string;
  autoFetchEnabled: boolean;
} {
  const config = loadCarfaxConfiguration();

  return {
    isConfigured: isCarfaxConfigured(),
    hasApiKey: Boolean(config.apiKey),
    hasEndpoint: Boolean(config.apiEndpoint),
    deduplicationStrategy: config.deduplicationStrategy,
    autoFetchEnabled: config.autoFetchEnabled,
  };
}

/**
 * Validate CARFAX configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result with errors
 */
export function validateCarfaxConfiguration(
  config: CarfaxConfiguration
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push("CARFAX API key is not configured");
  }

  if (!config.apiEndpoint) {
    errors.push("CARFAX API endpoint is not configured");
  }

  if (config.apiEndpoint && !isValidUrl(config.apiEndpoint)) {
    errors.push("CARFAX API endpoint is not a valid URL");
  }

  const validStrategies: Array<keyof typeof DEDUPLICATION_STRATEGY> = ["STANDARD", "AGGRESSIVE", "NONE"];
  if (!validStrategies.includes(config.deduplicationStrategy)) {
    errors.push(`Invalid deduplication strategy: ${config.deduplicationStrategy}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Simple URL validation
 * Basic validation that doesn't require external libraries
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get CARFAX configuration for logging (sanitized)
 * Removes sensitive information like API keys
 *
 * @param config - Configuration to sanitize
 * @returns Sanitized configuration for logging
 */
export function sanitizeCarfaxConfigForLogging(
  config: CarfaxConfiguration
): Record<string, unknown> {
  return {
    hasApiKey: Boolean(config.apiKey),
    apiKeyPrefix: config.apiKey ? `${config.apiKey.substring(0, 4)}...` : null,
    apiEndpoint: config.apiEndpoint,
    deduplicationStrategy: config.deduplicationStrategy,
    autoFetchEnabled: config.autoFetchEnabled,
    rateLimit: config.rateLimit,
  };
}
