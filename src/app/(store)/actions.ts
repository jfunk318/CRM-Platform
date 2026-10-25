"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOrigin } from "@/lib/business";
import { type ActionResult, FormError, optionalText, runAction } from "@/lib/admin/form";
import { formFiles, UploadError } from "@/lib/files/storage";
import { ensurePublicToken } from "@/lib/orders/customer-flow";
import { OrderError } from "@/lib/orders/service";
import { parseDay } from "@/lib/production/defaults";
import { ACCESS_COOKIE, accessToken } from "@/lib/store/access";
import { portalRole, submitStoreRequest } from "@/lib/store/portal";
import { getShopper, isOwnerPath, passwordSignIn, sendSignInLink, setShopperPassword, signOut, updateShopperProfile } from "@/lib/store/accounts";
import { addToCart, currentCart, setCartQty } from "@/lib/store/cart";
import { applyCode, payLater, placeOrderFromCart, removeCode, saveCheckoutDetails, startCheckout, startOrderPayment } from "@/lib/store/checkout";
import { createQuoteRequest } from "@/lib/store/quote-request";
import { getRequestStore, type RequestStore } from "@/lib/store/resolve";
import { looksLikeSpam } from "@/lib/store/spam";

const str = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function store(): Promise<RequestStore> {
  const rs = await getRequestStore();
  if (!rs) throw new FormError("This store isn't available.");
  return rs;
}

/** Shopper-facing errors read like form errors. */
async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof OrderError || e instanceof UploadError) throw new FormError(e.message);
      throw e;
    }
  });
}

function quantities(form: FormData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("qty_") || String(v).trim() === "") continue;
    const n = Number(String(v).trim());
    if (!Number.isInteger(n) || n < 0) throw new FormError("Quantities must be whole numbers");
    if (n > 0) out[k.slice(4)] = n;
  }
  // Personalized items send one size and quantity.
  const size = form.get("size");
  if (size) {
    const n = Number(String(form.get("qty") ?? "1").trim());
    if (!Number.isInteger(n) || n < 1) throw new FormError("Quantity must be a whole number, 1 or more");
    out[String(size)] = n;
  }
  return out;
}

// ─── Access code ────────────────────────────────────────────────────────

export async function enterAccessCode(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    if (!rs.store.accessCode) return;
    if (await looksLikeSpam(form, "access", 30)) throw new FormError("Too many tries. Wait a while and try again.");
    if (str(form, "code").toLowerCase() !== rs.store.accessCode.toLowerCase()) throw new FormError("That code isn't right");
    (await cookies()).set(ACCESS_COOKIE, accessToken(rs.store), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
    revalidatePath("/", "layout");
    return "Welcome!";
  });
}

// ─── Cart ───────────────────────────────────────────────────────────────

export async function addToCartAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    const q = quantities(form);
    await addToCart(rs, str(form, "itemId"), q, { name: form.get("personalName")?.toString(), number: form.get("personalNumber")?.toString() });
    revalidatePath("/", "layout");
    const n = Object.values(q).reduce((a, b) => a + b, 0);
    return `Added ${n} to your cart`;
  });
}

export async function updateCartAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    const n = Number(str(form, "qty"));
    if (!Number.isInteger(n)) throw new FormError("Enter a whole number");
    await setCartQty(rs, str(form, "cartItemId"), n);
    revalidatePath("/", "layout");
    return n === 0 ? "Removed" : "Updated";
  });
}

export async function applyCodeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    const cart = await currentCart(rs);
    if (!cart) throw new FormError("Your cart is empty");
    const msg = await applyCode(rs, cart, str(form, "code"));
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return msg;
  });
}

export async function removeCodeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    const cart = await currentCart(rs);
    if (cart) await removeCode(rs, cart, form.get("which") === "gift" ? "gift" : "promo");
    revalidatePath("/cart");
    revalidatePath("/checkout");
  });
}

// ─── Checkout ───────────────────────────────────────────────────────────

async function saveDetails(rs: RequestStore, form: FormData) {
  const cart = await currentCart(rs);
  if (!cart) throw new FormError("Your cart is empty");
  await saveCheckoutDetails(rs, cart, {
    email: str(form, "email"),
    firstName: str(form, "firstName"),
    lastName: str(form, "lastName"),
    phone: optionalText(form, "phone"),
    deliveryMethodId: optionalText(form, "deliveryMethodId"),
    ship: {
      name: optionalText(form, "shipName"),
      line1: optionalText(form, "shipLine1"),
      line2: optionalText(form, "shipLine2"),
      city: optionalText(form, "shipCity"),
      region: optionalText(form, "shipRegion"),
      postalCode: optionalText(form, "shipPostalCode"),
      country: optionalText(form, "shipCountry") ?? "US",
    },
    note: optionalText(form, "note"),
  });
  const shopper = await getShopper(rs);
  if (shopper) await rs.db.cart.update({ where: { id: cart.id }, data: { customerId: shopper.id } });
  return (await currentCart(rs))!;
}

export async function saveCheckoutAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    await saveDetails(rs, form);
    revalidatePath("/checkout");
    return "Updated";
  });
}

export async function placeOrderAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  let target = "";
  const r = await run(async () => {
    if (rs.settings.accountMode === "REQUIRED" && !(await getShopper(rs))) throw new FormError("Please sign in to check out");
    // The pay buttons send no details; they use what was saved on the cart.
    const cart = form.has("email") ? await saveDetails(rs, form) : await currentCart(rs);
    if (!cart) throw new FormError("Your cart is empty");
    const origin = await requestOrigin();
    if (form.get("payLater") === "1") {
      const order = await payLater(rs, cart, origin);
      target = `/checkout/thanks?order=${order.publicToken}`;
      return;
    }
    const result = await startCheckout(rs, cart, origin);
    target = result.kind === "placed" ? `/checkout/thanks?order=${result.orderToken}` : result.url;
  });
  if (r.error) return r;
  redirect(target);
}

