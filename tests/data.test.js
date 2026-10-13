// בדיקות שלמות לקובצי הנתונים: רצות יחד עם בדיקות האלגוריתם ב-npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const { questions } = load('questions.json');
const { parties } = load('parties.json');

test('כל שאלה: 4-5 תשובות, ערכים ייחודיים בסדר עולה בין 2- ל-2+', () => {
  for (const q of questions) {
    assert.ok(q.answers.length >= 4 && q.answers.length <= 5, q.id);
    const values = q.answers.map((a) => a.value);
    assert.deepEqual(values, [...new Set(values)].sort((a, b) => a - b), q.id);
    assert.ok(values.every((v) => Number.isInteger(v) && v >= -2 && v <= 2), q.id);
  }
});

test('מזהי שאלות ומפלגות ייחודיים', () => {
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.equal(new Set(parties.map((p) => p.id)).size, parties.length);
});

test('כל עמדה: שאלה קיימת, ערך שתואם תשובה, מקור והסבר', () => {
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const party of parties) {
    for (const [qid, position] of Object.entries(party.positions)) {
      const where = `${party.id}/${qid}`;
      const question = byId.get(qid);
      assert.ok(question, where);
      if (position.value === null) continue;
      assert.ok(question.answers.some((a) => a.value === position.value), `${where}: ערך שאינו תשובה`);
      assert.match(position.source, /^https:\/\//, `${where}: חסר מקור`);
      assert.ok(position.note && position.note.length > 10, `${where}: חסר הסבר`);
    }
  }
});
