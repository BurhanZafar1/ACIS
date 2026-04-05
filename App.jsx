export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "NO_API_KEY" }, { status: 500 });
  }

  try {
    var rawText = await request.text();
    var body;
    try {
      body = JSON.parse(rawText);
    } catch (e) {
      return Response.json({
        error: "JSON_PARSE_FAILED",
        rawLength: rawText.length,
        rawPreview: rawText.substring(0, 200)
      }, { status: 400 });
    }

    if (!body.prompt) {
      return Response.json({
        error: "NO_PROMPT_FIELD",
        receivedKeys: Object.keys(body),
        bodyPreview: JSON.stringify(body).substring(0, 300)
      }, { status: 400 });
    }

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
        system: "You are " + (body.model_name || "an AI model") + " by " + (body.provider || "AI") + ". Answer helpfully and concisely in under 250 words.",
        messages: [{ role: "user", content: body.prompt }],
      }),
    });

    var data = await apiResponse.json();

    if (!apiResponse.ok) {
      return Response.json({
        error: "ANTHROPIC_ERROR",
        status: apiResponse.status,
        message: data.error ? data.error.message : JSON.stringify(data).substring(0, 300)
      }, { status: apiResponse.status });
    }

    var text = "";
    for (var i = 0; i < (data.content || []).length; i++) {
      if (data.content[i].type === "text") text += data.content[i].text;
    }

    return Response.json({
      content: text,
      input_tokens: (data.usage && data.usage.input_tokens) || 0,
      output_tokens: (data.usage && data.usage.output_tokens) || 0,
    });
  } catch (err) {
    return Response.json({ error: "CRASH", message: err.message }, { status: 500 });
  }
}
