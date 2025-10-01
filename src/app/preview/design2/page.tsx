"use client";
import React from "react";

/** Influencer-only preview (single page)  
 * - No blog, no contact form, no palette  
 * - Sage/teal colorway, hero with colored backdrop, services cards,
 *   side-by-side images, stats, progress bars, CTA
 */
const theme = {
  ink: "#163A3A",          // deep teal headings
  primary: "#2A7D76",      // teal
  light: "#8FD0C5",        // light teal accents
  surface: "#EEF5F3",      // pale green background blocks
  border: "#E5E7EB",
};

export default function InfluencerOnly() {
  return (
    <div className="min-h-screen text-[#0F172A] bg-white">
      <Topbar />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-16">
        <Hero />
        <LogosRow />
        <Services />
        <SideBySide />
        <StatsBar />
        <Progress />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Topbar() {
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-neutral-200">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: theme.ink }}>
            <div className="w-4 h-4 rounded-sm" style={{ background: theme.light }} />
          </div>
          <div className="font-semibold">Hygiene<span style={{ color: theme.primary }}>Plus</span></div>
        </div>
        <nav className="hidden md:flex gap-6 text-sm text-neutral-700">
          <a href="#services" className="hover:underline">Υπηρεσίες</a>
          <a href="#about" className="hover:underline">Ποιοι είμαστε</a>
        </nav>
        <a className="px-4 py-2 rounded-full text-white" style={{ background: theme.primary }} href="#cta">Ζητήστε προσφορά</a>
      </div>
    </header>
  );
}

function SectionTitle({k, s}:{k:string; s?:string}) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold" style={{ color: theme.ink }}>{k}</h2>
      {s && <p className="text-neutral-600 text-sm max-w-prose">{s}</p>}
    </div>
  );
}

/* --- Hero --- */
function Hero() {
  return (
    <section className="rounded-3xl overflow-hidden border border-neutral-200" style={{ background: theme.surface }}>
      <div className="mx-auto max-w-6xl px-6 py-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="mt-1 text-4xl md:text-5xl font-semibold leading-tight" style={{ color: theme.ink }}>
            Power your <span style={{ color: theme.primary }}>Marketing</span>
          </h1>
          <p className="mt-4 text-neutral-700 max-w-prose">
            Minimal, φιλικό design με πράσινους τόνους — για υπηρεσίες υγιεινής, HACCP & ISO 22000.
          </p>
          <div className="mt-6 flex gap-3">
            <a className="px-5 py-3 rounded-full text-white" style={{ background: theme.primary }} href="#services">Δείτε υπηρεσίες</a>
            <a className="px-5 py-3 rounded-full border border-neutral-200 bg-white" href="#cta">Δείτε δείγματα</a>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-6 bg-white">
          <div className="aspect-video rounded-xl border border-neutral-200 grid place-items-center text-neutral-500">Εικόνα / Mockup</div>
        </div>
      </div>
    </section>
  );
}

/* --- Logos --- */
function LogosRow() {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="h-12 rounded-xl border border-neutral-200 grid place-items-center text-neutral-400">Λογότυπο {i}</div>
      ))}
    </section>
  );
}

/* --- Services cards --- */
function Card({title, text}:{title:string;text:string}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-6 bg-white">
      <div className="w-10 h-10 rounded-lg grid place-items-center mb-3" style={{ background: theme.light }}>
        <div className="w-4 h-4 rounded-sm" style={{ background: theme.primary }} />
      </div>
      <div className="font-medium" style={{ color: theme.ink }}>{title}</div>
      <p className="text-sm text-neutral-600 mt-1">{text}</p>
      <a className="inline-block mt-3 text-sm underline" href="#cta">Μάθετε περισσότερα</a>
    </div>
  );
}

