export async function streamSSE(
  response: Response,
  onToken: (token: string) => void
) {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body to stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const segment = part.trim();
      if (!segment.startsWith("data:")) continue;
      const payload = segment.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const json = JSON.parse(payload);
        const responseText =
          json.output_text ??
          json.output?.[0]?.content?.[0]?.text ??
          json.delta?.content?.[0]?.text ??
          json.choices?.[0]?.delta?.content ??
          "";
        if (responseText) onToken(responseText as string);
      } catch (error) {
        console.warn("Failed to parse SSE payload", error, payload);
      }
    }
  }
}
