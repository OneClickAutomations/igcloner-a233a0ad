import { createFileRoute } from "@tanstack/react-router";

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
        const upstream = await fetch(target.toString(), {
          headers: {
            Referer: "https://www.instagram.com/",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          },
        });
        if (!upstream.ok || !upstream.body) {
          return new Response(`upstream ${upstream.status}`, { status: 502 });
        }
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      },
    },
  },
});