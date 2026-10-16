import { cookies } from "next/headers";
import { auth } from "@/auth";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const jar = await cookies();
  const token =
    jar.get("__Secure-authjs.session-token")?.value ??
    jar.get("authjs.session-token")?.value;
  if (!token) {
    return Response.json({ detail: "Missing session token" }, { status: 401 });
  }

  const { id } = await params;

const upstream = await fetch(
  `${backendUrl}/api/documents/${encodeURIComponent(id)}`,
  { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
);

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}