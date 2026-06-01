import { Hono } from 'hono';
import Stripe from 'stripe';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { stripeInvoices, stripeSubscriptions, notifications } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '../lib/utils';

export const webhooksRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Stripe Webhooks ──────────────────────────────────────────────────────────

webhooksRouter.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  const body = await c.req.text();
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const db = createDb(c.env.DB);

  switch (event.type) {
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await db
        .update(stripeInvoices)
        .set({ status: 'paid', amountPaid: invoice.amount_paid, paidAt: new Date().toISOString() })
        .where(eq(stripeInvoices.stripeInvoiceId, invoice.id));
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await db
        .update(stripeInvoices)
        .set({ status: 'open' })
        .where(eq(stripeInvoices.stripeInvoiceId, invoice.id));
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await db
        .update(stripeSubscriptions)
        .set({
          status: sub.status,
          currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id));
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await db
        .update(stripeSubscriptions)
        .set({ status: 'canceled', canceledAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id));
      break;
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return c.json({ received: true });
});
