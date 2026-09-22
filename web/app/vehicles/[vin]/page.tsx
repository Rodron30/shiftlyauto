"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import VehicleImagePlaceholder from "@/components/VehicleImagePlaceholder";

function formatNumberInput(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");

  if (!cleaned) {
    return "";
  }

  const firstDotIndex = cleaned.indexOf(".");

  let integerPart =
    firstDotIndex === -1
      ? cleaned
      : cleaned.slice(0, firstDotIndex);

  const decimalPart =
    firstDotIndex === -1
      ? ""
      : cleaned
          .slice(firstDotIndex + 1)
          .replace(/\./g, "")
          .slice(0, 2);

  if (!integerPart) {
    integerPart = "0";
  }

  integerPart = integerPart.replace(/^0+(?=\d)/, "");

  const formattedInteger = Number(integerPart).toLocaleString(
    "en-US"
  );

  if (firstDotIndex !== -1) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
}

type Vehicle = {
  id: string;
  dealership_id: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  body: string | null;
  engine: string | null;
  drivetrain: string | null;
  transmission: string | null;
  fuel: string | null;
  price: number | null;
  currency: string | null;
  mileage: number | null;
  mileage_unit: string | null;
  status: string | null;
  primary_image: string | null;
  images: string[];
  description: string | null;
  location: string | null;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type Lead = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  status: "NEW" | "CONTACTED" | "NEGOTIATING" | "WON" | "LOST";
  follow_up_date: string | null;
  notes: string | null;
  vehicle?: {
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
  } | null;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
};

type CustomersResponse = {
  customers?: Customer[];
  error?: string;
};

type LeadsResponse = {
  leads?: Lead[];
  error?: string;
};

type VehicleResponse = {
  success: boolean;
  vehicle?: Vehicle;
  error?: string;
  vin?: string;
};

type VehicleMatch = Vehicle & {
  matchScore: number;
  reasons: string[];
};

type MatchingResponse = {
  success: boolean;
  sourceVehicle?: Vehicle;
  matches?: VehicleMatch[];
  count?: number;
  error?: string;
};

type PricingComparable = {
  id: string;
  source: string;
  source_url: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  location: string | null;
  listed_at: string | null;
  fetched_at: string;
};

type PricingResponse = {
  success: boolean;
  vehicle?: {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    current_price: number | null;
    mileage: number | null;
    status: string;
  };
  pricing?: {
    low_price: number | null;
    market_price: number | null;
    high_price: number | null;
    recommended_price: number | null;
    comparable_count: number;
    calculated_at: string | null;
  };
  days_on_market?: number | null;
  comparables?: PricingComparable[];
  error?: string;
};

type HistoryEvent = {
  id: string;
  event_date: string | null;
  event_type?: "THEFT" | "ODOMETER" | "ACCIDENT" | "CLAIM" | "OTHER";
  description: string | null;
  location: string | null;
  odometer: number | null;
  source: string;
  created_at?: string;
};

type HistoryResponse = {
  success: boolean;
  status?: "VEHICLE_NOT_SAVED" | "CHECKED";
  theft?: HistoryEvent[];
  odometer?: HistoryEvent[];
  accident?: HistoryEvent[];
  claim?: HistoryEvent[];
  odometerAnomaly?: boolean;
  error?: string;
};

type AiSummary = {
  quick_summary: string;
  salesperson_explanation: string;
  customer_summary: string;
  warnings: string[];
  facts: string[];
};

