import { z } from "zod";
import { InfraiMailDns } from "./infrai_mail_dns.js";
import { shipmentEventSchema } from "./shipment_event.js";

export const mailCutoverSchema = z.object({
  domain: z.string().min(1),
  records: z
    .array(
      z.object({
        name: z.string().min(1),
        content: z.string().min(1),
        priority: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  event: shipmentEventSchema,
});

export type MailCutover = z.infer<typeof mailCutoverSchema>;

export async function cutOverLogisticsMail(
  input: MailCutover,
  mailDns: InfraiMailDns,
) {
  const zoneId = await mailDns.addDomain(input.domain);
  await Promise.all(
    input.records.map((record) =>
      mailDns.upsertMx({
        zoneId,
        domain: input.domain,
        ...record,
      }),
    ),
  );
  const sendingDomains = await mailDns.listSendingDomains();

  return {
    domain: input.domain,
    zoneId,
    mxRecordsApplied: input.records.length,
    shipmentEvent: input.event,
    sendingDomains,
  };
}
