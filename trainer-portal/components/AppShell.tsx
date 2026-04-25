import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function AppShell({
  variant,
  children,
}: {
  variant: "trainer" | "client";
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user!.id)
    .single();

  const links =
    variant === "trainer"
      ? [{ href: "/trainer", label: "Clients" }]
      : [
          { href: "/portal/macros", label: "Macros" },
          { href: "/portal/journal", label: "Food Journal" },
          { href: "/portal/bodyfat", label: "Body Fat" },
        ];

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link href="/" className="font-semibold text-emerald-700">
            Trainer Portal
          </Link>
          <nav className="flex gap-2 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="px-3 py-1.5 rounded-md hover:bg-gray-100">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-gray-600 hidden sm:inline">
              {profile?.full_name || profile?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
