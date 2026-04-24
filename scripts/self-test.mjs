const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

function parseQuickAdd(input) {
  let title = input.trim();
  const tags = Array.from(title.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]);
  title = title.replace(/#[\p{L}\p{N}_-]+/gu, '').replace(/\s+/g, ' ').trim();
  let priority = 'medium';
  if (/(!важно|!high|!!)/i.test(title)) priority = 'high';
  if (/(!asap|!срочно|!!!)/i.test(title)) priority = 'asap';
  title = title.replace(/!важно|!high|!!|!asap|!срочно|!!!/gi, '').replace(/\s+/g, ' ').trim();
  const date = new Date();
  let dateFound = false;
  const tomorrowMatch = title.match(/(?:^|\s)(завтра|tomorrow)(?=\s|$)/i);
  if (tomorrowMatch) {
    date.setDate(date.getDate() + 1);
    dateFound = true;
  }
  const time = title.match(/\b(?:в|at)?\s*(\d{1,2})(?::|\.|ч)?(\d{2})?\b/i);
  if (time && dateFound) date.setHours(Number(time[1]), Number(time[2] ?? '0'), 0, 0);
  return { title, tags, priority, dueAt: dateFound ? date.toISOString() : undefined };
}

const ru = parseQuickAdd('позвонить завтра в 18 #личное !важно');
assert(ru.dueAt, 'Russian quick-add should parse due date');
assert(ru.priority === 'high', 'Russian quick-add should parse priority');
assert(ru.tags.includes('личное'), 'Russian quick-add should parse tag');

const en = parseQuickAdd('buy milk tomorrow at 18 #home');
assert(en.dueAt, 'English quick-add should parse due date');
assert(en.tags.includes('home'), 'English quick-add should parse tag');

console.log('Atlas self-tests passed');
