/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import VehicleImagePlaceholder from "@/components/VehicleImagePlaceholder";
import { useRef, FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CarIcon,
  DocumentIcon,
  DollarSignIcon,
  GaugeIcon,
  CogIcon,
  EditIcon,
  ArchiveIcon,
  ShareIcon,
  CalendarIcon,
  FuelIcon,
  MapPinIcon,
  ShieldCheckIcon,
  RefreshIcon,
  PlusIcon,
  BotIcon,
  BackIcon,
  CopyIcon,
  CloseIcon,
  SaveIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  CreditCardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";

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
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const activeThumbnailRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeThumbnailRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeImageIndex]);

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

  const refreshMatching = useCallback(async () => {
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
  }, [vin]);

  const refreshPricing = useCallback(async () => {
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
  }, [vin]);

  const refreshHistory = useCallback(async () => {
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
  }, [vin]);

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
  }, [vin, refreshMatching, refreshHistory, refreshPricing]);

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
        window.shiftlyExtensionId ||
        null;
      
      if (!extensionId) {
        alert("No extension ID found. Please ensure the Shiftly Auto extension is installed and refresh the page. This happens when the extension content script hasn't loaded yet.");
        return;
      }
      
      // Check for Chrome extension API availability across different browsers
      const hasChromeRuntime = typeof window.chrome !== 'undefined' && 
                               window.chrome !== null && 
                               typeof window.chrome.runtime !== 'undefined';
      
      if (!hasChromeRuntime) {
        alert("Chrome extension API not available. Please ensure you're using a Chromium-based browser (Chrome, Edge, Opera) with the Shiftly Auto extension installed.");
        return;
      }

      const chromeRuntime = window.chrome?.runtime;
      if (!chromeRuntime) {
        alert("Chrome extension API not available. Please ensure you are using a Chromium-based browser with the Shiftly Auto extension installed.");
        return;
      }

      chromeRuntime.sendMessage(extensionId, {
        type: "SHIFTLY_POST_TO_MARKETPLACE",
        listing: data.listing
      }, (response) => {
        if (chromeRuntime.lastError) {
          alert(`Extension communication error: ${chromeRuntime.lastError?.message ?? "Unknown extension error"}`);
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

  return (
    <div className="px-4 pb-4 pt-0 lg:px-6 lg:pb-6 lg:pt-0 max-w-[1200px] mx-auto bg-[#F5F9FD] min-h-screen">
      {/* Back Navigation */}
      <Link
        href="/vehicles"
        className="group mb-3 inline-flex items-center gap-2 rounded-lg border border-[#DCE8F5] bg-white px-4 py-2 text-sm font-semibold text-[#475569] shadow-[3px_3px_8px_rgba(71,85,105,0.07),-3px_-3px_8px_rgba(255,255,255,0.9)] transition-all duration-200 hover:border-[#BFD7EE] hover:bg-[#EAF5FF] hover:text-[#1677FF]"
      >
        <BackIcon className="w-3.5 h-3.5" />
        Back to Vehicles
      </Link>

      {loading && (
        <div className="mt-4 rounded-lg border border-[#DCE8F5] bg-white p-6 text-center shadow-sm">
          <RefreshIcon className="mx-auto h-6 w-6 animate-spin text-[#1677FF]" />
          <p className="mt-2 text-xs font-medium text-[#102A56]">
            Loading vehicle...
          </p>

          <p className="mt-1 text-xs text-[#64748B]">
            Fetching vehicle information.
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1">
              <h1 className="text-sm font-semibold text-[#102A56]">
                Unable to load vehicle
              </h1>

              <p className="mt-1 text-xs text-red-600">
                {error}
              </p>

              <Link
                href="/vehicles"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1677FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors"
              >
                <BackIcon className="w-3.5 h-3.5" />
                Back to Vehicles
              </Link>
            </div>
          </div>
        </div>
      )}

        {!loading &&
          !error &&
          vehicle && (
            <>
              {/* Vehicle Header */}
              <div className="rounded-xl border border-[#DCE8F5] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#E8EEF5] bg-gradient-to-r from-[#F5F9FD] to-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <CarIcon className="h-6 w-6 text-[#1677FF]" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {vehicle.status && (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 ring-1 ring-green-200">
                              {vehicle.status}
                            </span>
                          )}
                          <h1 className="text-base font-bold text-[#102A56]">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </h1>
                          {vehicle.trim && (
                            <span className="text-xs text-[#64748B]">
                              {vehicle.trim}
                            </span>
                          )}
                        </div>

                        {vehicle.vin && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#64748B]">
                            <span className="font-mono font-semibold">{vehicle.vin}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {vehicle.vin ? (
                        <Link
                          href={`/vehicles/${encodeURIComponent(
                            vehicle.vin
                          )}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE8F5] bg-white px-3 py-1.5 text-xs font-semibold text-[#102A56] shadow-sm transition hover:border-[#1677FF] hover:bg-blue-50 hover:text-[#1677FF]"
                        >
                          <EditIcon className="h-3.5 w-3.5" />
                          Edit Vehicle
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE8F5] bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-400">
                          <EditIcon className="h-3.5 w-3.5" />
                          VIN Required
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={handlePostToMarketplace}
                        disabled={marketplaceLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE8F5] bg-white px-3 py-1.5 text-xs font-semibold text-[#102A56] shadow-sm transition hover:border-[#1677FF] hover:bg-blue-50 hover:text-[#1677FF] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShareIcon className="h-3.5 w-3.5" />
                        {marketplaceLoading
                          ? "Posting..."
                          : "Post to Marketplace"}
                      </button>

                      <button
                        type="button"
                        onClick={handleArchiveVehicle}
                        disabled={archiveLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ArchiveIcon className="h-3.5 w-3.5" />
                        {archiveLoading
                          ? "Archiving..."
                          : "Archive Vehicle"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {/* Vehicle Image Gallery */}
                    <div className="lg:col-span-1">
                      {(() => {
                        const galleryImages =
                          Array.isArray(vehicle.images) && vehicle.images.length > 0
                            ? vehicle.images
                            : vehicle.primary_image
                              ? [vehicle.primary_image]
                              : [];

                        const showPreviousImage = () => {
  setImageError(false);
  setActiveImageIndex((current) =>
    current === 0 ? galleryImages.length - 1 : current - 1
  );
};

                        const showNextImage = () => {
  setImageError(false);
  setActiveImageIndex((current) =>
    current === galleryImages.length - 1 ? 0 : current + 1
  );
};

                        if (galleryImages.length === 0) {
                          return (
                            <VehicleImagePlaceholder className="h-48 w-full rounded-lg border border-[#DCE8F5]" />
                          );
                        }

                        return (
                          <div className="space-y-1.5">
                            <div className="relative overflow-hidden rounded-lg border border-[#DCE8F5] bg-[#F8FAFC]">
                              {imageError ? (
  <div className="flex h-48 w-full items-center justify-center bg-[#F8FAFC]">
    <div className="text-center">
      <CarIcon className="mx-auto h-8 w-8 text-[#94A3B8]" />
      <p className="mt-2 text-xs text-[#64748B]">
        Photo unavailable
      </p>
    </div>
  </div>
) : (
  <img
    src={galleryImages[activeImageIndex]}
    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo ${activeImageIndex + 1}`}
    className="h-48 w-full object-cover"
    onError={() => {
      if (galleryImages.length <= 1) {
        setImageError(true);
        return;
      }

      const tryCandidate = (offset: number): void => {
        if (offset >= galleryImages.length) {
          setImageError(true);
          return;
        }

        const candidate = (activeImageIndex + offset) % galleryImages.length;
        const image = new Image();

        image.onload = () => {
          setImageError(false);
          setActiveImageIndex(candidate);
        };

        image.onerror = () => tryCandidate(offset + 1);
        image.src = galleryImages[candidate];
      };

      tryCandidate(1);
    }}
  />
)}

                              {galleryImages.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={showPreviousImage}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
                                    aria-label="Previous photo"
                                  >
                                    <ChevronLeftIcon className="h-4 w-4 text-[#102A56]" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={showNextImage}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
                                    aria-label="Next photo"
                                  >
                                    <ChevronRightIcon className="h-4 w-4 text-[#102A56]" />
                                  </button>

                                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                                    {activeImageIndex + 1} / {galleryImages.length}
                                  </div>
                                </>
                              )}
                            </div>

                            {galleryImages.length > 1 && (
                              <div ref={thumbnailContainerRef} className="flex gap-1.5 overflow-x-auto pb-1">
                                {galleryImages.map((image, index) => (
                                  <button
                                    key={`${image}-${index}`}
                                    ref={index === activeImageIndex ? activeThumbnailRef : null}
                                    type="button"
                                    onClick={() => { setImageError(false); setActiveImageIndex(index); }}
                                    className={`overflow-hidden rounded border flex-shrink-0 ${
                                      index === activeImageIndex
                                        ? "border-[#1677FF] ring-2 ring-blue-200"
                                        : "border-[#DCE8F5]"
                                    }`}
                                    aria-label={`View photo ${index + 1}`}
                                  >
                                    <img
  src={image}
  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} photo ${index + 1}`}
  className="h-12 w-12 object-cover"
  onError={(event) => {
    const thumbnailButton = event.currentTarget.closest("button");
    if (thumbnailButton) thumbnailButton.hidden = true;
  }}
/>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Vehicle Information Grid */}
                    <div className="lg:col-span-2">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {/* VIN */}
                        <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheckIcon className="h-4 w-4 text-[#1677FF]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              VIN
                            </span>
                          </div>
                          <p className="mt-1.5 font-mono text-xs font-bold text-[#102A56]">
                            {vehicle.vin || "Not available"}
                          </p>
                        </div>

                        {/* Mileage */}
                        <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center gap-2">
                            <GaugeIcon className="h-4 w-4 text-[#1677FF]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Mileage
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-[#102A56]">
                            {vehicle.mileage != null
                              ? `${vehicle.mileage.toLocaleString()} ${vehicle.mileage_unit || 'km'}`
                              : "Not specified"}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center gap-2">
                            <DollarSignIcon className="h-4 w-4 text-[#1677FF]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Price
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-[#102A56]">
                            {vehicle.price != null
                              ? new Intl.NumberFormat("en-CA", {
                                  style: "currency",
                                  currency: "CAD",
                                  useGrouping: true,
                                  maximumFractionDigits: 0,
                                }).format(vehicle.price)
                              : "Not specified"}
                          </p>
                        </div>

                        {/* Transmission */}
                        <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center gap-2">
                            <CogIcon className="h-4 w-4 text-[#1677FF]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Transmission
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-[#102A56]">
                            {vehicle.transmission || "Not specified"}
                          </p>
                        </div>

                        {/* Fuel */}
                        <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center gap-2">
                            <FuelIcon className="h-4 w-4 text-[#1677FF]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Fuel
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-[#102A56]">
                            {vehicle.fuel || "Not specified"}
                          </p>
                        </div>

                        {/* Engine */}
                        <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center gap-2">
                            <CogIcon className="h-4 w-4 text-[#1677FF]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Engine
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-[#102A56]">
                            {vehicle.engine || "Not specified"}
                          </p>
                        </div>

                        {/* Drivetrain */}
                        <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center gap-2">
                            <CogIcon className="h-4 w-4 text-[#1677FF]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Drivetrain
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-[#102A56]">
                            {vehicle.drivetrain || "Not specified"}
                          </p>
                        </div>

                        {/* Body */}
                        <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center gap-2">
                            <CarIcon className="h-4 w-4 text-[#1677FF]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Body
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-[#102A56]">
                            {vehicle.body || "Not specified"}
                          </p>
                        </div>

                        {/* Location */}
                        {vehicle.location && (
                          <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                            <div className="flex items-center gap-2">
                              <MapPinIcon className="h-4 w-4 text-[#1677FF]" />
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Location
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs font-bold text-[#102A56]">
                              {vehicle.location}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Similar Vehicles */}
              <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#E8EEF5] bg-gradient-to-r from-[#F5F9FD] to-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <CarIcon className="h-5 w-5 text-[#1677FF]" />
                      </div>

                      <div>
                        <h2 className="text-sm font-bold text-[#102A56]">
                          Similar Vehicles
                        </h2>
                        <p className="mt-0.5 text-[10px] text-[#64748B]">
                          Vehicles matching this profile in your inventory
                        </p>
                      </div>
                    </div>

                    {!matchingLoading &&
                      matching &&
                      matching.count !== undefined && (
                        <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-semibold text-[#64748B]">
                          {matching.count}{" "}
                          {matching.count === 1
                            ? "match"
                            : "matches"}
                        </span>
                      )}
                  </div>
                </div>

                <div className="p-4">
                  {matchingLoading && (
                    <div className="flex items-center gap-2 rounded-md bg-[#F8FAFC] px-3 py-2">
                      <RefreshIcon className="h-3.5 w-3.5 animate-spin text-[#1677FF]" />
                      <p className="text-xs text-[#64748B]">
                        Finding similar vehicles...
                      </p>
                    </div>
                  )}

                  {!matchingLoading &&
                    matchingError && (
                      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                        <AlertCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                        <div>
                          <p className="text-xs font-medium text-red-700">
                            Unable to load vehicle matches.
                          </p>
                          <p className="mt-0.5 text-[10px] text-red-600">
                            {matchingError}
                          </p>
                          <button
                            type="button"
                            onClick={refreshMatching}
                            className="mt-1.5 rounded-md border border-red-300 bg-white px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}

                  {!matchingLoading &&
                    !matchingError &&
                    matching &&
                    matching.matches &&
                    matching.matches.length > 0 && (
                      <div className="space-y-1.5">
                        {matching.matches.map((match) => (
                          match.vin ? (
                            <Link
                              key={match.id}
                              href={`/vehicles/${encodeURIComponent(
                                match.vin
                              )}`}
                              className="block rounded-lg border border-[#DCE8F5] p-3 transition hover:border-[#1677FF] hover:bg-blue-50"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[#102A56]">
                                    {match.year}{" "}
                                    {match.make}{" "}
                                    {match.model}
                                  </p>

                                  {match.trim && (
                                    <p className="text-[10px] text-[#64748B]">
                                      {match.trim}
                                    </p>
                                  )}

                                  <p className="break-all font-mono text-[10px] text-[#94A3B8]">
                                    VIN: {match.vin}
                                  </p>
                                </div>

                                <div className="shrink-0 text-left sm:text-right">
                                  <p className="text-sm font-bold text-[#1677FF]">
                                    {match.matchScore}%
                                  </p>

                                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">
                                    Match
                                  </p>
                                </div>
                              </div>

                              {match.reasons.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-[10px] font-medium text-[#64748B]">
                                    {match.reasons.join(" | ")}
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
                      <div className="rounded-md border border-dashed border-[#DCE8F5] bg-[#F8FAFC] p-3 text-center">
                        <CarIcon className="mx-auto h-5 w-5 text-[#94A3B8]" />
                        <p className="mt-2 text-xs font-semibold text-[#102A56]">
                          No similar vehicles found
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#64748B]">
                          No matching vehicles in your active inventory.
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Pricing Intelligence */}
              <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#E8EEF5] bg-gradient-to-r from-[#F5F9FD] to-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <DollarSignIcon className="h-5 w-5 text-[#1677FF]" />
                      </div>

                      <div>
                        <h2 className="text-sm font-bold text-[#102A56]">
                          Pricing Intelligence
                        </h2>
                        <p className="mt-0.5 text-[10px] text-[#64748B]">
                          Market analysis and competitive pricing
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!showAddComparable && (
                        <button
                          type="button"
                          onClick={() => setShowAddComparable(true)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DCE8F5] bg-white px-3 text-[11px] font-semibold text-[#102A56] transition hover:border-[#1677FF] hover:bg-blue-50 hover:text-[#1677FF]"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                          Add Comparable
                        </button>
                      )}

                      {pricing?.pricing?.calculated_at && (
                        <div className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-[10px] text-[#64748B]">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          Updated{" "}
                          {new Date(
                            pricing.pricing.calculated_at
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {pricingLoading && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[1, 2, 3, 4].map((item) => (
                        <div
                          key={item}
                          className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3"
                        >
                          <div className="h-2.5 w-20 animate-pulse rounded bg-gray-200" />
                          <div className="mt-2 h-5 w-28 animate-pulse rounded bg-gray-200" />
                        </div>
                      ))}
                    </div>
                  )}

                  {!pricingLoading && pricingError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

                        <div>
                          <p className="text-xs font-semibold text-red-700">
                            Unable to load pricing intelligence
                          </p>

                          <p className="mt-0.5 text-[11px] text-red-600">
                            {pricingError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!pricingLoading &&
                    !pricingError &&
                    pricing && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="flex min-h-[88px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                                <DollarSignIcon className="h-3.5 w-3.5 text-[#1677FF]" />
                              </div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Current Price
                              </p>
                            </div>
                            <p className="mt-2 text-sm font-bold text-[#102A56]">
                              {pricing.vehicle?.current_price != null
                                ? `$${pricing.vehicle.current_price.toLocaleString()}`
                                : "Not specified"}
                            </p>
                          </div>

                          <div className="flex min-h-[88px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-50">
                                <DollarSignIcon className="h-3.5 w-3.5 text-green-600" />
                              </div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Market Price
                              </p>
                            </div>
                            <p className="mt-2 text-sm font-bold text-[#102A56]">
                              {pricing.pricing?.market_price != null
                                ? `$${pricing.pricing.market_price.toLocaleString()}`
                                : "Not specified"}
                            </p>
                          </div>

                          <div className="flex min-h-[88px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50">
                                <DollarSignIcon className="h-3.5 w-3.5 text-amber-600" />
                              </div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Recommended
                              </p>
                            </div>
                            <p className="mt-2 text-sm font-bold text-[#102A56]">
                              {pricing.pricing?.recommended_price != null
                                ? `$${pricing.pricing.recommended_price.toLocaleString()}`
                                : "Not specified"}
                            </p>
                          </div>

                          <div className="flex min-h-[88px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-50">
                                <CalendarIcon className="h-3.5 w-3.5 text-purple-600" />
                              </div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Days on Market
                              </p>
                            </div>
                            <p className="mt-2 text-sm font-bold text-[#102A56]">
                              {pricing.days_on_market != null
                                ? pricing.days_on_market
                                : "Not specified"}
                            </p>
                          </div>

                          <div className="flex min-h-[88px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-white p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Low Market
                            </p>
                            <p className="mt-2 text-sm font-semibold text-[#102A56]">
                              {pricing.pricing?.low_price != null
                                ? `$${pricing.pricing.low_price.toLocaleString()}`
                                : "Not specified"}
                            </p>
                          </div>

                          <div className="flex min-h-[88px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-white p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              High Market
                            </p>
                            <p className="mt-2 text-sm font-semibold text-[#102A56]">
                              {pricing.pricing?.high_price != null
                                ? `$${pricing.pricing.high_price.toLocaleString()}`
                                : "Not specified"}
                            </p>
                          </div>

                          <div className="flex min-h-[88px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-white p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                              Comparables
                            </p>
                            <p className="mt-2 text-sm font-semibold text-[#102A56]">
                              {pricing.pricing?.comparable_count ?? 0}
                            </p>
                          </div>
                        </div>

                        {showAddComparable && (
                          <form
                            onSubmit={handleAddComparable}
                            className="mt-4 overflow-hidden rounded-xl border border-[#DCE8F5] bg-white"
                          >
                            <div className="flex items-center gap-3 border-b border-[#E8EEF5] bg-[#F8FBFF] px-4 py-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                                <PlusIcon className="h-4 w-4 text-[#1677FF]" />
                              </div>

                              <div>
                                <h3 className="text-sm font-bold text-[#102A56]">
                                  Add Comparable
                                </h3>
                                <p className="mt-0.5 text-[10px] text-[#64748B]">
                                  Add a dealer listing to improve pricing intelligence.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4 p-4">
                              <div className="rounded-lg border border-[#E8EEF5] bg-[#F8FAFC] px-3 py-2.5">
                                <p className="text-[11px] leading-5 text-[#64748B]">
                                  No commercial market-data provider is connected yet.
                                  Comparables added here are tagged &quot;Manual Entry (Dealer)&quot;
                                  and immediately recalculate the pricing above.
                                </p>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                    Year
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="2026"
                                    value={newCompYear}
                                    onChange={(e) =>
                                      setNewCompYear(
                                        e.target.value.replace(/\D/g, "")
                                      )
                                    }
                                    className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                    Make
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Honda"
                                    value={newCompMake}
                                    onChange={(e) => setNewCompMake(e.target.value)}
                                    className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                    Model
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Civic"
                                    value={newCompModel}
                                    onChange={(e) => setNewCompModel(e.target.value)}
                                    className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                    Trim
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Sport"
                                    value={newCompTrim}
                                    onChange={(e) => setNewCompTrim(e.target.value)}
                                    className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                    Price ($)
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    required
                                    placeholder="1,200,000"
                                    value={newCompPrice}
                                    onChange={(e) =>
                                      setNewCompPrice(formatNumberInput(e.target.value))
                                    }
                                    className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                    Mileage ({vehicle.mileage_unit || "km"})
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="25,000"
                                    value={newCompMileage}
                                    onChange={(e) =>
                                      setNewCompMileage(formatNumberInput(e.target.value))
                                    }
                                    className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>
                              </div>

                              <div className="max-w-xs">
                                <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                  Location
                                </label>
                                <input
                                  type="text"
                                  placeholder="Quezon City"
                                  value={newCompLocation}
                                  onChange={(e) => setNewCompLocation(e.target.value)}
                                  className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                />
                              </div>

                              {addComparableError && (
                                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                                  <p className="text-xs leading-5 text-red-600">
                                    {addComparableError}
                                  </p>
                                </div>
                              )}

                              <div className="flex flex-col-reverse gap-2 border-t border-[#E8EEF5] pt-4 sm:flex-row sm:items-center sm:justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddComparable(false);
                                    setNewCompYear("");
                                    setNewCompMake("");
                                    setNewCompModel("");
                                    setNewCompTrim("");
                                    setNewCompPrice("");
                                    setNewCompMileage("");
                                    setNewCompLocation("");
                                    setAddComparableError("");
                                  }}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#475569] transition hover:border-[#BFD8F2] hover:bg-[#F8FBFF]"
                                >
                                  <CloseIcon className="h-4 w-4" />
                                  Cancel
                                </button>

                                <button
                                  type="submit"
                                  disabled={addComparableLoading}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition hover:border-[#0F67E8] hover:bg-[#0F67E8] disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-[#CBD5E1]"
                                >
                                  <SaveIcon className="h-4 w-4" />
                                  {addComparableLoading ? "Saving..." : "Save Comparable"}
                                </button>
                              </div>
                            </div>
                          </form>
                        )}

                        {pricing.comparables &&
                          pricing.comparables.length > 0 && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <h3 className="text-xs font-semibold text-[#102A56]">
                                  Competitive Listings
                                </h3>

                                <span className="text-[10px] text-[#64748B]">
                                  {pricing.comparables.length} listing
                                  {pricing.comparables.length === 1 ? "" : "s"}
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {pricing.comparables.map((comparable) => (
                                  <div
                                    key={comparable.id}
                                    className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-semibold text-[#102A56]">
                                          {comparable.year ?? "N/A"}{" "}
                                          {comparable.make ?? ""}{" "}
                                          {comparable.model ?? ""}
                                        </p>

                                        {comparable.trim && (
                                          <p className="text-[10px] text-[#64748B]">
                                            {comparable.trim}
                                          </p>
                                        )}
                                      </div>

                                      <p className="text-xs font-bold text-[#102A56]">
                                        {comparable.price != null
                                          ? `$${comparable.price.toLocaleString()}`
                                          : "Not specified"}
                                      </p>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#64748B]">
                                      <span>
                                        Mileage:{" "}
                                        {comparable.mileage != null
                                          ? `${comparable.mileage.toLocaleString()} ${vehicle.mileage_unit || 'km'}`
                                          : "Not specified"}
                                      </span>

                                      <span>
                                        Location: {comparable.location || "N/A"}
                                      </span>

                                      <span>Source: {comparable.source}</span>
                                    </div>

                                    {comparable.source_url && (
                                      <a
                                        href={comparable.source_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[#1677FF] hover:text-blue-600"
                                      >
                                        View listing
                                        <ChevronRightIcon className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {!pricing.comparables?.length && (
                          <div className="mt-4 rounded-lg border border-dashed border-[#DCE8F5] bg-[#F8FAFC] p-3 text-center">
                            <CarIcon className="mx-auto h-5 w-5 text-[#94A3B8]" />
                            <p className="mt-2 text-xs font-semibold text-[#102A56]">
                              No competitive listings yet
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#64748B]">
                              Add a comparable vehicle to improve the market analysis.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                </div>
              </div>

              {/* Vehicle History */}
              <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#E8EEF5] bg-gradient-to-r from-[#F5F9FD] to-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <ShieldCheckIcon className="h-5 w-5 text-[#1677FF]" />
                      </div>

                      <div>
                        <h2 className="text-sm font-bold text-[#102A56]">
                          Vehicle History
                        </h2>
                        <p className="mt-0.5 text-[10px] text-[#64748B]">
                          History checks and dealer records
                        </p>
                      </div>
                    </div>

                    {!showAddEvent && (
                      <button
                        type="button"
                        onClick={() => setShowAddEvent(true)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DCE8F5] bg-white px-3 text-[11px] font-semibold text-[#102A56] shadow-sm transition hover:border-[#1677FF] hover:text-[#1677FF]"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add History Record
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  {historyLoading && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[1, 2, 3, 4].map((item) => (
                        <div
                          key={item}
                          className="h-24 animate-pulse rounded-lg border border-[#DCE8F5] bg-[#F8FAFC]"
                        />
                      ))}
                    </div>
                  )}

                  {!historyLoading && historyError && (
                    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

                      <div>
                        <p className="text-xs font-semibold text-red-800">
                          Unable to load vehicle history
                        </p>
                        <p className="mt-0.5 text-[10px] text-red-600">
                          {historyError}
                        </p>
                      </div>
                    </div>
                  )}

                  {!historyLoading && !historyError && history && (
                    <>
                      {/* 2x2 Grid for all history categories */}
                      <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Theft */}
                        <div className="flex min-h-[82px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white">
                                <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-600" />
                              </div>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Theft
                              </span>
                            </div>

                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              hasTheft
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {hasTheft ? "Found" : "Clear"}
                            </span>
                          </div>

                          <p className="mt-2 text-xs font-bold text-[#102A56]">
                            {hasTheft
                              ? `${theftEvents.length} record${theftEvents.length === 1 ? "" : "s"}`
                              : "No records"}
                          </p>
                        </div>

                        {/* Odometer */}
                        <div className="flex min-h-[82px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white">
                                <GaugeIcon className="h-3.5 w-3.5 text-green-600" />
                              </div>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Odometer
                              </span>
                            </div>

                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">
                              {hasOdometer ? "Recorded" : "N/A"}
                            </span>
                          </div>

                          <p className="mt-2 text-xs font-bold text-[#102A56]">
                            {hasOdometer
                              ? `${odometerEvents[odometerEvents.length - 1]?.odometer?.toLocaleString("en-US") || "Not specified"} ${vehicle.mileage_unit || "km"}`
                              : "No records"}
                          </p>
                        </div>

                        {/* Accident */}
                        <div className={`flex min-h-[82px] flex-col justify-between rounded-lg border p-3 ${
                          hasAccident
                            ? "border-red-200 bg-red-50/60"
                            : "border-[#DCE8F5] bg-[#F8FAFC]"
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                                hasAccident ? "bg-red-100" : "bg-white"
                              }`}>
                                <AlertCircleIcon className={`h-3.5 w-3.5 ${
                                  hasAccident ? "text-red-600" : "text-[#64748B]"
                                }`} />
                              </div>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Accident
                              </span>
                            </div>

                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              hasAccident
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {hasAccident ? "Found" : "Clear"}
                            </span>
                          </div>

                          <p className="mt-2 text-xs font-bold text-[#102A56]">
                            {hasAccident
                              ? `${accidentEvents.length} record${accidentEvents.length === 1 ? "" : "s"}`
                              : "No records"}
                          </p>
                        </div>

                        {/* Insurance */}
                        <div className="flex min-h-[82px] flex-col justify-between rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white">
                                <CreditCardIcon className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                Insurance
                              </span>
                            </div>

                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              claimEvents.length
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {claimEvents.length ? "Claims" : "Clear"}
                            </span>
                          </div>

                          <p className="mt-2 text-xs font-bold text-[#102A56]">
                            {claimEvents.length
                              ? `${claimEvents.length} claim${claimEvents.length === 1 ? "" : "s"}`
                              : "No claims"}
                          </p>
                        </div>
                      </div>

                      {/* Detailed History */}
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {/* Theft Records */}
                        <div className="flex flex-col rounded-lg border border-[#E8EEF5] bg-[#FBFDFF]">
                          <div className="flex items-center justify-between border-b border-[#E8EEF5] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                              <h3 className="text-xs font-bold text-[#102A56]">
                                Theft Records
                              </h3>
                            </div>

                            <span className="text-[10px] text-[#64748B]">
                              {theftEvents.length} record {theftEvents.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="flex-1 p-2.5">
                            {hasTheft ? (
                              <div className="space-y-1.5">
                                {theftEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className="rounded-md border border-amber-200 bg-amber-50/60 p-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="min-w-0 flex-1 break-words text-[11px] font-semibold leading-4 text-amber-900">
                                        {event.description || "Theft-related record"}
                                      </p>

                                      <ConfidenceTag source={event.source} />
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-amber-700">
                                      <span>
                                        {event.event_date
                                          ? new Date(event.event_date).toLocaleDateString()
                                          : "Date not provided"}
                                      </span>

                                      {event.location && (
                                        <>
                                          <span>|</span>
                                          <span>{event.location}</span>
                                        </>
                                      )}
                                    </div>

                                    <p className="mt-1 text-[9px] text-amber-600">
                                      Source: {event.source}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-md bg-white p-3 text-center">
                                <ShieldCheckIcon className="mx-auto h-5 w-5 text-green-500" />
                                <p className="mt-1.5 text-xs font-semibold text-[#102A56]">
                                  No theft records
                                </p>
                                <p className="mt-0.5 text-[10px] text-[#64748B]">
                                  No reported theft history was found.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Odometer Records */}
                        <div className="flex flex-col rounded-lg border border-[#E8EEF5] bg-[#FBFDFF]">
                          <div className="flex items-center justify-between border-b border-[#E8EEF5] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <GaugeIcon className="h-4 w-4 text-green-600" />
                              <h3 className="text-xs font-bold text-[#102A56]">
                                Odometer Records
                              </h3>
                            </div>

                            <span className="text-[10px] text-[#64748B]">
                              {odometerEvents.length} record {odometerEvents.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="flex-1 p-2.5">
                            {hasOdometer ? (
                              <ol className="space-y-1.5 text-xs">
                                {odometerEvents.map((event) => (
                                  <li
                                    key={event.id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-[#EEF3F8] bg-white px-2 py-1.5"
                                  >
                                    <span className="text-[#102A56]">
                                      {event.event_date
                                        ? new Date(event.event_date).toLocaleDateString()
                                        : "Not specified"}
                                    </span>

                                    <span className="flex items-center gap-2">
                                      <span className="font-medium text-[#102A56]">
                                        {event.odometer != null
                                          ? event.odometer.toLocaleString("en-US")
                                          : "Not specified"}{" "}
                                        {vehicle.mileage_unit || 'km'}
                                      </span>

                                      <ConfidenceTag source={event.source} />
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <div className="rounded-md bg-white p-3 text-center">
                                <GaugeIcon className="mx-auto h-5 w-5 text-[#94A3B8]" />
                                <p className="mt-1.5 text-xs font-semibold text-[#102A56]">
                                  No odometer records
                                </p>
                                <p className="mt-0.5 text-[10px] text-[#64748B]">
                                  No odometer readings were found.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Accident Records */}
                        <div className="flex flex-col rounded-lg border border-[#E8EEF5] bg-[#FBFDFF]">
                          <div className="flex items-center justify-between border-b border-[#E8EEF5] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <AlertCircleIcon className="h-4 w-4 text-red-600" />
                              <h3 className="text-xs font-bold text-[#102A56]">
                                Accident Records
                              </h3>
                            </div>

                            <span className="text-[10px] text-[#64748B]">
                              {accidentEvents.length} record {accidentEvents.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="flex-1 p-2.5">
                            {hasAccident ? (
                              <div className="space-y-1.5">
                                {accidentEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className="rounded-md border border-red-200 bg-red-50/60 p-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="min-w-0 flex-1 break-words text-[11px] font-semibold leading-4 text-red-900">
                                        {event.description || "Accident record"}
                                      </p>

                                      <ConfidenceTag source={event.source} />
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-red-700">
                                      <span>
                                        {event.event_date
                                          ? new Date(event.event_date).toLocaleDateString()
                                          : "Date not provided"}
                                      </span>

                                      {event.location && (
                                        <>
                                          <span>|</span>
                                          <span>{event.location}</span>
                                        </>
                                      )}
                                    </div>

                                    <p className="mt-1 text-[9px] text-red-600">
                                      Source: {event.source}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-md bg-white p-3 text-center">
                                <ShieldCheckIcon className="mx-auto h-5 w-5 text-green-500" />
                                <p className="mt-1.5 text-xs font-semibold text-[#102A56]">
                                  No accident records
                                </p>
                                <p className="mt-0.5 text-[10px] text-[#64748B]">
                                  No reported accident history was found.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Insurance Claims */}
                        <div className="flex flex-col rounded-lg border border-[#E8EEF5] bg-[#FBFDFF]">
                          <div className="flex items-center justify-between border-b border-[#E8EEF5] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <CreditCardIcon className="h-4 w-4 text-blue-600" />
                              <h3 className="text-xs font-bold text-[#102A56]">
                                Insurance Claims
                              </h3>
                            </div>

                            <span className="text-[10px] text-[#64748B]">
                              {claimEvents.length} record {claimEvents.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="flex-1 p-2.5">
                            {claimEvents.length ? (
                              <div className="space-y-1.5">
                                {claimEvents.map((claim, index) => (
                                  <div
                                    key={claim.id || index}
                                    className="rounded-md border border-blue-200 bg-blue-50/60 p-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-[11px] font-semibold text-blue-900">
                                        {claim.description || "Insurance claim"}
                                      </p>

                                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-semibold text-blue-700">
                                        Claim
                                      </span>
                                    </div>

                                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-blue-700">
                                      {claim.event_date && (
                                        <span>
                                          {new Date(claim.event_date).toLocaleDateString()}
                                        </span>
                                      )}

                                      {claim.location && (
                                        <>
                                          <span>|</span>
                                          <span>{claim.location}</span>
                                        </>
                                      )}
                                    </div>

                                    <p className="mt-1 text-[9px] text-blue-600">
                                      Source: {claim.source}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-md bg-white p-3 text-center">
                                <CreditCardIcon className="mx-auto h-5 w-5 text-[#94A3B8]" />
                                <p className="mt-1.5 text-xs font-semibold text-[#102A56]">
                                  No insurance claims
                                </p>
                                <p className="mt-0.5 text-[10px] text-[#64748B]">
                                  No insurance claim history is currently available.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Odometer Anomaly */}
                      {history.odometerAnomaly && (
                        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                          <div>
                            <p className="text-xs font-bold text-amber-900">
                              Odometer anomaly detected
                            </p>

                            <p className="mt-0.5 text-[10px] leading-relaxed text-amber-700">
                              Potential mileage inconsistency detected. Review the mileage
                              records before relying on the current reading.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Add History Record Form */}
                      {showAddEvent && (
                        <form
                          onSubmit={handleAddEvent}
                          className="mt-4 overflow-hidden rounded-xl border border-[#DCE8F5] bg-white"
                        >
                          <div className="flex items-center gap-3 border-b border-[#E8EEF5] bg-[#F8FBFF] px-4 py-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                              <PlusIcon className="h-4 w-4 text-[#1677FF]" />
                            </div>

                            <div>
                              <h3 className="text-sm font-bold text-[#102A56]">
                                Add Record
                              </h3>
                              <p className="mt-0.5 text-[10px] text-[#64748B]">
                                Add a manual vehicle history record.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-4 p-4">
                            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5">
                              <p className="text-[11px] leading-5 text-[#526581]">
                                No commercial vehicle-history provider is connected yet.
                                Records added here are tagged &quot;Manual Entry (Dealer)&quot;.
                              </p>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                Record Type
                              </label>

                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                  { id: "THEFT", label: "Theft", icon: AlertTriangleIcon },
                                  { id: "ODOMETER", label: "Odometer", icon: GaugeIcon },
                                  { id: "ACCIDENT", label: "Accident", icon: AlertCircleIcon },
                                  { id: "CLAIM", label: "Insurance Claim", icon: CreditCardIcon },
                                ].map((type) => {
                                  const Icon = type.icon;

                                  return (
                                    <label
                                      key={type.id}
                                      className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                                        newEventType === type.id
                                          ? "border-[#1677FF] bg-blue-50 text-[#1677FF]"
                                          : "border-[#DCE8F5] bg-white text-[#64748B] hover:border-[#1677FF] hover:bg-blue-50/50"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="eventType"
                                        value={type.id}
                                        checked={newEventType === type.id}
                                        onChange={(e) => {
                                          setNewEventType(e.target.value as "THEFT" | "ODOMETER" | "ACCIDENT" | "CLAIM");
                                          setNewEventOdometer("");
                                        }}
                                        className="sr-only"
                                      />
                                      <Icon className="h-4 w-4 shrink-0" />
                                      <span>{type.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                  Date
                                </label>

                                <input
                                  type="date"
                                  value={newEventDate}
                                  onChange={(e) => setNewEventDate(e.target.value)}
                                  className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                />
                              </div>

                              {newEventType === "ODOMETER" && (
                                <div>
                                  <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                    Odometer ({vehicle.mileage_unit || "km"})
                                  </label>

                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    required
                                    value={newEventOdometer}
                                    onChange={(e) => handleOdometerChange(e.target.value)}
                                    className="h-10 w-full max-w-xs rounded-lg border border-[#DCE8F5] bg-white px-3 text-sm text-[#102A56] outline-none transition focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
                                  />
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[#102A56]">
                                Description
                              </label>

                              <textarea
  placeholder={
    newEventType === "THEFT"
      ? "Theft-related description"
      : "Optional note"
  }
  value={newEventDescription}
  onChange={(e) => {
  const textarea = e.currentTarget;
  setNewEventDescription(textarea.value);
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}}
  rows={1}
  className="min-h-10 w-full max-w-xs resize-none overflow-hidden rounded-lg border border-[#DCE8F5] bg-white px-3 py-2 text-sm leading-5 text-[#102A56] outline-none transition placeholder:text-[#94A3B8] focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
/>
                            </div>

                            {addEventError && (
                              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                                <p className="text-xs text-red-600">
                                  {addEventError}
                                </p>
                              </div>
                            )}

                            <div className="flex justify-end gap-3 border-t border-[#E8EEF5] pt-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddEvent(false);
                                  setNewEventDate("");
                                  setNewEventDescription("");
                                  setNewEventOdometer("");
                                  setAddEventError("");
                                }}
                                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#DCE8F5] bg-white px-4 text-sm font-semibold text-[#102A56] transition hover:bg-gray-50"
                              >
                                <CloseIcon className="h-4 w-4" />
                                Cancel
                              </button>

                              <button
                                type="submit"
                                disabled={addEventLoading}
                                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#1677FF] bg-[#1677FF] px-4 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300"
                              >
                                <SaveIcon className="h-4 w-4" />
                                {addEventLoading ? "Saving..." : "Save Record"}
                              </button>
                            </div>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </div>


              {/* AI Vehicle Intelligence */}
              <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#E8EEF5] bg-gradient-to-r from-[#F5F9FD] to-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <BotIcon className="h-5 w-5 text-[#1677FF]" />
                      </div>

                      <div>
                        <h2 className="text-sm font-bold text-[#102A56]">
                          AI Vehicle Intelligence
                        </h2>
                        <p className="mt-0.5 text-[10px] text-[#64748B]">
                          Plain-language explanation of vehicle history
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateAiSummary}
                      disabled={aiLoading || historyLoading}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DCE8F5] bg-white px-3 text-[11px] font-semibold text-[#102A56] shadow-sm transition hover:border-[#1677FF] hover:bg-blue-50 hover:text-[#1677FF] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <BotIcon className="h-3.5 w-3.5" />
                      {aiLoading ? "Generating..." : "Generate AI Summary"}
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {aiError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <p className="text-xs text-red-700">{aiError}</p>
                    </div>
                  )}

                  {aiSummary && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 ring-1 ring-purple-200">
                          AI Interpretation
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          Explains the source facts above - not a source fact itself.
                        </span>
                      </div>

                      <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Quick Summary
                        </p>
                        <p className="mt-1.5 text-xs text-[#102A56]">
                          {aiSummary.quick_summary}
                        </p>
                      </div>

                      <div className="rounded-lg border border-[#DCE8F5] bg-[#F8FAFC] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Salesperson Explanation
                        </p>
                        <p className="mt-1.5 text-xs text-[#102A56]">
                          {aiSummary.salesperson_explanation}
                        </p>
                      </div>

                      <div className="rounded-lg border border-[#DCE8F5] bg-white p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Customer-Friendly Summary
                        </p>
                        <p className="mt-1.5 text-xs text-[#102A56]">
                          {aiSummary.customer_summary}
                        </p>
                      </div>

                      {aiSummary.warnings.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Warnings
                          </p>
                          <ul className="mt-1.5 list-inside list-disc text-xs text-amber-800">
                            {aiSummary.warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-[10px] text-[#64748B]">
                        Generated by AI from the vehicle-history records shown above. This does not replace an independent vehicle inspection or the original source documentation.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Report */}
              {aiSummary && (
                <div className="mt-4 rounded-xl border border-[#DCE8F5] bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-[#E8EEF5] bg-gradient-to-r from-[#F5F9FD] to-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <DocumentIcon className="h-5 w-5 text-[#1677FF]" />
                      </div>

                      <div>
                        <h2 className="text-sm font-bold text-[#102A56]">
                          Customer Report
                        </h2>
                        <p className="mt-0.5 text-[10px] text-[#64748B]">
                          Shareable report for customers with PDF download
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#64748B]">
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
                          className="h-9 w-full rounded-md border border-[#DCE8F5] bg-white px-2.5 text-xs text-[#102A56] outline-none focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100"
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
                        <label className="mb-1 block text-xs font-medium text-[#64748B]">
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
                          className="h-9 w-full rounded-md border border-[#DCE8F5] bg-white px-2.5 text-xs text-[#102A56] outline-none focus:border-[#1677FF] focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
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
                      <div className="mt-3 flex items-center gap-2 rounded-md bg-[#F8FBFE] px-3 py-2">
                        <RefreshIcon className="h-3.5 w-3.5 animate-spin text-[#1677FF]" />
                        <p className="text-[10px] text-[#64748B]">
                          Loading customers and leads...
                        </p>
                      </div>
                    )}

                    {crmError && (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                        <AlertCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                        <p className="text-xs text-red-700">
                          {crmError}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCreateReport}
                        disabled={reportLoading}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#1677FF] px-3 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <DocumentIcon className="h-3.5 w-3.5" />
                        {reportLoading
                          ? "Creating report..."
                          : reportUrl
                            ? "Regenerate Report"
                            : "Create Customer Report"}
                      </button>

                      {reportUrl && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          Report Ready
                        </span>
                      )}
                    </div>

                    {reportError && (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                        <AlertCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                        <p className="text-xs text-red-700">
                          {reportError}
                        </p>
                      </div>
                    )}

                    {reportUrl && (
                      <div className="mt-4 rounded-lg border border-[#DCE8F5] bg-[#F8FBFE] p-3">
                        <div className="flex items-center gap-2">
                          <ShareIcon className="h-4 w-4 text-[#1677FF]" />

                          <div>
                            <p className="text-xs font-bold text-[#102A56]">
                              Shareable Report Link
                            </p>
                            <p className="text-[10px] text-[#64748B]">
                              Customer can open this report without dealership login.
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <input
                            readOnly
                            value={reportUrl}
                            onFocus={(e) => e.target.select()}
                            className="h-8 min-w-0 flex-1 rounded-md border border-[#DCE8F5] bg-white px-2.5 text-xs text-[#102A56] outline-none"
                          />

                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#102A56] transition hover:bg-gray-50"
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                            {copied ? "Copied!" : "Copy Link"}
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <a
                            href={reportUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#102A56] transition hover:bg-gray-50"
                          >
                            <DocumentIcon className="h-3.5 w-3.5" />
                            View Report
                          </a>

                          <a
                            href={`${reportUrl.replace(
                              "/report/",
                              "/api/reports/"
                            )}/pdf`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DCE8F5] bg-white px-3 text-xs font-semibold text-[#102A56] transition hover:bg-gray-50"
                          >
                            <DocumentIcon className="h-3.5 w-3.5" />
                            Download PDF
                          </a>

                          <button
                            type="button"
                            onClick={handleRevokeReport}
                            disabled={reportLoading}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CloseIcon className="h-3.5 w-3.5" />
                            Revoke Link
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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

  const isCarfax =
    source === "CARFAX";

  return (
    <span
      className={
        isManual
          ? "shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200"
          : isCarfax
          ? "shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 ring-1 ring-green-200"
          : "shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 ring-1 ring-gray-200"
      }
    >
      {isManual
        ? "Manual Entry"
        : isCarfax
        ? "CARFAX"
        : "Source Confirmed"}
    </span>
  );
}


















































