import { InfraiMailDns } from "./infrai_mail_dns.js";
import { cutOverLogisticsMail, mailCutoverSchema } from "./mail_cutover.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");

const input = mailCutoverSchema.parse({
  domain: "mail.example-logistics.com",
  records: [
    { name: "@", content: "mx1.mail-provider.example", priority: 10 },
    { name: "@", content: "mx2.mail-provider.example", priority: 20 },
  ],
  event: {
    shipmentId: "SHP-2048",
    occurredAt: "2026-10-01T08:30:00.000Z",
    status: "delivered",
    note: "Signed at the receiving desk",
    proofOfDelivery: [
      {
        name: "SHP-2048-signature.pdf",
        contentType: "application/pdf",
        storageKey: "shipments/SHP-2048/signature.pdf",
      },
    ],
  },
});

const result = await cutOverLogisticsMail(input, new InfraiMailDns(apiKey));
console.log(JSON.stringify(result, null, 2));
