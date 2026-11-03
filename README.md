# ACIS (earlier prototype)

An LLM cost simulator that prices each prompt across 10 models and ranks them by quality per dollar.

**Status:** this is the first prototype. Active development continues in [ai-cost-intelligence](https://github.com/BurhanZafar1/ai-cost-intelligence), which has the same code plus documentation of the method and its limitations. This repository is kept for history.

## The problem

Inference is billed per token, and list prices for comparable requests vary by more than ten times across models. Teams that default to one premium model carry a variable cost that grows with usage and compresses gross margin. Choosing the cheapest model that meets a quality bar, query by query, is a unit economics decision that needs per-query cost estimates.

## What it does

* Classifies a prompt by task type and complexity.
* Estimates tokens and cost for 10 models from OpenAI, Anthropic and Google using list prices.
* Ranks eligible models by a quality per dollar score and reports the saving against the most expensive model.
* Optional live mode calls a real API through a serverless function and prices the actual token usage.

## How it works

Pricing and routing logic is in `src/lib/pricing.js`: a word-based token estimate, list-price cost formula, a minimum capability tier set by complexity, and a value score of a tier-based quality prior divided by cost. `api/chat.js` is a Vercel Edge Function used only in live mode. The interface is React, Vite and Recharts.

## Quickstart

```bash
git clone https://github.com/BurhanZafar1/acis.git
cd acis
npm install
npm test
npm run dev
```

## Configuration

Copy `.env.example` to `.env` for live mode only.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Key used by `api/chat.js` |
| `LLM_MODEL` | Optional model override for the proxy |

## Example output

`npm test` runs six unit tests on the pricing and routing logic (6 passed). See the companion repository for a worked routing example.

## Limitations and next steps

Quality scores are a prior, not measured; classification is keyword based; prices are hardcoded. These are addressed going forward in ai-cost-intelligence.

## License

MIT. See [LICENSE](LICENSE).
