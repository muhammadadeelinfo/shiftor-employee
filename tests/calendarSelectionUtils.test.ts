import assert from 'assert';
import {
  parseStoredCalendarSelection,
  toggleCalendarSelectionInList,
  type ImportedCalendar,
} from '../src/shared/utils/calendarSelectionUtils';

const calA: ImportedCalendar = { id: 'a', title: 'Personal' };
const calB: ImportedCalendar = { id: 'b', title: 'Team', sourceName: 'Google' };

assert.deepStrictEqual(toggleCalendarSelectionInList([], calA), [calA]);
assert.deepStrictEqual(toggleCalendarSelectionInList([calA], calA), []);
assert.deepStrictEqual(toggleCalendarSelectionInList([calA], calB), [calA, calB]);

assert.deepStrictEqual(parseStoredCalendarSelection(null), []);
assert.deepStrictEqual(parseStoredCalendarSelection(''), []);
assert.deepStrictEqual(parseStoredCalendarSelection('not-json'), []);
assert.deepStrictEqual(parseStoredCalendarSelection('{"id":"x"}'), []);

assert.deepStrictEqual(
  parseStoredCalendarSelection(
    JSON.stringify([
      calA,
      calB,
      { id: 'bad-1' },
      { title: 'bad-2' },
      { id: 1, title: 'bad-3' },
    ])
  ),
  [calA, calB]
);

console.log('tests/calendarSelectionUtils.test.ts OK');
