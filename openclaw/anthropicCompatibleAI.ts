import type { AIProvider, ChatMessage } from "./types";

export interface AnthropicCompatibleAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  anthropicVersion?: string;
  extraHeaders?: Record<string, string>;
}

interface AnthropicMessageResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }> | null;
}

export class AnthropicCompatibleAIProvider implements AIProvider {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly anthropicVersion: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(config: AnthropicCompatibleAIConfig) {
    if (!config.baseUrl) throw new Error("Missing baseUrl");
    if (!config.apiKey) throw new Error("Missing apiKey");
    if (!config.model) throw new Error("Missing model");

    this.endpoint = resolveAnthropicEndpoint(config.baseUrl);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.2;
    this.timeoutMs = config.timeoutMs ?? 45_000;
    this.maxTokens = config.maxTokens ?? 400;
    this.anthropicVersion = config.anthropicVersion ?? "2023-06-01";
    this.extraHeaders = config.extraHeaders ?? {};
  }

  async chat(systemPrompt: string, userMessage: string, history: ChatMessage[] = []): Promise<string> {
    const payload = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemPrompt,
      messages: [
        ...history.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        {
          role: "user" as const,
          content: userMessage,
        },
      ],
    };

    const response = await this.postJSON<AnthropicMessageResponse>(payload);
    const content = extractAnthropicText(response).trim();
    if (!content) {
      throw new Error(
        `Anthropic model returned empty content: ${JSON.stringify({
          content: response.content ?? null,
        })}`
      );
    }
    return content;
  }

  async chatJSON<T>(systemPrompt: string, userMessage: string): Promise<T> {
    const content = await this.chat(
      `${systemPrompt}\n\nReturn valid JSON only.`,
      userMessage,
      []
    );
    return JSON.parse(stripMarkdownCodeFence(content)) as T;
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
          // Some Anthropic-compatible gateways only return text when Bearer auth is present,
          // even if they also advertise x-api-key compatibility.
          Authorization: `Bearer ${this.apiKey}`,
          "x-api-key": this.apiKey,
          "anthropic-version": this.anthropicVersion,
          ...this.extraHeaders,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Anthropic API ${response.status}: ${text}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

function resolveAnthropicEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/messages")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/messages`;
  return `${normalized}/v1/messages`;
}

function extractAnthropicText(response: AnthropicMessageResponse): string {
  return (response.content ?? [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      if (entry.type === "text" && typeof entry.text === "string") return entry.text;
      if (typeof entry.text === "string") return entry.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function stripMarkdownCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 3) return trimmed;
  return lines.slice(1, -1).join("\n").trim();
}
