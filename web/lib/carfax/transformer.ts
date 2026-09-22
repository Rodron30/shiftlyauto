// lib/carfax/transformer.ts
//
// CARFAX → history_events transformation interface for Shiftly Auto V1.
// This defines the transformation interface without implementing actual
// CARFAX API response transformation (which requires CARFAX documentation).
//
// The actual CARFAX transformation logic will be implemented when
// CARFAX API documentation is available.

import type {
  NormalizedCarfaxEvent,
  CarfaxFetchResponse,
  CarfaxTransformationResult,
  CarfaxIntegrationError,
} from "./types";
import { CARFAX_SOURCE, CARFAX_EVENT_TYPES } from "./constants";

/**
 * CARFAX Transformer Interface
 *
 * This interface defines the contract for transforming CARFAX API responses
 * into normalized history events that can be stored in the database.
 *
 * When CARFAX documentation is available, implement this interface with
 * actual CARFAX API response parsing logic.
 */
export interface ICarfaxTransformer {
  /**
   * Transform CARFAX API response to normalized events
   *
   * @param carfaxResponse - Raw CARFAX API response
   * @returns Normalized events and transformation metadata
   *
   * Implementation requires:
   * - CARFAX API response structure understanding
   * - Mapping CARFAX theft records to THEFT events
   * - Mapping CARFAX odometer readings to ODOMETER events
   * - Mapping CARFAX accident records to ACCIDENT events
   * - Mapping CARFAX insurance claims to CLAIM events
   * - Date format normalization
   * - Location data extraction
   * - Description generation from CARFAX data
   * - Error handling for malformed CARFAX data
   */
  transformToNormalizedEvents(
    carfaxResponse: CarfaxFetchResponse
  ): Promise<CarfaxTransformationResult>;

  /**
   * Transform a single CARFAX record to normalized event
   *
   * @param carfaxRecord - Single CARFAX record from API response
   * @param eventType - Target event type
   * @returns Normalized event or error
   *
   * Implementation requires:
   * - CARFAX record structure understanding
   * - Field mapping from CARFAX to database schema
   * - Data type conversion and validation
   */
  transformSingleRecord(
    carfaxRecord: Record<string, unknown>,
    eventType: keyof typeof CARFAX_EVENT_TYPES
  ): Promise<NormalizedCarfaxEvent | CarfaxIntegrationError>;

  /**
   * Validate normalized event before database insertion
   *
   * @param event - Normalized event to validate
   * @returns Validation result with errors if any
   *
   * Implementation requires:
   * - Required field validation
   * - Data type validation
   * - Business rule validation
   */
  validateNormalizedEvent(
    event: NormalizedCarfaxEvent
  ): { valid: boolean; errors: string[] };

  /**
   * Extract event date from CARFAX record
   *
   * @param carfaxRecord - CARFAX record
   * @returns Normalized date string or null
   *
   * Implementation requires:
   * - CARFAX date format understanding
   * - Date parsing and normalization
   */
  extractEventDate(
    carfaxRecord: Record<string, unknown>
  ): string | null;

  /**
   * Extract description from CARFAX record
   *
   * @param carfaxRecord - CARFAX record
   * @param eventType - Event type for context
   * @returns Description string or null
   *
   * Implementation requires:
   * - CARFAX description field mapping
   * - Description generation from CARFAX data
   */
  extractDescription(
    carfaxRecord: Record<string, unknown>,
    eventType: keyof typeof CARFAX_EVENT_TYPES
  ): string | null;

  /**
   * Extract location from CARFAX record
   *
   * @param carfaxRecord - CARFAX record
   * @returns Location string or null
   *
   * Implementation requires:
   * - CARFAX location field mapping
   * - Location data normalization
   */
  extractLocation(
    carfaxRecord: Record<string, unknown>
  ): string | null;

  /**
   * Extract odometer from CARFAX record
   *
   * @param carfaxRecord - CARFAX record
   * @returns Odometer integer or null
   *
   * Implementation requires:
   * - CARFAX odometer field mapping
   * - Unit conversion if needed (CARFAX may use miles)
   * - Data type conversion
   */
  extractOdometer(
    carfaxRecord: Record<string, unknown>
  ): number | null;
}

/**
 * CARFAX Transformer Implementation Placeholder
 *
 * This is a placeholder implementation that returns errors indicating
 * the actual CARFAX transformation logic is not yet implemented.
 *
 * When CARFAX documentation is available, replace this with the actual
 * CARFAX transformation implementation.
 */
