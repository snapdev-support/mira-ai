import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, CheckCircle, Copy, Download, Loader2, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCodeStyling from "qr-code-styling";
import { issueClaim, PaymentRequiredError } from "@/services/claimsApi";
import type { IssueClaimRequest, IssueClaimResponse, TemplateType } from "@/types/backend";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUsage } from "@/usage/UsageContext";

type Issued = {
  request: IssueClaimRequest;
  response: IssueClaimResponse;
};

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const numberOptional = (opts?: { min?: number; max?: number; int?: boolean; label?: string }) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z
      .coerce
      .number({ invalid_type_error: `${opts?.label ?? "Value"} must be a number` })
      .finite(`${opts?.label ?? "Value"} must be a valid number`)
      .refine((n) => (opts?.int ? Number.isInteger(n) : true), {
        message: `${opts?.label ?? "Value"} must be an integer`,
      })
      .refine((n) => (opts?.min !== undefined ? n >= opts.min : true), {
        message: `${opts?.label ?? "Value"} must be at least ${opts?.min}`,
      })
      .refine((n) => (opts?.max !== undefined ? n <= opts.max : true), {
        message: `${opts?.label ?? "Value"} must be at most ${opts?.max}`,
      })
      .optional(),
  );

const studioSchema = z
  .object({
    template: z.enum(["invoice", "package", "return_sla"]),
    subjectId: z.string().trim().min(1, "Subject ID is required"),
    expLocal: z.string().min(1, "Expiry is required").refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid expiry"),
    replayWindowS: z.coerce.number().int().min(0).max(3600),
    destinationUrl: z
      .string()
      .trim()
      .optional()
      .refine(
        (v) => {
          if (!v) return true;
          try {
            const u = new URL(v);
            return u.protocol === "http:" || u.protocol === "https:";
          } catch {
            return false;
          }
        },
        { message: "Destination URL must be a valid http(s) URL" },
      ),

    invoiceIssuer: z.string().trim().optional(),
    invoiceNumber: z.string().trim().optional(),
    invoiceAmount: numberOptional({ min: 0.01, label: "Amount" }),
    invoiceCurrency: z.string().trim().optional().default("USD"),
    invoiceDueDate: z.date().optional(),
    invoiceDescription: z.string().trim().optional(),

    packageCarrier: z.string().trim().optional(),
    packageTracking: z.string().trim().optional(),
    packageStatus: z.string().trim().optional(),

    returnWindowDays: numberOptional({ min: 1, int: true, label: "Refund window (days)" }),
    returnRefundAmount: numberOptional({ min: 0.01, label: "Refund amount" }),
    returnCurrency: z.string().trim().optional().default("USD"),
    returnNotes: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.template === "invoice") {
      if (!v.invoiceIssuer) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["invoiceIssuer"], message: "Issuer is required" });
      if (!v.invoiceNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["invoiceNumber"], message: "Invoice number is required" });
      if (v.invoiceAmount === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["invoiceAmount"], message: "Amount is required" });
      if (!v.invoiceCurrency) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["invoiceCurrency"], message: "Currency is required" });
      if (!v.invoiceDueDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["invoiceDueDate"], message: "Due date is required" });
    }

    if (v.template === "package") {
      if (!v.packageCarrier) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["packageCarrier"], message: "Carrier is required" });
      if (!v.packageTracking) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["packageTracking"], message: "Tracking number is required" });
    }

    if (v.template === "return_sla") {
      if (v.returnWindowDays === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["returnWindowDays"], message: "Refund window is required" });
      if (v.returnRefundAmount === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["returnRefundAmount"], message: "Refund amount is required" });
      if (!v.returnCurrency) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["returnCurrency"], message: "Currency is required" });
    }
  });

type StudioFormValues = z.infer<typeof studioSchema>;

