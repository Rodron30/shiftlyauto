import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { CustomerReportPayload } from "@/lib/reportTypes";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.11, 0.11, 0.13);
const MUTED = rgb(0.45, 0.45, 0.48);
const AMBER = rgb(0.72, 0.45, 0.05);
const GREEN = rgb(0.13, 0.45, 0.25);
const LINE = rgb(0.85, 0.85, 0.87);

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word;

    if (
      font.widthOfTextAtSize(
        candidate,
        size
      ) > maxWidth &&
      current
    ) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0
    ? lines
    : [""];
}

/**
 * GET /api/reports/:token/pdf
 *
 * Public PDF export of a shared customer report.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { token } = await params;

    const cleanToken = token
      .trim()
      .toUpperCase();

    if (!cleanToken) {
      return new Response(
        "Invalid report token.",
        {
          status: 400,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase
        .from("reports")
        .select(
          "customer_report, created_at"
        )
        .eq(
          "share_token",
          cleanToken
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Customer report PDF query error:",
        error
      );

      return new Response(
        "Unable to load report.",
        {
          status: 500,
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (!data?.customer_report) {
      return new Response(
        "Report not found.",
        {
          status: 404,
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const report =
      data.customer_report as CustomerReportPayload;

    const pdfDoc =
      await PDFDocument.create();

    const font =
      await pdfDoc.embedFont(
        StandardFonts.Helvetica
      );

    const bold =
      await pdfDoc.embedFont(
        StandardFonts.HelveticaBold
      );

    // =====================================================
    // OPTIONAL DEALERSHIP LOGO
    // =====================================================

    let logoImage:
      | Awaited<
          ReturnType<
            typeof pdfDoc.embedPng
          >
        >
      | null = null;

    if (
      report.dealership?.logo_url
    ) {
      try {
        const logoResponse =
          await fetch(
            report.dealership.logo_url
          );

        if (logoResponse.ok) {
          const contentType =
            (
              logoResponse.headers.get(
                "content-type"
              ) || ""
            ).toLowerCase();

          const bytes =
            new Uint8Array(
              await logoResponse.arrayBuffer()
            );

          const url =
            report.dealership.logo_url.toLowerCase();

          if (
            contentType.includes(
              "image/png"
            ) ||
            url.endsWith(".png")
          ) {
            logoImage =
              await pdfDoc.embedPng(
                bytes
              );
          } else if (
            contentType.includes(
              "image/jpeg"
            ) ||
            contentType.includes(
              "image/jpg"
            ) ||
            /\.(jpe?g)$/.test(url)
          ) {
            logoImage =
              await pdfDoc.embedJpg(
                bytes
              );
          }
        }
      } catch (logoError) {
        console.error(
          "PDF logo embed error:",
          logoError
        );
      }
    }

    // =====================================================
    // PAGE HELPERS
    // =====================================================

    let page: PDFPage =
      pdfDoc.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);

    let y =
      PAGE_HEIGHT - MARGIN;

    function ensureSpace(
      needed: number
    ) {
      if (
        y - needed <
        MARGIN
      ) {
        page =
          pdfDoc.addPage([
            PAGE_WIDTH,
            PAGE_HEIGHT,
          ]);

        y =
          PAGE_HEIGHT - MARGIN;
      }
    }

    function drawLine() {
      ensureSpace(20);

      page.drawLine({
        start: {
          x: MARGIN,
          y,
        },
        end: {
          x:
            PAGE_WIDTH -
            MARGIN,
          y,
        },
        thickness: 1,
        color: LINE,
      });

      y -= 20;
    }

    function drawHeading(
      text: string
    ) {
      ensureSpace(24);

      page.drawText(text, {
        x: MARGIN,
        y,
        size: 12,
        font: bold,
        color: INK,
      });

      y -= 18;
    }

    function drawParagraph(
      text: string,
      options?: {
        size?: number;
        color?: typeof INK;
      }
    ) {
      const size =
        options?.size ?? 10;

      const color =
        options?.color ?? INK;

      const lines =
        wrapText(
          text,
          font,
          size,
          CONTENT_WIDTH
        );

      for (const line of lines) {
        ensureSpace(
          size + 4
        );

        page.drawText(line, {
          x: MARGIN,
          y,
          size,
          font,
          color,
        });

        y -= size + 4;
      }

      y -= 6;
    }

    function drawKeyValueRow(
      label: string,
      value: string
    ) {
      ensureSpace(18);

      page.drawText(label, {
        x: MARGIN,
        y,
        size: 10,
        font: bold,
        color: MUTED,
      });

      page.drawText(
        value || "—",
        {
          x:
            MARGIN + 110,
          y,
          size: 10,
          font,
          color: INK,
        }
      );

      y -= 16;
    }

    // =====================================================
    // HEADER
    // =====================================================

    if (logoImage) {
      const maxHeight = 36;

      const scale =
        maxHeight /
        logoImage.height;

      const logoWidth =
        logoImage.width *
        scale;

      page.drawImage(
        logoImage,
        {
          x:
            PAGE_WIDTH -
            MARGIN -
            logoWidth,
          y:
            PAGE_HEIGHT -
            MARGIN -
            maxHeight +
            8,
          width:
            logoWidth,
          height:
            maxHeight,
        }
      );
    }

    page.drawText(
      report.dealership?.name ||
        "Your Dealership",
      {
        x: MARGIN,
        y,
        size: 16,
        font: bold,
        color: INK,
      }
    );

    y -= 22;

    page.drawText(
      "Vehicle History Report",
      {
        x: MARGIN,
        y,
        size: 12,
        font,
        color: MUTED,
      }
    );

    y -= 28;

    const vehicleTitle = [
      report.vehicle?.year,
      report.vehicle?.make,
      report.vehicle?.model,
      report.vehicle?.trim,
    ]
      .filter(Boolean)
      .join(" ");

    page.drawText(
      vehicleTitle || "Vehicle",
      {
        x: MARGIN,
        y,
        size: 14,
        font: bold,
        color: INK,
      }
    );

    y -= 20;

    page.drawText(
      `VIN: ${
        report.vehicle?.vin ||
        "N/A"
      }`,
      {
        x: MARGIN,
        y,
        size: 10,
        font,
        color: MUTED,
      }
    );

    y -= 24;

    drawLine();

    // =====================================================
    // HISTORY HIGHLIGHTS
    // =====================================================

    drawHeading(
      "History Highlights"
    );

    ensureSpace(16);

    page.drawText(
      report.history_highlights
        ?.theft_found
        ? "WARNING: Theft-related record found"
        : "No theft-related record was found in the available data",
      {
        x: MARGIN,
        y,
        size: 10,
        font,
        color:
          report.history_highlights
            ?.theft_found
            ? AMBER
            : GREEN,
      }
    );

    y -= 16;

    ensureSpace(16);

    page.drawText(
      report.history_highlights
        ?.odometer_available
        ? "Odometer records available"
        : "No odometer records available",
      {
        x: MARGIN,
        y,
        size: 10,
        font,
        color: INK,
      }
    );

    y -= 20;

    drawLine();

    // =====================================================
    // THEFT HISTORY
    // =====================================================

    drawHeading(
      "Theft History"
    );

    if (
      !report.theft ||
      report.theft.length === 0
    ) {
      drawParagraph(
        "No theft-related record was found in the available data.",
        {
          color: MUTED,
        }
      );
    } else {
      for (const event of report.theft) {
        drawKeyValueRow(
          "Date:",
          event.date ??
            "Not provided"
        );

        drawKeyValueRow(
          "Description:",
          event.description ??
            "Theft-related record"
        );

        if (event.location) {
          drawKeyValueRow(
            "Location:",
            event.location
          );
        }

        drawKeyValueRow(
          "Source:",
          event.source ||
            "Unknown"
        );

        y -= 8;
      }
    }

    drawLine();

    // =====================================================
    // ODOMETER HISTORY
    // =====================================================

    drawHeading(
      "Odometer History"
    );

    if (
      !report.odometer ||
      report.odometer.length === 0
    ) {
      drawParagraph(
        "No odometer records were returned by the connected data source.",
        {
          color: MUTED,
        }
      );
    } else {
      for (const event of report.odometer) {
        const km =
          event.odometer != null
            ? `${event.odometer.toLocaleString(
                "en-US"
              )} km`
            : "—";

        drawKeyValueRow(
          event.date ?? "—",
          km
        );
      }

      y -= 4;
    }

    drawLine();

    // =====================================================
    // CUSTOMER SUMMARY
    // =====================================================

    drawHeading(
      "Summary"
    );

    drawParagraph(
      report.customer_summary ||
        "No summary available."
    );

    // =====================================================
    // NOTES / WARNINGS
    // =====================================================

    if (
      report.warnings &&
      report.warnings.length > 0
    ) {
      drawHeading("Notes");

      for (const warning of report.warnings) {
        drawParagraph(
          `• ${warning}`
        );
      }
    }

    drawLine();

    // =====================================================
    // IMPORTANT NOTE
    // =====================================================

    drawHeading(
      "Important Note"
    );

    drawParagraph(
      "This report summarizes information available from the data sources used by the dealership. It does not replace an independent vehicle inspection or the original source documentation.",
      {
        size: 9,
        color: MUTED,
      }
    );

    drawKeyValueRow(
      "Data Source:",
      report.data_source ||
        "N/A"
    );

    drawKeyValueRow(
      "Report Date:",
      new Date(
        data.created_at
      ).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      )
    );

    // =====================================================
    // GENERATE PDF
    // =====================================================

    const pdfBytes =
      await pdfDoc.save();
    const pdfData =
      new Uint8Array(
        pdfBytes
      );

    const filename =
      `vehicle-history-${
        report.vehicle?.vin ||
        cleanToken
      }.pdf`;

    return new Response(
      new Blob(
        [pdfData],
        {
          type: "application/pdf",
        }
      ),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/pdf",
          "Content-Disposition":
            `attachment; filename="${filename}"`,
          "Content-Length":
            String(
              pdfBytes.length
            ),
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Customer report PDF generation error:",
      error
    );

    return new Response(
      "Failed to generate PDF.",
      {
        status: 500,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}