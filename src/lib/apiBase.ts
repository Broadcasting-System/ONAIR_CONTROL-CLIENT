export function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
  return base.endsWith("/api") ? base : `${base}/api`;
}
