// Pricing, classification and routing logic for the dashboard.
// Kept free of React so it can be unit tested with `npm test`.

// List prices in USD per 1M tokens. Check provider pricing pages before
// relying on these numbers; they change often.
// `latency` is an indicative median in ms and `tier` is an ordinal capability
// bucket (1 = smallest, 5 = frontier). Both are assumptions, not measurements.
export const MODELS = [
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "openai", tier: 1, inputCost: 0.10, outputCost: 0.40, latency: 200, color: "#22d3ee" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", tier: 2, inputCost: 0.15, outputCost: 0.60, latency: 400, color: "#38bdf8" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", tier: 2, inputCost: 0.30, outputCost: 2.50, latency: 300, color: "#34d399" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic", tier: 3, inputCost: 1.00, outputCost: 5.00, latency: 350, color: "#a78bfa" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai", tier: 3, inputCost: 0.40, outputCost: 1.60, latency: 350, color: "#60a5fa" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", tier: 4, inputCost: 2.50, outputCost: 10.00, latency: 800, color: "#818cf8" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", tier: 4, inputCost: 2.00, outputCost: 8.00, latency: 700, color: "#6366f1" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic", tier: 4, inputCost: 3.00, outputCost: 15.00, latency: 900, color: "#c084fc" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", tier: 4, inputCost: 1.25, outputCost: 10.00, latency: 700, color: "#4ade80" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic", tier: 5, inputCost: 5.00, outputCost: 25.00, latency: 1500, color: "#e879f9" },
];

// Baseline for "savings": the registry model with the highest output price.
export const PREMIUM_MODEL = MODELS.reduce((a, b) => (b.outputCost > a.outputCost ? b : a));

// Quality proxy by tier (0 to 100). A heuristic prior, not a benchmark score.
export const TIER_QUALITY = { 1: 45, 2: 60, 3: 72, 4: 85, 5: 95 };

// Expected output tokens per input token, by task type.
export const OUTPUT_RATIO = { code: 1.5, creative: 2, analysis: 1, support: 0.5, summarization: 0.3, reasoning: 1.2, general: 0.8 };

export const TASK_TYPES = {
  code: { label: "Code", icon: "⌨️", keywords: ["code", "function", "class", "def", "import", "script", "debug", "api", "python", "javascript", "html", "implement", "refactor"] },
  creative: { label: "Creative", icon: "✨", keywords: ["write", "story", "poem", "essay", "blog", "article", "creative", "fiction", "marketing", "slogan"] },
  analysis: { label: "Analysis", icon: "📊", keywords: ["analyze", "analysis", "compare", "evaluate", "benchmark", "report", "data", "trend", "insight", "research"] },
  support: { label: "Support", icon: "💬", keywords: ["help", "how to", "explain", "tutorial", "guide", "troubleshoot", "setup", "install", "configure", "fix"] },
  summarization: { label: "Summary", icon: "📝", keywords: ["summarize", "summary", "tldr", "condense", "brief", "recap", "key points"] },
  reasoning: { label: "Reasoning", icon: "🧠", keywords: ["reason", "logic", "proof", "theorem", "deduce", "solve", "puzzle", "math", "why does", "prove"] },
  general: { label: "General", icon: "💡", keywords: [] },
};

const TECH_TERMS = ["algorithm", "architecture", "optimization", "distributed", "microservice", "database", "neural", "transformer", "pipeline", "encryption"];

function wordCount(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// Keyword classifier: task type with the most keyword hits, plus a 1 to 5
// complexity score from prompt length and technical vocabulary.
export function classifyPrompt(prompt) {
  const lower = prompt.toLowerCase();
  const scores = Object.entries(TASK_TYPES).map(([type, { keywords }]) => [type, keywords.filter(k => lower.includes(k)).length]);
  const best = scores.sort((a, b) => b[1] - a[1])[0];
  const taskType = best[1] > 0 ? best[0] : "general";

  const words = wordCount(prompt);
  const techTerms = TECH_TERMS.filter(t => lower.includes(t)).length;
  const complexity = Math.min(5, Math.max(1, Math.round(1 + (words > 200 ? 2 : words > 50 ? 1 : 0) + techTerms * 0.5)));

  return { taskType, complexity, confidence: best[1] > 0 ? 0.85 : 0.5 };
}

// Rough rule of thumb: about 0.75 English words per token.
export function estimateTokens(text) {
  return Math.max(1, Math.round(wordCount(text) / 0.75));
}

export function estimateCost(model, inputTokens, outputTokens) {
  return (inputTokens / 1e6) * model.inputCost + (outputTokens / 1e6) * model.outputCost;
}

// Ranks eligible models by quality per dollar. Models below the minimum tier
// implied by the prompt's complexity are excluded.
export function routeToModel(prompt) {
  const { taskType, complexity } = classifyPrompt(prompt);
  const inputTokens = estimateTokens(prompt);
  const outputTokens = Math.max(50, Math.round(inputTokens * (OUTPUT_RATIO[taskType] ?? 0.8)));
  const minTier = Math.max(1, Math.ceil(complexity / 2));
  const scored = MODELS.filter(m => m.tier >= minTier)
    .map(m => {
      const cost = estimateCost(m, inputTokens, outputTokens);
      const quality = TIER_QUALITY[m.tier] ?? 60;
      const value = quality / (cost * 1000 + 0.001);
      return { ...m, cost, quality, value, inputTokens, outputTokens };
    })
    .sort((a, b) => b.value - a.value);
  const premiumCost = estimateCost(PREMIUM_MODEL, inputTokens, outputTokens);
  return { scored, taskType, complexity, inputTokens, outputTokens, premiumCost };
}
