import { z } from "zod";

const proofFileSchema = z.object({
  name: z.string().min(1),
  contentType: z.string().min(1),
  storageKey: z.string().min(1),
});

export const shipmentEventSchema = z
  .object({
    shipmentId: z.string().min(1),
    occurredAt: z.string().datetime(),
    status: z.enum(["in_transit", "delivered", "exception"]),
    note: z.string().min(1),
    proofOfDelivery: z.array(proofFileSchema).default([]),
  })
  .superRefine((event, context) => {
    if (event.status === "exception" && event.proofOfDelivery.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proofOfDelivery"],
        message: "An exception event needs at least one proof file",
      });
    }
  });

export type ShipmentEvent = z.infer<typeof shipmentEventSchema>;
