/** PostgreSQL implementations of the ports of Price Alerts (feature 11, ADR-0006). The schema is in `database/migrations`. */

import type { Pool } from "pg";
import { isUniqueViolation } from "../../shared/database-errors";
import { ListingId, ObservedAt, Price, UserId } from "../../shared/domain";
import {
  ActiveAlertAlreadyExists,
  AlertStateChanged,
  NotificationAlreadyExists,
  type AlertPage,
  type AlertPageQuery,
  type NotificationPage,
  type NotificationPageQuery,
  type NotificationRepository,
  type PriceAlertRepository,
} from "../application";
import { AlertId, AlertStatus, CreatedAt, Notification, PriceAlert, TargetPrice } from "../domain";

interface AlertRow {
  id: string;
  owner: string;
  listing_id: string;
  target_minor_units: number;
  currency: string;
  status: string;
  created_at: number;
}

const ALERT_COLUMNS = "id, owner, listing_id, target_minor_units, currency, status, created_at";
const STATUSES: readonly string[] = Object.values(AlertStatus);

/** Rebuilds an Alert. The value objects make their checks, and a status that is not one of the three is an error. */
function toAlert(row: AlertRow): PriceAlert {
  if (!STATUSES.includes(row.status)) throw new RangeError(`The stored Price Alert ${row.id} has an unknown status`);
  return new PriceAlert(
    AlertId(row.id),
    UserId(row.owner),
    ListingId(row.listing_id),
    TargetPrice.of(Price.fromMinorUnits(row.target_minor_units, row.currency)),
    row.status as AlertStatus,
    CreatedAt.fromEpochMilliseconds(row.created_at),
  );
}

/**
 * Implements PriceAlertRepository. The guarantee of one Active alert per owner and Listing is a partial unique index
 * (BR-07), and the conditional save is one conditional `UPDATE` (decision 6 of the design).
 */
export class PostgresPriceAlertRepository implements PriceAlertRepository {
  constructor(private readonly pool: Pool) {}

  async findActive(owner: UserId, listingId: ListingId): Promise<PriceAlert | null> {
    const { rows } = await this.pool.query<AlertRow>(
      `SELECT ${ALERT_COLUMNS} FROM price_alerts WHERE owner = $1 AND listing_id = $2 AND status = 'active'`,
      [owner, listingId],
    );
    return rows[0] ? toAlert(rows[0]) : null;
  }

