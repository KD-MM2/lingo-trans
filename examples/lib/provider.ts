import { streamSSE } from "@/lib/sse";

export type Protocol = "responses" | "chat-completions";

export interface ProviderConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  protocol: Protocol;
  customHeaders?: Record<string, string>;
  azure?: {
    apiVersion?: string;
    deployment?: string;
  };
}

export const PROVIDER_PRESETS = {
  openai: (model = "gpt-4o"): ProviderConfig => ({
    baseUrl: "https://api.openai.com",
    protocol: "responses",
    model,
  }),
  ollama: (model = "llama3.1:latest"): ProviderConfig => ({
    baseUrl: "http://localhost:11434",
    protocol: "chat-completions",
    model,
  }),
};

function buildHeaders(config: ProviderConfig) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.customHeaders ?? {}),
  };

  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  return headers;
}

export async function streamGenerate(
  config: ProviderConfig,
  prompt: string,
  onToken: (token: string) => void
) {
  const headers = buildHeaders(config);
  let url = config.baseUrl.replace(/\/$/, "");
  let body: any;

  if (config.protocol === "responses") {
    url += "/v1/responses";
    body = { model: config.model, input: prompt, stream: true };
  } else {
    url += "/v1/chat/completions";
    body = {
      model: config.model,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  await streamSSE(response, onToken);
}

export async function healthcheck(
  config: ProviderConfig
): Promise<{ ok: boolean; message: string; models?: string[] }> {
  try {
    const headers = buildHeaders(config);
    const base = config.baseUrl.replace(/\/$/, "");

    const modelsRes = await fetch(`${base}/v1/models`, {
      headers,
      method: "GET",
    }).catch(() => undefined);
    if (modelsRes?.ok) {
      const data = await modelsRes.json().catch(() => ({}));
      const models = Array.isArray(data?.data)
        ? data.data.map((item: any) => item.id ?? item.name).filter(Boolean)
        : undefined;
      return { ok: true, message: "Models listed", models };
    }

    if (config.protocol === "responses") {
      const res = await fetch(`${base}/v1/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          input: "Reply with OK",
          stream: false,
          max_output_tokens: 8,
        }),
      });
      if (res.ok) return { ok: true, message: "Responses API healthy" };
      const text = await res.text().catch(() => "");
      return { ok: false, message: `Responses ${res.status}: ${text}` };
    }

    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        max_tokens: 8,
        messages: [{ role: "user", content: "Say OK" }],
      }),
    });
    if (res.ok) return { ok: true, message: "Chat completions healthy" };
    const text = await res.text().catch(() => "");
    return { ok: false, message: `Chat ${res.status}: ${text}` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
