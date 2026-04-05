export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not set. Add it in Vercel → Settings → Environment Variables.",
    });
  }

  try {
    const { prompt, model_name, provider } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You are simulating the output quality of "${model_name || "an AI model"}" (${provider || "AI provider"}). Respond helpfully, accurately, and concisely. Keep your response under 250 words. Do NOT mention that you are simulating — just answer the user's question directly as if you were that model.`,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Anthropic API error",
        type: data.error?.type,
      });
    }

    return res.status(200).json({
      content: data.content?.map((b) => (b.type === "text" ? b.text : "")).join("") || "",
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
