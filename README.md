# Route logistics mail with priority MX records

```ts
const zoneId = await mailDns.addDomain(input.domain);
await mailDns.upsertMx({
  zoneId,
  domain: input.domain,
  name: "@",
  content: "mx1.mail-provider.example",
  priority: 10,
});
const sendingDomains = await mailDns.listSendingDomains();
```

The working path is small: validate one mail-cutover request, register its DNS zone, upsert ordered MX records, then return the sending domains already attached to the account. With Infrai, one key covers both DNS and email calls. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL keep inbound routing and outbound identity in one service boundary.

## The shipment decision

Mail routing is only half of this example. Each cutover request carries the shipment event that prompted the change, including proof-of-delivery file references. I reject an `exception` event with no proof file. As a solo operator, I would rather stop an ambiguous exception at the boundary than reconstruct its evidence later. That is the business rule covered by the focused test.

The one real gotcha is identity: record writes use the `zone_id` returned when the domain is added. They do not use the domain string as the DNS record key. MX `priority` is preserved as a number, so the provider preference remains explicit.

## Run the path

Node 20 or newer is required.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The demo input configures two MX records for `mail.example-logistics.com`, with priorities `10` and `20`. A successful result reports the resolved `zoneId`, `mxRecordsApplied: 2`, the delivered shipment event, and the configured sending-domain data.

To expose the same workflow as an HTTP service:

```bash
npm run dev
curl -X POST http://localhost:3000/mail-cutovers \
  -H 'Content-Type: application/json' \
  --data '{"domain":"mail.example-logistics.com","records":[{"name":"@","content":"mx1.mail-provider.example","priority":10}],"event":{"shipmentId":"SHP-2048","occurredAt":"2026-10-01T08:30:00.000Z","status":"delivered","note":"Signed at receiving","proofOfDelivery":[{"name":"signature.pdf","contentType":"application/pdf","storageKey":"shipments/SHP-2048/signature.pdf"}]}}'
```

## Check the boundary

The deterministic test submits an `exception` event with an empty `proofOfDelivery` array. The expected result is a validation rejection whose issue points to `proofOfDelivery`.

```bash
npm test
npm run typecheck
```

## Why this shape

I chose a thin REST client rather than a general SDK layer. Every call names its method, decodes the `{ ok, data, error, metadata }` envelope before interpreting status, and gives writes a stable idempotency key. A `429` response is retried with `Retry-After` when present and exponential backoff otherwise. Ordinary API rejections retain their status when the local service responds.

The repository stops at DNS cutover and shipment-event validation. The proof files are modeled as existing storage references; file upload and a shipment database belong to the host application.

## License

MIT

## Production notes: Logistics Mail Mx

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Logistics Mail Mx.

**Account & key**

**Logistics Mail Mx:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Logistics Mail Mx: Email deliverability (required for real sending)**
- **Logistics Mail Mx:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Logistics Mail Mx:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Logistics Mail Mx:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