/** Development only: finish checkout as if the card payment went through. */
export async function testPaymentAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  void form;
  if (process.env.NODE_ENV === "production") return { error: "Not available" };
  const rs = await store();
  let token = "";
  const r = await run(async () => {
    const cart = await currentCart(rs);
    if (!cart || cart.status !== "CHECKOUT" || !cart.amountDue) throw new FormError("Nothing is waiting for payment");
    const order = await placeOrderFromCart(rs.db, cart.id, { amount: cart.amountDue, reference: `test_${cart.id}` }, await requestOrigin());
    token = order.publicToken!;
  });
  if (r.error) return r;
  redirect(`/checkout/thanks?order=${token}`);
}

/** Pay a deposit or balance from the customer's order page. */
export async function payOrderAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  let url = "";
  const r = await run(async () => {
    url = await startOrderPayment(rs.db, rs.business, str(form, "token"), await requestOrigin());
  });
  if (r.error) return r;
  redirect(url);
}

// ─── Quote requests and order tracking ──────────────────────────────────

export async function quoteRequestAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    if (rs.store.kind !== "ROOT") throw new FormError("Quote requests go through the main site.");
    if (await looksLikeSpam(form, "quote")) return "Thanks! We'll be in touch.";
    const productId = optionalText(form, "productId");
    const colorId = optionalText(form, "colorId");
    const q = quantities(form);
    const needed = optionalText(form, "neededBy");
    const quote = await createQuoteRequest(rs, {
      name: str(form, "name"),
      email: str(form, "email"),
      phone: optionalText(form, "phone"),
      organization: optionalText(form, "organization"),
      details: str(form, "details").slice(0, 5000),
      neededBy: parseDay(needed),
      product: productId && colorId && Object.keys(q).length ? { productId, colorId, quantities: q } : null,
      files: formFiles(form, "files").slice(0, 10),
      origin: await requestOrigin(),
    });
    return `Thanks! Your request Q-${quote.number} is in. We'll email you a quote soon.`;
  });
}

export async function trackOrderAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  let token = "";
  const r = await run(async () => {
    if (await looksLikeSpam(form, "track", 20)) throw new FormError("Too many tries. Wait a while and try again.");
    const number = Number(str(form, "number").replace(/^#/, ""));
    const email = str(form, "email").toLowerCase();
    const order = Number.isInteger(number)
      ? await rs.db.order.findFirst({ where: { type: "ORDER", number, customer: { email: { equals: email, mode: "insensitive" } } } })
      : null;
    if (!order) throw new FormError("We couldn't find an order with that number and email");
    token = await ensurePublicToken(rs.db, order.id);
  });
  if (r.error) return r;
  redirect(`/c/${token}`);
}

// ─── Accounts ───────────────────────────────────────────────────────────

export async function sendLinkAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    if (rs.settings.accountMode === "GUEST_ONLY" && !isOwnerPath(str(form, "next"))) throw new FormError("This store doesn't use accounts");
    if (await looksLikeSpam(form, "signin", 20)) throw new FormError("Too many tries. Wait a while and try again.");
    const status = await sendSignInLink(rs, str(form, "email"), await requestOrigin(), str(form, "next") || "/account");
    return status === "LOGGED"
      ? "Sign-in link recorded (email isn't set up on this store yet, so it wasn't sent)"
      : "Check your email for a sign-in link";
  });
}

export async function passwordSignInAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  const next = str(form, "next");
  const r = await run(async () => {
    if (await looksLikeSpam(form, "password", 20)) throw new FormError("Too many tries. Wait a while and try again.");
    await passwordSignIn(rs, str(form, "email"), String(form.get("password") ?? ""));
  });
  if (r.error) return r;
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
}

export async function signOutAction() {
  const rs = await getRequestStore();
  if (rs) await signOut(rs);
  redirect("/");
}

export async function setPasswordAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    const me = await getShopper(rs);
    if (!me) throw new FormError("Please sign in again");
    const pw = String(form.get("password") ?? "");
    if (pw !== String(form.get("confirm") ?? "")) throw new FormError("The passwords don't match");
    await setShopperPassword(rs, me.id, pw);
    return "Password saved";
  });
}

export async function profileAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    const me = await getShopper(rs);
    if (!me) throw new FormError("Please sign in again");
    await updateShopperProfile(rs, me.id, { firstName: str(form, "firstName"), lastName: str(form, "lastName"), phone: optionalText(form, "phone") });
    revalidatePath("/account");
  });
}

// ─── Owner portal ───────────────────────────────────────────────────────

export async function ownerSignOutAction() {
  const rs = await getRequestStore();
  if (rs) await signOut(rs);
  redirect("/owner/login");
}

export async function storeRequestAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const rs = await store();
  return run(async () => {
    const me = await getShopper(rs);
    if (!me || !(await portalRole(rs.db, rs.store, me)) || !rs.store.portalSections.includes("requests")) throw new FormError("Sign in as the store's owner to send requests");
    await submitStoreRequest(rs.db, rs.store, me, { subject: str(form, "subject"), body: String(form.get("body") ?? "") }, await requestOrigin());
    revalidatePath("/owner");
    return "Sent. We'll get back to you here and by email.";
  });
}
