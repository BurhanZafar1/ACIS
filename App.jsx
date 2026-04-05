export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel env vars" });

  try {
    var body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    if (!body || !body.prompt) return res.status(400).json({ error: "prompt required", got: typeof body });

    var apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: "You are " + (body.model_name || "an AI") + " by " + (body.provider || "AI") + ". Answer helpfully and concisely in under 250 words.",
        messages: [{ role: "user", content: body.prompt }],
      }),
    });

    var data = await apiResponse.json();
    if (!apiResponse.ok) return res.status(apiResponse.status).json({ error: (data.error && data.error.message) || "API error" });

    var text = "";
    for (var i = 0; i < (data.content || []).length; i++) {
      if (data.content[i].type === "text") text += data.content[i].text;
    }

    return res.status(200).json({
      content: text,
      input_tokens: (data.usage && data.usage.input_tokens) || 0,
      output_tokens: (data.usage && data.usage.output_tokens) || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
