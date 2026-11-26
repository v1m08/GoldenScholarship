import "server-only";

export const markdown = (body: string) =>
  new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" } });
