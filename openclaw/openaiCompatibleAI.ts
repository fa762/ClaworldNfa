import type { AIProvider, ChatMessage } from "./types";

export interface OpenAICompatibleAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
}

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string; content?: string }> | null;
      reasoning_content?: string | Array<{ type?: string; text?: string; content?: string }> | null;
    };
  }>;
  output_text?: string;
}

export class OpenAICompatibleAIProvider implements AIProvider {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(config: OpenAICompatibleAIConfig) {
    if (!config.baseUrl) throw new Error("Missing baseUrl");
    if (!config.apiKey) throw new Error("Missing apiKey");
    if (!config.model) throw new Error("Missing model");

    this.endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.2;
    this.timeoutMs = config.timeoutMs ?? 45_000;
    this.extraHeaders = config.extraHeaders ?? {};
  }

  async chat(systemPrompt: string, userMessage: string, history: ChatMessage[] = []): Promise<string> {
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      { role: "user", content: userMessage },
    ];

    const payload = {
      model: this.model,
      temperature: this.temperature,
      response_format: { type: "text" },
      messages,
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.postJSON<OpenAIChatCompletionResponse>(payload);
      const content = extractMessageText(response)?.trim();
      if (content) {
        return content;
      }

      if (attempt === 1) {
        throw new Error(
          `Model returned empty content: ${JSON.stringify({
            output_text: response.output_text ?? null,
            choice: response.choices?.[0]?.message ?? null,
          })}`
        );
      }

      await sleep(750);
    }

    throw new Error("Model returned empty content after retries.");
  }

  async chatJSON<T>(systemPrompt: string, userMessage: string): Promise<T> {
    const content = await this.chat(
      `${systemPrompt}\n\nReturn valid JSON only.`,
      userMessage,
      []
    );
    return parseJsonResponse<T>(content);
  }

  private async postJSON<T>(body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Model API ${response.status}: ${text}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

function stripMarkdownCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 3) return trimmed;
  return lines.slice(1, -1).join("\n").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonResponse<T>(value: string): T {
  const normalized = stripMarkdownCodeFence(value);

  try {
    return JSON.parse(normalized) as T;
  } catch {
    const extracted = extractFirstJsonCandidate(normalized);
    if (!extracted) {
      throw new Error(`Model returned non-JSON content: ${normalized}`);
    }
    return JSON.parse(extracted) as T;
  }
}

function extractFirstJsonCandidate(value: string): string | null {
  const text = value.trim();
  if (!text) return null;

  const starts = ["{", "["];
  for (let i = 0; i < text.length; i += 1) {
    if (!starts.includes(text[i])) continue;

    const candidate = extractBalancedJson(text, i);
    if (!candidate) continue;

    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Keep scanning for the next balanced JSON object/array.
    }
  }

  return null;
}

function extractBalancedJson(value: string, start: number): string | null {
  const opening = value[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < value.length; i += 1) {
    const char = value[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, i + 1);
      }
    }
  }

  return null;
}

function extractMessageText(response: OpenAIChatCompletionResponse): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const message = response.choices?.[0]?.message;
  if (!message) return "";

  const parts = [message.content, message.reasoning_content]
    .map(flattenContentPart)
    .filter(Boolean);

  return parts.join("\n").trim();
}

function flattenContentPart(
  value: string | Array<{ type?: string; text?: string; content?: string }> | null | undefined
): string {
  if (!value) return "";
  if (typeof value === "string") return value;

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      if (typeof entry.text === "string" && entry.text.trim()) return entry.text;
      if (typeof entry.content === "string" && entry.content.trim()) return entry.content;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
