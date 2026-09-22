// Global type declarations for Chrome extension API

declare global {
  interface Window {
    chrome?: {
      runtime: {
        sendMessage: (extensionId: string, message: any, callback?: (response: any) => void) => void;
        lastError?: { message: string };
      };
    };
    shiftlyExtensionId?: string;
  }
}

export {};