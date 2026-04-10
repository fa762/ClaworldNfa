import { ethers } from "ethers";
import type { IPFSUploader } from "./skills/oracleSkill";

export interface HttpReasoningUploaderConfig {
  uploadUrl: string;
  bearerToken?: string;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
}

export class DigestReasoningUploader implements IPFSUploader {
  async upload(content: string): Promise<string> {
    const digest = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(content)).slice(2, 18);
    return `autonomy://${digest}`;
  }
}

export class HttpReasoningUploader implements IPFSUploader {
  private readonly uploadUrl: string;
  private readonly bearerToken?: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(config: HttpReasoningUploaderConfig) {
    this.uploadUrl = config.uploadUrl;
    this.bearerToken = config.bearerToken;
    this.timeoutMs = config.timeoutMs ?? 45_000;
    this.extraHeaders = config.extraHeaders ?? {};
  }

  async upload(content: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.uploadUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : {}),
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          content,
          contentType: "application/json",
          filename: `autonomy-reasoning-${Date.now()}.json`,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Reasoning uploader ${response.status}: ${text}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const cid =
        pickString(payload, ["cid", "hash", "id", "url", "uri"]) ??
        pickString(payload.data, ["cid", "hash", "id", "url", "uri"]);

      if (!cid) {
        throw new Error("Reasoning uploader did not return a cid/hash/url/id");
      }

      return cid;
    } finally {
      clearTimeout(timer);
    }
  }
}

function pickString(
  value: unknown,
  keys: string[]
): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}