  async add(alert: PriceAlert): Promise<void> {
    try {
      await this.pool.query(`INSERT INTO price_alerts (${ALERT_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
        alert.id,
        alert.owner,
        alert.listingId,
        alert.targetPrice.price.minorUnits,
        alert.targetPrice.currency,
        alert.status,
        alert.createdAt.epochMilliseconds,
      ]);
    } catch (error) {
      if (isUniqueViolation(error, "price_alerts_one_active_idx")) throw new ActiveAlertAlreadyExists();
      throw error;
    }
  }

  async find(owner: UserId, alertId: AlertId): Promise<PriceAlert | null> {
    const { rows } = await this.pool.query<AlertRow>(`SELECT ${ALERT_COLUMNS} FROM price_alerts WHERE id = $1 AND owner = $2`, [alertId, owner]);
    return rows[0] ? toAlert(rows[0]) : null;
  }

  async findByOwner(owner: UserId, query: AlertPageQuery): Promise<AlertPage> {
    // One statement, so the page and the total come from one snapshot, and the total is there when the page is empty.
    const { rows } = await this.pool.query<{ total: number } & Partial<AlertRow>>(
      `SELECT c.total, p.id, p.owner, p.listing_id, p.target_minor_units, p.currency, p.status, p.created_at
         FROM (SELECT count(*) AS total FROM price_alerts WHERE owner = $1 AND ($2::text IS NULL OR status = $2)) c
         LEFT JOIN LATERAL (
           SELECT ${ALERT_COLUMNS} FROM price_alerts WHERE owner = $1 AND ($2::text IS NULL OR status = $2)
            ORDER BY created_at DESC, id LIMIT $3 OFFSET $4
         ) p ON true
        ORDER BY p.created_at DESC, p.id`,
      [owner, query.status ?? null, query.limit, query.offset],
    );
    return {
      items: rows.flatMap((row) => (row.id === null || row.id === undefined ? [] : [toAlert(row as AlertRow)])),
      total: rows[0]?.total ?? 0,
    };
  }

  async findActiveByListing(listingId: ListingId): Promise<PriceAlert[]> {
    const { rows } = await this.pool.query<AlertRow>(`SELECT ${ALERT_COLUMNS} FROM price_alerts WHERE listing_id = $1 AND status = 'active'`, [listingId]);
    return rows.map(toAlert);
  }

  async save(alert: PriceAlert, expectedStatus: AlertStatus): Promise<void> {
    const updated = await this.pool.query(
      "UPDATE price_alerts SET status = $1, target_minor_units = $2 WHERE id = $3 AND status = $4",
      [alert.status, alert.targetPrice.price.minorUnits, alert.id, expectedStatus],
    );
    if (updated.rowCount === 1) return;
    // Nothing was changed: either the alert is not there, or another change came first.
    const { rows } = await this.pool.query<{ status: string }>("SELECT status FROM price_alerts WHERE id = $1", [alert.id]);
    const stored = rows[0];
    if (stored === undefined) throw new Error(`Unknown Price Alert: ${alert.id}`);
    if (stored.status === alert.status) return; // already in the state it would have: nothing to do
    throw new AlertStateChanged();
  }
}

interface NotificationRow {
  alert_id: string;
  owner: string;
  listing_id: string;
  currency: string;
  target_minor_units: number;
  current_minor_units: number;
  observed_at: number;
}

const NOTIFICATION_COLUMNS = "alert_id, owner, listing_id, currency, target_minor_units, current_minor_units, observed_at";

function toNotification(row: NotificationRow): Notification {
  return Notification.restore(
    AlertId(row.alert_id),
    UserId(row.owner),
    ListingId(row.listing_id),
    TargetPrice.of(Price.fromMinorUnits(row.target_minor_units, row.currency)),
    Price.fromMinorUnits(row.current_minor_units, row.currency),
    ObservedAt.fromEpochMilliseconds(row.observed_at),
  );
}

/** Implements NotificationRepository. At most one per alert is the primary key (BR-05). */
export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async findByAlert(alertId: AlertId): Promise<Notification | null> {
    const { rows } = await this.pool.query<NotificationRow>(`SELECT ${NOTIFICATION_COLUMNS} FROM notifications WHERE alert_id = $1`, [alertId]);
    return rows[0] ? toNotification(rows[0]) : null;
  }

  async add(notification: Notification): Promise<void> {
    try {
      await this.pool.query(`INSERT INTO notifications (${NOTIFICATION_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
        notification.alertId,
        notification.owner,
        notification.listingId,
        notification.currentPrice.currency,
        notification.targetPrice.price.minorUnits,
        notification.currentPrice.minorUnits,
        notification.observedAt.epochMilliseconds,
      ]);
    } catch (error) {
      if (isUniqueViolation(error, "notifications_pkey")) throw new NotificationAlreadyExists();
      throw error;
    }
  }

  async findByOwner(owner: UserId, query: NotificationPageQuery): Promise<NotificationPage> {
    const { rows } = await this.pool.query<{ total: number } & Partial<NotificationRow>>(
      `SELECT c.total, p.alert_id, p.owner, p.listing_id, p.currency, p.target_minor_units, p.current_minor_units, p.observed_at
         FROM (SELECT count(*) AS total FROM notifications WHERE owner = $1) c
         LEFT JOIN LATERAL (
           SELECT ${NOTIFICATION_COLUMNS} FROM notifications WHERE owner = $1 ORDER BY observed_at DESC, alert_id LIMIT $2 OFFSET $3
         ) p ON true
        ORDER BY p.observed_at DESC, p.alert_id`,
      [owner, query.limit, query.offset],
    );
    return {
      items: rows.flatMap((row) => (row.alert_id === null || row.alert_id === undefined ? [] : [toNotification(row as NotificationRow)])),
      total: rows[0]?.total ?? 0,
    };
  }
}
