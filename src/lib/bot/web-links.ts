const DEFAULT_APP_URL = "http://localhost:3000";

/**
 * Get the web links block for the system prompt.
 * These links allow the AI to naturally include web URLs in responses.
 */
export function getWebLinksBlock(appUrl?: string): string {
  const url = appUrl || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;

  return `WEB LINKS (include when relevant):
- Food details: ${url}/food/{foodId}
- Your settings: ${url}/settings
- Daily log: ${url}/log
- Dashboard: ${url}/dashboard`;
}
