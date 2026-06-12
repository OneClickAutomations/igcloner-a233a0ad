import { createServerFn } from "@tanstack/react-start";

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
    },
    nodeEnv: process.env.NODE_ENV ?? null,
  };
});