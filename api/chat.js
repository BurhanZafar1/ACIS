// Vercel Edge Function: optional live mode for the dashboard.
// Forwards one prompt to the Anthropic Messages API and returns the text plus
// the actual token counts, which the dashboard prices at the selected model's
// list rates. Requires ANTHROPIC_API_KEY; LLM_MODEL is optional.
export const config = { runtime: "edge" };

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_PROMPT_CHARS = 8000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body, status = 200) => Response.json(body, { status, headers: cors });

export default async function handler(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not configured" }, 500);
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be JSON" }, 400);
  }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "prompt is required" }, 400);
  if (prompt.length > MAX_PROMPT_CHARS) return json({ error: `prompt exceeds ${MAX_PROMPT_CHARS} characters` }, 413);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: "Answer helpfully and concisely in under 250 words.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || "Upstream API error" }, r.status);

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return json({
      content: text,
      served_by: model,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
