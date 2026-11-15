export type NotificationDestination =
  | { tab: 'Tasks'; taskId?: number }
  | { tab: 'Stock' };

export function notificationRoute(data: Record<string, unknown> | undefined): NotificationDestination | undefined {
  if (!data) return undefined;
  const taskId = typeof data.careTaskId === 'number' && Number.isSafeInteger(data.careTaskId) && data.careTaskId > 0
    ? data.careTaskId
    : undefined;
  if (data.route === 'tasks' || taskId !== undefined) return { tab: 'Tasks', taskId };
  if (data.route === 'stock' || data.type === 'low_stock') return { tab: 'Stock' };
  return undefined;
}
