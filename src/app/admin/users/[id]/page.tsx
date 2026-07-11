import Link from "next/link";

import { AdminUserForm } from "@/components/admin/AdminUserForm";
import { Card, CardContent } from "@/components/ui/card";
import { getCountries, getDevStore, getUserById } from "@/lib/dev-store";
import { getPortalUiSession } from "@/lib/security/ui-session";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalUiSession();
  if (!session) return null;
  const { id } = await params;
  const user = getUserById(id);
  if (!user) {
    return (
      <Card><CardContent className="grid gap-3 pt-5">
        <p className="text-sm text-[var(--muted)]">No such user.</p>
        <Link href="/admin/users" className="text-sm font-semibold text-[var(--brand)]">← Back to users</Link>
      </CardContent></Card>
    );
  }
  const resellers = getDevStore().resellerRecords.map((r) => r.name);
  const countries = getCountries().filter((c) => c.active).map((c) => c.name);
  return <AdminUserForm resellers={resellers} countries={countries} initial={{ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, countries: [...user.countries], reseller: user.reseller }} />;
}
