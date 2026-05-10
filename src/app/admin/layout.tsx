import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { isSuperAdmin, validateSessionToken } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Admin — Tidingz",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("mymun_session")?.value;
  if (!token) redirect("/");

  const actor = await validateSessionToken(token);
  if (!isSuperAdmin(actor)) redirect("/");

  return (
    <>
      <Navbar />
      <div className="app-shell">{children}</div>
      <Footer />
    </>
  );
}
