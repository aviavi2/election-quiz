import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionScore, scoreParty, rankParties, MIN_SHARED_QUESTIONS } from '../js/scoring.js';

const party = (id, values) => ({
  id,
  name: id,
  positions: Object.fromEntries(
    Object.entries(values).map(([q, value]) => [q, { value, source: 'test', note: '' }])
  ),
});

const answer = (value, important = false) => ({ value, important });

test('questionScore: זהות, מרחק חלקי ומרחק מרבי', () => {
  assert.equal(questionScore(2, 2), 1);
  assert.equal(questionScore(0, 1), 0.75);
  assert.equal(questionScore(-2, 2), 0);
});

test('התאמה מושלמת נותנת 100%', () => {
  const answers = { q1: answer(-2), q2: answer(0), q3: answer(2) };
  const result = scoreParty(answers, party('p', { q1: -2, q2: 0, q3: 2 }));
  assert.equal(result.percent, 100);
  assert.equal(result.partial, false);
});

test('עמדות הפוכות לגמרי נותנות 0%', () => {
  const answers = { q1: answer(-2), q2: answer(2) };
  const result = scoreParty(answers, party('p', { q1: 2, q2: -2 }));
  assert.equal(result.percent, 0);
});

test('שאלות שדולגו לא נכנסות לחישוב', () => {
  const answers = { q1: answer(2), q2: answer(null), q3: answer(null) };
  const result = scoreParty(answers, party('p', { q1: 2, q2: -2, q3: -2 }));
  assert.equal(result.percent, 100);
  assert.equal(result.answered, 1);
  assert.equal(result.covered, 1);
});

test('שאלה חשובה מקבלת משקל כפול', () => {
  const p = party('p', { q1: 2, q2: -2 });
  const plain = scoreParty({ q1: answer(2), q2: answer(2) }, p);
  const starred = scoreParty({ q1: answer(2, true), q2: answer(2) }, p);
  assert.equal(plain.percent, 50);
  assert.ok(Math.abs(starred.percent - 200 / 3) < 1e-9);
});

test('נתונים חסרים אצל המפלגה: מפתח חסר או value null', () => {
  const answers = { q1: answer(1), q2: answer(1), q3: answer(1) };
  const p = party('p', { q1: 1, q2: null });
  const result = scoreParty(answers, p);
  assert.equal(result.percent, 100);
  assert.equal(result.answered, 3);
  assert.equal(result.covered, 1);
});

test('כיסוי מתחת ל-60% מסומן כחלקי, 60% ומעלה לא', () => {
  const answers = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`q${n}`, answer(0)]));
  const twoOfFive = scoreParty(answers, party('p', { q1: 0, q2: 0 }));
  const threeOfFive = scoreParty(answers, party('p', { q1: 0, q2: 0, q3: 0 }));
  assert.equal(twoOfFive.partial, true);
  assert.equal(threeOfFive.partial, false);
});

test('בלי אף שאלה משותפת הציון הוא null והמפלגה לא מדורגת', () => {
  const answers = { q1: answer(1) };
  const empty = party('empty', {});
  assert.equal(scoreParty(answers, empty).percent, null);
  const ranked = rankParties(answers, [empty, party('p', { q1: 1 })], Math.random, 1);
  assert.deepEqual(ranked.map((r) => r.partyId), ['p']);
});

test('משתמש שדילג על הכול: אין דירוג', () => {
  const answers = { q1: answer(null), q2: answer(null) };
  assert.deepEqual(rankParties(answers, [party('p', { q1: 1, q2: 1 })]), []);
});

test('הדירוג הוא לפי ציון יורד', () => {
  const answers = { q1: answer(2) };
  const parties = [party('far', { q1: -2 }), party('exact', { q1: 2 }), party('near', { q1: 1 })];
  const ranked = rankParties(answers, parties, Math.random, 1);
  assert.deepEqual(ranked.map((r) => r.partyId), ['exact', 'near', 'far']);
});

test('שוויון נשבר לפי המספר האקראי ולא לפי סדר הקלט', () => {
  const answers = { q1: answer(0) };
  const parties = [party('a', { q1: 0 }), party('b', { q1: 0 })];
  const sequence = (values) => () => values.shift();
  const first = rankParties(answers, parties, sequence([0.9, 0.1]), 1);
  const second = rankParties(answers, parties, sequence([0.1, 0.9]), 1);
  assert.deepEqual(first.map((r) => r.partyId), ['b', 'a']);
  assert.deepEqual(second.map((r) => r.partyId), ['a', 'b']);
});

test('רשימה עם פחות שאלות משותפות מהסף לא מדורגת, גם אם ההתאמה שלה מושלמת', () => {
  const ids = Array.from({ length: MIN_SHARED_QUESTIONS }, (_, i) => `q${i + 1}`);
  const answers = Object.fromEntries(ids.map((id) => [id, answer(2)]));
  const atThreshold = party('enough', Object.fromEntries(ids.map((id) => [id, -2])));
  const belowThreshold = party('sparse', Object.fromEntries(ids.slice(1).map((id) => [id, 2])));
  const ranked = rankParties(answers, [belowThreshold, atThreshold]);
  assert.deepEqual(ranked.map((r) => r.partyId), ['enough']);
});

test('כמה תשובות מסומנות: קובעת התשובה הקרובה ביותר לעמדת הרשימה', () => {
  const p = party('p', { q1: 2 });
  assert.equal(scoreParty({ q1: { values: [-2, 1], important: false } }, p).percent, 75);
  assert.equal(scoreParty({ q1: { values: [-2, 2], important: false } }, p).percent, 100);
});

test('רשימת תשובות ריקה נחשבת דילוג', () => {
  const result = scoreParty({ q1: { values: [], important: false }, q2: { values: [0], important: false } }, party('p', { q1: 2, q2: 0 }));
  assert.equal(result.answered, 1);
  assert.equal(result.percent, 100);
});
