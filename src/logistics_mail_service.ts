import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, InfraiMailDns } from "./infrai_mail_dns.js";
import { cutOverLogisticsMail, mailCutoverSchema } from "./mail_cutover.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const mailDns = new InfraiMailDns(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/mail-cutovers") {
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = mailCutoverSchema.parse(JSON.parse(Buffer.concat(chunks).toString()));
    const result = await cutOverLogisticsMail(input, mailDns);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    const status =
      error instanceof ZodError
        ? 400
        : error instanceof InfraiError && error.status < 500
          ? error.status
          : 500;
    const body =
      error instanceof ZodError
        ? { error: "INVALID_REQUEST", issues: error.issues }
        : error instanceof InfraiError
          ? { error: error.code, message: error.message }
          : { error: "INTERNAL_ERROR" };
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  }
}).listen(port, () => console.log(`Logistics mail service listening on ${port}`));
