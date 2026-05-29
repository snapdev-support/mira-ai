import { useState, useEffect } from "react";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Star, CreditCard, Building2 } from "lucide-react";
import type { PaymentMethod, CardBrand } from "@/types/backend";
import {
  deletePaymentMethod,
  setDefaultPaymentMethod,
  attachPaymentMethod,
  createSetupIntent,
} from "@/services/billingApi";
import { stripePromise } from "@/lib/stripe";
import { useToast } from "@/hooks/use-toast";

interface Props {
  methods: PaymentMethod[];
  onRefresh: () => void;
}

// ── Brand logo placeholder ──────────────────────────────────────────────────

function CardBrandIcon({ brand }: { brand: CardBrand }) {
  const colors: Record<CardBrand, string> = {
    visa: "#1A1F71",
    mastercard: "#EB001B",
    amex: "#007BC1",
    discover: "#FF6600",
    unknown: "var(--color-muted)",
  };
  const labels: Record<CardBrand, string> = {
    visa: "VISA",
    mastercard: "MC",
    amex: "AMEX",
    discover: "DISC",
    unknown: "CARD",
  };
  return (
    <span
      className="inline-flex items-center justify-center text-[10px] font-black px-1.5 py-0.5"
      style={{
        background: colors[brand],
        color: "#fff",
        borderRadius: 2,
        minWidth: 34,
        letterSpacing: "0.04em",
      }}
    >
      {labels[brand]}
    </span>
  );
}

// ── Add Card Modal (Stripe Elements) ───────────────────────────────────────

function CardForm({
  clientSecret,
  setDefault,
  onAdded,
  onClose,
}: {
  clientSecret: string;
  setDefault: boolean;
  onAdded: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setSaving(true);
    setCardError(null);
    try {
      const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) {
        setCardError(error.message ?? "Card setup failed.");
        return;
      }

      const pmId = typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

      if (!pmId) {
        setCardError("Could not retrieve payment method. Please try again.");
        return;
      }

      await attachPaymentMethod({ paymentMethodId: pmId, setDefault });
      toast({ title: "Card added", description: "Your new card has been saved." });
      onAdded();
      onClose();
    } catch {
      toast({ title: "Failed to add card", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      {/* Stripe CardElement */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
          Card Details
        </label>
        <div
          className="px-3 py-3 border"
          style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-btn)",
          }}
        >
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "14px",
                  color: "var(--color-text, #e2e8f0)",
                  fontFamily: "inherit",
                  "::placeholder": { color: "var(--color-muted, #64748b)" },
                },
                invalid: { color: "#D95050" },
              },
              hidePostalCode: true,
            }}
          />
        </div>
        {cardError && (
          <p className="text-xs" style={{ color: "#D95050" }}>{cardError}</p>
        )}
      </div>

      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
        Payments are processed securely by Stripe. We never store raw card numbers.
      </p>

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-muted)",
            background: "transparent",
            borderRadius: "var(--radius-btn)",
          }}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 font-semibold"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-accent-fg)",
            borderRadius: "var(--radius-btn)",
            border: "none",
          }}
          disabled={saving || !stripe}
        >
          {saving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
          ) : (
            "Save Card"
          )}
        </Button>
      </div>
    </form>
  );
}

function AddCardModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setDefault, setSetDefault] = useState(false);
  const [loadingIntent, setLoadingIntent] = useState(false);

  // Fetch a SetupIntent when the modal opens
  useEffect(() => {
    if (!open) { setClientSecret(null); return; }
    setLoadingIntent(true);
    createSetupIntent()
      .then((res) => setClientSecret(res.clientSecret))
      .catch(() => {
        toast({ title: "Could not initialise card form", variant: "destructive" });
        onClose();
      })
      .finally(() => setLoadingIntent(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setClientSecret(null);
    setSetDefault(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: "var(--color-bg-card)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--color-text)" }}>Add Payment Method</DialogTitle>
          <DialogDescription style={{ color: "var(--color-muted)" }}>
            Enter your card details. Your information is encrypted and secured by Stripe.
          </DialogDescription>
        </DialogHeader>

        {loadingIntent ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-accent)" }} />
          </div>
        ) : clientSecret && stripePromise ? (
          <>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CardForm
                clientSecret={clientSecret}
                setDefault={setDefault}
                onAdded={onAdded}
                onClose={handleClose}
              />
            </Elements>
            {/* Set as default toggle */}
            <label className="flex items-center gap-2 text-sm cursor-pointer -mt-1" style={{ color: "var(--color-muted)" }}>
              <input
                type="checkbox"
                checked={setDefault}
                onChange={(e) => setSetDefault(e.target.checked)}
                className="rounded"
              />
              Set as default payment method
            </label>
          </>
        ) : (
          <p className="text-sm text-center py-6" style={{ color: "var(--color-muted)" }}>
            Stripe is not configured. Please add{" "}
            <code className="text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code> to your environment.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Payment Method Card ─────────────────────────────────────────────────────

function PaymentMethodCard({
  method,
  onSetDefault,
  onRemove,
  loading,
}: {
  method: PaymentMethod;
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
  loading: string | null;
}) {
  const isCard = method.type === "card" && method.card;

  return (
    <div
      className="flex items-center gap-4 p-4 border transition-colors"
      style={{
        background: method.isDefault
          ? "var(--color-accent-8)"
          : "var(--color-bg)",
        borderColor: method.isDefault
          ? "var(--color-accent-20)"
          : "var(--color-border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center w-10 h-10 flex-shrink-0"
        style={{
          background: "var(--color-bg-light)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border)",
        }}
      >
        {isCard ? (
          <CreditCard className="w-4 h-4" style={{ color: "var(--color-muted)" }} />
        ) : (
          <Building2 className="w-4 h-4" style={{ color: "var(--color-muted)" }} />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isCard && <CardBrandIcon brand={method.card!.brand} />}
          <span
            className="text-sm font-medium"
            style={{ color: "var(--color-text)" }}
          >
            {isCard
              ? `•••• •••• •••• ${method.card!.last4}`
              : `${method.bankAccount!.bankName} ••${method.bankAccount!.last4}`}
          </span>
          {method.isDefault && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                background: "var(--color-accent-16)",
                color: "var(--color-accent)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Default
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
          {isCard
            ? `Expires ${method.card!.expMonth.toString().padStart(2, "0")}/${method.card!.expYear}`
            : `${method.bankAccount!.accountType} account`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!method.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8"
            style={{ color: "var(--color-muted)", borderRadius: "var(--radius-btn)" }}
            onClick={() => onSetDefault(method.id)}
            disabled={loading === method.id}
          >
            {loading === method.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Star className="w-3.5 h-3.5 mr-1" />
                Set default
              </>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          style={{ color: "var(--color-danger)", borderRadius: "var(--radius-btn)" }}
          onClick={() => onRemove(method.id)}
          disabled={loading === method.id}
          title="Remove card"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Tab ────────────────────────────────────────────────────────────────

export function PaymentMethodsTab({ methods, onRefresh }: Props) {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSetDefault = async (id: string) => {
    setLoadingId(id);
    try {
      await setDefaultPaymentMethod(id);
      toast({ title: "Default updated" });
      onRefresh();
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setLoadingId(id);
    try {
      await deletePaymentMethod(id);
      toast({ title: "Card removed" });
      onRefresh();
    } catch {
      toast({ title: "Failed to remove card", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
            Payment Methods
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
            Manage your saved cards and bank accounts.
          </p>
        </div>
        <Button
          size="sm"
          className="flex items-center gap-1.5 text-sm font-semibold"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-accent-fg)",
            borderRadius: "var(--radius-btn)",
            border: "none",
          }}
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Card
        </Button>
      </div>

      {/* List */}
      {methods.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-14 gap-3 border"
          style={{
            background: "var(--color-bg-card)",
            borderColor: "var(--color-border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <CreditCard className="w-8 h-8" style={{ color: "var(--color-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            No payment methods saved
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Add a card to make future purchases faster.
          </p>
          <Button
            size="sm"
            className="mt-1"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-accent-fg)",
              borderRadius: "var(--radius-btn)",
              border: "none",
            }}
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add your first card
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <PaymentMethodCard
              key={m.id}
              method={m}
              onSetDefault={handleSetDefault}
              onRemove={handleRemove}
              loading={loadingId}
            />
          ))}
        </div>
      )}

      <AddCardModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={onRefresh}
      />
    </div>
  );
}
