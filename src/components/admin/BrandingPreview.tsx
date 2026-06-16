import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface BrandPreviewProps {
  platformName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  loginTagline: string;
  footer: string;
}

function Logo({ name, logoUrl, color }: { name: string; logoUrl: string; color: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- user-supplied external logo URL; next/image needs configured domains
  if (logoUrl) return <img src={logoUrl} alt="" className="h-5 w-auto max-w-[90px] object-contain" />;
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "LP";
  return <span className="inline-flex size-5 items-center justify-center rounded text-[9px] font-bold text-white" style={{ backgroundColor: color }}>{initials}</span>;
}

/** §30 live preview — login, dashboard, invoice, reseller portal — driven by brand props. */
export function BrandingPreview(props: BrandPreviewProps) {
  const { platformName, logoUrl, primaryColor, secondaryColor, loginTagline, footer } = props;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Live preview</CardTitle></CardHeader>
      <CardContent className="grid gap-4 pt-1 lg:grid-cols-2">
        {/* Login */}
        <figure className="overflow-hidden rounded-xl border border-[var(--border)]">
          <figcaption className="border-b border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Login page</figcaption>
          <div className="grid place-items-center gap-2 p-5" style={{ background: `linear-gradient(135deg, ${primaryColor}22, ${secondaryColor}22)` }}>
            <Logo name={platformName} logoUrl={logoUrl} color={primaryColor} />
            <p className="text-sm font-bold">{platformName}</p>
            <p className="text-center text-[11px] text-[var(--muted)]">{loginTagline}</p>
            <span className="mt-1 rounded-md px-4 py-1.5 text-[11px] font-semibold text-white" style={{ backgroundColor: primaryColor }}>Sign in</span>
          </div>
        </figure>

        {/* Dashboard */}
        <figure className="overflow-hidden rounded-xl border border-[var(--border)]">
          <figcaption className="border-b border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Dashboard</figcaption>
          <div className="flex">
            <div className="flex w-1/4 flex-col gap-1 p-2" style={{ backgroundColor: primaryColor }}>
              <Logo name={platformName} logoUrl={logoUrl} color={secondaryColor} />
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-full rounded-full bg-white/40" />)}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-1.5 p-2.5">
              {[primaryColor, secondaryColor, secondaryColor, primaryColor].map((c, i) => (
                <div key={i} className="rounded-md border border-[var(--border)] p-1.5">
                  <span className="block h-1 w-8 rounded-full" style={{ backgroundColor: c }} />
                  <span className="mt-1 block text-[11px] font-bold">1,2{i}0</span>
                </div>
              ))}
            </div>
          </div>
        </figure>

        {/* Invoice */}
        <figure className="overflow-hidden rounded-xl border border-[var(--border)]">
          <figcaption className="border-b border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Invoice</figcaption>
          <div className="p-3 text-[11px]">
            <div className="flex items-center justify-between border-b-2 pb-1.5" style={{ borderColor: primaryColor }}>
              <Logo name={platformName} logoUrl={logoUrl} color={primaryColor} />
              <span className="font-bold" style={{ color: primaryColor }}>INVOICE</span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span>$1,200</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span style={{ color: secondaryColor }}>$1,200</span></div>
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted)]">{footer}</p>
          </div>
        </figure>

        {/* Reseller portal */}
        <figure className="overflow-hidden rounded-xl border border-[var(--border)]">
          <figcaption className="border-b border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Reseller portal</figcaption>
          <div>
            <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: secondaryColor }}>
              <Logo name={platformName} logoUrl={logoUrl} color={primaryColor} />
              <span className="text-[11px] font-bold text-white">{platformName}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-2.5 text-center text-[10px]">
              {["Leads", "Customers", "Revenue"].map((l) => (
                <div key={l} className="rounded-md border border-[var(--border)] p-1.5">
                  <span className="block font-bold" style={{ color: primaryColor }}>42</span>
                  <span className="text-[var(--muted)]">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </figure>
      </CardContent>
    </Card>
  );
}
