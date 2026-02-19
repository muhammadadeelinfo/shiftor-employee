import assert from 'assert';
import {
  determineNotificationCategory,
  groupNotificationsByRecency,
  normalizeNotificationRow,
  parseIsoDate,
  resolveTargetPath,
  type NotificationRecord,
} from '../src/shared/utils/notificationUtils';

assert.strictEqual(
  determineNotificationCategory('Shift published', 'New shift assigned'),
  'shift-published'
);
assert.strictEqual(
  determineNotificationCategory('Shift removed', 'This shift was canceled'),
  'shift-removed'
);
assert.strictEqual(
  determineNotificationCategory('Schedule changed', 'Your schedule was updated'),
  'shift-schedule'
);
assert.strictEqual(
  determineNotificationCategory('Admin notice', 'Policy message'),
  'admin'
);
assert.strictEqual(
  determineNotificationCategory('FYI', 'General information'),
  'general'
);

assert.strictEqual(resolveTargetPath({ target: '/calendar' }), '/calendar');
assert.strictEqual(resolveTargetPath({ deepLink: '  /notifications  ' }), '/notifications');
assert.strictEqual(resolveTargetPath({ url: '/help-center', shiftId: 'abc123' }), '/help-center');
assert.strictEqual(resolveTargetPath({ shiftId: 'abc123' }), '/shift-details/abc123');
assert.strictEqual(resolveTargetPath(undefined), undefined);

assert.strictEqual(parseIsoDate('2026-03-10T10:00:00Z'), '2026-03-10T10:00:00Z');
assert.strictEqual(parseIsoDate(new Date('2026-03-10T10:00:00Z')), '2026-03-10T10:00:00.000Z');
assert.strictEqual(parseIsoDate(1_770_000_000_000), '2026-02-02T02:40:00.000Z');

const normalized = normalizeNotificationRow(
  {
    id: 42,
    message: 'Shift schedule updated',
    body: 'Starts at 8:00',
    is_read: false,
    created_at: 1_770_000_000_000,
    metadata: { shift_id: 'shift-42' },
  },
  { title: 'Fallback title', detail: 'Fallback detail' }
);

assert.ok(normalized, 'row should normalize');
assert.strictEqual(normalized?.id, '42');
assert.strictEqual(normalized?.title, 'Shift schedule updated');
assert.strictEqual(normalized?.detail, 'Starts at 8:00');
assert.strictEqual(normalized?.read, false);
assert.strictEqual(normalized?.targetPath, '/shift-details/shift-42');
assert.strictEqual(normalized?.category, 'shift-schedule');

const normalizedWithFallbacks = normalizeNotificationRow(
  {
    notification_id: 'abc',
    description: 'Fallback detail from description',
    status: 'read',
    timestamp: '2026-03-10T12:00:00Z',
    payload: { deepLink: '/calendar-day/2026-03-10' },
  },
  { title: 'Fallback title', detail: 'Fallback detail' }
);

assert.ok(normalizedWithFallbacks, 'row with fallback fields should normalize');
assert.strictEqual(normalizedWithFallbacks?.id, 'abc');
assert.strictEqual(normalizedWithFallbacks?.title, 'Fallback title');
assert.strictEqual(normalizedWithFallbacks?.detail, 'Fallback detail from description');
assert.strictEqual(normalizedWithFallbacks?.read, true);
assert.strictEqual(normalizedWithFallbacks?.targetPath, '/calendar-day/2026-03-10');
assert.strictEqual(normalizedWithFallbacks?.category, 'general');

const invalidRow = normalizeNotificationRow(
  { title: 'Missing id notification' },
  { title: 'Fallback title', detail: 'Fallback detail' }
);
assert.strictEqual(invalidRow, null);

const normalizedWithBlankTitle = normalizeNotificationRow(
  {
    id: 'blank-title',
    title: '   ',
    body: 'Body detail',
    read: true,
    createdAt: '2026-03-10T13:00:00Z',
  },
  { title: 'Fallback title', detail: 'Fallback detail' }
);
assert.ok(normalizedWithBlankTitle, 'blank title should fall back');
assert.strictEqual(normalizedWithBlankTitle?.title, 'Fallback title');
assert.strictEqual(normalizedWithBlankTitle?.detail, 'Body detail');
assert.strictEqual(normalizedWithBlankTitle?.read, true);

const now = new Date('2026-03-10T12:00:00Z');
const notifications: NotificationRecord[] = [
  {
    id: 'today-1',
    title: 'Today',
    detail: 'today item',
    createdAt: '2026-03-10T11:00:00Z',
    read: false,
    category: 'general',
  },
  {
    id: 'yesterday-1',
    title: 'Yesterday',
    detail: 'yesterday item',
    createdAt: '2026-03-09T10:00:00Z',
    read: false,
    category: 'general',
  },
  {
    id: 'earlier-1',
    title: 'Earlier',
    detail: 'earlier item',
    createdAt: '2026-03-01T10:00:00Z',
    read: true,
    category: 'general',
  },
];

const grouped = groupNotificationsByRecency(
  notifications,
  {
    today: 'Today',
    yesterday: 'Yesterday',
    earlier: 'Earlier',
  },
  now
);

assert.strictEqual(grouped.length, 3);
assert.strictEqual(grouped[0].key, 'today');
assert.strictEqual(grouped[0].items.length, 1);
assert.strictEqual(grouped[1].key, 'yesterday');
assert.strictEqual(grouped[1].items.length, 1);
assert.strictEqual(grouped[2].key, 'earlier');
assert.strictEqual(grouped[2].items.length, 1);

const groupedWithoutEarlier = groupNotificationsByRecency(
  notifications.slice(0, 2),
  {
    today: 'Today',
    yesterday: 'Yesterday',
    earlier: 'Earlier',
  },
  now
);
assert.strictEqual(groupedWithoutEarlier.length, 2);
assert.strictEqual(groupedWithoutEarlier[0].key, 'today');
assert.strictEqual(groupedWithoutEarlier[1].key, 'yesterday');

console.log('tests/notificationUtils.test.ts OK');
