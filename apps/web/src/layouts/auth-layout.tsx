import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-primary/5 to-background flex-col items-center justify-center p-12 border-r border-border">
        <div className="max-w-md text-center">
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-3xl font-bold text-foreground">SparQPlug</span>
          </div>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Your business. Fully connected.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            {[
              { label: 'CRM', desc: 'Manage contacts & pipeline' },
              { label: 'Analytics', desc: 'Cloudflare traffic insights' },
              { label: 'Billing', desc: 'Stripe invoicing & subs' },
              { label: 'Documents', desc: 'File management & sharing' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                <p className="font-semibold text-foreground text-sm">{item.label}</p>
                <p className="text-muted-foreground text-xs mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth form */}
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-2xl font-bold text-foreground">SparQPlug</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
