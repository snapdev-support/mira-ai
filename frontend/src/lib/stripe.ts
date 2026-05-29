import { loadStripe } from "@stripe/stripe-js";

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

// Stripe singleton — safe to call multiple times
export const stripePromise = key ? loadStripe(key) : null;
