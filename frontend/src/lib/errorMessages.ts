import axios from "axios";

export interface ErrorSuggestion {
  message: string;
  action?: { label: string; href: string };
}

// HTTP status → suggestion
const byStatus: Record<number, ErrorSuggestion> = {
  401: {
    message: "Your session has expired. Please sign in again.",
    action: { label: "Sign in", href: "/login" },
  },
  402: {
    message: "You've run out of credits.",
    action: { label: "Add Credits", href: "/pricing" },
  },
  403: {
    message: "You don't have permission to perform this action.",
  },
  404: {
    message: "The resource you're looking for doesn't exist.",
  },
  409: {
    message: "This conflicts with existing data. Try refreshing the page.",
  },
  422: {
    message: "Some submitted data is invalid. Check your inputs and try again.",
  },
  429: {
    message: "Too many requests. Wait a moment and try again.",
  },
  500: {
    message: "Something went wrong on our end. We've been notified.",
  },
  503: {
    message: "The server is temporarily unavailable. Please try again shortly.",
  },
};

// Domain error code → suggestion
const byCode: Record<string, ErrorSuggestion> = {
  INSUFFICIENT_CREDITS: {
    message: "You need more credits to issue QR codes.",
    action: { label: "Add Credits", href: "/pricing" },
  },
  QR_LIMIT_REACHED: {
    message: "You've reached your QR code limit. Upgrade to issue more.",
    action: { label: "View Plans", href: "/pricing" },
  },
  NETWORK_ERROR: {
    message: "Can't reach the server. Check your internet connection.",
  },
};

/**
 * Given any thrown value, returns a human-readable suggestion with an
 * optional CTA link. Returns null if no suggestion is mapped.
 */
export function getErrorSuggestion(error: unknown): ErrorSuggestion | null {
  if (axios.isAxiosError(error)) {
    const code = error.response?.data?.code as string | undefined;
    const status = error.response?.status;
    if (code && byCode[code]) return byCode[code];
    if (status && byStatus[status]) return byStatus[status];
    if (!error.response) return byCode.NETWORK_ERROR;
  }
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("network")
  ) {
    return byCode.NETWORK_ERROR;
  }
  return null;
}
