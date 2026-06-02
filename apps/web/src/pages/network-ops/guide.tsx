import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-sky-900/60 bg-slate-950/55 p-5">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-[3px] text-cyan-300">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NetworkOpsGuidePage() {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_20%_0%,#0b2f52_0%,#091724_45%,#050a12_100%)] px-6 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-2xl border border-cyan-900/60 bg-slate-950/55 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Network Ops Guide</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-100">VPN + Pi-hole Basics</h1>
              <p className="mt-2 text-sm text-slate-300">Use this to onboard devices, verify behavior, and keep your setup secure.</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-cyan-200" />
          </div>
          <Link to="/network-ops" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-200 hover:text-cyan-100">
            <ArrowLeft className="h-4 w-4" />
            Back to Network Ops
          </Link>
        </header>

        <Section
          title="Current live setup"
          items={[
            'VPN endpoint: vpn.alphazonelabs.com:51820',
            'Pi-hole admin domain (LAN/VPN): adblock.alphazonelabs.com',
            'Pi-hole server IP: 10.0.0.106',
            'WireGuard subnet: 10.44.0.0/24',
          ]}
        />

        <Section
          title="Access basics"
          items={[
            'At home: set DNS to 10.0.0.106 and open adblock.alphazonelabs.com/admin.',
            'Away from home: connect WireGuard first, then open the same Pi-hole URL.',
            'In WireGuard profiles: endpoint should be vpn.alphazonelabs.com:51820 and DNS should be 10.44.0.1.',
            'Disable DNS-bypass features (Private Relay, strict browser DoH) on devices that should be filtered.',
          ]}
        />

        <Section
          title="Performance habits"
          items={[
            'Use Pi-hole as the only resolver on clients; avoid fallback public DNS.',
            'Keep split-tunnel unless full-tunnel is intentionally required.',
            'Update gravity lists regularly (already automated in your server setup).',
            'Use temporary pause controls for troubleshooting instead of disabling filtering permanently.',
          ]}
        />

        <Section
          title="Remote validation checks"
          items={[
            'Run Remote Tests from Network Ops to validate DNS, reachability, and exposure guardrails.',
            'Check Pi-hole reachability and summary API from your current network path.',
            'Review backend-side checks for public DNS visibility and accidental Pi-hole exposure.',
            'Use public IP result to confirm expected network egress when switching VPN on/off.',
          ]}
        />

        <Section
          title="Security guardrails"
          items={[
            'Keep Pi-hole admin private to LAN/VPN only.',
            'Keep WireGuard DNS record as DNS-only (not proxied).',
            'Rotate API tokens/passwords when sharing admin access.',
            'Treat any public Pi-hole reachability warning as high priority to fix.',
          ]}
        />
      </div>
    </div>
  );
}
