import { cookies } from "next/headers";
import { auth } from "@/auth";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const jar = await cookies();
  const token =
    jar.get("__Secure-authjs.session-token")?.value ?? jar.get("authjs.session-token")?.value;
  if (!token) {
    return Response.json({ detail: "Missing session token" }, { status: 401 });
  }

  // Body from the frontend: { id, messages, trigger, chatId, documentIds }
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body,
      signal: req.signal,
    });
  } catch {
    return Response.json({ detail: "Backend is unreachable" }, { status: 502 });
  }

  // Surface upstream failures as real errors instead of an empty stream.
  if (!upstream.ok || !upstream.body) {
    const detail = (await upstream.text().catch(() => "")) || "Upstream error";
    return Response.json({ detail }, { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}
