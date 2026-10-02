import assert from "node:assert/strict";
import test from "node:test";
import { shipmentEventSchema } from "./shipment_event.js";

test("an exception event is rejected until a proof file is attached", () => {
  const result = shipmentEventSchema.safeParse({
    shipmentId: "SHP-77",
    occurredAt: "2026-10-01T08:30:00.000Z",
    status: "exception",
    note: "Recipient disputed the package condition",
    proofOfDelivery: [],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0]?.path, ["proofOfDelivery"]);
  }
});
