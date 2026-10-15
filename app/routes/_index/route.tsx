import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Shopify embedded app template</h1>
        <p className={styles.text}>
          Managed installation, token exchange and expiring offline tokens,
          with no access token stored in code or environment variables. Enter
          your store domain to open the app in your Shopify admin.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Session tokens</strong>. Every request is authenticated by
            a short-lived token from Shopify, so no cookies are needed.
          </li>
          <li>
            <strong>Per-shop storage</strong>. Access and refresh tokens are
            kept per shop in Postgres and rotated automatically.
          </li>
          <li>
            <strong>Compliance webhooks</strong>. The three mandatory privacy
            webhooks are handled and verified.
          </li>
        </ul>
      </div>
    </div>
  );
}
