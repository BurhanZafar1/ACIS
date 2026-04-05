import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, AreaChart, Area } from "recharts";

// ─── Model Registry (mirrors backend) ─────────────────────────
const MODELS = [
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "openai", tier: 1, inputCost: 0.10, outputCost: 0.40, latency: 200, color: "#22d3ee" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", tier: 2, inputCost: 0.15, outputCost: 0.60, latency: 400, color: "#38bdf8" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", tier: 2, inputCost: 0.15, outputCost: 0.60, latency: 300, color: "#34d399" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic", tier: 3, inputCost: 0.80, outputCost: 4.00, latency: 350, color: "#a78bfa" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai", tier: 3, inputCost: 0.40, outputCost: 1.60, latency: 350, color: "#60a5fa" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", tier: 4, inputCost: 2.50, outputCost: 10.00, latency: 800, color: "#818cf8" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", tier: 4, inputCost: 2.00, outputCost: 8.00, latency: 700, color: "#6366f1" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic", tier: 4, inputCost: 3.00, outputCost: 15.00, latency: 900, color: "#c084fc" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", tier: 4, inputCost: 1.25, outputCost: 10.00, latency: 700, color: "#4ade80" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic", tier: 5, inputCost: 5.00, outputCost: 25.00, latency: 1500, color: "#e879f9" },
];

const TASK_TYPES = {
  code: { label: "Code", icon: "⌨️", keywords: ["code","function","class","def","import","script","debug","api","python","javascript","html","implement","refactor"] },
  creative: { label: "Creative", icon: "✨", keywords: ["write","story","poem","essay","blog","article","creative","fiction","marketing","slogan"] },
  analysis: { label: "Analysis", icon: "📊", keywords: ["analyze","analysis","compare","evaluate","benchmark","report","data","trend","insight","research"] },
  support: { label: "Support", icon: "💬", keywords: ["help","how to","explain","tutorial","guide","troubleshoot","setup","install","configure","fix"] },
  summarization: { label: "Summary", icon: "📝", keywords: ["summarize","summary","tldr","condense","brief","recap","key points"] },
  reasoning: { label: "Reasoning", icon: "🧠", keywords: ["reason","logic","proof","theorem","deduce","solve","puzzle","math","why does","prove"] },
  general: { label: "General", icon: "💡", keywords: [] },
};

// ─── Classification Engine ────────────────────────────────────
function classifyPrompt(prompt) {
  const lower = prompt.toLowerCase();
  const scores = {};
  for (const [type, { keywords }] of Object.entries(TASK_TYPES)) {
    scores[type] = keywords.filter(k => lower.includes(k)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const taskType = best[1] > 0 ? best[0] : "general";

  const words = prompt.split(/\s+/).length;
  const techTerms = ["algorithm","architecture","optimization","distributed","microservice","database","neural","transformer","pipeline","encryption"].filter(t => lower.includes(t)).length;
  const complexity = Math.min(5, Math.max(1, Math.round(1 + (words > 200 ? 2 : words > 50 ? 1 : 0) + techTerms * 0.5)));

  return { taskType, complexity, confidence: best[1] > 0 ? 0.85 : 0.5 };
}

function estimateTokens(text) {
  return Math.max(1, Math.round(text.split(/\s+/).length / 0.75));
}

function estimateCost(model, inputTokens, outputTokens) {
  return (inputTokens / 1e6) * model.inputCost + (outputTokens / 1e6) * model.outputCost;
}

function routeToModel(prompt) {
  const { taskType, complexity } = classifyPrompt(prompt);
  const inputTokens = estimateTokens(prompt);
  const outputRatio = { code: 1.5, creative: 2, analysis: 1, support: 0.5, summarization: 0.3, reasoning: 1.2, general: 0.8 }[taskType] || 0.8;
  const outputTokens = Math.max(50, Math.round(inputTokens * outputRatio));
  const minTier = Math.max(1, Math.ceil(complexity / 2));
  const candidates = MODELS.filter(m => m.tier >= minTier);
  const scored = candidates.map(m => {
    const cost = estimateCost(m, inputTokens, outputTokens);
    const quality = { 1: 45, 2: 60, 3: 72, 4: 85, 5: 95 }[m.tier] || 60;
    const value = quality / (cost * 1000 + 0.001);
    return { ...m, cost, quality, value, inputTokens, outputTokens };
  }).sort((a, b) => b.value - a.value);
  return { scored, taskType, complexity, inputTokens, outputTokens };
}

// ─── Styles ───────────────────────────────────────────────────
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');`;

// ─── Components ────────────────────────────────────────────────
function SavingsCounter({ total, animatedTotal }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
      border: "1px solid rgba(139,92,246,0.3)",
      borderRadius: 20,
      padding: "32px 40px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 14, fontWeight: 500, color: "#a78bfa", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8, position: "relative" }}>Total Saved with ACIS</div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 56, fontWeight: 700, color: "#f0fdf4", position: "relative", lineHeight: 1.1 }}>
        ${animatedTotal.toFixed(4)}
      </div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, color: "#86efac", marginTop: 8, position: "relative" }}>
        vs. always using Claude Opus 4.6 (most expensive)
      </div>
    </div>
  );
}

