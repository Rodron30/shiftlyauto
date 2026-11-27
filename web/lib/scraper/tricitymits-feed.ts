export type TriCityFeedResponse = {
  results: unknown[];
  summary?: {
    total_vehicles?: number | string;
    [key: string]: unknown;
  };
  pagination?: {
    page?: number | string;
    page_size?: number | string;
    total_pages?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type TriCityFeedPage = {
  results: unknown[];
  totalVehicles: number | null;
  page: number;
  pageSize: number;
  totalPages: number | null;
  complete: boolean;
};

export interface TriCityFeedTransport {
  fetchInventory(
    endpoint: string
  ): Promise<TriCityFeedResponse>;
}
