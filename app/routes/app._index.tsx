import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Minimal embedded home page. It makes one Admin API call with the token that
// authenticate.admin obtained through token exchange, so there is no stored or
// hardcoded access token anywhere in the app. Replace this with your app's UI.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`#graphql
    query homeShop {
      shop {
        name
      }
    }`);
  const { data } = await response.json();

  return { shopName: data?.shop?.name ?? "your store" };
};

export default function Index() {
  const { shopName } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Welcome">
      <s-section heading={`Connected to ${shopName}`}>
        <s-paragraph>
          This app is installed with Shopify managed installation and
          authenticates every request with a session token that the server
          exchanges for an access token. Use the Auth check page to verify the
          flow on a device.
        </s-paragraph>
        <s-link href="/app/ipad-check">Open the auth check</s-link>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
