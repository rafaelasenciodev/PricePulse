/** A fixed moment and a clock that always says it, so that the tests of Price Alerts need not care about time. */

import type { Clock } from "../../src/price-alerts/application";
import { CreatedAt } from "../../src/price-alerts/domain";

const MOMENT = "2026-11-19T10:00:00Z";

export const CREATED_AT = CreatedAt.fromDate(new Date(MOMENT));

export const FIXED_CLOCK: Clock = { now: () => new Date(MOMENT) };
