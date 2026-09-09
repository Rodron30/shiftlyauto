// lib/perplexity.ts
//
// Thin wrapper around the Perplexity API (OpenAI-compatible /chat/completions
// endpoint) used for the AI Analysis layer (Blueprint §16-§19, §35).
//
// IMPORTANT CAVEAT — read before changing models:
// Perplexity's "sonar" family is web-search-grounded by default. The
// blueprint's #1 AI rule is "never invent facts — only use the supplied
// vehicle-history data" (§18: Rule 1). Letting the model search the live
// web for a VIN/vehicle could pull in unrelated or wrong information and
// violate that rule. To keep this safe:
//   - `disable_search: true` is passed on every call to turn off live
//     browsing/grounding, so the model reasons only over the JSON we send it.
//   - If Perplexity changes/removes that parameter, drop back to OpenAI (or
//     any plain non-search chat model) for this endpoint specifically.

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

export type PerplexityMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callPerplexity(
  messages: PerplexityMessage[],
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "PERPLEXITY_API_KEY is not set. Add it to your .env.local (server-side only, never NEXT_PUBLIC_)."
    );
  }

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options?.model ?? process.env.PERPLEXITY_MODEL ?? "sonar",
      messages,
      max_tokens: options?.maxTokens ?? 800,
      temperature: 0.2,
      // Keep the model grounded ONLY in the data we send it. See caveat above.
      disable_search: true,
      return_related_questions: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Perplexity API error (${response.status}): ${errorText || response.statusText}`
    );
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new Error("Perplexity API returned an unexpected response shape.");
  }

  return content;
}
