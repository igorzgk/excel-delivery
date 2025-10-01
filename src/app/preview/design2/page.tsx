"use client";
import React from "react";

/** Influencer-style palette (sage/teal) */
const theme = {
  ink: "#163A3A",           // deep teal for headings
  primary: "#2A7D76",       // teal
  primaryLight: "#8FD0C5",  // light teal
  surface: "#EEF5F3",       // pale green sections
  border: "#E5E7EB",
  text: "#0F172A",
};

export default function InfluencerPreview() {
  return (
    <div className="min-h-screen text-[#0F172A]" style={{ backgroundColor: "#ffffff" }}>
      <Topbar />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-16">
        <Hero />
        <LogosRow />
        <Services />
        <SideBySide />
        <StatsBar />
        <Benefits />
        <Progress />
        <CTA />
        <Blog />
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
            <div className="w-4 h-4 rounded-sm" style={{ background: theme.primaryLight }} />
          </div>
          <div className="font-semibold">Hygiene<span style={{color: theme.primary}}>Plus</span></div>
        </div>
        <nav className="hidden md:flex gap-6 text-sm text-neutral-700">
          <a href="#services" className="hover:underline">Υπηρεσίες</a>
          <a href="#about" className="hover:underline">Ποιοι είμαστε</a>
          <a href="#blog" className="hover:underline">Άρθρα</a>
          <a href="#contact" className="hover:underline">Επικοινωνία</a>
        </nav>
        <a className="px-4 py-2 rounded-full text-white" style={{ background: theme.primary }} href="#contact">Ζητήστε προσφορά</a>
      </div>
    </header>
  );
}

function SectionTitle({k, s}:{k:string; s?:string}) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold" style={{color: theme.ink}}>{k}</h2>
      {s && <p className="text-neutral-600 text-sm max-w-prose">{s}</p>}
    </div>
  );
}

/* --- Hero --- */
function Hero() {
  return (
    <section className="grid md:grid-cols-2 gap-10 items-center">
      <div>
        <div className="inline-block px-3 py-1 text-xs rounded-full" style={{ background: theme.surface, color: theme.primary }}>
          Νέο στυλ — Influencer
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold leading-tight">
          Ανεβάστε το <span style={{color: theme.primary}}>brand</span> σας με
          σύγχρονη παρουσία και καθαρό μήνυμα
        </h1>
        <p className="mt-4 text-neutral-600">
          Minimal, φιλικό design με πράσινους τόνους, για υπηρεσίες υγιεινής, HACCP & ISO 22000.
        </p>
        <div className="mt-6 flex gap-3">
          <a className="px-5 py-3 rounded-full text-white" style={{ background: theme.primary }} href="#services">Δείτε υπηρεσίες</a>
          <a className="px-5 py-3 rounded-full border border-neutral-200" href="#contact">Επικοινωνία</a>
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-200 p-6" style={{ background: theme.surface }}>
        <div className="aspect-video rounded-xl border border-neutral-200 grid place-items-center text-neutral-500">
          Εικόνα ή mockup
        </div>
      </div>
    </section>
  );
}

/* --- Logos --- */
function LogosRow() {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="h-12 rounded-xl border border-neutral-200 grid place-items-center text-neutral-400">Λογότυπο {i}</div>
      ))}
    </section>
  );
}

/* --- Services cards --- */
function Card({title, text}:{title:string;text:string}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-6 bg-white">
      <div className="w-10 h-10 rounded-lg grid place-items-center mb-3" style={{ background: theme.primaryLight }}>
        <div className="w-4 h-4 rounded-sm" style={{ background: theme.primary }} />
      </div>
      <div className="font-medium">{title}</div>
      <p className="text-sm text-neutral-600 mt-1">{text}</p>
      <a className="inline-block mt-3 text-sm underline" href="#contact">Μάθετε περισσότερα</a>
    </div>
  );
}

function Services() {
  return (
    <section id="services">
      <SectionTitle k="Τι προσφέρουμε" s="Περιεχόμενο, ανάλυση, ενημέρωση και προώθηση — πάντα με εστίαση στην ασφάλεια τροφίμων." />
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
    <section className="grid md:grid-cols-2 gap-6 items-center">
      <div className="grid grid-cols-2 gap-4">
        <div className="h-40 rounded-xl border border-neutral-200" style={{ background: theme.surface }} />
        <div className="h-40 rounded-xl border border-neutral-200" style={{ background: theme.surface }} />
        <div className="h-40 rounded-xl border border-neutral-200" style={{ background: theme.surface }} />
        <div className="h-40 rounded-xl border border-neutral-200" style={{ background: theme.surface }} />
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

/* --- Benefits grid --- */
function Benefits() {
  return (
    <section>
      <SectionTitle k="Τα οφέλη" s="Συνδυασμός αυθεντικότητας και συνέπειας." />
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {["Direct ενημέρωση", "Υγιεινή & Ασφάλεια", "Συνέπεια", "Εμπιστοσύνη"].map((t) => (
          <div key={t} className="rounded-2xl border border-neutral-200 p-6 bg-white">
            <div className="font-medium">{t}</div>
            <p className="text-sm text-neutral-600 mt-1">Σύντομη περιγραφή πλεονεκτήματος.</p>
            <a className="text-sm underline mt-2 inline-block" href="#contact">Μάθετε περισσότερα</a>
          </div>
        ))}
      </div>
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
    <section className="rounded-2xl p-6 border border-neutral-200 text-center" style={{ background: theme.surface }}>
      <h3 className="text-xl font-semibold" style={{ color: theme.ink }}>Έτοιμοι να ξεκινήσουμε;</h3>
      <p className="text-neutral-600 text-sm mt-1">Κλείστε μια δωρεάν κλήση 15’ για αξιολόγηση αναγκών.</p>
      <a className="inline-block mt-4 px-5 py-3 rounded-full text-white" style={{ background: theme.primary }} href="#contact">Κλείστε ραντεβού</a>
    </section>
  );
}

/* --- Blog cards --- */
function Blog() {
  const items = [
    { t: "Με το Hygiene Plus", d: "2 μέρες • 20 Μαΐ 2025" },
    { t: "Επιτυχημένη πορεία", d: "3 μέρες • 29 Μαΐ 2025" },
    { t: "Σταδιοδρομία", d: "5 μέρες • 25 Μαΐ 2025" },
  ];
  return (
    <section id="blog">
      <SectionTitle k="Άρθρα & Νέα" s="Μικρά παραδείγματα θεμάτων." />
      <div className="mt-4 grid md:grid-cols-3 gap-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl border border-neutral-200 p-4 bg-white">
            <div className="aspect-[4/3] rounded-xl border border-neutral-200 mb-3" style={{ background: theme.surface }} />
            <div className="font-medium">{it.t}</div>
            <div className="text-xs text-neutral-500 mt-1">{it.d}</div>
            <a className="inline-block mt-2 text-sm underline" href="#contact">Μάθετε περισσότερα</a>
          </div>
        ))}
      </div>
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
