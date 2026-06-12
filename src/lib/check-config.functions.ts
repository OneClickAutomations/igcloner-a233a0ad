import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkConfig = createServerFn({ method: "GET" }).handler(async () => {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const apify = process.env.APIFY_TOKEN;
  return {
    ok: true,
    anthropic: {
      present: Boolean(anthropic),
      length: anthropic?.length ?? 0,
      prefix: anthropic ? anthropic.slice(0, 7) : null,
    },
    apify: {
      present: Boolean(apify),
      length: apify?.length ?? 0,
      prefix: apify ? apify.slice(0, 6) : null,
    },
    nodeEnv: process.env.NODE_ENV ?? null,
  };
});

/**
 * Live diagnostic for APIfy. Performs a minimal scrape against a known public
 * Instagram URL (or the one you pass) and returns a safe summary — never the token.
 */
export const checkApifyConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z
          .string()
          .url()
          .optional()
          .default("https://www.instagram.com/p/C5qLgVNoG3o/"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      return {
        ok: false,
        present: false,
        status: 0,
        itemCount: 0,
        sampleOwner: null as string | null,
        error: "APIFY_TOKEN is not configured",
      };
    }

    const started = Date.now();
    try {
      const endpoint = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=60`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [data.url],
          resultsLimit: 1,
          resultsType: "posts",
        }),
      });

      const text = await res.text();
      let items: any[] = [];
      try {
        items = JSON.parse(text);
        if (!Array.isArray(items)) items = [];
      } catch {
        // non-JSON response
      }

      return {
        ok: res.ok && items.length > 0,
        present: true,
        status: res.status,
        itemCount: items.length,
        sampleOwner: items[0]?.ownerUsername ?? null,
        elapsedMs: Date.now() - started,
        error: res.ok ? null : text.slice(0, 300),
      };
    } catch (err: any) {
      return {
        ok: false,
        present: true,
        status: 0,
        itemCount: 0,
        sampleOwner: null,
        elapsedMs: Date.now() - started,
        error: err?.message || "Network error calling APIfy",
      };
    }
  });