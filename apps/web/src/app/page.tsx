import Link from "next/link";

const sections = [
  {
    title: "Users & Access",
    items: [
      { name: "Manage Users", href: "/users", desc: "View, activate, deactivate users and change roles" },
      { name: "Invitations", href: "/invitations", desc: "Create and manage invitation codes" },
    ],
  },
  {
    title: "Features & Billing",
    items: [
      { name: "Feature Matrix", href: "/features", desc: "Define features and assign them to plans per role" },
      { name: "Plans & Pricing", href: "/plans", desc: "Configure subscription plans, pricing, and Stripe products" },
      { name: "Subscriptions", href: "/subscriptions", desc: "View active subscriptions and manage billing" },
    ],
  },
  {
    title: "Engagement",
    items: [
      { name: "Song Curation", href: "/curation", desc: "Manage Tinder-style song curation per station" },
      { name: "Chart Alerts", href: "/charts", desc: "Monitor Shazam, Spotify, Apple Music charts" },
    ],
  },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Admin Portal</h1>
      <div className="grid gap-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors"
                >
                  <h3 className="font-semibold text-white mb-1">{item.name}</h3>
                  <p className="text-sm text-zinc-400">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
