// Real Flutterwave Standard integration (https://developer.flutterwave.com/docs/direct-api-integration/standard/).
// Requires FLUTTERWAVE_SECRET_KEY from the user's own Flutterwave dashboard.

const FLW_BASE = "https://api.flutterwave.com/v3";

function secretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "FLUTTERWAVE_SECRET_KEY is not set. Add your Flutterwave secret key to .env to accept payments through Flutterwave."
    );
  }
  return key;
}

export async function initializePayment(params: {
  txRef: string;
  amount: number; // major currency unit, e.g. Naira not kobo
  currency: string;
  redirectUrl: string;
  email: string;
  name: string;
  title: string;
}): Promise<{ link: string }> {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: params.amount,
      currency: params.currency,
      redirect_url: params.redirectUrl,
      customer: { email: params.email, name: params.name },
      customizations: { title: params.title },
    }),
  });
  const json = await res.json();
  if (!res.ok || json.status !== "success") {
    throw new Error(json.message || "Flutterwave initialize failed");
  }
  return json.data;
}

export async function verifyTransactionByRef(txRef: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  tx_ref: string;
}> {
  const res = await fetch(`${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const json = await res.json();
  if (!res.ok || json.status !== "success") {
    throw new Error(json.message || "Flutterwave verify failed");
  }
  return json.data;
}

// Flutterwave webhooks are authenticated with a static secret hash you set
// in the dashboard and that is echoed back in the `verif-hash` header —
// not an HMAC signature. See:
// https://developer.flutterwave.com/docs/integration-guides/webhooks
export function verifyWebhookHash(hashHeader: string | null): boolean {
  const expected = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!expected || !hashHeader) return false;
  return hashHeader === expected;
}
