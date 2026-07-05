import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell/app-shell";
import { AuthScreen } from "@/components/auth/auth-screen";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) return <AuthScreen />;

  return <AppShell />;
}
