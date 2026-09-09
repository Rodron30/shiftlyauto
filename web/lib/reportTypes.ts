// lib/reportTypes.ts
//
// Shape of the `reports.customer_report` JSONB column — the ONLY data
// exposed to the public share link (Blueprint §21-23). Deliberately a
// denormalized snapshot rather than live foreign keys, so a customer
// link never needs read access to `vehicles` or `history_events`.

export type CustomerReportHistoryEvent = {
  date: string | null;
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
};

export type CustomerReportPayload = {
  dealership: {
    name: string;
    logo_url: string | null;
  };
  vehicle: {
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
  };
  history_highlights: {
    theft_found: boolean;
    odometer_available: boolean;
  };
  theft: CustomerReportHistoryEvent[];
  odometer: CustomerReportHistoryEvent[];
  customer_summary: string;
  warnings: string[];
  data_source: string;
  generated_at: string;
};