const Studio = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refresh: refreshUsage } = useUsage();
  const [activeTab, setActiveTab] = useState("preview");

  const form = useForm<StudioFormValues>({
    resolver: zodResolver(studioSchema),
    mode: "onChange",
    defaultValues: {
      template: "invoice",
      subjectId: "",
      expLocal: toDatetimeLocalValue(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
      replayWindowS: 300,
      destinationUrl: "",
      invoiceCurrency: "USD",
      returnCurrency: "USD",
    },
  });

  const template = form.watch("template") as TemplateType;

  const [isIssuing, setIsIssuing] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const qrCodeRef = useRef<QRCodeStyling | null>(null);
  // Synchronous re-entry guard. `isIssuing` (useState) only flips after a
  // re-render, so a fast double-click can fire two requests before the
  // button visibly disables. Refs update immediately and let us bail out
  // synchronously at the very top of the submit handler.
  const issuingRef = useRef(false);

  const createPayload = (v: StudioFormValues): IssueClaimRequest => {
    const facts: Record<string, unknown> = {};
    if (v.destinationUrl?.trim()) facts.url = v.destinationUrl.trim();

    if (v.template === "invoice") {
      facts.issuer = v.invoiceIssuer?.trim();
      facts.invoice_number = v.invoiceNumber?.trim();
      facts.amount = v.invoiceAmount;
      facts.currency = v.invoiceCurrency?.trim() || "USD";
      if (v.invoiceDueDate) facts.due_date = format(v.invoiceDueDate, "yyyy-MM-dd");
      if (v.invoiceDescription?.trim()) facts.description = v.invoiceDescription.trim();
    }

    if (v.template === "package") {
      facts.carrier = v.packageCarrier?.trim();
      facts.tracking_number = v.packageTracking?.trim();
      if (v.packageStatus?.trim()) facts.status = v.packageStatus.trim();
    }

    if (v.template === "return_sla") {
      facts.refund_window_days = v.returnWindowDays;
      facts.refund_amount = v.returnRefundAmount;
      facts.currency = v.returnCurrency?.trim() || "USD";
      if (v.returnNotes?.trim()) facts.notes = v.returnNotes.trim();
    }

    return {
      template: v.template,
      subject: { type: v.template, id: v.subjectId.trim() },
      facts,
      exp: new Date(v.expLocal).toISOString(),
      policy: { replay_window_s: v.replayWindowS },
    };
  };

  useEffect(() => {
    if (!issued?.response.qrPayload) return;
    if (!qrContainerRef.current) return;

    if (!qrCodeRef.current) {
      qrCodeRef.current = new QRCodeStyling({
        width: 260,
        height: 260,
        data: issued.response.qrPayload,
        margin: 8,
      });
      qrContainerRef.current.innerHTML = "";
      qrCodeRef.current.append(qrContainerRef.current);
      return;
    }
    qrCodeRef.current.update({ data: issued.response.qrPayload });
  }, [issued?.response.qrPayload]);

  const canIssue = form.formState.isValid && !isIssuing;

  const onIssue = form.handleSubmit(async (v) => {
    // Synchronous re-entry check. If a second click landed before React
    // re-rendered the button as disabled, swallow it here.
    if (issuingRef.current) return;
    issuingRef.current = true;

    const payload = createPayload(v);

    setIsIssuing(true);
    setIssued(null);
    try {
      const response = await issueClaim(payload);
      setIssued({ request: payload, response });
      setActiveTab("preview");
      toast({ title: "Claim issued", description: "QR payload generated successfully." });
      await refreshUsage();
    } catch (err) {
      if (err instanceof PaymentRequiredError) {
        await refreshUsage();
        if (err.code === "PAYWALL_CLAIMS_EXHAUSTED") {
          setIsPaywallOpen(true);
          return;
        }
        toast({ title: "Payment required", description: err.message || "Upgrade required to issue more claims.", variant: "destructive" });
        return;
      }
      toast({ title: "Issuance failed", description: "Could not issue this claim.", variant: "destructive" });
    } finally {
      setIsIssuing(false);
      issuingRef.current = false;
    }
  });

  const copyQrPayload = async () => {
    const value = issued?.response.qrPayload;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: "QR payload copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard is not available.", variant: "destructive" });
    }
  };

  const downloadQr = async () => {
    if (!qrCodeRef.current || !issued) return;
    try {
      await qrCodeRef.current.download({ name: `mira-${issued.response.jti}`, extension: "png" });
    } catch {
      toast({ title: "Download failed", description: "Could not generate QR image.", variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={isPaywallOpen} onOpenChange={setIsPaywallOpen}>
        <DialogContent className="border-border text-foreground p-0 overflow-hidden" style={{ background: "var(--color-bg-card)" }}>
          {/* Credits exhausted banner inside the modal */}
          <div
            className="w-full px-5 py-2.5 flex items-center gap-2 border-b"
            style={{ background: "rgba(217,80,80,0.08)", borderColor: "rgba(217,80,80,0.2)" }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#D95050" }} />
            <p className="text-sm font-medium" style={{ color: "#D95050" }}>
              You've used all claim credits. Purchase more to issue new claims.
            </p>
          </div>

          <div className="px-6 pt-5 pb-6">
            <DialogHeader>
              <DialogTitle className="text-foreground">All free claims are used</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                To issue new claims, purchase more credits from the pricing page.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-5">
              <Button variant="outline" onClick={() => setIsPaywallOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setIsPaywallOpen(false);
                  navigate("/pricing");
                }}
              >
                Go to Pricing
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-8 h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Studio</h1>
            <p className="text-muted-foreground mt-1">Create signed claims</p>
          </div>

        </div>

        <div className="grid lg:grid-cols-12 gap-8 flex-1 min-h-0">
          {/* Left Panel - Manual Entry */}
          <Card className="flex flex-col border-border h-full overflow-hidden lg:col-span-7">
            <CardHeader className="border-b border-border shrink-0">
              <CardTitle className="text-foreground">Claim Details</CardTitle>

            </CardHeader>

            <CardContent className="flex-1 p-6 min-h-0 overflow-y-auto custom-scrollbar space-y-6">
              <Form {...form}>
                <form id="issue-claim-form" onSubmit={onIssue} className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="template"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Template</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="border-border bg-background text-foreground">
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="border-border text-foreground" style={{ background: "var(--color-bg-card)" }}>
                              <SelectItem value="invoice">invoice</SelectItem>
                              <SelectItem value="package">package</SelectItem>
                              <SelectItem value="return_sla">return_sla</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subjectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Subject ID</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={template === "invoice" ? "Invoice ID" : template === "package" ? "Package ID" : "Order ID"}
                              className="border-border bg-background text-foreground placeholder:text-muted-foreground/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expLocal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Expiry</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="replayWindowS"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Replay window (seconds)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={3600}
                              value={String(field.value ?? 0)}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              className="border-border bg-background text-foreground placeholder:text-muted-foreground/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="destinationUrl"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-2">
                          <FormLabel className="text-foreground">Destination URL (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://example.com/..." className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {template === "invoice" && (
                    <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Invoice fields</h3>
                    <Badge variant="secondary" className="border-border text-muted-foreground" style={{ background: "rgba(255,255,255,0.04)" }}>facts</Badge>
                  </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="invoiceIssuer"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Issuer</FormLabel>
                              <FormControl>
                                <Input {...field} className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="invoiceNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Invoice number</FormLabel>
                              <FormControl>
                                <Input {...field} className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="invoiceAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Amount</FormLabel>
                              <FormControl>
                                <Input
                                  value={field.value === undefined ? "" : String(field.value)}
                                  onChange={field.onChange}
                                  placeholder="4200"
                                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/50"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="invoiceCurrency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Currency</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="USD" className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="invoiceDueDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Due date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-start text-left font-normal border-border bg-background text-foreground",
                                        !field.value && "text-muted-foreground",
                                      )}
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-border text-foreground" style={{ background: "var(--color-bg-card)" }} align="start">
                                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="text-foreground" style={{ background: "var(--color-bg-card)" }} />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="invoiceDescription"
                          render={({ field }) => (
                            <FormItem className="lg:col-span-2">
                              <FormLabel className="text-foreground">Description (optional)</FormLabel>
                              <FormControl>
                                <Textarea {...field} className="min-h-[80px] border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {template === "package" && (
                    <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Package fields</h3>
                    <Badge variant="secondary" className="border-border text-muted-foreground" style={{ background: "rgba(255,255,255,0.04)" }}>facts</Badge>
                  </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="packageCarrier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Carrier</FormLabel>
                              <FormControl>
                                <Input {...field} className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="packageTracking"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Tracking number</FormLabel>
                              <FormControl>
                                <Input {...field} className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="packageStatus"
                          render={({ field }) => (
                            <FormItem className="lg:col-span-2">
                              <FormLabel className="text-foreground">Status (optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="in_transit" className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {template === "return_sla" && (
                    <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Return SLA fields</h3>
                    <Badge variant="secondary" className="border-border text-muted-foreground" style={{ background: "rgba(255,255,255,0.04)" }}>facts</Badge>
                  </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="returnWindowDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Refund window (days)</FormLabel>
                              <FormControl>
                                <Input
                                  value={field.value === undefined ? "" : String(field.value)}
                                  onChange={field.onChange}
                                  placeholder="3"
                                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/50"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="returnRefundAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Refund amount</FormLabel>
                              <FormControl>
                                <Input
                                  value={field.value === undefined ? "" : String(field.value)}
                                  onChange={field.onChange}
                                  placeholder="89.99"
                                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/50"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="returnCurrency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Currency</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="USD" className="border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="returnNotes"
                          render={({ field }) => (
                            <FormItem className="lg:col-span-2">
                              <FormLabel className="text-foreground">Notes (optional)</FormLabel>
                              <FormControl>
                                <Textarea {...field} className="min-h-[80px] border-border bg-background text-foreground placeholder:text-muted-foreground/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>

            <CardFooter className="border-t border-border p-6 shrink-0 block" style={{ background: "rgba(255,255,255,0.02)" }}>
              <Button
                type="submit"
                form="issue-claim-form"
                disabled={!canIssue}
                className="w-full font-semibold hover:opacity-90"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)", borderRadius: 4, border: "none" }}
              >
                {isIssuing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Issuing...
                  </>
                ) : (
                  "Issue claim"
                )}
              </Button>

            </CardFooter>
          </Card>

          {/* Right Panel - Live Preview */}
          <Card className="border-border h-full overflow-hidden flex flex-col lg:col-span-5">
            <CardHeader className="border-b border-border shrink-0">
              <CardTitle className="text-foreground">Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <div className="px-6 pt-6">
                  <TabsList className="grid w-full grid-cols-3 border border-border shrink-0" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <TabsTrigger value="preview" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">QR Preview</TabsTrigger>
                    <TabsTrigger value="claim" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Claim JSON</TabsTrigger>
                    <TabsTrigger value="policy" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Policy</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="preview" className="p-6 space-y-6 flex-1">
                  {issued ? (
                    <>
                      {/* QR Code */}
                      <div className="text-center">
                        <div className="p-6 border-2 border-dashed border-[rgba(181,196,90,0.3)] inline-block" style={{ borderRadius: 3, background: "#F5F4F0" }}>
                          <div ref={qrContainerRef} className="inline-block" />
                          <p className="text-sm mt-3" style={{ color: "var(--color-muted)" }}>Generated QR Code</p>
                        </div>
                      </div>

                      {/* Claim Summary */}
                      <div className="p-6 border border-[rgba(181,196,90,0.2)]" style={{ background: "rgba(181,196,90,0.08)", borderRadius: 3 }}>
                        <div className="flex items-center space-x-2 mb-4">
                          <CheckCircle className="h-6 w-6 text-primary" />
                          <h3 className="font-semibold text-primary">Claim Ready</h3>
                        </div>
                        <div className="space-y-2 text-sm text-foreground/80">
                          <p><strong className="text-primary">Template:</strong> {issued.request.template}</p>
                          <p><strong className="text-primary">Subject:</strong> {issued.request.subject.id}</p>
                          <p><strong className="text-primary">JTI:</strong> {issued.response.jti}</p>
                          <p><strong className="text-primary">Expires:</strong> {new Date(issued.response.exp).toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-3">
                        <Button onClick={() => void copyQrPayload()} className="w-full text-foreground hover:bg-white/10" style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, border: "none" }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy QR Payload
                        </Button>
                        <Button variant="outline" className="w-full border-border hover:bg-white/5 text-foreground bg-transparent" onClick={() => void downloadQr()}>
                          <Download className="h-4 w-4 mr-2" />
                          Download QR Image
                        </Button>
                        <Link to={`/app/verify?token=${encodeURIComponent(issued.response.qrPayload)}`} className="block">
                          <Button variant="outline" className="w-full border-border hover:bg-white/5 text-foreground bg-transparent">
                            Test in Verify
                          </Button>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <QrCode className="h-16 w-16 mx-auto mb-4 text-border" />
                      <p>QR code will appear here</p>
                      <p className="text-sm">Fill the form and issue a claim</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="claim" className="p-6 flex-1">
                  {issued ? (
                    <div className="text-primary p-4 font-mono text-sm overflow-auto max-h-96 border border-border" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                      <pre>{JSON.stringify(issued.request, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Request JSON will appear here</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="policy" className="p-6 flex-1">
                  {issued ? (
                    <div className="text-primary p-4 font-mono text-sm overflow-auto max-h-96 border border-border" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                      <pre>{JSON.stringify(issued.response, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="font-medium mb-2 text-primary">Policy</h4>
                        <p className="text-muted-foreground">Issuance policy is included in the request payload.</p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2 text-primary">Response</h4>
                        <p className="text-muted-foreground">Response JSON (including `qrPayload`) appears after issuance.</p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Studio;
