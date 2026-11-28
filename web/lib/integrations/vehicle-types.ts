
export interface VehiclePreview {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stockNumber: string | null;
  price: number | null;
  mileage: number | null;
  sourceUrl: string | null;
  images: string[];
  metadata?: Record<string, unknown>;
}

export interface ScanResult {
  success: boolean;
  complete: boolean;
  vehicles: VehiclePreview[];
  totalVehicles: number;
  pagesFetched: number;
  totalPages?: number;
  scanId?: string;
  error?: string;
  tableMissing?: boolean;
}

export interface ExtensionScanResult {
  ok: boolean;
  source: string;
  complete: boolean;
  allPagesLoaded: boolean;
  totalVehicles: number;
  totalPages: number;
  vehicles: unknown[];
  capturedAt: string;
  sourceUrl?: string;
  error?: string;
}

