/** UC-01 List my Notifications (see the design of feature 05). */

import type { UserId } from "../domain";
import { toNotificationView, type NotificationView } from "./notification-view";
import type { NotificationRepository } from "./ports";

export interface ListNotificationsCommand {
  /** Comes from the authentication of the request, never from the client. */
  readonly owner: UserId;
  /** How many Notifications at most. The way in checks that it is valid. */
  readonly limit: number;
  /** How many Notifications to skip. The way in checks that it is valid. */
  readonly offset: number;
}

export interface ListNotificationsResult {
  /** The page, newest first (BR-02). */
  readonly items: readonly NotificationView[];
  /** How many Notifications of the User there are, in all pages. */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export class ListNotifications {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(command: ListNotificationsCommand): Promise<ListNotificationsResult> {
    const { owner, limit, offset } = command;
    // The query is by owner, so the Notifications of another User can never come back (BR-01).
    const page = await this.notifications.findByOwner(owner, { limit, offset });
    return { items: page.items.map(toNotificationView), total: page.total, limit, offset };
  }
}
