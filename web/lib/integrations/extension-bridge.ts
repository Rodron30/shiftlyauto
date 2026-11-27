'use client';

const EXTENSION_ID = process.env.NEXT_PUBLIC_DEALERARCH_EXTENSION_ID;
const REQUEST_TIMEOUT_MS = 10000;

interface ExtensionMessageResponse {
  success?: boolean;
  error?: string;
  provider?: string;
  complete?: boolean;
  allPagesLoaded?: boolean;
  vehicles?: unknown[];
  totalPages?: number;
  capturedAt?: string | number;
  sourceUrl?: string;
}

function isExtensionMessageResponse(value: unknown): value is ExtensionMessageResponse {
  return typeof value === 'object' && value !== null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Extension request timed out')), timeoutMs)
    )
  ]);
}

function sendExtensionMessage(message: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const runtime = window.chrome?.runtime;
    if (!runtime || !EXTENSION_ID) {
      reject(new Error('Chrome extension API not available'));
      return;
    }

    runtime.sendMessage(EXTENSION_ID, message, (response: unknown) => {
      const runtimeError = window.chrome?.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || 'Extension communication failed'));
        return;
      }
      resolve(response);
    });
  });
}

export async function requestInventoryFromExtension(url: string): Promise<ExtensionScanResult> {
  if (typeof window === 'undefined') {
    throw new Error('Extension bridge can only be called from client-side');
  }

  if (!window.chrome?.runtime) {
    throw new Error('Chrome extension API not available');
  }

  if (!EXTENSION_ID) {
    throw new Error('DEALERARCH_EXTENSION_ID not configured');
  }

  try {
    const rawResponse = await withTimeout(
      sendExtensionMessage({
        type: 'DEALERARCH_REQUEST_INVENTORY',
        url,
      }),
      REQUEST_TIMEOUT_MS
    );

    if (!isExtensionMessageResponse(rawResponse) || rawResponse.success !== true) {
      const message = isExtensionMessageResponse(rawResponse) &&
        typeof rawResponse.error === 'string'
        ? rawResponse.error
        : 'Extension request failed';
      throw new Error(message);
    }

    const vehicles = Array.isArray(rawResponse.vehicles) ? rawResponse.vehicles : [];
    const capturedAt = rawResponse.capturedAt ?? Date.now();
    const capturedDate = new Date(capturedAt);

    if (Number.isNaN(capturedDate.getTime())) {
      throw new Error('Extension returned an invalid capture timestamp');
    }

    return {
      ok: true,
      source: rawResponse.provider || 'unknown',
      complete: rawResponse.complete === true,
      allPagesLoaded: rawResponse.allPagesLoaded === true,
      totalVehicles: vehicles.length,
      totalPages: typeof rawResponse.totalPages === 'number' ? rawResponse.totalPages : 0,
      vehicles,
      capturedAt: capturedDate.toISOString(),
      sourceUrl: rawResponse.sourceUrl,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('Extension not found') ||
        error.message.includes('could not establish connection') ||
        error.message.includes('message port closed')
      ) {
        throw new Error('Dealerarch extension not installed. Please install the extension to use this scanning method.');
      }

      if (error.message.includes('timed out')) {
        throw new Error('Extension did not respond in time. Please reload the page and try again.');
      }

      throw error;
    }

    throw new Error('Extension communication failed');
  }
}

export async function isExtensionInstalled(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.chrome?.runtime || !EXTENSION_ID) {
    return false;
  }

  try {
    const response = await withTimeout(
      sendExtensionMessage({ type: 'DEALERARCH_EXTENSION_PING' }),
      REQUEST_TIMEOUT_MS
    );

    return isExtensionMessageResponse(response) && response.success === true;
  } catch {
    return false;
  }
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
