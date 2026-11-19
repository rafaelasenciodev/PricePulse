import { describe, expect, it } from "vitest";
import { InMemoryPriceObservationRepository } from "../../../src/price-observations/adapters";
import { ObservedAtRange, type PriceObservation } from "../../../src/price-observations/domain";
import { ListingId } from "../../../src/shared/domain";
import { anObservation } from "../../support/observations";
import { describePriceHistoryContract } from "./price-history-contract";

describePriceHistoryContract("InMemoryPriceObservationRepository", () => new InMemoryPriceObservationRepository());

describe("InMemoryPriceObservationRepository: what is specific to this adapter", () => {
  it("the page it returns cannot be used to change the store", async () => {
    const repository = new InMemoryPriceObservationRepository();
    await repository.add(anObservation({ observedAt: "2026-11-19T10:00:00Z" }));
    await repository.add(anObservation({ observedAt: "2026-11-19T11:00:00Z" }));
    const query = { range: ObservedAtRange.unbounded(), limit: 10, offset: 0 };

    const first = await repository.findByListing(ListingId("headphones-shop-a"), query);
    (first.items as PriceObservation[]).pop();

    expect(repository.all()).toHaveLength(2);
    expect((await repository.findByListing(ListingId("headphones-shop-a"), query)).items).toHaveLength(2);
  });
});
