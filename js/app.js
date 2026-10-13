// זרימת המסכים: פתיחה, שאלות, תוצאות.
// אין כאן שמירה או שליחה של מידע: המצב חי בזיכרון בלבד ונמחק ברענון.

import { rankParties, IMPORTANT_WEIGHT, MIN_COVERAGE, MIN_SHARED_QUESTIONS } from './scoring.js';

const TOP_COUNT = 5;
const SKIP = 'skip';

const app = document.getElementById('app');
const statusRegion = document.getElementById('status');

let questions = [];
let parties = [];
let dataUpdated = '';

// choices: { [questionId]: { choice: answerId | SKIP, important: boolean } }
let state = { index: 0, choices: {} };

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value === 'boolean') node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

function show(heading, ...content) {
  app.replaceChildren(heading, ...content);
  window.scrollTo(0, 0);
  // מעביר את הפוקוס לראש המסך החדש, כדי שקורא מסך וניווט מקלדת ימשיכו משם.
  app.focus({ preventScroll: true });
  statusRegion.textContent = heading.textContent;
}

function howItWorks() {
  return el('details', { class: 'explain' },
    el('summary', {}, 'איך מחושב הציון?'),
    el('ul', {},
      el('li', {}, 'בכל שאלה התשובות מסודרות על ציר עמדות מ־2- עד 2+. לכל מפלגה נקבע מיקום על אותו ציר, לפי מקור שמצוין לצד העמדה.'),
      el('li', {}, 'ציון שאלה הוא 1 פחות המרחק בין התשובה שלך לעמדת המפלגה, חלקי 4. תשובה זהה נותנת 1, ותשובה בקצה ההפוך נותנת 0.'),
      el('li', {}, `שאלה שסומנה כחשובה במיוחד נספרת במשקל ${IMPORTANT_WEIGHT}.`),
      el('li', {}, 'אחוז ההתאמה הוא הממוצע המשוקלל של ציוני השאלות, כפול 100.'),
      el('li', {}, 'שאלות שדילגת עליהן, ושאלות שבהן עמדת המפלגה לא ידועה, לא נכנסות לחישוב.'),
      el('li', {}, `אם ידועה עמדת המפלגה בפחות מ־${MIN_COVERAGE * 100}% מהשאלות שענית עליהן, מוצג לצידה הסימון "נתוני עמדות חלקיים".`),
      el('li', {}, `רשימה מדורגת רק אם ידועה עמדתה לפחות ב־${MIN_SHARED_QUESTIONS} מהשאלות שענית עליהן. בלי זה, רשימה עם עמדה ידועה אחת שבמקרה תואמת הייתה מקבלת 100%.`),
      el('li', {}, 'הרשימות מסודרות לפי הציון בלבד. במקרה של שוויון הסדר אקראי.')
    )
  );
}

function privacyNote() {
  return el('p', { class: 'muted small' },
    'פרטיות: כל החישוב נעשה בדפדפן שלך. התשובות לא נשמרות ולא נשלחות לשום מקום, ואין באתר עוגיות או כלי מעקב.');
}

function neutralityNote() {
  return el('p', { class: 'muted small' },
    'ניטרליות: האתר אינו קשור לאף מפלגה. השאלות מנוסחות כך שיציגו את העמדות המרכזיות באופן הוגן, ועמדות המפלגות מבוססות רק על מקורות שמצוינים לצידן.');
}

function hasKnownPosition(party) {
  return Object.values(party.positions || {}).some((position) => typeof position?.value === 'number');
}

// שקיפות לגבי היקף הנתונים: רשימה בלי עמדות מתועדות לא יכולה להופיע בדירוג.
function coverageNote() {
  const documented = parties.filter(hasKnownPosition).length;
  if (documented === parties.length) return null;
  const date = dataUpdated ? ` (עדכון אחרון: ${dataUpdated.split('-').reverse().join('.')})` : '';
  return el('p', { class: 'notice' },
    `השאלון כולל את ${parties.length} הרשימות שעברו את אחוז החסימה בחלק מהסקרים או בכולם. נמצאו עמדות מתועדות עם מקור ל־${documented} מהן${date}. רשימה שאין לה מספיק עמדות מתועדות לא מופיעה בדירוג, ואין בכך אמירה על מידת ההתאמה שלה.`);
}

function partyNameList(list) {
  const names = list.map((party) => party.name).sort((a, b) => a.localeCompare(b, 'he'));
  return el('ul', {}, names.map((name) => el('li', {}, name)));
}

// ---------- מסך פתיחה ----------

function renderIntro() {
  show(
    el('h1', {}, 'שאלון התאמה למפלגות'),
    el('p', {}, `${questions.length} שאלות קצרות על נושאים שעל סדר היום. בסוף יוצגו הרשימות שעמדותיהן הכי קרובות לשלך, עם פירוט לכל שאלה.`),
    el('ul', { class: 'facts' },
      el('li', {}, 'זמן משוער: 3 עד 5 דקות.'),
      el('li', {}, 'אפשר לדלג על כל שאלה, ולסמן נושאים שחשובים לך במיוחד.'),
      el('li', {}, 'השאלון הוא כלי עזר ולא המלצת הצבעה.')
    ),
    coverageNote(),
    privacyNote(),
    neutralityNote(),
    el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: startQuiz }, 'התחל'),
    howItWorks()
  );
}

