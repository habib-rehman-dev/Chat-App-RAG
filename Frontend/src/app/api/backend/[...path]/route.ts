import { cookies } from "next/headers";
import { auth } from "@/auth";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ detail: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  const token =
    jar.get("__Secure-authjs.session-token")?.value ?? jar.get("authjs.session-token")?.value;
  if (!token) return Response.json({ detail: "Missing session token" }, { status: 401 });

  const { path } = await params;
  const { search } = new URL(req.url);
  const hasBody = !["GET", "HEAD"].includes(req.method);

  const upstream = await fetch(`${backendUrl}/${path.join("/")}${search}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { "Content-Type": req.headers.get("content-type") ?? "application/json" } : {}),
    },
    body: hasBody ? await req.text() : undefined,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) return Response.json({ detail: "Backend is unreachable" }, { status: 502 });

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export { proxy as GET, proxy as POST, proxy as DELETE };