// אלגוריתם ההתאמה. פונקציות טהורות בלבד, בלי גישה ל-DOM או לרשת.
//
// answers: { [questionId]: { values: number[], important: boolean } }
//   values ריק פירושו שהמשתמש דילג על השאלה. נתמך גם value יחיד (מספר או null).
// party:   { id, name, positions: { [questionId]: { value: number | null, source, note } } }

export const MAX_DISTANCE = 4;
export const IMPORTANT_WEIGHT = 2;
export const MIN_COVERAGE = 0.6;
// רשימה מדורגת רק אם יש לה עמדה ידועה לפחות במספר הזה של שאלות שהמשתמש ענה עליהן.
// בלי הסף הזה, רשימה עם עמדה אחת שבמקרה תואמת מקבלת 100% ועולה לראש הדירוג.
export const MIN_SHARED_QUESTIONS = 5;

function isValue(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function questionScore(userValue, partyValue) {
  const distance = Math.min(Math.abs(userValue - partyValue), MAX_DISTANCE);
  return 1 - distance / MAX_DISTANCE;
}

// המשתמש יכול לסמן כמה תשובות בשאלה (values), או אחת (value). רשימה ריקה פירושה דילוג.
function userValues(answer) {
  if (!answer) return [];
  const raw = Array.isArray(answer.values) ? answer.values : [answer.value];
  return raw.filter(isValue);
}

// כשסומנו כמה תשובות, קובעת התשובה שהכי קרובה לעמדת הרשימה.
export function bestScore(userValueList, partyValue) {
  return Math.max(...userValueList.map((value) => questionScore(value, partyValue)));
}

export function scoreParty(answers, party) {
  const positions = party.positions || {};
  let weightedSum = 0;
  let weightSum = 0;
  let answered = 0;
  let covered = 0;

  for (const [questionId, answer] of Object.entries(answers)) {
    const values = userValues(answer);
    if (values.length === 0) continue;
    answered++;

    const position = positions[questionId];
    if (!position || !isValue(position.value)) continue;
    covered++;

    const weight = answer.important ? IMPORTANT_WEIGHT : 1;
    weightedSum += bestScore(values, position.value) * weight;
    weightSum += weight;
  }

  const coverage = answered > 0 ? covered / answered : 0;
  return {
    partyId: party.id,
    // null כשאין אף שאלה משותפת, כדי לא להציג 0% שנראה כמו אי-התאמה.
    percent: weightSum > 0 ? (weightedSum / weightSum) * 100 : null,
    answered,
    covered,
    coverage,
    partial: coverage < MIN_COVERAGE,
  };
}

// מדרג לפי ציון בלבד. שוויון נשבר באקראי (random ניתן להזרקה לצורך בדיקות).
// מפלגות עם פחות מ-minShared שאלות משותפות עם המשתמש אינן נכללות בדירוג.
export function rankParties(answers, parties, random = Math.random, minShared = MIN_SHARED_QUESTIONS) {
  return parties
    .map((party) => ({ result: scoreParty(answers, party), tieBreak: random() }))
    .filter(({ result }) => result.percent !== null && result.covered >= minShared)
    .sort((a, b) => {
      const diff = b.result.percent - a.result.percent;
      return Math.abs(diff) > 1e-9 ? diff : a.tieBreak - b.tieBreak;
    })
    .map(({ result }) => result);
}
