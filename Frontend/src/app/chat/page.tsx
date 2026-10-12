import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Workspace } from "@/features/chat/components/workspace";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const u = session.user;
  return (
    <Workspace
      user={{
        id: u.id ?? u.email ?? "me",
        name: u.name ?? "User",
        email: u.email ?? "",
        image: u.image ?? "",
      }}
    />
  );
}