export default function VehicleDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const vin = Array.isArray(params?.vin)
    ? params.vin[0]
    : params?.vin;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [matching, setMatching] =
    useState<MatchingResponse | null>(null);
  const [matchingLoading, setMatchingLoading] =
    useState(true);
  const [matchingError, setMatchingError] =
    useState("");

  const [pricing, setPricing] =
    useState<PricingResponse | null>(null);
  const [pricingLoading, setPricingLoading] =
    useState(true);
  const [pricingError, setPricingError] =
    useState("");

  const [history, setHistory] =
    useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] =
    useState(true);
  const [historyError, setHistoryError] =
    useState("");

  const [aiSummary, setAiSummary] =
    useState<AiSummary | null>(null);
  const [aiLoading, setAiLoading] =
    useState(false);
  const [aiError, setAiError] =
    useState("");

  const [reportUrl, setReportUrl] =
    useState<string | null>(null);
  const [reportLoading, setReportLoading] =
    useState(false);
  const [reportError, setReportError] =
    useState("");
  const [customers, setCustomers] =
    useState<Customer[]>([]);
  const [leads, setLeads] =
    useState<Lead[]>([]);
  const [crmLoading, setCrmLoading] =
    useState(true);
  const [crmError, setCrmError] =
    useState("");
  const [selectedCustomerId, setSelectedCustomerId] =
    useState("");
  const [selectedLeadId, setSelectedLeadId] =
    useState("");

  const [copied, setCopied] =
    useState(false);

  const [showAddEvent, setShowAddEvent] =
    useState(false);
  const [newEventType, setNewEventType] =
    useState<"THEFT" | "ODOMETER" | "ACCIDENT" | "CLAIM">("THEFT");
  const [newEventDate, setNewEventDate] =
    useState("");
  const [newEventDescription, setNewEventDescription] =
    useState("");
  const [newEventOdometer, setNewEventOdometer] =
    useState("");
  const [addEventLoading, setAddEventLoading] =
    useState(false);
  const [addEventError, setAddEventError] =
    useState("");

  const [archiveLoading, setArchiveLoading] =
    useState(false);

  const [imageError, setImageError] = useState(false);

  const [marketplaceLoading, setMarketplaceLoading] =
    useState(false);

  const [showAddComparable, setShowAddComparable] =
    useState(false);
  const [newCompYear, setNewCompYear] = useState("");
  const [newCompMake, setNewCompMake] = useState("");
  const [newCompModel, setNewCompModel] = useState("");
  const [newCompTrim, setNewCompTrim] = useState("");
  const [newCompPrice, setNewCompPrice] = useState("");
  const [newCompMileage, setNewCompMileage] = useState("");
  const [newCompLocation, setNewCompLocation] = useState("");
  const [addComparableLoading, setAddComparableLoading] =
    useState(false);
  const [addComparableError, setAddComparableError] =
    useState("");

  async function refreshMatching() {
    if (!vin) return;

    try {
      setMatchingLoading(true);
      setMatchingError("");

      const normalizedVin = decodeURIComponent(vin)
        .trim()
        .toUpperCase();

      const response = await fetch(
        `/api/vehicles/matching/${encodeURIComponent(
          normalizedVin
        )}`,
        {
          cache: "no-store",
        }
      );

      const result: MatchingResponse =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to load vehicle matches."
        );
      }

      setMatching(result);
    } catch (err) {
      console.error(
        "Vehicle matching error:",
        err
      );

      setMatchingError(
        err instanceof Error
          ? err.message
          : "Failed to load vehicle matches."
      );
    } finally {
      setMatchingLoading(false);
    }
  }

  async function refreshPricing() {
    if (!vin) return;

    try {
      setPricingLoading(true);
      setPricingError("");

      const normalizedVin = decodeURIComponent(vin)
        .trim()
        .toUpperCase();

      const response = await fetch(
        `/api/pricing/${encodeURIComponent(normalizedVin)}`,
        {
          cache: "no-store",
        }
      );

      const result: PricingResponse =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to load pricing intelligence."
        );
      }

      setPricing(result);
    } catch (err) {
      console.error(
        "Vehicle pricing error:",
        err
      );

      setPricingError(
        err instanceof Error
          ? err.message
          : "Failed to load pricing intelligence."
      );
    } finally {
      setPricingLoading(false);
    }
  }

  async function refreshHistory() {
    if (!vin) return;

    try {
      setHistoryLoading(true);
      setHistoryError("");

      const normalizedVin = decodeURIComponent(vin)
        .trim()
        .toUpperCase();

      const response = await fetch(
        `/api/history/${encodeURIComponent(normalizedVin)}`,
        {
          cache: "no-store",
        }
      );

      const result: HistoryResponse =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to load vehicle history."
        );
      }

      setHistory(result);
    } catch (err) {
      console.error(
        "Vehicle history error:",
        err
      );

      setHistoryError(
        err instanceof Error
          ? err.message
          : "Failed to load history."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function refreshCrm() {
    try {
      setCrmLoading(true);
      setCrmError("");

      const [customersResponse, leadsResponse] =
        await Promise.all([
          fetch("/api/customers", {
            cache: "no-store",
          }),
          fetch("/api/leads", {
            cache: "no-store",
          }),
        ]);

      const customersResult: CustomersResponse =
        await customersResponse.json();

      const leadsResult: LeadsResponse =
        await leadsResponse.json();

      if (
        !customersResponse.ok ||
        customersResult.error
      ) {
        throw new Error(
          customersResult.error ||
            "Failed to load customers."
        );
      }

      if (
        !leadsResponse.ok ||
        leadsResult.error
      ) {
        throw new Error(
          leadsResult.error ||
            "Failed to load leads."
        );
      }

      setCustomers(customersResult.customers ?? []);
      setLeads(leadsResult.leads ?? []);
    } catch (err) {
      console.error(
        "CRM data loading error:",
        err
      );

      setCrmError(
        err instanceof Error
          ? err.message
          : "Failed to load CRM data."
      );
    } finally {
      setCrmLoading(false);
    }
  }
  useEffect(() => {
    if (!vin) return;

    async function loadVehicle() {
      if (!vin) return;

      try {
        setLoading(true);
        setError("");
        setImageError(false);

        const normalizedVin = decodeURIComponent(vin)
          .trim()
          .toUpperCase();

        const response = await fetch(
          `/api/vehicles/${encodeURIComponent(normalizedVin)}`,
          {
            cache: "no-store",
          }
        );

        const result: VehicleResponse =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.vehicle
        ) {
          throw new Error(
            result.error ||
              "Vehicle not found."
          );
        }

        setVehicle(result.vehicle);
      } catch (err) {
        console.error(
          "Vehicle details error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load vehicle."
        );
      } finally {
        setLoading(false);
      }
    }

    const loadVehicleData = async () => {
      await Promise.all([
        loadVehicle(),
        refreshMatching(),
        refreshHistory(),
        refreshPricing(),
        refreshCrm(),
      ]);
    };

    void loadVehicleData();
  }, [vin]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keyboard navigation when typing in input elements
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Only handle gallery navigation when vehicle has multiple images
      const galleryImages =
        Array.isArray(vehicle?.images) && vehicle.images.length > 0
          ? vehicle.images
          : vehicle?.primary_image
            ? [vehicle.primary_image]
            : [];

      if (galleryImages.length <= 1) {
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          setActiveImageIndex((current) =>
            current === 0 ? galleryImages.length - 1 : current - 1
          );
          break;
        case "ArrowRight":
          event.preventDefault();
          setActiveImageIndex((current) =>
            current === galleryImages.length - 1 ? 0 : current + 1
          );
          break;
        case "Home":
          event.preventDefault();
          setActiveImageIndex(0);
          break;
        case "End":
          event.preventDefault();
          setActiveImageIndex(galleryImages.length - 1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [vehicle]);

  const handleGenerateAiSummary = async () => {
    if (!vehicle || !history) return;

    try {
      setAiLoading(true);
      setAiError("");

      const response = await fetch(
        "/api/ai/summarize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vehicle: {
              year: vehicle.year,
              make: vehicle.make,
              model: vehicle.model,
              trim: vehicle.trim,
            },
            mileageUnit: vehicle.mileage_unit ?? null,
            history: {
              theft: history.theft ?? [],
              odometer: history.odometer ?? [],
              accident: history.accident ?? [],
              claim: history.claim ?? [],
            },
            vehicleId: vehicle.id,
            odometerAnomaly:
              history.odometerAnomaly ?? false,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to generate AI summary."
        );
      }

      setAiSummary(result.summary);
      setReportUrl(null);
    } catch (err) {
      console.error(
        "AI summary error:",
        err
      );

      setAiError(
        err instanceof Error
          ? err.message
          : "Failed to generate AI summary."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateReport = async () => {
    if (!vehicle || !aiSummary) return;

    try {
      setReportLoading(true);
      setReportError("");
      setCopied(false);

      const response = await fetch(
        "/api/reports",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vehicleId: vehicle.id,
            aiSummary,
            customerId: selectedCustomerId || null,
            leadId: selectedLeadId || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to create report."
        );
      }

      const url =
        `${window.location.origin}` +
        `/report/${result.report.share_token}`;

      setReportUrl(url);
    } catch (err) {
      console.error(
        "Report creation error:",
        err
      );

      setReportError(
        err instanceof Error
          ? err.message
          : "Failed to create report."
      );
    } finally {
      setReportLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!reportUrl) return;

    try {
      await navigator.clipboard.writeText(
        reportUrl
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API may fail silently.
    }
  };

  const handleRevokeReport = async () => {
    if (!reportUrl) return;

    const token =
      reportUrl.split("/report/")[1];

    if (!token) return;

    try {
      setReportLoading(true);
      setReportError("");

      const response = await fetch(
        `/api/reports/${encodeURIComponent(token)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to revoke report."
        );
      }

      setReportUrl(null);
    } catch (err) {
      console.error(
        "Report revoke error:",
        err
      );

      setReportError(
        err instanceof Error
          ? err.message
          : "Failed to revoke report."
      );
    } finally {
      setReportLoading(false);
    }
  };

  const handleAddEvent = async (
    e: FormEvent
  ) => {
    e.preventDefault();

    if (!vin) return;

    setAddEventError("");

    if (
      newEventType === "ODOMETER" &&
      !newEventOdometer
    ) {
      setAddEventError(
        "Enter an odometer reading."
      );
      return;
    }

    try {
      setAddEventLoading(true);

      const normalizedVin =
        decodeURIComponent(vin)
          .trim()
          .toUpperCase();

      const response = await fetch(
        `/api/history/${encodeURIComponent(normalizedVin)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventType: newEventType,
            eventDate: newEventDate || null,
            description:
              newEventDescription.trim() || null,
            odometer:
              newEventType === "ODOMETER" &&
              newEventOdometer
                ? Number(
                    newEventOdometer.replace(
                      /,/g,
                      ""
                    )
                  )
                : null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to save history record."
        );
      }

      setShowAddEvent(false);
      setNewEventDate("");
      setNewEventDescription("");
      setNewEventOdometer("");
      setAddEventError("");

      await refreshHistory();
    } catch (err) {
      console.error(
        "Add history event error:",
        err
      );

      setAddEventError(
        err instanceof Error
          ? err.message
          : "Failed to save history record."
      );
    } finally {
      setAddEventLoading(false);
    }
  };

  const handleAddComparable = async (
    e: FormEvent
  ) => {
    e.preventDefault();

    if (!vin) return;

    setAddComparableError("");

    const priceValue = Number(
      newCompPrice.replace(/,/g, "")
    );

    if (
      !newCompPrice ||
      !Number.isFinite(priceValue) ||
      priceValue <= 0
    ) {
      setAddComparableError(
        "Enter a valid comparable price."
      );
      return;
    }

    try {
      setAddComparableLoading(true);

      const normalizedVin =
        decodeURIComponent(vin)
          .trim()
          .toUpperCase();

      const response = await fetch(
        `/api/pricing/${encodeURIComponent(normalizedVin)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            price: priceValue,
            year: newCompYear
              ? Number(newCompYear)
              : null,
            make: newCompMake.trim() || null,
            model: newCompModel.trim() || null,
            trim: newCompTrim.trim() || null,
            mileage: newCompMileage
              ? Number(
                  newCompMileage.replace(/,/g, "")
                )
              : null,
            location:
              newCompLocation.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to save comparable listing."
        );
      }

      setShowAddComparable(false);
      setNewCompYear("");
      setNewCompMake("");
      setNewCompModel("");
      setNewCompTrim("");
      setNewCompPrice("");
      setNewCompMileage("");
      setNewCompLocation("");
      setAddComparableError("");

      await refreshPricing();
    } catch (err) {
      console.error(
        "Add comparable listing error:",
        err
      );

      setAddComparableError(
        err instanceof Error
          ? err.message
          : "Failed to save comparable listing."
      );
    } finally {
      setAddComparableLoading(false);
    }
  };

  const handleOdometerChange = (
    value: string
  ) => {
    const raw = value.replace(/\D/g, "");

    if (!raw) {
      setNewEventOdometer("");
      return;
    }

    setNewEventOdometer(
      Number(raw).toLocaleString("en-US")
    );
  };

  const handleArchiveVehicle = async () => {
    if (!vin || !vehicle || archiveLoading) {
      return;
    }

    const confirmed = window.confirm(
      `Archive ${vehicle.year} ${vehicle.make} ${vehicle.model}?\n\n` +
        "This will remove the vehicle from active inventory. " +
        "Its history and reports will be preserved."
    );

    if (!confirmed) {
      return;
    }

    try {
      setArchiveLoading(true);
      setError("");

      const normalizedVin =
        decodeURIComponent(vin)
          .trim()
          .toUpperCase();

      const response = await fetch(
        `/api/vehicles/${encodeURIComponent(normalizedVin)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to archive vehicle."
        );
      }

      router.push("/vehicles");
      router.refresh();
    } catch (err) {
      console.error(
        "Archive vehicle error:",
        err
      );

      setArchiveLoading(false);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to archive vehicle."
      );
    }
  };

  const handlePostToMarketplace = async () => {
    if (!vin || !vehicle || marketplaceLoading) {
      return;
    }

    try {
      setMarketplaceLoading(true);

      // Generate Marketplace listing data
      const normalizedVin =
        decodeURIComponent(vin)
          .trim()
          .toUpperCase();

      const response = await fetch(
        `/api/vehicles/${encodeURIComponent(normalizedVin)}/marketplace-listing`
      );

      if (!response.ok) {
        throw new Error("Failed to generate Marketplace listing");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate listing");
      }

      // Send listing data to Chrome extension using externally_connectable
      const extensionId = 
        localStorage.getItem("shiftly_extension_id") ||
        (window as any).shiftlyExtensionId ||
        null;
      
      if (!extensionId) {
        alert("No extension ID found. Please ensure the Shiftly Auto extension is installed and refresh the page. This happens when the extension content script hasn't loaded yet.");
        return;
      }
      
      // Check for Chrome extension API availability across different browsers
      const hasChromeRuntime = typeof (window as any).chrome !== 'undefined' && 
                               (window as any).chrome !== null && 
                               typeof (window as any).chrome.runtime !== 'undefined';
      
      if (!hasChromeRuntime) {
        alert("Chrome extension API not available. Please ensure you're using a Chromium-based browser (Chrome, Edge, Opera) with the Shiftly Auto extension installed.");
        return;
      }

      (window as any).chrome.runtime.sendMessage(extensionId, {
        type: "SHIFTLY_POST_TO_MARKETPLACE",
        listing: data.listing
      }, (response: any) => {
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.lastError) {
          alert(`Extension communication error: ${window.chrome.runtime.lastError.message}`);
        } else if (response && !response.success) {
          alert(`Marketplace posting error: ${response.error}`);
        } else {
          alert("Marketplace listing sent to extension successfully! Facebook Marketplace should open shortly.");
        }
      });
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to prepare Marketplace listing"
      );
    } finally {
      setMarketplaceLoading(false);
    }
  };

  const theftEvents =
    history?.theft ?? [];

  const odometerEvents =
    history?.odometer ?? [];

  const accidentEvents =
    history?.accident ?? [];

  const claimEvents =
    history?.claim ?? [];

  const hasTheft =
    theftEvents.length > 0;

  const hasOdometer =
    odometerEvents.length > 0;

  const hasAccident =
    accidentEvents.length > 0;

  const hasClaim =
    claimEvents.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <Link
        href="/vehicles"
        className="text-xs font-semibold text-neutral-600 hover:text-neutral-900"
      >
        &lt; Back to Vehicles
      </Link>

      {loading && (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-medium text-neutral-700">
            Loading vehicle...
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            Fetching vehicle information.
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-white p-4 shadow-sm">
          <h1 className="text-sm font-semibold text-neutral-900">
            Unable to load vehicle
          </h1>

          <p className="mt-1 text-xs text-red-600">
            {error}
          </p>

            <Link
              href="/vehicles"
              className="mt-3 inline-flex rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
            >
              Back to Vehicles
            </Link>
          </div>
        )}

        {!loading &&
          !error &&
          vehicle && (
            <>
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <h1 className="text-lg font-bold text-gray-900">
                      {vehicle.year}{" "}
                      {vehicle.make}{" "}
                      {vehicle.model}
                    </h1>

                    {vehicle.trim && (
                      <p className="text-xs text-gray-500">
                        {vehicle.trim}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {vehicle.vin ? (
                      <Link
                        href={`/vehicles/${encodeURIComponent(
                          vehicle.vin
                        )}/edit`}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Edit Vehicle
                      </Link>
                    ) : (
                      <span className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-400">
                        VIN Required for Edit
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleArchiveVehicle}
                      disabled={archiveLoading}
                      className="inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {archiveLoading
                        ? "Archiving..."
                        : "Archive Vehicle"}
                    </button>

                    <button
                      type="button"
                      onClick={handlePostToMarketplace}
                      disabled={marketplaceLoading}
                      className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {marketplaceLoading
                        ? "Opening Marketplace..."
                        : "Post to Marketplace"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Vehicle Image Gallery */}
                  <div className="rounded-md overflow-hidden bg-gray-100 sm:col-span-2 lg:col-span-1">
                    {(() => {
                      const galleryImages =
                        Array.isArray(vehicle.images) && vehicle.images.length > 0
                          ? vehicle.images
                          : vehicle.primary_image
                            ? [vehicle.primary_image]
                            : [];

                      const showPreviousImage = () => {
                        setActiveImageIndex((current) =>
                          current === 0 ? galleryImages.length - 1 : current - 1
                        );
                      };

                      const showNextImage = () => {
                        setActiveImageIndex((current) =>
                          current === galleryImages.length - 1 ? 0 : current + 1
                        );
                      };

                      if (galleryImages.length === 0) {
                        return (
                          <div className="h-48 flex items-center justify-center bg-gray-100">
                            <VehicleImagePlaceholder />
                          </div>
                        );
                      }

                      return (
                        <>
                          <div className="relative overflow-hidden">
                            <img
                              src={galleryImages[activeImageIndex]}
                              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo ${activeImageIndex + 1}`}
                              className="h-48 w-full object-cover"
                              onError={() => setImageError(true)}
                            />

                            {galleryImages.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={showPreviousImage}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/80"
                                  aria-label="Previous photo"
                                >
                                  ←
                                </button>

                                <button
                                  type="button"
                                  onClick={showNextImage}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/80"
                                  aria-label="Next photo"
                                >
                                  →
                                </button>

                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                                  {activeImageIndex + 1} / {galleryImages.length}
                                </div>
                              </>
                            )}
                          </div>

                          {galleryImages.length > 1 && (
                            <div className="mt-2 flex flex-nowrap gap-1.5 overflow-x-auto">
                              {galleryImages.map((image, index) => (
                                <button
                                  key={`${image}-${index}`}
                                  type="button"
                                  onClick={() => setActiveImageIndex(index)}
                                  className={`overflow-hidden rounded border bg-white flex-shrink-0 ${
                                    index === activeImageIndex
                                      ? "border-blue-600 ring-2 ring-blue-200"
                                      : "border-neutral-200"
                                  }`}
                                  aria-label={`View photo ${index + 1}`}
                                >
                                  <img
                                    src={image}
                                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo ${index + 1}`}
                                    className="h-12 w-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Vehicle Details */}
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Vehicle Details
                    </p>

                    <div className="mt-2">
                      <p className="font-mono text-sm font-bold text-gray-900">
                        {vehicle.vin || "VIN Not Available"}
                      </p>

                      <h2 className="mt-1 text-base font-bold text-gray-900">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h2>

                      {vehicle.trim && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          Trim: {vehicle.trim}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      <div>
                        <span className="text-xs text-gray-500">Price:</span>{" "}
                        <span className="text-sm font-semibold text-gray-900">
                          {vehicle.price != null
                            ? (() => {
                                const currencyCode = vehicle.currency || "CAD";
                                const localeMap: Record<string, string> = {
                                  USD: "en-US",
                                  PHP: "en-PH",
                                  EUR: "de-DE",
                                  GBP: "en-GB",
                                  CAD: "en-CA",
                                  AUD: "en-AU",
                                  JPY: "ja-JP",
                                  CNY: "zh-CN",
                                  SGD: "en-SG",
                                  HKD: "en-HK",
                                  MYR: "en-MY",
                                  THB: "th-TH",
                                  IDR: "id-ID",
                                  VND: "vi-VN",
                                };
                                const locale = localeMap[currencyCode] || "en-US";

                                return new Intl.NumberFormat(locale, {
                                  style: "currency",
                                  currency: currencyCode,
                                  useGrouping: true,
                                  maximumFractionDigits: 0,
                                }).format(vehicle.price);
                              })()
                            : "Not specified"}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-500">Mileage:</span>{" "}
                        <span className="text-sm font-semibold text-gray-900">
                          {vehicle.mileage != null
                            ? `${vehicle.mileage.toLocaleString()} ${(vehicle.mileage_unit || "KM").toUpperCase()}`
                            : "Not specified"}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-500">Body:</span>{" "}
                        <span className="text-sm text-gray-800">
                          {vehicle.body || "Not specified"}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-500">Engine:</span>{" "}
                        <span className="text-sm text-gray-800">
                          {vehicle.engine || "Not specified"}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-500">Drivetrain:</span>{" "}
                        <span className="text-sm text-gray-800">
                          {vehicle.drivetrain || "Not specified"}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-500">Transmission:</span>{" "}
                        <span className="text-sm text-gray-800">
                          {vehicle.transmission || "Not specified"}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-500">Fuel:</span>{" "}
                        <span className="text-sm text-gray-800">
                          {vehicle.fuel || "Not specified"}
                        </span>
                      </div>

                      {vehicle.location && (
                        <div className="sm:col-span-2">
                          <span className="text-xs text-gray-500">Location:</span>{" "}
                          <span className="text-sm text-gray-800">
                            {vehicle.location}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* V2 VEHICLE MATCHING */}
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      V2 Inventory Intelligence
                    </p>

                    <h2 className="mt-0.5 text-sm font-bold text-gray-900">
                      Similar Vehicles
                    </h2>
                  </div>

                  {!matchingLoading &&
                    matching &&
                    matching.count !== undefined && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                        {matching.count}{" "}
                        {matching.count === 1
                          ? "match"
                          : "matches"}
                      </span>
                    )}
                </div>

                {matchingLoading && (
                  <div className="mt-2 rounded-md bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">
                      Finding similar vehicles...
                    </p>
                  </div>
                )}

                {!matchingLoading &&
                  matchingError && (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2">
                      <p className="text-xs font-medium text-red-700">
                        Unable to load vehicle matches.
                      </p>

                      <p className="mt-0.5 text-xs text-red-600">
                        {matchingError}
                      </p>

                      <button
                        type="button"
                        onClick={refreshMatching}
                        className="mt-1 rounded-md border border-red-300 bg-white px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                {!matchingLoading &&
                  !matchingError &&
                  matching &&
                  matching.matches &&
                  matching.matches.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {matching.matches.map((match) => (
                        match.vin ? (
                          <Link
                            key={match.id}
                            href={`/vehicles/${encodeURIComponent(
                              match.vin
                            )}`}
                            className="block rounded-lg border border-gray-200 p-2 transition hover:border-gray-400 hover:bg-gray-50"
                          >
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900">
                                {match.year}{" "}
                                {match.make}{" "}
                                {match.model}
                              </p>

                              {match.trim && (
                                <p className="text-[10px] text-gray-500">
                                  {match.trim}
                                </p>
                              )}

                              <p className="break-all font-mono text-[10px] text-gray-400">
                                VIN: {match.vin}
                              </p>
                            </div>

                            <div className="shrink-0 text-left sm:text-right">
                              <p className="text-sm font-bold text-gray-900">
                                {match.matchScore}%
                              </p>

                              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                                Match
                              </p>
                            </div>
                          </div>

                          {match.reasons.length > 0 && (
                            <div className="mt-1.5">
                              <p className="text-[10px] font-medium text-gray-600">
                                {match.reasons.join(" · ")}
                              </p>
                            </div>
                          )}
                        </Link>
                        ) : null
                      ))}
                    </div>
                  )}

                {!matchingLoading &&
                  !matchingError &&
                  matching &&
                  matching.matches &&
                  matching.matches.length === 0 && (
                    <div className="mt-2 rounded-md bg-gray-50 p-2">
                      <p className="text-xs text-gray-500">
                        No similar vehicles were found
                        in your active inventory.
                      </p>
                    </div>
                  )}
              </div>

              {/* V2.2 PRICING */}
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      V2.2 Pricing Intelligence
                    </p>

                    <h2 className="mt-0.5 text-sm font-bold text-gray-900">
                      Price Intelligence
                    </h2>
                  </div>

                  {pricing?.pricing?.calculated_at && (
                    <p className="text-[10px] text-gray-400">
                      Updated{" "}
                      {new Date(
                        pricing.pricing.calculated_at
                      ).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {pricingLoading && (
                  <div className="mt-2 rounded-md bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">
                      Loading pricing intelligence...
                    </p>
                  </div>
                )}

                {!pricingLoading && pricingError && (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2">
                    <p className="text-xs font-medium text-red-700">
                      Unable to load pricing intelligence.
                    </p>

                    <p className="mt-0.5 text-xs text-red-600">
                      {pricingError}
                    </p>
                  </div>
                )}

                {!pricingLoading &&
                  !pricingError &&
                  pricing && (
                    <>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            Current Price
                          </p>

                          <p className="mt-0.5 text-sm font-bold text-gray-900">
                            {pricing.vehicle?.current_price != null
                              ? `$${pricing.vehicle.current_price.toLocaleString()}`
                              : "Not specified"}
                          </p>
                        </div>

                        <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            Market Price
                          </p>

                          <p className="mt-0.5 text-sm font-bold text-gray-900">
                            {pricing.pricing?.market_price != null
                              ? `$${pricing.pricing.market_price.toLocaleString()}`
                              : "Not specified"}
                          </p>
                        </div>

                        <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            Recommended Price
                          </p>

                          <p className="mt-0.5 text-sm font-bold text-gray-900">
                            {pricing.pricing?.recommended_price != null
                              ? `$${pricing.pricing.recommended_price.toLocaleString()}`
                              : "Not specified"}
                          </p>
                        </div>

                        <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            Days on Market
                          </p>

                          <p className="mt-0.5 text-sm font-bold text-gray-900">
                            {pricing.days_on_market != null
                              ? pricing.days_on_market
                              : "Not specified"}
                          </p>

                          {pricing.days_on_market != null && (
                            <p className="text-[10px] text-gray-500">
                              days
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-md border border-gray-200 p-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            Low Market
                          </p>

                          <p className="mt-0.5 text-xs font-semibold text-gray-900">
                            {pricing.pricing?.low_price != null
                              ? `$${pricing.pricing.low_price.toLocaleString()}`
                              : "Not specified"}
                          </p>
                        </div>

                        <div className="rounded-md border border-gray-200 p-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            High Market
                          </p>

                          <p className="mt-0.5 text-xs font-semibold text-gray-900">
                            {pricing.pricing?.high_price != null
                              ? `$${pricing.pricing.high_price.toLocaleString()}`
                              : "Not specified"}
                          </p>
                        </div>

                        <div className="rounded-md border border-gray-200 p-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            Comparables
                          </p>

                          <p className="mt-0.5 text-xs font-semibold text-gray-900">
                            {pricing.pricing?.comparable_count ?? 0}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 border-t border-gray-100 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setShowAddComparable((v) => !v)
                          }
                          className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                        >
                          {showAddComparable
                            ? "Cancel"
                            : "+ Add Comparable"}
                        </button>

                        {showAddComparable && (
                          <form
                            onSubmit={handleAddComparable}
                            className="mt-2 space-y-2"
                          >
                            <p className="text-[10px] text-gray-500">
                              No commercial market-data
                              provider is connected yet.
                              Comparables added here are
                              tagged &quot;Manual Entry
                              (Dealer)&quot; and immediately
                              recalculate the pricing above.
                            </p>

                            <div className="grid gap-2 sm:grid-cols-3">
                              <div>
                                <label className="block text-[10px] font-medium text-gray-500">
                                  Year
                                </label>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="2026"
                                  value={newCompYear}
                                  onChange={(e) =>
                                    setNewCompYear(
                                      e.target.value.replace(
                                        /\D/g,
                                        ""
                                      )
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-medium text-gray-500">
                                  Make
                                </label>

                                <input
                                  type="text"
                                  placeholder="Honda"
                                  value={newCompMake}
                                  onChange={(e) =>
                                    setNewCompMake(
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-medium text-gray-500">
                                  Model
                                </label>

                                <input
                                  type="text"
                                  placeholder="Civic"
                                  value={newCompModel}
                                  onChange={(e) =>
                                    setNewCompModel(
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                                />
                              </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-3">
                              <div>
                                <label className="block text-[10px] font-medium text-gray-500">
                                  Trim
                                </label>

                                <input
                                  type="text"
                                  placeholder="Sport"
                                  value={newCompTrim}
                                  onChange={(e) =>
                                    setNewCompTrim(
                                      e.target.value
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-medium text-gray-500">
                                  Price ($)
                                </label>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  required
                                  placeholder="1,200,000"
                                  value={newCompPrice}
                                  onChange={(e) =>
                                    setNewCompPrice(
                                      formatNumberInput(
                                        e.target.value
                                      )
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-medium text-gray-500">
                                  Mileage ({vehicle.mileage_unit || 'km'})
                                </label>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="25,000"
                                  value={newCompMileage}
                                  onChange={(e) =>
                                    setNewCompMileage(
                                      formatNumberInput(
                                        e.target.value
                                      )
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-gray-500">
                                Location
                              </label>

                              <input
                                type="text"
                                placeholder="Quezon City"
                                value={newCompLocation}
                                onChange={(e) =>
                                  setNewCompLocation(
                                    e.target.value
                                  )
                                }
                                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                              />
                            </div>

                            {addComparableError && (
                              <p className="text-xs text-red-600">
                                {addComparableError}
                              </p>
                            )}

                            <button
                              type="submit"
                              disabled={addComparableLoading}
                              className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              {addComparableLoading
                                ? "Saving..."
                                : "Save Comparable"}
                            </button>
                          </form>
                        )}
                      </div>

                      {pricing.comparables &&
                        pricing.comparables.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-xs font-semibold text-gray-900">
                                Competitive Listings
                              </h3>

                              <span className="text-[10px] text-gray-400">
                                {pricing.comparables.length} listing
                                {pricing.comparables.length === 1
                                  ? ""
                                  : "s"}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1.5">
                              {pricing.comparables.map(
                                (comparable) => (
                                  <div
                                    key={comparable.id}
                                    className="rounded-md border border-gray-200 p-2"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-semibold text-gray-900">
                                          {comparable.year ?? "N/A"}{" "}
                                          {comparable.make ?? ""}{" "}
                                          {comparable.model ?? ""}
                                        </p>

                                        {comparable.trim && (
                                          <p className="text-[10px] text-gray-500">
                                            {comparable.trim}
                                          </p>
                                        )}
                                      </div>

                                      <p className="text-xs font-bold text-gray-900">
                                        {comparable.price != null
                                          ? `$${comparable.price.toLocaleString()}`
                                          : "Not specified"}
                                      </p>
                                    </div>

                                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                                      <span>
                                        Mileage:{" "}
                                        {comparable.mileage != null
                                          ? `${comparable.mileage.toLocaleString()} ${vehicle.mileage_unit || 'km'}`
                                          : "Not specified"}
                                      </span>

                                      <span>
                                        Location:{" "}
                                        {comparable.location || "N/A"}
                                      </span>

                                      <span>
                                        Source:{" "}
                                        {comparable.source}
                                      </span>
                                    </div>


                                    {comparable.source_url && (
                                      <a
                                        href={comparable.source_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-1.5 inline-block text-[10px] font-medium text-gray-700 underline hover:text-gray-900"
                                      >
                                        View listing
                                      </a>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {!pricing.comparables?.length && (
                        <div className="mt-3 rounded-md bg-gray-50 p-2">
                          <p className="text-xs text-gray-500">
                            No competitive listings are available yet.
                          </p>
                        </div>
                      )}
                    </>
                  )}
              </div>

              {/* VEHICLE STATUS */}
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">
                  Vehicle Status
                </h2>

                {historyLoading && (
                  <p className="mt-2 text-xs text-gray-500">
                    Checking available history...
                  </p>
                )}

                {!historyLoading &&
                  historyError && (
                    <p className="mt-2 text-xs text-red-600">
                      {historyError}
                    </p>
                  )}

                {!historyLoading &&
                  !historyError &&
                  history && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={
                          hasTheft
                            ? "text-amber-700"
                            : "text-green-700"
                        }>
                          {hasTheft ? "\u2713" : "\u2013"}
                        </span>

                        <span className={
                          hasTheft
                            ? "text-amber-700"
                            : "text-green-700"
                        }>
                          {hasTheft
                            ? "Theft-related record found"
                            : "No theft-related record"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <span>
                          {hasOdometer ? "\u2713" : "\u2013"}
                        </span>

                        <span>
                          {hasOdometer
                            ? "Odometer records available"
                            : "No odometer records"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <span>
                          {hasAccident ? "\u2713" : "\u2013"}
                        </span>

                        <span>
                          {hasAccident
                            ? "Accident records available"
                            : "No accident records"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <span>
                          {hasClaim ? "\u2713" : "\u2013"}
                        </span>

                        <span>
                          {hasClaim
                            ? "Insurance claim records available"
                            : "No insurance claim records"}
                        </span>
                      </div>
                      {history.odometerAnomaly && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 sm:col-span-2">
                          <span>\u26A0 </span>

                          <span>
                            Odometer Pattern Requires Review
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                <div className="mt-3 border-t border-gray-100 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAddEvent((v) => !v)
                    }
                    className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                  >
                    {showAddEvent
                      ? "Cancel"
                      : "+ Add History Record"}
                  </button>

                  {showAddEvent && (
                    <form
                      onSubmit={handleAddEvent}
                      className="mt-2 space-y-2"
                    >
                      <p className="text-[10px] text-gray-500">
                        No commercial vehicle-history
                        provider is connected yet.
                        Records added here are tagged
                        &quot;Manual Entry (Dealer)&quot;.
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            checked={
                              newEventType === "THEFT"
                            }
                            onChange={() => {
                              setNewEventType("THEFT");
                              setNewEventOdometer("");
                            }}
                          />
                          Theft
                        </label>

                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            checked={
                              newEventType === "ODOMETER"
                            }
                            onChange={() =>
                              setNewEventType("ODOMETER")
                            }
                          />
                          Odometer
                        </label>

                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            checked={
                              newEventType === "ACCIDENT"
                            }
                            onChange={() => {
                              setNewEventType("ACCIDENT");
                              setNewEventOdometer("");
                            }}
                          />
                          Accident
                        </label>

                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            checked={
                              newEventType === "CLAIM"
                            }
                            onChange={() => {
                              setNewEventType("CLAIM");
                              setNewEventOdometer("");
                            }}
                          />
                          Insurance Claim
                        </label>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500">
                            Date
                          </label>

                          <input
                            type="date"
                            value={newEventDate}
                            onChange={(e) =>
                              setNewEventDate(
                                e.target.value
                              )
                            }
                            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                          />
                        </div>

                        {newEventType === "ODOMETER" && (
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500">
                              Odometer ({vehicle.mileage_unit || 'km'})
                            </label>

                            <input
                              type="text"
                              inputMode="numeric"
                              required
                              value={newEventOdometer}
                              onChange={(e) =>
                                handleOdometerChange(
                                  e.target.value
                                )
                              }
                              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-gray-500">
                          Description
                        </label>

                        <input
                          type="text"
                          placeholder={
                            newEventType === "THEFT"
                              ? "Theft-related description"
                              : "Optional note"
                          }
                          value={newEventDescription}
                          onChange={(e) =>
                            setNewEventDescription(
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
                        />
                      </div>

                      {addEventError && (
                        <p className="text-xs text-red-600">
                          {addEventError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={addEventLoading}
                        className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {addEventLoading
                          ? "Saving..."
                          : "Save Record"}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* HISTORY */}
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Theft History
                  </h2>

                  {!historyLoading && !hasTheft && (
                    <p className="mt-2 text-xs text-gray-500">
                      No theft-related record was
                      found in the available data.
                    </p>
                  )}

                  {hasTheft && (
                    <ul className="mt-2 space-y-1.5">
                      {theftEvents.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-amber-900">
                              {event.description ||
                                "Theft-related record"}
                            </p>

                            <ConfidenceTag
                              source={event.source}
                            />
                          </div>

                          <p className="mt-0.5 text-[10px] text-amber-700">
                            {event.event_date
                              ? new Date(
                                  event.event_date
                                ).toLocaleDateString()
                              : "Date not provided"}

                            {event.location
                              ? ` · ${event.location}`
                              : ""}
                          </p>

                          <p className="text-[10px] text-amber-600">
                            Source: {event.source}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Odometer History
                  </h2>

                  {!historyLoading &&
                    !hasOdometer && (
                      <p className="mt-2 text-xs text-gray-500">
                        No odometer records were
                        returned by the connected data
                        source.
                      </p>
                    )}

                  {hasOdometer && (
                    <ol className="mt-2 space-y-1 text-xs">
                      {odometerEvents.map((event) => (
                        <li
                          key={event.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5"
                        >
                          <span className="text-gray-700">
                            {event.event_date
                              ? new Date(
                                  event.event_date
                                ).toLocaleDateString()
                              : "Not specified"}
                          </span>

                          <span className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {event.odometer != null
                                ? event.odometer.toLocaleString(
                                    "en-US"
                                  )
                                : "Not specified"}{" "}
                              {vehicle.mileage_unit || 'km'}
                            </span>

                            <ConfidenceTag
                              source={event.source}
                            />
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Accident History
                  </h2>

                  {!historyLoading && !hasAccident && (
                    <p className="mt-2 text-xs text-gray-500">
                      No accident records were
                      found in the available data.
                    </p>
                  )}

                  {hasAccident && (
                    <ul className="mt-2 space-y-1.5">
                      {accidentEvents.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-md border border-red-200 bg-red-50 p-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-red-900">
                              {event.description ||
                                "Accident record"}
                            </p>

                            <ConfidenceTag
                              source={event.source}
                            />
                          </div>

                          <p className="mt-0.5 text-[10px] text-red-700">
                            {event.event_date
                              ? new Date(
                                  event.event_date
                                ).toLocaleDateString()
                              : "Date not provided"}

                            {event.location
                              ? ` · ${event.location}`
                              : ""}
                          </p>

                          <p className="text-[10px] text-red-600">
                            Source: {event.source}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Insurance Claim History
                  </h2>

                  {!historyLoading && !hasClaim && (
                    <p className="mt-2 text-xs text-gray-500">
                      No insurance claim records were
                      found in the available data.
                    </p>
                  )}

                  {hasClaim && (
                    <ul className="mt-2 space-y-1.5">
                      {claimEvents.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-blue-900">
                              {event.description ||
                                "Insurance claim record"}
                            </p>

                            <ConfidenceTag
                              source={event.source}
                            />
                          </div>

                          <p className="mt-0.5 text-[10px] text-blue-700">
                            {event.event_date
                              ? new Date(
                                  event.event_date
                                ).toLocaleDateString()
                              : "Date not provided"}

                            {event.location
                              ? ` · ${event.location}`
                              : ""}
                          </p>

                          <p className="text-[10px] text-blue-600">
                            Source: {event.source}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* AI */}
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      AI Analysis
                    </h2>

                    <p className="text-xs text-gray-500">
                      Turns the raw history above into a
                      plain-language explanation, without
                      adding facts beyond what was found.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAiSummary}
                    disabled={
                      aiLoading || historyLoading
                    }
                    className="shrink-0 rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {aiLoading
                      ? "Generating..."
                      : "Generate AI Summary"}
                  </button>
                </div>

                {aiError && (
                  <p className="mt-2 text-xs text-red-600">
                    {aiError}
                  </p>
                )}

                {aiSummary && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 ring-1 ring-purple-200">
                        AI Interpretation
                      </span>

                      <span className="text-[10px] text-gray-400">
                        Explains the source facts above - not a source fact itself.
                      </span>
                    </div>

                    <div className="rounded-md bg-gray-50 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Quick Summary
                      </p>

                      <p className="mt-0.5 text-xs text-gray-800">
                        {aiSummary.quick_summary}
                      </p>
                    </div>

                    <div className="rounded-md bg-gray-50 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Salesperson Explanation
                      </p>

                      <p className="mt-0.5 text-xs text-gray-800">
                        {
                          aiSummary.salesperson_explanation
                        }
                      </p>
                    </div>

                    <div className="rounded-md border border-gray-200 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Customer-Friendly Summary
                      </p>

                      <p className="mt-0.5 text-xs text-gray-800">
                        {aiSummary.customer_summary}
                      </p>
                    </div>

                    {aiSummary.warnings.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Warnings
                        </p>

                        <ul className="mt-0.5 list-inside list-disc text-xs text-amber-800">
                          {aiSummary.warnings.map(
                            (warning, i) => (
                              <li key={i}>
                                {warning}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                    <p className="text-[10px] text-gray-400">
                      Generated by AI from the
                      vehicle-history records shown above.
                      This does not replace an independent
                      vehicle inspection or the original
                      source documentation.
                    </p>
                  </div>
                )}
              </div>

              {/* CUSTOMER REPORT */}
              {aiSummary && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Customer Report
                  </h2>

                  <p className="text-xs text-gray-500">
                    Creates a professional, shareable
                    report the customer can open without a
                    dealership login, and download as a PDF.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Customer
                      </label>

                      <select
                        value={selectedCustomerId}
                        onChange={(e) => {
                          setSelectedCustomerId(e.target.value);

                          const selected = e.target.value;

                          if (
                            selectedLeadId &&
                            leads.some(
                              (lead) =>
                                lead.id === selectedLeadId &&
                                lead.customer_id !== selected
                            )
                          ) {
                            setSelectedLeadId("");
                          }
                        }}
                        disabled={crmLoading}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800"
                      >
                        <option value="">
                          No customer selected
                        </option>

                        {customers.map((customer) => (
                          <option
                            key={customer.id}
                            value={customer.id}
                          >
                            {customer.name}
                            {customer.phone
                              ? ` | ${customer.phone}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Lead
                      </label>

                      <select
                        value={selectedLeadId}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedLeadId(value);

                          if (value) {
                            const selectedLead =
                              leads.find(
                                (lead) =>
                                  lead.id === value
                              );

                            if (
                              selectedLead?.customer_id
                            ) {
                              setSelectedCustomerId(
                                selectedLead.customer_id
                              );
                            }
                          }
                        }}
                        disabled={
                          crmLoading ||
                          !selectedCustomerId
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 disabled:bg-gray-100"
                      >
                        <option value="">
                          No lead selected
                        </option>

                        {leads
                          .filter(
                            (lead) =>
                              lead.customer_id ===
                              selectedCustomerId
                          )
                          .map((lead) => (
                            <option
                              key={lead.id}
                              value={lead.id}
                            >
                              {lead.customer_name} -{" "}
                              {lead.status}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {crmLoading && (
                    <p className="mt-2 text-[10px] text-gray-500">
                      Loading customers and leads...
                    </p>
                  )}

                  {crmError && (
                    <p className="mt-2 text-xs text-red-600">
                      {crmError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleCreateReport}
                    disabled={reportLoading}
                    className="mt-3 rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {reportLoading
                      ? "Creating report..."
                      : reportUrl
                        ? "Regenerate Report"
                        : "Create Customer Report"}
                  </button>

                  {reportError && (
                    <p className="mt-2 text-xs text-red-600">
                      {reportError}
                    </p>
                  )}

                  {reportUrl && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-col gap-2 rounded-md bg-gray-50 p-2 sm:flex-row sm:items-center">
                        <input
                          readOnly
                          value={reportUrl}
                          onFocus={(e) =>
                            e.target.select()
                          }
                          className="flex-1 truncate rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                        />

                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                        >
                          {copied
                            ? "Copied!"
                            : "Copy Link"}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={reportUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                        >
                          View Report
                        </a>

                        <a
                          href={`${reportUrl.replace(
                            "/report/",
                            "/api/reports/"
                          )}/pdf`}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                        >
                          Download PDF
                        </a>

                        <button
                          type="button"
                          onClick={handleRevokeReport}
                          disabled={reportLoading}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Revoke Link
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
    </div>
  );
}

function ConfidenceTag({
  source,
}: {
  source: string;
}) {
  const isManual =
    source === "Manual Entry (Dealer)";

  return (
    <span
      className={
        isManual
          ? "shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200"
          : "shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 ring-1 ring-gray-200"
      }
    >
      {isManual
        ? "Manual Entry"
        : "Source Confirmed"}
    </span>
  );
}








