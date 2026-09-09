import { action, mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY || "sk_test_635398d5c80523e100346c7bcbe3d4d39f40078b";
const PAYSTACK_BASE_URL = "https://api.paystack.co";

export const initializePayment = action({
  args: {
    email: v.string(),
    amount: v.number(), // in Naira
    reference: v.string(),
    workspaceId: v.optional(v.string()),
    callbackUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: args.email,
        amount: Math.round(args.amount * 100), // Convert Naira to Kobo
        reference: args.reference,
        currency: "NGN",
        channels: ["card", "bank", "ussd", "bank_transfer"],
        callback_url: args.callbackUrl,
        metadata: {
          workspaceId: args.workspaceId,
          custom_fields: [
            {
              display_name: "Workspace ID",
              variable_name: "workspace_id",
              value: args.workspaceId,
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || "Paystack initialization failed");
    }

    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  },
});

export const verifyPayment = action({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(args.reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!data.status || data.data.status !== "success") {
      throw new Error(data.message || "Payment verification failed or payment not successful");
    }

    return {
      status: "success" as const,
      amount: data.data.amount / 100, // Convert Kobo to Naira
      currency: data.data.currency,
      paidAt: data.data.paid_at ? new Date(data.data.paid_at).getTime() : Date.now(),
      customer: data.data.customer,
      authorization: data.data.authorization,
      reference: data.data.reference,
    };
  },
});

export const createSubscription = action({
  args: {
    customer: v.object({
      email: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      phone: v.optional(v.string()),
    }),
    plan: v.object({
      name: v.string(),
      amount: v.number(), // in Naira
      interval: v.string(), // "monthly" | "annually"
    }),
  },
  handler: async (ctx, args) => {
    // 1. Create customer
    const customerResponse = await fetch(`${PAYSTACK_BASE_URL}/customer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: args.customer.email,
        first_name: args.customer.firstName,
        last_name: args.customer.lastName,
        phone: args.customer.phone,
      }),
    });

    const customerData = await customerResponse.json();

    if (!customerData.status) {
      throw new Error(customerData.message || "Failed to create Paystack customer");
    }

    // 2. Create or find Plan
    const planResponse = await fetch(`${PAYSTACK_BASE_URL}/plan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: args.plan.name,
        amount: Math.round(args.plan.amount * 100), // Convert to Kobo
        interval: args.plan.interval === "annual" ? "annually" : args.plan.interval,
        currency: "NGN",
      }),
    });

    const planData = await planResponse.json();

    if (!planData.status) {
      throw new Error(planData.message || "Failed to create Paystack plan");
    }

    // 3. Create Subscription
    const subscriptionResponse = await fetch(`${PAYSTACK_BASE_URL}/subscription`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerData.data.customer_code,
        plan: planData.data.plan_code,
      }),
    });

    const subscriptionData = await subscriptionResponse.json();

    if (!subscriptionData.status) {
      throw new Error(subscriptionData.message || "Failed to create Paystack subscription");
    }

    return {
      subscriptionCode: subscriptionData.data.subscription_code,
      emailToken: subscriptionData.data.email_token,
      status: subscriptionData.data.status,
    };
  },
});
