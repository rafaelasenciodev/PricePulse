import type { Brand } from "../../shared/domain";

/** The Provider that supplied a Price Observation. An identifier, not an entity. See `Brand`. */
export type ProviderId = Brand<"ProviderId">;

export const ProviderId = (value: string): ProviderId => value as ProviderId;
