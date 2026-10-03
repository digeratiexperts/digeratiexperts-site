import { Link } from "wouter";
import { Shield, Users, KeyRound, MapPin, ClipboardCheck } from "lucide-react";

const items = [
  {
    icon: Shield,
    title: "Security-first by design",
    body: "IT and cybersecurity run as one operating model — not bolted-on afterthoughts.",
  },
  {
    icon: Users,
    title: "Fully managed or co-managed",
    body: "Engage as your outsourced IT/security team, or extend the team you already have.",
  },
  {
    icon: KeyRound,
    title: "Client-owned access",
    body: "You keep ownership of credentials, tenants, and licenses.",
    href: "/about/client-bill-of-rights",
    linkLabel: "Client Bill of Rights",
  },
  {
    icon: ClipboardCheck,
    title: "Assessment-led recommendations",
    body: "We prioritize what matters in your environment before asking you to buy a stack.",
  },
  {
    icon: MapPin,
    title: "Arizona-based · principal-led",
    body: "Local accountability with clear reporting — not a faceless ticket farm.",
  },
];

export function HomepageTrustRail() {
  return (
    <section id="trust-rail" className="py-12 lg:py-16 bg-[#0a0a0a] border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-300/90 mb-3">
          Why Digerati Experts is different
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 max-w-2xl">
          Credible managed IT and cybersecurity — without the lock-in theater
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <item.icon className="h-5 w-5 text-violet-300 mb-3" aria-hidden />
              <h3 className="text-white font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-white/65 leading-relaxed">{item.body}</p>
              {item.href && (
                <Link
                  href={item.href}
                  className="inline-block mt-3 text-sm text-pink-300 hover:text-pink-200 underline underline-offset-4"
                >
                  {item.linkLabel}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
