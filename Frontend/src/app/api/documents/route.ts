import { cookies } from "next/headers";
import { auth } from "@/auth";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

async function getToken() {
  const jar = await cookies();
  return (
    jar.get("__Secure-authjs.session-token")?.value ??
    jar.get("authjs.session-token")?.value ??
    null
  );
}

// POST /api/documents  →  FastAPI /api/documents/upload
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken();
  if (!token) {
    return Response.json({ detail: "Missing session token" }, { status: 401 });
  }

  // Forward the multipart body as-is. Do NOT parse it — multipart boundaries
  // break if you read it as JSON or rebuild it.
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ detail: "No file provided" }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("file", file, file.name);

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/documents/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: upstreamForm,
      signal: req.signal,
    });
  } catch {
    return Response.json({ detail: "Backend is unreachable" }, { status: 502 });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

// GET /api/documents  →  FastAPI /api/documents
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken();
  if (!token) {
    return Response.json({ detail: "Missing session token" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/documents/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return Response.json({ detail: "Backend is unreachable" }, { status: 502 });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}