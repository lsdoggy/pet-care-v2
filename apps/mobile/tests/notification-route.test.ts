import { describe, expect, it } from 'vitest';
import { notificationRoute } from '../src/notifications/notificationRoute';

describe('notificationRoute', () => {
  it('opens only the internal task and stock tabs', () => {
    expect(notificationRoute({ route: 'tasks' })).toEqual({ tab: 'Tasks', taskId: undefined });
    expect(notificationRoute({ route: 'stock' })).toEqual({ tab: 'Stock' });
    expect(notificationRoute({ route: 'https://example.test/' })).toBeUndefined();
    expect(notificationRoute(undefined)).toBeUndefined();
  });

  it('routes previously delivered notification payloads', () => {
    expect(notificationRoute({ careTaskId: 64 })).toEqual({ tab: 'Tasks', taskId: 64 });
    expect(notificationRoute({ type: 'low_stock' })).toEqual({ tab: 'Stock' });
  });
});
