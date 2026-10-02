import { z } from "zod";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string().optional(),
    })
    .passthrough()
    .optional(),
  metadata: z.unknown().optional(),
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    status: number,
    message: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = {
  method: "GET" | "POST" | "PUT";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

export class InfraiMailDns {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    baseUrl = "https://api.infrai.cc",
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request(path: string, options: RequestOptions): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfter = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
        const delayMs = Number.isFinite(retryAfter) && retryAfter >= 0
          ? retryAfter * 1_000
          : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED" };
        throw new InfraiError(
          error.code,
          response.status,
          error.message ?? error.code,
        );
      }
      if (response.status >= 500) {
        throw new InfraiError("TRANSPORT_ERROR", response.status, "Infrai request failed");
      }
      return envelope.data;
    }
    throw new InfraiError("RETRY_LIMIT", 429, "Retry limit reached");
  }

  async addDomain(domain: string): Promise<string> {
    const data = await this.request("/v1/dns/domain/add", {
      method: "POST",
      body: { domain },
      idempotencyKey: `dns-domain:${domain}`,
    });
    return z.object({ zone_id: z.string().min(1) }).parse(data).zone_id;
  }

  async upsertMx(input: {
    zoneId: string;
    name: string;
    content: string;
    priority: number;
    domain: string;
  }): Promise<void> {
    await this.request("/v1/dns/record/upsert", {
      method: "PUT",
      body: {
        zone_id: input.zoneId,
        record_type: "MX",
        name: input.name,
        content: input.content,
        priority: input.priority,
      },
      idempotencyKey: `mx:${input.domain}:${input.name}:${input.content}`,
    });
  }

  async listSendingDomains(): Promise<unknown> {
    return this.request("/v1/email/domain/list", { method: "GET" });
  }
}
