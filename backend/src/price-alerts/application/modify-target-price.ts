/** UC-03 Modify the Target Price of a Price Alert (see the design of feature 04). */

import { InvalidValue } from "../../shared/domain";
import {
  AlertStatus,
  TargetAlreadyReached as DomainTargetAlreadyReached,
  TargetPrice,
  type AlertId,
  type PriceAlert,
  type UserId,
} from "../domain";
import { AlertConflict, AlertNotActive, AlertNotFound, InvalidTargetPrice, TargetAlreadyReached } from "./errors";
import { AlertStateChanged, type ListingReader, type PriceAlertRepository } from "./ports";
import { toView, type PriceAlertView } from "./price-alert-view";

export interface ModifyTargetPriceCommand {
  /** Comes from the authentication of the request, never from the client. */
  readonly owner: UserId;
  readonly alertId: AlertId;
  /** Only the amount, as text such as "70.00". The currency is the one of the Listing. */
  readonly targetAmount: string;
}

export interface ModifyTargetPriceResult {
  readonly alert: PriceAlertView;
  /** false when the alert already had that Target Price and nothing was changed (BR-06). */
  readonly changed: boolean;
}

export class ModifyTargetPrice {
  constructor(
    private readonly alerts: PriceAlertRepository,
    private readonly listings: ListingReader,
  ) {}

  async execute(command: ModifyTargetPriceCommand): Promise<ModifyTargetPriceResult> {
    // 1. The alert is the User's (BR-01)
    const alert = await this.alerts.find(command.owner, command.alertId);
    if (alert === null) throw new AlertNotFound(command.alertId);

    // 2. Only an Active alert can be modified (BR-05)
    if (alert.status !== AlertStatus.Active) throw new AlertNotActive(alert.status);

    // 3. The Listing: its currency and its Current Price. An alert whose Listing is missing is
    //    inconsistent data, an internal error and not a mistake of the User.
    const listing = await this.listings.get(alert.listingId);
    if (listing === null) throw new Error(`The Listing ${alert.listingId} of the Price Alert ${alert.id} does not exist`);

    // 4. The Target Price is valid, in the currency of the Listing (BR-05, rules of creation)
    let target: TargetPrice;
    try {
      target = TargetPrice.fromDecimalString(command.targetAmount, listing.currency);
    } catch (error) {
      if (error instanceof InvalidValue) throw new InvalidTargetPrice(error.message, { cause: error });
      throw error; // e.g. an unsupported currency of the catalogue: an internal error
    }

    // 5. The same Target Price changes nothing (BR-06). It comes before step 6, so it succeeds even
    //    when the Current Price now reaches it, as a repeated creation does.
    if (alert.targetPrice.equals(target)) return { alert: toView(alert), changed: false };

    // 6. The Current Price does not already reach it (BR-05)
    let modified: PriceAlert;
    try {
      modified = alert.changeTargetPrice(target, listing.currentPrice);
    } catch (error) {
      if (error instanceof DomainTargetAlreadyReached) throw new TargetAlreadyReached(error.message, { cause: error });
      throw error;
    }

    // 7. Save, if the alert is still in the state that was read (BR-08)
    try {
      await this.alerts.save(modified, alert.status);
    } catch (error) {
      if (error instanceof AlertStateChanged) throw new AlertConflict();
      throw error;
    }
    return { alert: toView(modified), changed: true };
  }
}
