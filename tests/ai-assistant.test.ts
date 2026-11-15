import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSeedBills, DEFAULT_PRODUCTS } from "../lib/billing";
import { analyzeStoreBills, answerStoreAIQuestion } from "../lib/ai-assistant";

test("analyzeStoreBills accurately calculates today sales, yesterday dip, and time window dips", () => {
  const seedBills = generateSeedBills();
  const analysis = analyzeStoreBills(seedBills, "2026-11-15", DEFAULT_PRODUCTS);

  assert.equal(analysis.todayDate, "2026-11-15");
  assert.ok(analysis.todayRevenue > 0);
  assert.ok(analysis.todayBillsCount > 0);
  assert.ok(analysis.yesterdayRevenue > 0);

  // Time window dip detection (DukaanPulse feature)
  assert.equal(analysis.timeWindows.length, 4);
  // Afternoon window 11:00 - 15:00 has deliberate slump in seed data
  const afternoonWindow = analysis.timeWindows.find((w) => w.startHour === 11);
  assert.ok(afternoonWindow);
  assert.ok(afternoonWindow.isFlagged, "Afternoon 11-15 should be flagged as dip");
  assert.ok(afternoonWindow.dipPercent >= 25);
  assert.ok(analysis.flaggedDipWindows.length > 0);

  // Spoken Tamil briefing
  assert.ok(analysis.fullReportTa.includes("வணக்கம்"));
  assert.ok(analysis.fullReportTa.includes("ரூபாய்"));
});

test("answerStoreAIQuestion handles Tamil questions for dip, time slump, and products", () => {
  const seedBills = generateSeedBills();

  // Test dip query
  const dipReply = answerStoreAIQuestion("நேற்றை விட இன்று எவ்வளவு கம்மியா இருக்கு?", seedBills, "2026-11-15");
  assert.equal(dipReply.topic, "dip");
  assert.ok(dipReply.answerTa.includes("சரிவு") || dipReply.answerTa.includes("குறைவு"));

  // Test time window query
  const timeReply = answerStoreAIQuestion("எந்த நேரத்துல சேல்ஸ் ரொம்ப கம்மியா ஆச்சு?", seedBills, "2026-11-15");
  assert.equal(timeReply.topic, "time_window");
  assert.ok(timeReply.answerTa.includes("மந்தமான") || timeReply.answerTa.includes("சரிவு"));

  // Test product query
  const prodReply = answerStoreAIQuestion("டீ எவ்வளவு விற்றது?", seedBills, "2026-11-15");
  assert.equal(prodReply.topic, "products");
  assert.ok(prodReply.answerTa.includes("மசாலா டீ") || prodReply.answerTa.includes("பொருட்கள்"));
});
