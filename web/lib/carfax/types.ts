// lib/carfax/types.ts
//
// CARFAX integration types for Shiftly Auto V1.
// These are INTERFACE types only - no fake CARFAX API response structures.
// The actual CARFAX API response shapes will be defined when CARFAX
// documentation is available.

import type { CARFAX_EVENT_TYPES } from "./constants";
import { DEDUPLICATION_STRATEGY } from "./constants";

// Re-export DEDUPLICATION_STRATEGY for type imports
export { DEDUPLICATION_STRATEGY };

/**
 * Normalized CARFAX record - the internal representation after transformation
 * from CARFAX API responses to our database schema
 */
export type NormalizedCarfaxEvent = {
  /** Event type matching database event_type */
  eventType: keyof typeof CARFAX_EVENT_TYPES;

  /** Event date from CARFAX */
  eventDate: string | null;

  /** Description of the event */
  description: string | null;

  /** Location if provided by CARFAX */
  location: string | null;

  /** Odometer reading if applicable */
  odometer: number | null;

  /** Always set to CARFAX_SOURCE constant */
  source: string;

  /** Original CARFAX API response data for audit/debugging */
  rawData: Record<string, unknown>;
};

/**
 * Deduplication key for CARFAX events
 * Used to identify potential duplicates before insertion
 */
export type DeduplicationKey = {
  eventType: string;
  eventDate: string | null;
  description: string | null;
  location: string | null;
  odometer: number | null;
};

/**
 * CARFAX integration configuration
 * These are placeholder fields - actual CARFAX configuration will be
 * defined when CARFAX documentation is available
 */
export type CarfaxConfiguration = {
  /** CARFAX API credential placeholder */
  apiKey?: string;

  /** CARFAX API endpoint placeholder */
  apiEndpoint?: string;

  /** Deduplication strategy to use */
  deduplicationStrategy: keyof typeof DEDUPLICATION_STRATEGY;

  /** Whether to automatically fetch CARFAX data for new vehicles */
  autoFetchEnabled: boolean;

  /** Rate limiting configuration placeholder */
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
};

/**
 * CARFAX integration result types
 */
export type CarfaxIntegrationResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: CarfaxIntegrationError;
};

/**
 * CARFAX integration error types
 */
export type CarfaxIntegrationError = {
  code: CarfaxErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
};

/**
 * CARFAX error codes - generic categories that don't require CARFAX documentation
 */
export type CarfaxErrorCode =
  | "AUTHENTICATION_FAILED"
  | "API_KEY_INVALID"
  | "RATE_LIMIT_EXCEEDED"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "VIN_NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN_ERROR";

/**
 * CARFAX fetch request parameters
 * These are placeholder parameters - actual CARFAX API parameters
 * will be defined when CARFAX documentation is available
 */
export type CarfaxFetchRequest = {
  vin: string;
  /** Additional CARFAX-specific parameters to be defined */
  options?: Record<string, unknown>;
};

/**
 * CARFAX fetch response placeholder
 * The actual CARFAX API response structure will be defined when
 * CARFAX documentation is available
 */
export type CarfaxFetchResponse = {
  /** Placeholder for CARFAX API response */
  data: unknown;
  /** Metadata about the CARFAX response */
  metadata: {
    fetchedAt: string;
    vin: string;
    recordCount?: number;
  };
};

/**
 * CARFAX transformation result
 * Result of transforming CARFAX API data to normalized events
 */
export type CarfaxTransformationResult = {
  normalizedEvents: NormalizedCarfaxEvent[];
  skippedEvents: Array<{
    reason: string;
    originalData: Record<string, unknown>;
  }>;
  transformationErrors: Array<{
    eventType: string;
    error: string;
    originalData: Record<string, unknown>;
  }>;
};

/**
 * CARFAX deduplication result
 * Result of checking for duplicate events
 */
export type CarfaxDeduplicationResult = {
  newEvents: NormalizedCarfaxEvent[];
  duplicateEvents: Array<{
    existingEventId: string;
    newEvent: NormalizedCarfaxEvent;
    reason: string;
  }>;
  skippedEvents: Array<{
    event: NormalizedCarfaxEvent;
    reason: string;
  }>;
};

/**
 * CARFAX sync result
 * Overall result of a CARFAX sync operation
 */
export type CarfaxSyncResult = {
  success: boolean;
  vehicleId: string;
  vin: string;
  eventsInserted: number;
  eventsSkipped: number;
  eventsFailed: number;
  errors: Array<{
    eventType: string;
    error: string;
  }>;
  syncDuration: number; // milliseconds
  syncedAt: string;
};
