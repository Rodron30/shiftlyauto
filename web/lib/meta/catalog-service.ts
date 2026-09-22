// Meta Product Catalog service for Automotive Inventory Ads
// Server-side only - handles vehicle catalog operations via Graph API

import type { MetaVehicle, MetaSyncResult, MetaCatalogSyncResult } from './types';

export class MetaCatalogService {
  private catalogId: string;
  private accessToken: string;
  private apiVersion: string;

  constructor(catalogId: string, accessToken: string, apiVersion: string = 'v20.0') {
    this.catalogId = catalogId;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
  }

  /**
   * Create or update a vehicle in the Meta catalog
   */
  async syncVehicle(vehicle: MetaVehicle, vehicleId?: string): Promise<MetaSyncResult> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.catalogId}/vehicles`;
      
      const payload = {
        ...vehicle,
        // Use retailer_id for deduplication - this should be the Shiftly vehicle ID
        retailer_id: vehicleId || vehicle.vin,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[META CATALOG] Vehicle sync failed:', data);
        return {
          success: false,
          error: data.error?.message || 'Unknown error',
          details: JSON.stringify(data),
        };
      }

      console.log('[META CATALOG] Vehicle synced successfully:', data.id);
      return {
        success: true,
        vehicle_id: vehicleId,
        meta_vehicle_id: data.id,
        details: 'Vehicle synced to catalog',
      };
    } catch (error) {
      console.error('[META CATALOG] Vehicle sync error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : 'Unknown',
      };
    }
  }

  /**
   * Delete a vehicle from the Meta catalog
   */
  async deleteVehicle(metaVehicleId: string): Promise<MetaSyncResult> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${metaVehicleId}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[META CATALOG] Vehicle deletion failed:', data);
        return {
          success: false,
          error: data.error?.message || 'Unknown error',
          details: JSON.stringify(data),
        };
      }

      console.log('[META CATALOG] Vehicle deleted successfully:', metaVehicleId);
      return {
        success: true,
        meta_vehicle_id: metaVehicleId,
        details: 'Vehicle deleted from catalog',
      };
    } catch (error) {
      console.error('[META CATALOG] Vehicle deletion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : 'Unknown',
      };
    }
  }

  /**
   * Sync multiple vehicles to the catalog
   */
  async syncBatch(vehicles: Array<{ vehicle: MetaVehicle; vehicleId: string }>): Promise<MetaCatalogSyncResult> {
    const results: MetaCatalogSyncResult = {
      total_vehicles: vehicles.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const { vehicle, vehicleId } of vehicles) {
      const result = await this.syncVehicle(vehicle, vehicleId);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          vehicle_id: vehicleId,
          error: result.error || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get catalog information
   */
  async getCatalogInfo(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.catalogId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Unknown error',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}