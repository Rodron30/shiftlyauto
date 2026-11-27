import { request } from "undici";
import type {
  TriCityFeedResponse,
  TriCityFeedTransport,
} from "./tricitymits-feed";

export class TriCityHttpFeedTransport implements TriCityFeedTransport {
  async fetchInventory(endpoint: string): Promise<TriCityFeedResponse> {
    const response = await request(endpoint, {
      method: "GET",
      headersTimeout: 15000,
      bodyTimeout: 30000,
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent":
          "ShiftlyAutoInventorySync/1.0",
      },
    });

    const rawText = await response.body.text();

    if (response.statusCode !== 200) {
      throw new Error(
        `Tri-City authorized feed returned HTTP ${response.statusCode}: ${rawText.slice(
          0,
          160
        )}`
      );
    }

    let payload: unknown;

    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Tri-City authorized feed returned non-JSON content: ${rawText.slice(
          0,
          160
        )}`
      );
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !Array.isArray((payload as TriCityFeedResponse).results)
    ) {
      throw new Error(
        "Tri-City authorized feed returned an invalid inventory response."
      );
    }

    return payload as TriCityFeedResponse;
  }
}
