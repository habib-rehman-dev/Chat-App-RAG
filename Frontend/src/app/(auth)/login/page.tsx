import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthCard } from "@/features/auth/components/auth-card";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/chat");

  return <AuthCard mode="login" />;
}
