import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export interface PDFStorageResult {
  success: boolean;
  path: string | null;
  error?: string;
}

/**
 * Stores a PDF in Supabase Storage for BCAutoLoan applications.
 *
 * @param applicationNumber - The application number (used as folder name)
 * @param pdfBytes - The PDF file bytes
 * @returns Object with success status, storage path, and optional error
 */
export async function storePDFInStorage(
  applicationNumber: string,
  pdfBytes: Uint8Array
): Promise<PDFStorageResult> {
  const supabase = createSupabaseAdminClient();
  const bucketName = "bcautoloan-applications";
  const fileName = `bcautoloan-application-${applicationNumber}.pdf`;
  const filePath = `${applicationNumber}/${fileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error("PDF storage upload error:", error);
      return {
        success: false,
        path: null,
        error: `Failed to upload PDF: ${error.message}`,
      };
    }

    return {
      success: true,
      path: data.path,
    };
  } catch (error) {
    console.error("PDF storage exception:", error);
    return {
      success: false,
      path: null,
      error: "PDF storage failed due to an unexpected error",
    };
  }
}

/**
 * Retrieves a PDF from Supabase Storage.
 *
 * @param applicationNumber - The application number
 * @returns Object with success status, PDF bytes, and optional error
 */
export async function getPDFFromStorage(
  applicationNumber: string
): Promise<{ success: boolean; data: Uint8Array | null; error?: string }> {
  const supabase = createSupabaseAdminClient();
  const bucketName = "bcautoloan-applications";
  const fileName = `bcautoloan-application-${applicationNumber}.pdf`;
  const filePath = `${applicationNumber}/${fileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      console.error("PDF storage download error:", error);
      return {
        success: false,
        data: null,
        error: `Failed to download PDF: ${error.message}`,
      };
    }

    // Convert Blob to Uint8Array
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    return {
      success: true,
      data: uint8Array,
    };
  } catch (error) {
    console.error("PDF download exception:", error);
    return {
      success: false,
      data: null,
      error: "PDF download failed due to an unexpected error",
    };
  }
}
