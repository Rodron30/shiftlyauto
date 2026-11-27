// Global type declarations for Chrome extension API

declare global {
  interface ShiftlyMarketplaceListingMessage {
    type: "SHIFTLY_POST_TO_MARKETPLACE";
    listing: unknown;
  }

  interface ShiftlyExtensionMessage {
    type: string;
    [key: string]: unknown;
  }

  interface ShiftlyExtensionResponse {
    success?: boolean;
    error?: string;
  }

  interface Window {
    chrome?: {
      runtime: {
        sendMessage: (
          extensionId: string,
          message: ShiftlyExtensionMessage,
          callback?: (response: ShiftlyExtensionResponse) => void
        ) => void;
        lastError?: { message: string };
      };
    };
    shiftlyExtensionId?: string;
  }
}

export {};
