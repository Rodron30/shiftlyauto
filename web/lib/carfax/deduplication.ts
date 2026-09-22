// lib/carfax/deduplication.ts
//
// CARFAX deduplication strategy interface for Shiftly Auto V1.
// This defines the deduplication interface without implementing actual
// database queries (which are straightforward but need proper integration).
//
// The deduplication logic prevents duplicate CARFAX events from being
// inserted into the database.

import type {
  NormalizedCarfaxEvent,
  DeduplicationKey,
  CarfaxDeduplicationResult,
} from "./types";
import { CARFAX_SOURCE, DEDUPLICATION_STRATEGY } from "./constants";

/**
 * Existing database event structure for deduplication comparison
 */
export type ExistingDatabaseEvent = {
  id: string;
  event_type: string;
  event_date: string | null;
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
};

/**
 * CARFAX Deduplication Interface
 *
 * This interface defines the contract for CARFAX event deduplication.
 * It checks for potential duplicates before inserting CARFAX data.
 */
export interface ICarfaxDeduplicator {
  /**
   * Generate deduplication key for a normalized event
   *
   * @param event - Normalized CARFAX event
   * @param strategy - Deduplication strategy to use
   * @returns Deduplication key for comparison
   */
  generateDeduplicationKey(
    event: NormalizedCarfaxEvent,
    strategy: keyof typeof DEDUPLICATION_STRATEGY
  ): DeduplicationKey;

  /**
   * Check if a normalized event is a duplicate of existing events
   *
   * @param event - Normalized CARFAX event to check
   * @param existingEvents - Existing events from database
   * @param strategy - Deduplication strategy to use
   * @returns Duplicate detection result
   */
  isDuplicate(
    event: NormalizedCarfaxEvent,
    existingEvents: ExistingDatabaseEvent[],
    strategy: keyof typeof DEDUPLICATION_STRATEGY
  ): { isDuplicate: boolean; existingEventId?: string; reason: string };

  /**
   * Filter out duplicate events from a batch
   *
   * @param newEvents - New CARFAX events to insert
   * @param existingEvents - Existing events from database
   * @param strategy - Deduplication strategy to use
   * @returns Deduplication result with new events and duplicates
   */
  deduplicateBatch(
    newEvents: NormalizedCarfaxEvent[],
    existingEvents: ExistingDatabaseEvent[],
    strategy: keyof typeof DEDUPLICATION_STRATEGY
  ): CarfaxDeduplicationResult;

  /**
   * Generate a unique signature for an event
   * Used for exact duplicate detection
   *
   * @param event - Event to generate signature for
   * @returns Unique signature string
   */
  generateEventSignature(event: NormalizedCarfaxEvent): string;
}

/**
 * CARFAX Deduplicator Implementation
 *
 * This implementation provides concrete deduplication logic that
 * can work without CARFAX-specific documentation.
 */
export class CarfaxDeduplicator implements ICarfaxDeduplicator {
  generateDeduplicationKey(
    event: NormalizedCarfaxEvent,
    strategy: keyof typeof DEDUPLICATION_STRATEGY
  ): DeduplicationKey {
    switch (strategy) {
      case "STANDARD":
        return {
          eventType: event.eventType,
          eventDate: event.eventDate,
          description: event.description,
          location: event.location,
          odometer: event.odometer,
        };

      case "AGGRESSIVE":
        return {
          eventType: event.eventType,
          eventDate: event.eventDate,
          description: null, // Ignore description for aggressive deduplication
          location: null, // Ignore location for aggressive deduplication
          odometer: event.odometer,
        };

      case "NONE":
        return {
          eventType: event.eventType,
          eventDate: null,
          description: null,
          location: null,
          odometer: null,
        };

      default:
        return this.generateDeduplicationKey(event, "STANDARD");
    }
  }

  isDuplicate(
    event: NormalizedCarfaxEvent,
    existingEvents: ExistingDatabaseEvent[],
    strategy: keyof typeof DEDUPLICATION_STRATEGY
  ): { isDuplicate: boolean; existingEventId?: string; reason: string } {
    const newKey = this.generateDeduplicationKey(event, strategy);

    for (const existing of existingEvents) {
      // Only compare with CARFAX-sourced events to avoid conflicts with manual entries
      if (existing.source !== CARFAX_SOURCE) {
        continue;
      }

      const existingKey: DeduplicationKey = {
        eventType: existing.event_type,
        eventDate: existing.event_date,
        description: existing.description,
        location: existing.location,
        odometer: existing.odometer,
      };

      if (this.keysMatch(newKey, existingKey, strategy)) {
        return {
          isDuplicate: true,
          existingEventId: existing.id,
          reason: this.getDuplicateReason(newKey, existingKey, strategy),
        };
      }
    }

    return {
      isDuplicate: false,
      reason: "No duplicate found",
    };
  }