function ModelBar({ model, isSelected, maxCost, onClick }) {
  const barWidth = maxCost > 0 ? (model.cost / maxCost) * 100 : 0;
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
      borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
      background: isSelected ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)",
      border: isSelected ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: model.color, flexShrink: 0 }} />
      <div style={{ width: 130, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{model.name}</div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#94a3b8" }}>{model.provider}</div>
      </div>
      <div style={{ flex: 1, position: "relative", height: 24, background: "rgba(255,255,255,0.03)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${barWidth}%`, background: `linear-gradient(90deg, ${model.color}33, ${model.color}88)`, borderRadius: 6, transition: "width 0.5s ease" }} />
        <div style={{ position: "absolute", top: 0, left: 8, right: 8, bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#e2e8f0" }}>${model.cost.toFixed(6)}</span>
          <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, color: "#94a3b8" }}>Q:{model.quality}/100</span>
        </div>
      </div>
      <div style={{ width: 60, textAlign: "right", fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#94a3b8" }}>{model.latency}ms</div>
      {model.recommendation && (
        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
          background: model.recommendation === "Best value" ? "rgba(52,211,153,0.15)" : model.recommendation === "Cheapest" ? "rgba(34,211,238,0.15)" : "rgba(251,191,36,0.15)",
          color: model.recommendation === "Best value" ? "#34d399" : model.recommendation === "Cheapest" ? "#22d3ee" : "#fbbf24",
          border: `1px solid ${model.recommendation === "Best value" ? "rgba(52,211,153,0.3)" : model.recommendation === "Cheapest" ? "rgba(34,211,238,0.3)" : "rgba(251,191,36,0.3)"}`,
        }}>{model.recommendation}</span>
      )}
    </div>
  );
}

function QueryLogRow({ log, idx }) {
  const taskInfo = TASK_TYPES[log.taskType] || TASK_TYPES.general;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "32px 1fr 90px 80px 70px 70px 80px", alignItems: "center", gap: 8,
      padding: "10px 16px", borderRadius: 10,
      background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{ fontSize: 16 }}>{taskInfo.icon}</span>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.prompt}</div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: log.cached ? "#22d3ee" : "#a78bfa" }}>{log.model}</div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#34d399" }}>${log.cost.toFixed(5)}</div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#fbbf24" }}>{log.quality}/100</div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#94a3b8" }}>{log.latency}ms</div>
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#86efac" }}>+${log.savings.toFixed(5)}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function ACISDashboard() {
  const [prompt, setPrompt] = useState("");
  const [activeTab, setActiveTab] = useState("simulate");
  const [simulation, setSimulation] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [queryLogs, setQueryLogs] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [animatedSavings, setAnimatedSavings] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiError, setAiError] = useState(null);
  const promptRef = useRef(null);

  // Animate savings counter
  useEffect(() => {
    const target = totalSavings;
    const step = (target - animatedSavings) * 0.08;
    if (Math.abs(step) > 0.000001) {
      const timer = setTimeout(() => setAnimatedSavings(prev => prev + step), 30);
      return () => clearTimeout(timer);
    } else {
      setAnimatedSavings(target);
    }
  }, [totalSavings, animatedSavings]);

  // Seed demo data
  useEffect(() => {
    const demoPrompts = [
      { prompt: "Write a quicksort function in Python", taskType: "code", model: "gpt-4o-mini", cost: 0.00012, quality: 78, latency: 380, savings: 0.00450, cached: false },
      { prompt: "Analyze Q3 revenue trends and forecast Q4", taskType: "analysis", model: "claude-sonnet-4", cost: 0.00340, quality: 92, latency: 870, savings: 0.00180, cached: false },
      { prompt: "What is a REST API?", taskType: "support", model: "gpt-4.1-nano", cost: 0.00002, quality: 65, latency: 180, savings: 0.00520, cached: false },
      { prompt: "Write a story about a robot learning to paint", taskType: "creative", model: "claude-haiku-4-5", cost: 0.00089, quality: 82, latency: 340, savings: 0.00430, cached: false },
      { prompt: "Summarize the key points of transformer architecture", taskType: "summarization", model: "gemini-2.5-flash", cost: 0.00008, quality: 70, latency: 290, savings: 0.00510, cached: false },
      { prompt: "Compare React vs Vue vs Svelte for a startup", taskType: "analysis", model: "gpt-4.1-mini", cost: 0.00035, quality: 75, latency: 330, savings: 0.00490, cached: false },
      { prompt: "What is a REST API?", taskType: "support", model: "gpt-4.1-nano", cost: 0.00000, quality: 65, latency: 1, savings: 0.00002, cached: true },
    ];
    setQueryLogs(demoPrompts);
    setTotalSavings(demoPrompts.reduce((s, l) => s + l.savings, 0));
  }, []);

  const handleSimulate = useCallback(() => {
    if (!prompt.trim()) return;
    const result = routeToModel(prompt);
    const maxCost = Math.max(...result.scored.map(s => s.cost));
    const cheapestCost = Math.min(...result.scored.map(s => s.cost));
    const bestQuality = Math.max(...result.scored.map(s => s.quality));
    const fastestLatency = Math.min(...result.scored.map(s => s.latency));

    const enriched = result.scored.map(s => ({
      ...s,
      recommendation: s.cost === cheapestCost ? "Cheapest" : s.quality === bestQuality ? "Highest quality" : s.latency === fastestLatency ? "Fastest" : (s === result.scored[0] && s.cost !== cheapestCost && s.quality !== bestQuality) ? "Best value" : "",
    }));

    setSimulation({ ...result, scored: enriched, maxCost });
    setSelectedModel(enriched[0]?.id);
    setAiResponse(null);
    setAiError(null);
  }, [prompt]);

  const handleExecute = useCallback(async () => {
    if (!simulation || !selectedModel) return;
    setIsProcessing(true);
    setAiResponse(null);
    setAiError(null);

    const model = simulation.scored.find(s => s.id === selectedModel);
    if (!model) { setIsProcessing(false); return; }

    const premiumModel = MODELS[MODELS.length - 1];

    // Try real API first (works inside Claude.ai artifact), fall back to simulation
    let content = null;
    let actualInputTokens = model.inputTokens;
    let actualOutputTokens = model.outputTokens;
    let usedLiveApi = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are simulating the output of "${model.name}" (${model.provider}). Respond helpfully and concisely. Keep response under 200 words.`,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      clearTimeout(timeout);
      const data = await response.json();
      content = data.content?.map(b => b.type === "text" ? b.text : "").join("") || null;
      actualInputTokens = data.usage?.input_tokens || model.inputTokens;
      actualOutputTokens = data.usage?.output_tokens || model.outputTokens;
      if (content) usedLiveApi = true;
    } catch (_) {
      // CORS or network error — expected outside artifact env, fall through to simulation
    }

    // Generate simulated response if API unavailable
    if (!content) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 500)); // realistic delay
      const simResponses = {
        code: `Here's an implementation for your request:\n\n\`\`\`python\ndef solution():\n    # Implementation using ${model.name}\n    # Optimized for ${model.tier >= 4 ? "accuracy and edge cases" : "speed and simplicity"}\n    pass\n\`\`\`\n\nThis approach uses a ${model.tier >= 4 ? "comprehensive" : "straightforward"} strategy. Time complexity: O(n). Space complexity: O(1).\n\nKey decisions:\n• Chose iterative over recursive for memory efficiency\n• Added input validation for robustness\n• Handles edge cases: empty input, single element, duplicates`,
        creative: `${model.tier >= 4 ? "In the amber light of a forgotten afternoon, " : ""}The story unfolds with unexpected turns — a world where every choice echoes forward. The protagonist discovers that ${model.tier >= 4 ? "the boundaries between memory and imagination blur like watercolors in rain" : "things aren't always what they seem"}.\n\nThis narrative explores themes of identity and transformation, weaving together moments both quiet and electric.`,
        analysis: `**Analysis Summary** (via ${model.name})\n\nKey findings from the data:\n1. Primary trend: Upward trajectory with ${model.tier >= 4 ? "3 statistically significant inflection points" : "steady growth patterns"}\n2. Contributing factors: Market dynamics, seasonal variation, and structural shifts\n3. Confidence level: ${model.quality}%\n\nRecommendation: ${model.tier >= 4 ? "Implement a phased approach targeting the identified leverage points" : "Focus on the top-impact areas for immediate gains"}.`,
        support: `Here's how to approach this:\n\n**Step 1:** Start by checking your current setup\n**Step 2:** Apply the recommended configuration\n**Step 3:** Verify everything works\n\nCommon issues: Make sure dependencies are up to date. If you're still stuck, the most likely cause is a configuration mismatch.\n\nThis should resolve your question — let me know if you need more detail on any step.`,
        general: `Based on your prompt, here's a comprehensive response:\n\nThe key points to understand are:\n• Context matters — the answer depends on your specific use case\n• There are ${model.tier >= 4 ? "several nuanced considerations" : "a few important factors"} to weigh\n• The optimal approach balances practicality with thoroughness\n\nBottom line: ${model.tier >= 4 ? "This requires careful analysis of trade-offs, but the evidence points toward a clear direction" : "Start simple, iterate, and optimize based on results"}.`,
      };
      content = simResponses[simulation.taskType] || simResponses.general;
      content = `[Simulated — ${model.name} response]\n\n${content}`;
      actualOutputTokens = estimateTokens(content);
    }

    const actualCost = estimateCost(model, actualInputTokens, actualOutputTokens);
    const premiumCost = estimateCost(premiumModel, actualInputTokens, actualOutputTokens);
    const savings = Math.max(0, premiumCost - actualCost);

    setAiResponse({ content, model: model.name, cost: actualCost, inputTokens: actualInputTokens, outputTokens: actualOutputTokens, quality: model.quality, latency: model.latency, live: usedLiveApi });

    const newLog = { prompt: prompt.slice(0, 80), taskType: simulation.taskType, model: model.name.split(" ").pop(), cost: actualCost, quality: model.quality, latency: model.latency, savings, cached: false };
    setQueryLogs(prev => [newLog, ...prev]);
    setTotalSavings(prev => prev + savings);
    setIsProcessing(false);
  }, [simulation, selectedModel, prompt]);

  // Analytics data
  const modelUsageData = (() => {
    const counts = {};
    queryLogs.forEach(l => { counts[l.model] = (counts[l.model] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const costByType = (() => {
    const costs = {};
    queryLogs.forEach(l => { costs[l.taskType] = (costs[l.taskType] || 0) + l.cost; });
    return Object.entries(costs).map(([name, cost]) => ({ name: TASK_TYPES[name]?.label || name, cost: parseFloat(cost.toFixed(5)) }));
  })();

  const savingsTrend = queryLogs.slice().reverse().reduce((acc, l, i) => {
    const prev = acc[acc.length - 1]?.cumulative || 0;
    acc.push({ query: i + 1, savings: parseFloat(l.savings.toFixed(5)), cumulative: parseFloat((prev + l.savings).toFixed(5)) });
    return acc;
  }, []);

  const CHART_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#fb923c"];

  const { taskType, complexity, confidence } = prompt ? classifyPrompt(prompt) : { taskType: "general", complexity: 1, confidence: 0 };
  const taskInfo = TASK_TYPES[taskType] || TASK_TYPES.general;

  return (
    <div style={{ minHeight: "100vh", background: "#060918", color: "#e2e8f0", fontFamily: "'Outfit',sans-serif" }}>
      <style>{fonts}</style>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 3px; }
        textarea:focus, input:focus { outline: none; }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 20px rgba(139,92,246,0.2); } 50% { box-shadow: 0 0 40px rgba(139,92,246,0.4); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .slide-up { animation: slide-up 0.4s ease-out; }
      `}</style>

      {/* ─── Header ─────────────────────────────────────── */}
      <div style={{ padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono',monospace", color: "#fff" }}>A</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>ACIS</div>
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>AI COST INTELLIGENCE</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4 }}>
          {[{ id: "simulate", label: "Simulate" }, { id: "analytics", label: "Analytics" }, { id: "models", label: "Models" }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "8px 20px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "'Outfit',sans-serif", transition: "all 0.2s",
              background: activeTab === tab.id ? "rgba(139,92,246,0.2)" : "transparent",
              color: activeTab === tab.id ? "#c4b5fd" : "#64748b",
              border: activeTab === tab.id ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
        {/* ─── Savings Counter ─────────────────────────── */}
        <SavingsCounter total={totalSavings} animatedTotal={animatedSavings} />

        {/* ─── Stats Row ──────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, margin: "20px 0" }}>
          {[
            { label: "Total Queries", value: queryLogs.length, color: "#818cf8" },
            { label: "Cache Hit Rate", value: `${queryLogs.length ? Math.round(queryLogs.filter(l => l.cached).length / queryLogs.length * 100) : 0}%`, color: "#22d3ee" },
            { label: "Avg Quality", value: `${queryLogs.length ? Math.round(queryLogs.reduce((s, l) => s + l.quality, 0) / queryLogs.length) : 0}/100`, color: "#fbbf24" },
            { label: "Avg Cost/Query", value: `$${queryLogs.length ? (queryLogs.reduce((s, l) => s + l.cost, 0) / queryLogs.length).toFixed(5) : "0"}`, color: "#34d399" },
          ].map((stat, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>{stat.label}</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* ─── SIMULATE TAB ───────────────────────────── */}
        {activeTab === "simulate" && (
          <div className="slide-up">
            {/* Prompt Input */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Prompt</span>
                {prompt && (
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.2)" }}>{taskInfo.icon} {taskInfo.label}</span>
                    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>Complexity: {complexity}/5</span>
                    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(34,211,153,0.1)", color: "#34d399", border: "1px solid rgba(34,211,153,0.2)" }}>~{estimateTokens(prompt)} tokens</span>
                  </div>
                )}
              </div>
              <textarea ref={promptRef} value={prompt} onChange={e => { setPrompt(e.target.value); setSimulation(null); setAiResponse(null); setAiError(null); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSimulate(); } }}
                placeholder="Enter your prompt here... (e.g. 'Write a Python function to merge two sorted lists')"
                style={{
                  width: "100%", minHeight: 80, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12, padding: 16, color: "#e2e8f0", fontSize: 14, fontFamily: "'Outfit',sans-serif",
                  resize: "vertical", lineHeight: 1.6,
                }} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={handleSimulate} style={{
                  padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "#fff",
                  fontSize: 13, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
                  boxShadow: "0 4px 15px rgba(124,58,237,0.3)", transition: "all 0.2s",
                }}>⚡ Simulate Before Execute</button>
                {simulation && (
                  <button onClick={handleExecute} disabled={isProcessing} style={{
                    padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(52,211,153,0.4)", cursor: isProcessing ? "wait" : "pointer",
                    background: isProcessing ? "rgba(52,211,153,0.1)" : "rgba(52,211,153,0.15)", color: "#34d399",
                    fontSize: 13, fontWeight: 700, fontFamily: "'Outfit',sans-serif", transition: "all 0.2s",
                  }}>{isProcessing ? "⏳ Executing..." : "🚀 Execute with " + (MODELS.find(m => m.id === selectedModel)?.name || "")}</button>
                )}
              </div>
            </div>

            {/* Simulation Results */}
            {simulation && (
              <div className="slide-up" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Cost × Quality Simulation</span>
                  <span style={{ marginLeft: "auto", fontFamily: "'Space Mono',monospace", fontSize: 12, color: "#64748b" }}>
                    {simulation.scored.length} models compared • ~{simulation.inputTokens} input tokens
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {simulation.scored.map(model => (
                    <ModelBar key={model.id} model={model} isSelected={model.id === selectedModel} maxCost={simulation.maxCost} onClick={() => setSelectedModel(model.id)} />
                  ))}
                </div>
                <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10 }}>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, color: "#86efac" }}>
                    💰 Using {simulation.scored[0]?.name} instead of {MODELS[MODELS.length - 1].name} saves ${(simulation.scored[simulation.scored.length - 1]?.cost - simulation.scored[0]?.cost).toFixed(6)} per query
                  </span>
                </div>
              </div>
            )}

            {/* AI Response */}
            {aiResponse && (
              <div className="slide-up" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#c4b5fd" }}>Response from {aiResponse.model}</span>
                  <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: aiResponse.live ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.12)", color: aiResponse.live ? "#34d399" : "#fbbf24", border: `1px solid ${aiResponse.live ? "rgba(52,211,153,0.3)" : "rgba(251,191,36,0.25)"}` }}>
                    {aiResponse.live ? "LIVE API" : "SIMULATED"}
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#34d399" }}>${aiResponse.cost.toFixed(6)}</span>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#94a3b8" }}>{aiResponse.inputTokens}→{aiResponse.outputTokens} tokens</span>
                  </div>
                </div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 14, color: "#cbd5e1", lineHeight: 1.7, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 16 }}>
                  {aiResponse.content}
                </div>
              </div>
            )}

            {/* Query History */}
            {queryLogs.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Query History</div>
                <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 90px 80px 70px 70px 80px", gap: 8, padding: "8px 16px", marginBottom: 4 }}>
                  {["", "Prompt", "Model", "Cost", "Quality", "Latency", "Saved"].map((h, i) => (
                    <span key={i} style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{h}</span>
                  ))}
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {queryLogs.slice(0, 20).map((log, i) => <QueryLogRow key={i} log={log} idx={i} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ANALYTICS TAB ──────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="slide-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Cumulative Savings */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Cumulative Savings</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={savingsTrend}>
                  <defs><linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.3} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="query" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "Space Mono" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11, fontFamily: "Space Mono" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10, fontFamily: "Space Mono", fontSize: 12 }} />
                  <Area type="monotone" dataKey="cumulative" stroke="#34d399" fill="url(#savingsGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Model Distribution */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Model Usage Distribution</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={modelUsageData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" paddingAngle={3}>
                    {modelUsageData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10, fontFamily: "Space Mono", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Outfit" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Cost by Task Type */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Cost by Task Type</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={costByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "Outfit" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11, fontFamily: "Space Mono" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10, fontFamily: "Space Mono", fontSize: 12 }} />
                  <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                    {costByType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Per-Query Savings */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Savings Per Query</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={savingsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="query" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "Space Mono" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11, fontFamily: "Space Mono" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10, fontFamily: "Space Mono", fontSize: 12 }} />
                  <Bar dataKey="savings" fill="#86efac" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ─── MODELS TAB ─────────────────────────────── */}
        {activeTab === "models" && (
          <div className="slide-up">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Model Registry — {MODELS.length} models across 3 providers</div>
            <div style={{ display: "grid", gap: 12 }}>
              {MODELS.map(model => (
                <div key={model.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 20px", display: "grid", gridTemplateColumns: "200px 1fr 1fr 1fr 80px", alignItems: "center", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: model.color }} />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{model.name}</span>
                    </div>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#64748b", marginLeft: 18 }}>{model.provider}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Input / Output per 1M tokens</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: "#34d399" }}>${model.inputCost.toFixed(2)} / ${model.outputCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Avg Latency</div>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: "#fbbf24" }}>{model.latency}ms</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Quality Tier</div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {[1, 2, 3, 4, 5].map(t => (
                        <div key={t} style={{ width: 16, height: 6, borderRadius: 3, background: t <= model.tier ? model.color : "rgba(255,255,255,0.06)" }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: model.tier <= 2 ? "rgba(34,211,238,0.1)" : model.tier <= 4 ? "rgba(139,92,246,0.1)" : "rgba(232,121,249,0.1)",
                      color: model.tier <= 2 ? "#22d3ee" : model.tier <= 4 ? "#a78bfa" : "#e879f9",
                      border: `1px solid ${model.tier <= 2 ? "rgba(34,211,238,0.2)" : model.tier <= 4 ? "rgba(139,92,246,0.2)" : "rgba(232,121,249,0.2)"}`,
                    }}>
                      {model.tier <= 2 ? "Budget" : model.tier <= 4 ? "Pro" : "Frontier"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing Comparison Chart */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginTop: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Output Cost Comparison (per 1M tokens)</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={MODELS.map(m => ({ name: m.name.replace("Claude ", "").replace("Gemini ", ""), cost: m.outputCost, color: m.color }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "Space Mono" }} tickFormatter={v => `$${v}`} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "Outfit" }} />
                  <Tooltip contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10, fontFamily: "Space Mono", fontSize: 12 }} formatter={v => `$${v}/1M`} />
                  <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
                    {MODELS.map((m, i) => <Cell key={i} fill={m.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