function startQuiz() {
  state = { index: 0, choices: {} };
  renderQuestion();
}

// ---------- מסך שאלה ----------

function renderQuestion() {
  const question = questions[state.index];
  const saved = state.choices[question.id] || { choice: null, important: false };
  const isLast = state.index === questions.length - 1;
  const position = state.index + 1;

  const nextButton = el('button', { class: 'btn btn-primary', type: 'submit', disabled: saved.choice === null },
    isLast ? 'לתוצאות' : 'הבא');

  const option = (id, text, extraClass = '') =>
    el('label', { class: `option ${extraClass}` },
      el('input', {
        type: 'radio',
        name: 'answer',
        value: id,
        checked: saved.choice === id,
        onchange: () => { nextButton.disabled = false; },
      }),
      el('span', {}, text)
    );

  const importantBox = el('input', { type: 'checkbox', name: 'important', checked: saved.important });

  const form = el('form', {
    onsubmit: (event) => {
      event.preventDefault();
      const picked = form.querySelector('input[name="answer"]:checked');
      if (!picked) return;
      state.choices[question.id] = { choice: picked.value, important: importantBox.checked };
      if (isLast) {
        renderResults();
      } else {
        state.index++;
        renderQuestion();
      }
    },
  },
    el('fieldset', {},
      el('legend', {}, question.text),
      question.answers.map((answer) => option(answer.id, answer.text)),
      option(SKIP, 'אין לי דעה / דלג', 'option-skip')
    ),
    el('label', { class: 'option option-important' },
      importantBox,
      el('span', {}, `הנושא חשוב לי במיוחד (משקל כפול)`)
    ),
    el('div', { class: 'actions' },
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          if (state.index === 0) {
            renderIntro();
          } else {
            state.index--;
            renderQuestion();
          }
        },
      }, 'חזור'),
      nextButton
    )
  );

  const heading = el('h1', { class: 'visually-hidden' }, `שאלה ${position} מתוך ${questions.length}: ${question.topic}`);
  show(
    heading,
    el('div', { class: 'progress-row', 'aria-hidden': 'true' },
      el('span', {}, question.topic),
      el('span', {}, `שאלה ${position} מתוך ${questions.length}`)
    ),
    el('progress', { max: questions.length, value: position, 'aria-label': 'התקדמות בשאלון' }),
    form
  );
}

// ---------- מסך תוצאות ----------

function buildAnswers() {
  const answers = {};
  for (const question of questions) {
    const saved = state.choices[question.id];
    if (!saved) continue;
    const picked = question.answers.find((answer) => answer.id === saved.choice);
    answers[question.id] = { value: picked ? picked.value : null, important: saved.important };
  }
  return answers;
}

function sourceNode(source) {
  if (!source) return 'לא צוין מקור';
  if (/^https?:\/\//i.test(source)) {
    return el('a', { href: source, target: '_blank', rel: 'noopener noreferrer' }, source);
  }
  return source;
}

function breakdownItem(question, party) {
  const saved = state.choices[question.id];
  const userAnswer = question.answers.find((answer) => answer.id === saved?.choice);
  const position = party.positions?.[question.id];
  const known = position && typeof position.value === 'number';
  const partyAnswer = known ? question.answers.find((answer) => answer.value === position.value) : null;

  let partyText = 'לא ידוע (לא נכלל בחישוב)';
  if (known) {
    partyText = partyAnswer
      ? partyAnswer.text
      : `מיקום ${position.value} על הציר שבין "${question.axis.min}" לבין "${question.axis.max}"`;
  }

  return el('li', {},
    el('div', { class: 'topic' }, question.topic, saved?.important && userAnswer ? ' · סומן כחשוב במיוחד' : ''),
    el('h3', {}, question.text),
    el('dl', {},
      el('dt', {}, 'התשובה שלך'),
      el('dd', {}, userAnswer ? userAnswer.text : 'דילגת על השאלה (לא נכלל בחישוב)'),
      el('dt', {}, 'עמדת המפלגה'),
      el('dd', {}, partyText),
      known && position.note ? [el('dt', {}, 'הסבר'), el('dd', {}, position.note)] : null,
      known ? [el('dt', {}, 'מקור'), el('dd', {}, sourceNode(position.source))] : null
    )
  );
}