function Services() {
  return (
    <section id="services">
      <SectionTitle k="Τι προσφέρουμε" s="Περιεχόμενο, αναλύσεις και ενημερώσεις — πάντα με εστίαση στη συμμόρφωση." />
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Ιδέες & Υλικό" text="Έγγραφα, checklists και templates για HACCP/ISO." />
        <Card title="Αναλύσεις" text="Μετρήσιμα KPIs συμμόρφωσης και προόδου." />
        <Card title="Επικοινωνία" text="Ενημερώσεις, υπενθυμίσεις, εκπαιδευτικό περιεχόμενο." />
      </div>
    </section>
  );
}

/* --- Side by side --- */
function SideBySide() {
  return (
    <section className="grid md:grid-cols-2 gap-6 items-center" id="about">
      <div className="grid grid-cols-2 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-40 rounded-xl border border-neutral-200" style={{ background: theme.surface }} />
        ))}
      </div>
      <div>
        <SectionTitle k="Αναβαθμίστε την εικόνα σας" />
        <p className="text-neutral-600 text-sm mt-2">
          Ειλικρινής, αυθεντική παρουσίαση υπηρεσιών. Φωτογραφίες, χρώματα και στοιχεία UI που εμπνέουν καθαρότητα.
        </p>
        <ul className="mt-3 text-sm text-neutral-700 space-y-1 list-disc pl-5">
          <li>Καθαρή τυπογραφία, άνετα κενά</li>
          <li>Σταθερή παλέτα πρασίνων/teal</li>
          <li>Κάρτες με απαλές σκιές</li>
        </ul>
      </div>
    </section>
  );
}

/* --- Big stats --- */
function StatBox({v, label}:{v:string; label:string}) {
  return (
    <div className="rounded-2xl p-6 border border-neutral-200" style={{ background: theme.surface }}>
      <div className="text-2xl font-semibold" style={{ color: theme.ink }}>{v}</div>
      <div className="text-sm text-neutral-600">{label}</div>
    </div>
  );
}

function StatsBar() {
  return (
    <section className="grid sm:grid-cols-3 gap-4">
      <StatBox v="6.3M" label="Προβολές περιεχομένου" />
      <StatBox v="5M+" label="Ενημερώσεις/Emails" />
      <StatBox v="5.5M+" label="Εντυπώσεις Brand" />
    </section>
  );
}

/* --- Progress bars --- */
function Progress() {
  const bars = [
    { t: "Επιτυχημένες επιθεωρήσεις", v: 90 },
    { t: "Σχέδια / Έργα", v: 85 },
    { t: "Brand Awareness", v: 90 },
  ];
  return (
    <section className="grid md:grid-cols-2 gap-8 items-center">
      <div>
        <SectionTitle k="Συνδυασμός δημιουργικότητας & στρατηγικής" />
        <p className="text-neutral-600 text-sm mt-2">Επιγραμματικά μετρήσιμα αποτελέσματα από projects και εκπαιδεύσεις.</p>
      </div>
      <div className="space-y-4">
        {bars.map(b => (
          <div key={b.t}>
            <div className="text-sm mb-1">{b.t}</div>
            <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${b.v}%`, background: theme.primary }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- CTA --- */
function CTA() {
  return (
    <section id="cta" className="rounded-2xl p-6 border border-neutral-200 text-center" style={{ background: theme.surface }}>
      <h3 className="text-xl font-semibold" style={{ color: theme.ink }}>Έτοιμοι να ξεκινήσουμε;</h3>
      <p className="text-neutral-600 text-sm mt-1">Κλείστε μια δωρεάν κλήση 15’ για αξιολόγηση αναγκών.</p>
      <a className="inline-block mt-4 px-5 py-3 rounded-full text-white" style={{ background: theme.primary }} href="#">Κλείστε ραντεβού</a>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16">
      <div className="border-t border-neutral-200 py-8 text-sm text-neutral-600 text-center">
        © {new Date().getFullYear()} HygienePlus — Preview (Influencer Style)
      </div>
    </footer>
  );
}
