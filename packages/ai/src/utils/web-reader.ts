import { compile } from 'html-to-text';
import { safeParse, v } from '@grasp/domain';
import { env } from '../env';

/**
 * Extracts and cleans text content from a given web URL.
 * Uses a multi-layer strategy:
 * 1. Standard Fetch (works for sites without WAF protections)
 * 2. Cloudflare Browser Run Quick Actions API (works for JS-challenged WAFs, if configured)
 */
export async function extractWebpageContent(url: string): Promise<string> {
  let targetUrl = url;
  if (targetUrl.startsWith('https://r.jina.ai/')) {
    targetUrl = targetUrl.replace('https://r.jina.ai/', '');
  }

  const { createClient } = await import('node-wreq');
  const client = createClient({ browser: 'chrome_137' });
  const response = await client.get(targetUrl);

  if (response.ok) {
    const html = await response.text();
    const convert = compile({ wordwrap: 130 });
    const text = convert(html);

    // WAF & SPA detection heuristics
    const isTooShort = text.trim().length < 50;
    const isWafChallenge =
      text.includes('Just a moment...') ||
      text.includes('Enable JavaScript and cookies to continue') ||
      text.includes('DDoS protection by Cloudflare');

    if (!isTooShort && !isWafChallenge) {
      return text;
    }
    // If it's too short or a WAF challenge, fall through to Layer 2
  }

  // LAYER 2: Cloudflare Browser Run Quick Actions API (Markdown Extraction)
  const cfAccountId = env.CLOUDFLARE_ACCOUNT_ID;
  const cfApiToken = env.CLOUDFLARE_API_TOKEN;

  if (cfAccountId && cfApiToken) {
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/browser-rendering/markdown`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfApiToken}`,
        },
        body: JSON.stringify({
          url: targetUrl,
          gotoOptions: { waitUntil: 'networkidle2' },
        }),
      }
    );

    if (cfResponse.ok) {
      const CloudflareResponseSchema = v.object({
        success: v.boolean(),
        result: v.optional(v.string()),
        errors: v.optional(v.array(v.unknown())),
      });

      const cfDataRaw = await cfResponse.json();
      const parsed = safeParse(CloudflareResponseSchema, cfDataRaw);

      if (parsed.success && parsed.output.success && parsed.output.result) {
        return parsed.output.result;
      } else {
        const errors = parsed.success ? parsed.output.errors : parsed.issues;
        throw new Error(`Failed to extract markdown via Browser Run: ${JSON.stringify(errors)}`);
      }
    } else {
      throw new Error(`Cloudflare Browser Run failed with status ${cfResponse.status}`);
    }
  }

  throw new Error(
    `Failed to fetch URL: ${response.status} ${response.statusText}. Please configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env to bypass WAF protections.`
  );
}