function partyCard(result, rank) {
  const party = parties.find((p) => p.id === result.partyId);
  const percent = Math.round(result.percent);

  return el('details', { class: 'party' },
    el('summary', {},
      el('div', { class: 'party-head' },
        el('span', { class: 'party-name' }, `${rank}. ${party.name}`),
        el('span', { class: 'party-percent' }, `${percent}%`, el('span', { class: 'visually-hidden' }, ' התאמה'))
      ),
      el('div', { class: 'bar', 'aria-hidden': 'true' }, el('span', { style: `width:${percent}%` })),
      el('div', { class: 'party-meta' },
        el('span', {},
          `מבוסס על ${result.covered} מתוך ${result.answered} השאלות שענית עליהן`,
          result.partial ? [' ', el('span', { class: 'badge' }, 'נתוני עמדות חלקיים')] : null
        ),
        el('span', {},
          el('span', { class: 'when-closed' }, 'הצגת פירוט'),
          el('span', { class: 'when-open' }, 'הסתרת פירוט')
        )
      )
    ),
    el('ol', { class: 'breakdown' }, questions.map((question) => breakdownItem(question, party)))
  );
}

async function share(button) {
  const url = location.origin + location.pathname;
  const text = 'שאלון התאמה למפלגות: כמה דקות, בלי הרשמה ובלי שמירת מידע.';
  try {
    if (navigator.share) {
      await navigator.share({ title: document.title, text, url });
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      button.textContent = 'הקישור הועתק';
      statusRegion.textContent = 'הקישור הועתק';
    }
  } catch {
    // המשתמש ביטל את השיתוף, או שהדפדפן חסם גישה ללוח. אין מה לעשות מעבר לכך.
  }
}

function renderResults() {
  const ranked = rankParties(buildAnswers(), parties);
  const heading = el('h1', {}, 'התוצאות שלך');

  const disclaimer = el('p', { class: 'notice' },
    'השאלון הוא כלי עזר ולא המלצת הצבעה. מומלץ לקרוא את המצעים המלאים.');

  const restart = el('button', { class: 'btn', type: 'button', onclick: renderIntro }, 'התחל מחדש');

  if (ranked.length === 0) {
    show(heading, disclaimer,
      el('p', {}, `אי אפשר לחשב התאמה: צריך לענות על לפחות ${MIN_SHARED_QUESTIONS} שאלות שיש בהן עמדה ידועה של אותה רשימה.`),
      el('div', { class: 'actions' }, restart),
      privacyNote(), neutralityNote());
    return;
  }

  const list = el('div', {});
  const renderList = (count) => {
    list.replaceChildren(...ranked.slice(0, count).map((result, i) => partyCard(result, i + 1)));
  };
  renderList(TOP_COUNT);

  const showAll = ranked.length > TOP_COUNT
    ? el('button', {
        class: 'btn btn-block',
        type: 'button',
        onclick: () => { renderList(ranked.length); showAll.remove(); },
      }, `הצגת כל ${ranked.length} הרשימות המדורגות`)
    : null;

  const shareButton = el('button', { class: 'btn btn-primary', type: 'button', onclick: () => share(shareButton) }, 'שתף');

  const rankedIds = new Set(ranked.map((result) => result.partyId));
  const unranked = parties.filter((party) => !rankedIds.has(party.id));
  const unrankedBlock = unranked.length > 0
    ? el('details', { class: 'explain' },
        el('summary', {}, `${unranked.length} רשימות שאינן בדירוג`),
        el('p', { class: 'small' }, `לרשימות האלה נמצאה עמדה מתועדת עם מקור בפחות מ־${MIN_SHARED_QUESTIONS} מהשאלות שענית עליהן, ולכן אי אפשר לחשב להן התאמה אמינה. אין בכך אמירה על עמדותיהן.`),
        partyNameList(unranked))
    : null;

  show(
    heading,
    disclaimer,
    el('p', { class: 'muted' }, `${Math.min(TOP_COUNT, ranked.length)} הרשימות שעמדותיהן המתועדות הכי קרובות לתשובות שלך. לחיצה על רשימה מציגה את הפירוט לכל שאלה.`),
    list,
    showAll,
    unrankedBlock,
    el('div', { class: 'actions' }, restart, shareButton),
    el('p', { class: 'muted small' }, 'השיתוף כולל רק קישור לשאלון, בלי התשובות או התוצאות שלך.'),
    howItWorks(),
    privacyNote(),
    neutralityNote()
  );
}

// ---------- טעינה ----------

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

async function init() {
  try {
    const [questionData, partyData] = await Promise.all([
      loadJson('data/questions.json'),
      loadJson('data/parties.json'),
    ]);
    questions = questionData.questions;
    parties = partyData.parties;
    dataUpdated = partyData.updated || '';
    document.getElementById('demo-banner').hidden = !partyData.demo;
    renderIntro();
  } catch (error) {
    console.error(error);
    show(
      el('h1', {}, 'טעינת השאלון נכשלה'),
      el('p', {}, 'לא הצלחנו לטעון את קובצי הנתונים. אם האתר נפתח ישירות מקובץ במחשב, צריך להריץ אותו דרך שרת מקומי (ההוראות ב־README).')
    );
  }
}

init();
