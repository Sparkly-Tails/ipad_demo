import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory compliance webhooks for App Store apps:
// customers/data_request, customers/redact and shop/redact.
// authenticate.webhook verifies the HMAC and throws a 401 response when it
// is invalid. This app stores no customer data, only Shopify sessions, so the
// customer topics only acknowledge. Payloads hold customer emails and phone
// numbers, so they are never logged.
export const action = async ({ request }: ActionFunctionArgs) => {
  let context;
  try {
    context = await authenticate.webhook(request);
  } catch (error) {
    // authenticate.webhook throws a Response (401 for a bad HMAC, 400 for
    // missing headers). Log the status so rejections are visible in Vercel.
    if (error instanceof Response) {
      console.log(`Compliance webhook rejected with HTTP ${error.status}`);
    } else {
      console.log(`Compliance webhook failed before verification: ${String(error)}`);
    }
    throw error;
  }
  const { shop, topic } = context;

  // Topic casing differs between API styles (customers/redact, CUSTOMERS_REDACT).
  const normalizedTopic = topic.toUpperCase().replace(/\//g, "_");

  switch (normalizedTopic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      console.log(`Received ${normalizedTopic} for ${shop}: no customer data stored`);
      break;
    case "SHOP_REDACT":
      await db.session.deleteMany({ where: { shop } });
      console.log(`Received SHOP_REDACT for ${shop}: deleted stored sessions`);
      break;
    default:
      console.log(`Ignoring unexpected topic ${normalizedTopic} for ${shop}`);
  }

  return new Response();
};
