import { describe, expect, it } from "vitest";
import { InMemoryPriceAlertRepository } from "../../../src/price-alerts/adapters";
import { UserId, type PriceAlert } from "../../../src/price-alerts/domain";
import { anAlert } from "../../support/alerts";
import { describeAlertRepositoryReadsContract } from "./alert-repository-reads-contract";

describeAlertRepositoryReadsContract("InMemoryPriceAlertRepository", () => new InMemoryPriceAlertRepository());

describe("InMemoryPriceAlertRepository: what is specific to this adapter", () => {
  it("the page it returns cannot be used to change the store", async () => {
    const repository = new InMemoryPriceAlertRepository();
    await repository.add(anAlert({ listing: "l-1" }));
    await repository.add(anAlert({ listing: "l-2" }));

    const first = await repository.findByOwner(UserId("user-1"), { limit: 10, offset: 0 });
    (first.items as PriceAlert[]).pop();

    expect(repository.all()).toHaveLength(2);
    expect((await repository.findByOwner(UserId("user-1"), { limit: 10, offset: 0 })).items).toHaveLength(2);
  });
});
