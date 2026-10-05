import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Normalizes any external URL input into a safe, fully-qualified external URL (with https://).
 * Prevents relative URL navigation bugs (e.g. `srcjdcoem.in/www.example.com/...`).
 */
export function formatExternalUrl(input?: string | null): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();
  if (
    !trimmed ||
    trimmed === "undefined" ||
    trimmed === "null" ||
    trimmed === "-" ||
    trimmed === "none"
  ) {
    return "";
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/**
 * Normalizes any LinkedIn profile input (URL, username, missing protocol, in/ handle)
 * into a safe, fully-qualified external HTTPS LinkedIn URL.
 * Prevents relative URL navigation bugs (e.g. `srcjdcoem.in/www.linkedin.com/in/username`).
 */
export function formatLinkedinUrl(input?: string | null): string {
  if (!input || typeof input !== "string") return "";
  let trimmed = input.trim();
  if (
    !trimmed ||
    trimmed === "undefined" ||
    trimmed === "null" ||
    trimmed === "-" ||
    trimmed === "none"
  ) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (/^(www\.)?linkedin\.com/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }

  if (/^\/?in\//i.test(trimmed)) {
    const cleanPath = trimmed.replace(/^\/?in\//i, "");
    return `https://www.linkedin.com/in/${cleanPath}`;
  }

  const strippedAt = trimmed.replace(/^@/, "");
  if (!strippedAt.includes("/") && !strippedAt.includes(".")) {
    return `https://www.linkedin.com/in/${strippedAt}`;
  }

  return `https://${trimmed.replace(/^\/+/, "")}`;
}
