import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--app-bg)] px-4 py-10 text-slate-950 dark:text-slate-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Portal login</CardTitle>
          <CardDescription>This deployment requires an authenticated portal session supplied by the identity gateway.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Contact your administrator if your session has expired or your account has not been assigned to this organization.
        </CardContent>
      </Card>
    </main>
  );
}
