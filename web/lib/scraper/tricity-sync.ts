export type TriCitySyncStats = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  errors: number;
};

export type TriCitySyncResult = {
  success: boolean;
  complete: boolean;
  startedAt: string;
  finishedAt: string;
  stats: TriCitySyncStats;
  errors: string[];
};

export interface TriCityInventorySync {
  sync(): Promise<TriCitySyncResult>;
}
