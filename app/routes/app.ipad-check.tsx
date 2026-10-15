import { useEffect, useState, useSyncExternalStore } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Diagnostic page for testing managed install + token exchange inside the
// Shopify mobile app on iPad. It never renders access tokens, only metadata.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(`#graphql
    query ipadCheckShop {
      shop {
        name
        myshopifyDomain
      }
    }`);
  const { data } = await response.json();

  return {
    shopName: data?.shop?.name ?? "unknown",
    shopDomain: session.shop,
    tokenIsOnline: session.isOnline,
    tokenExpires: session.expires?.toISOString() ?? null,
    hasRefreshToken: Boolean(session.refreshToken),
    renderedAt: new Date().toISOString(),
  };
};

type IdTokenResult =
  | { status: "pending" }
  | { status: "ok"; ms: number; length: number }
  | { status: "error"; ms: number; message: string };

const ID_TOKEN_TIMEOUT_MS = 20_000;

const noopSubscribe = () => () => {};
const readDevice = () =>
  `${navigator.cookieEnabled ? "cookies on" : "cookies off"} | ${navigator.userAgent}`;
const readDeviceOnServer = () => "";

export default function IpadCheck() {
  const data = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const refetch = useFetcher<typeof loader>();
  const [idToken, setIdToken] = useState<IdTokenResult>({ status: "pending" });
  const device = useSyncExternalStore(
    noopSubscribe,
    readDevice,
    readDeviceOnServer,
  );

  useEffect(() => {
    const started = performance.now();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`No ID token after ${ID_TOKEN_TIMEOUT_MS} ms`)),
        ID_TOKEN_TIMEOUT_MS,
      ),
    );
    Promise.race([shopify.idToken(), timeout])
      .then((token) =>
        setIdToken({
          status: "ok",
          ms: Math.round(performance.now() - started),
          length: token.length,
        }),
      )
      .catch((error: Error) =>
        setIdToken({
          status: "error",
          ms: Math.round(performance.now() - started),
          message: error.message,
        }),
      );
  }, [shopify]);

  const latest = refetch.data ?? data;

  return (
    <s-page heading="iPad auth check">
      <s-section heading="1. Server: token exchange and Admin API call">
        <s-paragraph>
          Shop: <strong>{data.shopName}</strong> ({data.shopDomain})
        </s-paragraph>
        <s-paragraph>
          Token type: {data.tokenIsOnline ? "online" : "offline"}, expiring:{" "}
          {data.tokenExpires ?? "no"}, refresh token stored:{" "}
          {data.hasRefreshToken ? "yes" : "no"}
        </s-paragraph>
        <s-paragraph>Page rendered at {data.renderedAt}</s-paragraph>
      </s-section>

      <s-section heading="2. Browser: App Bridge ID token handshake">
        {idToken.status === "pending" && (
          <s-paragraph>Waiting for the ID token…</s-paragraph>
        )}
        {idToken.status === "ok" && (
          <s-paragraph>
            <s-badge tone="success">Handshake OK</s-badge> ID token received in{" "}
            {idToken.ms} ms ({idToken.length} characters).
          </s-paragraph>
        )}
        {idToken.status === "error" && (
          <s-paragraph>
            <s-badge tone="critical">Handshake failed</s-badge> after{" "}
            {idToken.ms} ms: {idToken.message}
          </s-paragraph>
        )}
      </s-section>

      <s-section heading="3. Authenticated fetch after load">
        <s-paragraph>
          Re-requests this page&apos;s data with a plain fetch. App Bridge must attach
          a fresh ID token for this to succeed.
        </s-paragraph>
        <s-button
          onClick={() => refetch.load("/app/ipad-check")}
          {...(refetch.state !== "idle" ? { loading: true } : {})}
        >
          Refetch
        </s-button>
        <s-paragraph>Latest server render: {latest.renderedAt}</s-paragraph>
      </s-section>

      <s-section heading="Device">
        <s-paragraph>{device}</s-paragraph>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
