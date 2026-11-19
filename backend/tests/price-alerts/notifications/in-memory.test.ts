import { describe, expect, it } from "vitest";
import { InMemoryNotificationRepository } from "../../../src/price-alerts/adapters";
import { UserId, type Notification } from "../../../src/price-alerts/domain";
import { aNotification } from "../../support/notifications";
import { describeNotificationRepositoryReadsContract } from "./notification-repository-reads-contract";

describeNotificationRepositoryReadsContract("InMemoryNotificationRepository", () => new InMemoryNotificationRepository());

describe("InMemoryNotificationRepository: what is specific to this adapter", () => {
  it("the page it returns cannot be used to change the store", async () => {
    const repository = new InMemoryNotificationRepository();
    await repository.add(aNotification({ owner: "user-1" }));
    await repository.add(aNotification({ owner: "user-1" }));

    const first = await repository.findByOwner(UserId("user-1"), { limit: 10, offset: 0 });
    (first.items as Notification[]).pop();

    expect(repository.all()).toHaveLength(2);
    expect((await repository.findByOwner(UserId("user-1"), { limit: 10, offset: 0 })).items).toHaveLength(2);
  });
});
