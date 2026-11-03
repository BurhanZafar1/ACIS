import test from "node:test";
import assert from "node:assert/strict";
import { MODELS, PREMIUM_MODEL, classifyPrompt, estimateTokens, estimateCost, routeToModel } from "../src/lib/pricing.js";

test("estimateCost applies per-million-token list prices", () => {
  const m = { inputCost: 2, outputCost: 8 };
  assert.equal(estimateCost(m, 1_000_000, 0), 2);
  assert.equal(estimateCost(m, 500_000, 250_000), 1 + 2);
});

test("estimateTokens uses about 0.75 words per token and never returns 0", () => {
  assert.equal(estimateTokens("one two three"), 4);
  assert.equal(estimateTokens(""), 1);
  assert.equal(estimateTokens("   "), 1);
});

test("classifyPrompt detects task type and defaults to general", () => {
  assert.equal(classifyPrompt("Write a Python function to debug this script").taskType, "code");
  assert.equal(classifyPrompt("Summarize the key points of this memo").taskType, "summarization");
  assert.equal(classifyPrompt("hello there").taskType, "general");
});

test("complexity rises with technical vocabulary and stays in 1..5", () => {
  const simple = classifyPrompt("What is a list?").complexity;
  const hard = classifyPrompt("Design a distributed database pipeline with encryption and a transformer architecture optimization algorithm").complexity;
  assert.ok(hard > simple);
  assert.ok(hard <= 5 && simple >= 1);
});

test("routeToModel ranks by quality per dollar and excludes low tiers for complex prompts", () => {
  const easy = routeToModel("What is a REST API?");
  assert.equal(easy.scored.length, MODELS.length);
  for (let i = 1; i < easy.scored.length; i++) assert.ok(easy.scored[i - 1].value >= easy.scored[i].value);

  const hard = routeToModel("Design a distributed database pipeline with encryption and a transformer architecture optimization algorithm");
  const minTier = Math.ceil(hard.complexity / 2);
  assert.ok(hard.scored.every(m => m.tier >= minTier));
  assert.ok(hard.scored.length < MODELS.length);
});

test("premium baseline is the highest list price, so savings are non-negative", () => {
  assert.equal(PREMIUM_MODEL.outputCost, Math.max(...MODELS.map(m => m.outputCost)));
  const r = routeToModel("Compare React and Vue for a startup");
  assert.ok(r.premiumCost >= r.scored[0].cost);
});
