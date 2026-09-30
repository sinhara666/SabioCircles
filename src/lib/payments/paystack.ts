// Real Paystack REST integration (https://paystack.com/docs/api/).
// Requires PAYSTACK_SECRET_KEY to be set to a real (test or live) secret key
// from the user's own Paystack dashboard — without it, initialization calls
// will fail with a clear error rather than silently pretending to succeed.

import crypto from "node:crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Add your Paystack secret key (test or live) to .env to accept Naira payments."
    );
  }
  return key;
}

export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  splitCode?: string;
}): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
      // When the community owner has connected payouts, Paystack splits the
      // payment automatically: platform keeps its fee, the rest settles to
      // the owner's subaccount. No manual payouts needed.
      ...(params.splitCode ? { split_code: params.splitCode } : {}),
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack initialize failed");
  }
  return json.data;
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  reference: string;
  customer: { email: string };
}> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack verify failed");
  }
  return json.data;
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const hash = crypto.createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  return hash === signatureHeader;
}

/* ------------------------------------------------------------------ */
/* Split payouts: community owners get paid automatically, the        */
/* platform keeps its cut. Uses Paystack Subaccounts + Splits.        */
/* ------------------------------------------------------------------ */

/** Platform's cut of each member payment, percent. Env override, default 10. */
export function platformFeePercent(): number {
  const raw = Number(process.env.PLATFORM_FEE_PERCENT ?? "10");
  if (!Number.isFinite(raw)) return 10;
  return Math.min(30, Math.max(0, Math.round(raw)));
}

/** Nigerian banks for the payout setup dropdown. */
export async function listBanks(): Promise<{ name: string; code: string }[]> {
  const res = await fetch(`${PAYSTACK_BASE}/bank?currency=NGN`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack bank list failed");
  }
  return (json.data as { name: string; code: string }[]).map((b) => ({
    name: b.name,
    code: b.code,
  }));
}

/**
 * Creates a Paystack subaccount for a community owner. The owner receives
 * `sharePercent` of every member payment; the platform keeps the rest.
 */
export async function createSubaccount(params: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  sharePercent: number;
}): Promise<{ subaccount_code: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/subaccount`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_name: params.businessName,
      settlement_bank: params.bankCode,
      account_number: params.accountNumber,
      percentage_charge: params.sharePercent,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack subaccount creation failed");
  }
  return json.data;
}

/**
 * Creates a percentage split routing the owner's share to their subaccount.
 * The remainder settles to the platform's account automatically.
 */
export async function createSplit(params: {
  name: string;
  subaccountCode: string;
  ownerSharePercent: number;
}): Promise<{ split_code: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/split`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      type: "percentage",
      currency: "NGN",
      subaccounts: [{ subaccount: params.subaccountCode, share: params.ownerSharePercent }],
      bearer_type: "account",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack split creation failed");
  }
  return json.data;
}
