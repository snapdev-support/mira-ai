import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CreditCard, Receipt, LayoutGrid } from "lucide-react";
import { PlanOverviewCard } from "@/components/billing/PlanOverviewCard";
import { PaymentMethodsTab } from "@/components/billing/PaymentMethodsTab";
import { TransactionHistoryTab } from "@/components/billing/TransactionHistoryTab";
import {
  fetchSubscriptionOverview,
  fetchPaymentMethods,
  fetchTransactions,
} from "@/services/billingApi";
import type {
  SubscriptionOverview,
  PaymentMethod,
  Transaction,
} from "@/types/backend";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

export default function BillingDashboard() {
  // ── Overview ──────────────────────────────────────────────────────────────
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // ── Payment Methods ───────────────────────────────────────────────────────
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);

  // ── Transactions ──────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(true);

  // ── Active tab ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("overview");

  // ── Search params ─────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await fetchSubscriptionOverview();
      setOverview(data);
    } catch {
      // keep null, UI handles it
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadMethods = useCallback(async () => {
    setMethodsLoading(true);
    try {
      const data = await fetchPaymentMethods();
      setMethods(data.items);
    } catch {
      setMethods([]);
    } finally {
      setMethodsLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(
    async (page: number) => {
      setTxLoading(true);
      try {
        const data = await fetchTransactions(page, PAGE_SIZE);
        setTransactions(data.items);
        setTxTotal(data.total);
        setTxPage(data.page);
      } catch {
        setTransactions([]);
      } finally {
        setTxLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadOverview();
    loadMethods();
    loadTransactions(1);
  }, [loadOverview, loadMethods, loadTransactions]);

  // Show toast when returning from a canceled Stripe checkout
  useEffect(() => {
    if (searchParams.get("canceled") === "1") {
      toast({
        title: "Checkout canceled",
        description: "No charge was made. You can try again anytime.",
      });
      searchParams.delete("canceled");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const handlePageChange = (page: number) => {
    loadTransactions(page);
  };

  // ── Tab styles ─────────────────────────────────────────────────────────────

  const tabTriggerStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: 500,
    color: active ? "var(--color-text)" : "var(--color-muted)",
    background: active ? "var(--color-bg-light)" : "transparent",
    borderRadius: "var(--radius-sm)",
    border: active ? "1px solid var(--color-border)" : "1px solid transparent",
    padding: "5px 12px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          Billing
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Manage your plan, payment methods, and transaction history.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          className="h-auto p-1 gap-1"
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <TabsTrigger
            value="overview"
            style={tabTriggerStyle(tab === "overview")}
            className="data-[state=active]:shadow-none data-[state=active]:text-foreground"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="payment-methods"
            style={tabTriggerStyle(tab === "payment-methods")}
            className="data-[state=active]:shadow-none data-[state=active]:text-foreground"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Payment Methods
          </TabsTrigger>
          <TabsTrigger
            value="history"
            style={tabTriggerStyle(tab === "history")}
            className="data-[state=active]:shadow-none data-[state=active]:text-foreground"
          >
            <Receipt className="w-3.5 h-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ── Overview tab ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {overviewLoading ? (
            <LoadingBlock />
          ) : overview ? (
            <PlanOverviewCard overview={overview} onRefresh={loadOverview} />
          ) : (
            <EmptyState message="Could not load plan information." />
          )}

          {/* Quick summary cards */}
          {!overviewLoading && overview && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <QuickCard
                label="Payment Methods"
                value={
                  methodsLoading
                    ? "—"
                    : `${methods.length} saved`
                }
                action="Manage"
                onAction={() => setTab("payment-methods")}
              />
              <QuickCard
                label="Total Spent"
                value={
                  txLoading
                    ? "—"
                    : `$${transactions
                        .filter((t) => t.status === "paid")
                        .reduce((sum, t) => sum + t.amountUsd, 0)
                        .toLocaleString()}`
                }
                action="View History"
                onAction={() => setTab("history")}
              />
              <QuickCard
                label="Last Payment"
                value={
                  txLoading
                    ? "—"
                    : transactions.filter((t) => t.status === "paid").length > 0
                    ? new Date(
                        transactions.filter((t) => t.status === "paid")[0].date
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "No payments yet"
                }
                action="Details"
                onAction={() => setTab("history")}
              />
            </div>
          )}
        </TabsContent>

        {/* ── Payment Methods tab ───────────────────────────────────────── */}
        <TabsContent value="payment-methods" className="mt-6">
          {methodsLoading ? (
            <LoadingBlock />
          ) : (
            <PaymentMethodsTab methods={methods} onRefresh={loadMethods} />
          )}
        </TabsContent>

        {/* ── History tab ───────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-6">
          <TransactionHistoryTab
            items={transactions}
            total={txTotal}
            page={txPage}
            pageSize={PAGE_SIZE}
            loading={txLoading}
            onPageChange={handlePageChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function LoadingBlock() {
  return (
    <div
      className="flex items-center justify-center py-20 border"
      style={{
        background: "var(--color-bg-card)",
        borderColor: "var(--color-border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <Loader2
        className="w-6 h-6 animate-spin"
        style={{ color: "var(--color-accent)" }}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center py-20 border"
      style={{
        background: "var(--color-bg-card)",
        borderColor: "var(--color-border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        {message}
      </p>
    </div>
  );
}

function QuickCard({
  label,
  value,
  action,
  onAction,
}: {
  label: string;
  value: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div
      className="p-5 border flex flex-col gap-3"
      style={{
        background: "var(--color-bg-card)",
        borderColor: "var(--color-border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-bold"
        style={{ color: "var(--color-text)" }}
      >
        {value}
      </p>
      <button
        onClick={onAction}
        className="text-xs font-medium hover:opacity-80 transition-opacity text-left"
        style={{ color: "var(--color-accent)" }}
      >
        {action} →
      </button>
    </div>
  );
}