export class CarfaxTransformerPlaceholder implements ICarfaxTransformer {
  async transformToNormalizedEvents(
    _carfaxResponse: CarfaxFetchResponse
  ): Promise<CarfaxTransformationResult> {
    return {
      normalizedEvents: [],
      skippedEvents: [],
      transformationErrors: [
        {
          eventType: "ALL",
          error: "CARFAX transformation is not yet implemented. Requires CARFAX API documentation.",
          originalData: {},
        },
      ],
    };
  }

  async transformSingleRecord(
    _carfaxRecord: Record<string, unknown>,
    _eventType: keyof typeof CARFAX_EVENT_TYPES
  ): Promise<NormalizedCarfaxEvent | CarfaxIntegrationError> {
    return {
      code: "CONFIGURATION_ERROR",
      message: "CARFAX transformation is not yet implemented. Requires CARFAX API documentation.",
      timestamp: new Date().toISOString(),
    };
  }

  validateNormalizedEvent(
    event: NormalizedCarfaxEvent
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation that doesn't require CARFAX documentation
    if (!event.eventType) {
      errors.push("Event type is required");
    }

    if (event.source !== CARFAX_SOURCE) {
      errors.push("Source must be CARFAX for CARFAX events");
    }

    if (!event.rawData || Object.keys(event.rawData).length === 0) {
      errors.push("Raw data is required for audit trail");
    }

    // Odometer validation if present
    if (event.odometer !== null) {
      if (typeof event.odometer !== "number" || event.odometer < 0) {
        errors.push("Odometer must be a positive number");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  extractEventDate(_carfaxRecord: Record<string, unknown>): string | null {
    // Placeholder - requires CARFAX date format knowledge
    return null;
  }

  extractDescription(
    _carfaxRecord: Record<string, unknown>,
    _eventType: keyof typeof CARFAX_EVENT_TYPES
  ): string | null {
    // Placeholder - requires CARFAX field mapping knowledge
    return null;
  }

  extractLocation(_carfaxRecord: Record<string, unknown>): string | null {
    // Placeholder - requires CARFAX location field knowledge
    return null;
  }

  extractOdometer(_carfaxRecord: Record<string, unknown>): number | null {
    // Placeholder - requires CARFAX odometer field knowledge
    return null;
  }
}

/**
 * CARFAX Transformer Factory
 *
 * Creates CARFAX transformer instances.
 * When CARFAX documentation is available, this will return the actual
 * CARFAX transformer implementation.
 */
export function createCarfaxTransformer(): ICarfaxTransformer {
  // When CARFAX documentation is available, replace this with
  // actual CARFAX transformer instantiation logic
  return new CarfaxTransformerPlaceholder();
}

/**
 * CARFAX Transformer Singleton
 *
 * Global CARFAX transformer instance for the application.
 */
let carfaxTransformerInstance: ICarfaxTransformer | null = null;

export function getCarfaxTransformer(): ICarfaxTransformer {
  if (!carfaxTransformerInstance) {
    carfaxTransformerInstance = createCarfaxTransformer();
  }
  return carfaxTransformerInstance;
}

export function resetCarfaxTransformer(): void {
  carfaxTransformerInstance = null;
}

/**
 * Database-ready event structure
 * This matches the history_events table schema
 */
export type DatabaseHistoryEvent = {
  vehicle_id: string;
  event_date: string | null;
  event_type: string;
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
  raw_data: Record<string, unknown>;
};

/**
 * Convert normalized CARFAX event to database history event
 *
 * @param vehicleId - Vehicle ID in database
 * @param normalizedEvent - Normalized CARFAX event
 * @returns Database-ready history event
 */
export function normalizedEventToDatabaseEvent(
  vehicleId: string,
  normalizedEvent: NormalizedCarfaxEvent
): DatabaseHistoryEvent {
  return {
    vehicle_id: vehicleId,
    event_date: normalizedEvent.eventDate,
    event_type: normalizedEvent.eventType,
    description: normalizedEvent.description,
    location: normalizedEvent.location,
    odometer: normalizedEvent.odometer,
    source: normalizedEvent.source,
    raw_data: normalizedEvent.rawData,
  };
}

/**
 * Batch convert normalized events to database events
 *
 * @param vehicleId - Vehicle ID in database
 * @param normalizedEvents - Array of normalized CARFAX events
 * @returns Array of database-ready history events
 */
export function batchNormalizedEventsToDatabaseEvents(
  vehicleId: string,
  normalizedEvents: NormalizedCarfaxEvent[]
): DatabaseHistoryEvent[] {
  return normalizedEvents.map((event) =>
    normalizedEventToDatabaseEvent(vehicleId, event)
  );
}