  deduplicateBatch(
    newEvents: NormalizedCarfaxEvent[],
    existingEvents: ExistingDatabaseEvent[],
    strategy: keyof typeof DEDUPLICATION_STRATEGY
  ): CarfaxDeduplicationResult {
    const newEventsFiltered: NormalizedCarfaxEvent[] = [];
    const duplicateEvents: CarfaxDeduplicationResult["duplicateEvents"] = [];
    const skippedEvents: CarfaxDeduplicationResult["skippedEvents"] = [];

    for (const newEvent of newEvents) {
      const duplicateCheck = this.isDuplicate(newEvent, existingEvents, strategy);

      if (duplicateCheck.isDuplicate) {
        duplicateEvents.push({
          existingEventId: duplicateCheck.existingEventId!,
          newEvent,
          reason: duplicateCheck.reason,
        });
      } else {
        newEventsFiltered.push(newEvent);
      }
    }

    return {
      newEvents: newEventsFiltered,
      duplicateEvents,
      skippedEvents,
    };
  }

  generateEventSignature(event: NormalizedCarfaxEvent): string {
    // Create a unique signature based on all event fields
    const signatureParts = [
      event.eventType,
      event.eventDate || "",
      event.description || "",
      event.location || "",
      event.odometer?.toString() || "",
      event.source,
    ];

    return signatureParts.join("|");
  }

  /**
   * Check if two deduplication keys match based on strategy
   */
  private keysMatch(
    key1: DeduplicationKey,
    key2: DeduplicationKey,
    strategy: keyof typeof DEDUPLICATION_STRATEGY
  ): boolean {
    switch (strategy) {
      case "STANDARD":
        return (
          key1.eventType === key2.eventType &&
          this.normalizeDate(key1.eventDate) === this.normalizeDate(key2.eventDate) &&
          this.normalizeString(key1.description) === this.normalizeString(key2.description) &&
          this.normalizeString(key1.location) === this.normalizeString(key2.location) &&
          key1.odometer === key2.odometer
        );

      case "AGGRESSIVE":
        return (
          key1.eventType === key2.eventType &&
          this.normalizeDate(key1.eventDate) === this.normalizeDate(key2.eventDate) &&
          key1.odometer === key2.odometer
        );

      case "NONE":
        return false; // No deduplication

      default:
        return this.keysMatch(key1, key2, "STANDARD");
    }
  }

  /**
   * Get human-readable reason for duplicate detection
   */
  private getDuplicateReason(
    newKey: DeduplicationKey,
    existingKey: DeduplicationKey,
    strategy: keyof typeof DEDUPLICATION_STRATEGY
  ): string {
    switch (strategy) {
      case "STANDARD":
        return `Duplicate ${newKey.eventType} event on ${newKey.eventDate || "unknown date"}`;

      case "AGGRESSIVE":
        return `Duplicate ${newKey.eventType} event on ${newKey.eventDate || "unknown date"} (aggressive matching)`;

      case "NONE":
        return "No deduplication applied";

      default:
        return "Duplicate event detected";
    }
  }

  /**
   * Normalize date for comparison
   */
  private normalizeDate(date: string | null): string {
    if (!date) return "";
    try {
      const d = new Date(date);
      return d.toISOString().split("T")[0]; // YYYY-MM-DD
    } catch {
      return date;
    }
  }

  /**
   * Normalize string for comparison
   */
  private normalizeString(str: string | null): string {
    if (!str) return "";
    return str.trim().toLowerCase().replace(/\s+/g, " ");
  }
}

/**
 * CARFAX Deduplicator Factory
 */
export function createCarfaxDeduplicator(): ICarfaxDeduplicator {
  return new CarfaxDeduplicator();
}

/**
 * CARFAX Deduplicator Singleton
 */
let carfaxDeduplicatorInstance: ICarfaxDeduplicator | null = null;

export function getCarfaxDeduplicator(): ICarfaxDeduplicator {
  if (!carfaxDeduplicatorInstance) {
    carfaxDeduplicatorInstance = createCarfaxDeduplicator();
  }
  return carfaxDeduplicatorInstance;
}

export function resetCarfaxDeduplicator(): void {
  carfaxDeduplicatorInstance = null;
}
