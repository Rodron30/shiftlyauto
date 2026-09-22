// lib/carfax/constants.ts
//
// CARFAX integration constants and source attribution for Shiftly Auto V1.
// This file contains ONLY safe, architectural constants that don't require
// CARFAX API documentation. No fake endpoints, credentials, or response formats.

/**
 * CARFAX source identifier for history_events.source field
 * This distinguishes CARFAX-sourced data from manual dealer entries
 */
export const CARFAX_SOURCE = "CARFAX";

/**
 * Manual dealer entry source identifier for comparison
 */
export const MANUAL_SOURCE = "Manual Entry (Dealer)";

/**
 * Generic source confirmed identifier for comparison
 */
export const SOURCE_CONFIRMED = "Source Confirmed";

/**
 * All recognized vehicle history sources
 */
export const HISTORY_SOURCES = {
  CARFAX: CARFAX_SOURCE,
  MANUAL: MANUAL_SOURCE,
  SOURCE_CONFIRMED: SOURCE_CONFIRMED,
} as const;

/**
 * CARFAX-supported event types mapping to database event types
 */
export const CARFAX_EVENT_TYPES = {
  THEFT: "THEFT",
  ODOMETER: "ODOMETER",
  ACCIDENT: "ACCIDENT",
  CLAIM: "CLAIM",
} as const;

/**
 * Deduplication strategy types for CARFAX data
 */
export const DEDUPLICATION_STRATEGY = {
  /**
   * Deduplicate by event type + date + description
   * Safe strategy that prevents obvious duplicates
   */
  STANDARD: "STANDARD",

  /**
   * Deduplicate by event type + date + source
   * More aggressive, may merge legitimate separate events
   */
  AGGRESSIVE: "AGGRESSIVE",

  /**
   * No deduplication - insert all CARFAX records
   * Risk of duplicates but preserves all data
   */
  NONE: "NONE",
} as const;

/**
 * CARFAX integration status types
 */
export const CARFAX_INTEGRATION_STATUS = {
  NOT_CONFIGURED: "NOT_CONFIGURED",
  CONFIGURED: "CONFIGURED",
  AUTHENTICATED: "AUTHENTICATED",
  RATE_LIMITED: "RATE_LIMITED",
  ERROR: "ERROR",
} as const;
