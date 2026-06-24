import { createFileRoute } from "@tanstack/react-router";

// 1x1 transparent PNG returned when upstream fails so <img> tags don't break the UI.
const FALLBACK_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  ),
  (c) => c.charCodeAt(0),
);

function fallbackResponse(reason: string) {
  return new Response(FALLBACK_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
      "X-Proxy-Fallback": reason,
    },
  });
}

export const Route = createFileRoute("/api/public/img")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams.get("u");
        if (!u) return new Response("missing u", { status: 400 });
        let target: URL;
        try {
          target = new URL(u);
        } catch {
          return new Response("bad url", { status: 400 });
        }
        // Only allow Instagram / Facebook CDN hosts
        if (!/(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i.test(target.hostname)) {
          return new Response("host not allowed", { status: 403 });
        }
        try {
          const upstream = await fetch(target.toString(), {
            headers: {
              Referer: "https://www.instagram.com/",
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
            },
          });
          if (!upstream.ok || !upstream.body) {
            console.warn(`[img-proxy] upstream ${upstream.status} for ${target.hostname}`);
            return fallbackResponse(`upstream-${upstream.status}`);
          }
          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
              "Cache-Control": "public, max-age=86400, immutable",
            },
          });
        } catch (err) {
          console.error("[img-proxy] fetch failed", err);
          return fallbackResponse("fetch-failed");
        }
      },
    },
  },
});