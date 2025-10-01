"use client";

import React, { useState, useEffect } from "react";

// --- Brand palette tuned to the provided reference (healthcare style) ---
const palette = {
  ink: "#0E1A2F", // deep navy
  primary: "#2563EB", // button gradient start (reference blue)
  primaryLight: "#60A5FA", // gradient end / hover
  accent: "#2CC8F7", // secondary accent
  text: "#101113",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#FFFFFF",
};

// Smoke tests (keep lightweight)
function SelfTest() {
  useEffect(() => {
    console.assert(typeof useState === "function", "React hooks missing");
    console.assert(Object.values(palette).every(Boolean), "Palette incomplete");
    console.assert(["Επισκόπηση","Χρήστες","Αρχεία","Ρυθμίσεις"].length === 4, "Admin menu labels");
    console.log("DesignPreview (GR) self‑test: OK");
  }, []);
  return null;
}

export default function DesignPreview() {
  return (
    <div className="min-h-screen bg-white text-[#101113]">
      <Topbar />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <Tabs />
      </main>
      <SiteFooter />
      <SelfTest />
    </div>
  );
}

function Topbar() {
  return (
    <header className="border-b border-neutral-200 sticky top-0 z-10 bg-white/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <nav className="hidden md:flex gap-5 text-sm text-neutral-700 ml-6">
            <a href="#services" className="hover:underline">Υπηρεσίες</a>
            <a href="#about" className="hover:underline">Ποιοί είμαστε</a>
            <a href="#clients" className="hover:underline">Πελάτες</a>
            <a href="#process" className="hover:underline">Διαδικασία</a>
            <a href="#faq" className="hover:underline">Συχνές ερωτήσεις</a>
            <a href="#contact" className="hover:underline">Επικοινωνία</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <a href="#login" className="text-sm underline">Είσοδος</a>
          <a href="#contact" className="px-4 py-2 rounded-full text-white" style={{
            background: `linear-gradient(90deg, ${palette.primary}, ${palette.primaryLight})`
          }}>Ζητήστε προσφορά</a>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200">
      <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-2 gap-6 items-center">
        <div>
          <h3 className="text-lg font-semibold">Εγγραφείτε για ενημερώσεις</h3>
          <p className="text-sm text-neutral-600 mt-1">Στείλτε μας το email σας για νέα και χρήσιμους οδηγούς.</p>
        </div>
        <form className="flex gap-2">
          <input className="flex-1 border border-neutral-200 rounded-full px-4 py-2" placeholder="Το email σας" />
          <button className="px-4 py-2 rounded-full text-white" style={{
            background: `linear-gradient(90deg, ${palette.primary}, ${palette.primaryLight})`
          }}>Εγγραφή</button>
        </form>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-neutral-600 flex items-center justify-between border-t border-neutral-200">
        <span>© {new Date().getFullYear()} HygienePlus • Prototype</span>
        <a href="#palette" className="underline">Χρωματική παλέτα</a>
      </div>
    </footer>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{backgroundColor: palette.ink}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="10" y="4" width="4" height="16" rx="1" fill={palette.accent}/>
          <rect x="4" y="10" width="16" height="4" rx="1" fill={palette.primaryLight}/>
        </svg>
      </div>
      <span className="text-xl font-semibold"><span style={{color: palette.ink}}>Hygiene</span><span style={{color: palette.accent}}>Plus</span></span>
    </div>
  );
}

function Tabs() {
  const [tab, setTab] = useState("marketing");
  const tabs = [
    { id: "marketing", label: "Ιστοσελίδα" },
    { id: "login", label: "Web App — Σύνδεση" },
    { id: "dashboard", label: "Web App — Πίνακας" },
    { id: "admin", label: "Web App — Διαχειριστής" },
  ];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-2xl border border-neutral-200 ${tab===t.id?"text-white":"bg-white hover:bg-neutral-50"}`} style={tab===t.id?{background:`linear-gradient(90deg, ${palette.primary}, ${palette.primaryLight})`}:{}}>{t.label}</button>
        ))}
      </div>
      <div className="mt-8">
        {tab === "marketing" && <MarketingGR />} 
        {tab === "login" && <LoginMockGR />} 
        {tab === "dashboard" && <DashboardMockGR />} 
        {tab === "admin" && <AdminShellGR />} 
      </div>
      <Palette />
    </div>
  );
}

function Chip({ children }){
  return <span className="inline-block text-xs rounded-full px-2 py-1 border border-neutral-200 bg-white">{children}</span>
}

// --- Marketing one‑pager (Greek) aligned to uploaded reference ---
function MarketingGR() {
  return (
    <section className="space-y-16">
      {/* Hero */}
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-block text-xs font-medium px-3 py-1 rounded-full" style={{backgroundColor: "#EAF2FF", color: palette.primary}}>Νέο!</span>
          <h1 className="text-3xl md:text-5xl font-semibold leading-tight mt-3">Μεταμορφώστε την <span style={{color: palette.primary}}>Υγιεινή</span> της επιχείρησής σας</h1>
          <p className="mt-4 text-neutral-600 max-w-prose">Υπηρεσίες συμβουλευτικής, εκπαίδευσης και επιθεωρήσεων για HACCP & ISO 22000. 
            Σύγχρονη προσέγγιση, ξεκάθαρη τιμολόγηση, πρακτικά αποτελέσματα.</p>
          <div className="mt-6 flex gap-3">
            <a className="px-5 py-3 rounded-full text-white" style={{background:`linear-gradient(90deg, ${palette.primary}, ${palette.primaryLight})`}} href="#contact">Μάθετε περισσότερα</a>
            <a className="px-5 py-3 rounded-full border border-neutral-200" href="#services">Επικοινωνήστε</a>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
            <Stat k="13+" v="Χρόνια εμπειρίας"/>
            <Stat k="350+" v="Πελάτες"/>
            <Stat k="85+" v="Έργα πιστοποίησης"/>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-6 bg-gradient-to-br from-[#F7FBFF] to-white">
          <div className="aspect-video rounded-xl border border-neutral-200 grid place-items-center">
            <span className="text-neutral-500">Εικόνα ή κολάζ υπηρεσιών</span>
          </div>
        </div>
      </div>

      {/* Twin feature blocks */}
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <FeatureCard
          title="Προσφέρουμε μια ευρεία γκάμα υπηρεσιών"
          copy="Λύσεις προσαρμοσμένες στις ανάγκες σας — από τον αρχικό σχεδιασμό συστημάτων μέχρι τη συνεχή παρακολούθηση και βελτίωση."
          badge="Αποδοτικότητα"
        />
        <FeatureCard
          title="Οι υπηρεσίες μας έχουν μετρήσιμα αποτελέσματα"
          copy="Με πρακτικές οδηγίες, πρότυπα και έλεγχο εφαρμογής, διασφαλίζουμε συμμόρφωση και ομαλή λειτουργία."
          badge="Αξιοπιστία"
        />
      </div>

      {/* Services grid */}
      <div id="services">
        <h2 className="text-2xl font-semibold">Ανακαλύψτε τις Υπηρεσίες μας</h2>
        <p className="text-neutral-600 mt-1">Εξειδικευμένες λύσεις για κάθε στάδιο.</p>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {t:"Πρόγραμμα Παρακολούθησης Υγιεινής", d:"Συνεχής έλεγχος και αναφορές προόδου."},
            {t:"Ενοποιημένο Πλάνο", d:"Σχεδιασμός και τεκμηρίωση για όλες τις διαδικασίες."},
            {t:"Προληπτικές Υπηρεσίες", d:"Εμβολιασμοί, καθαρισμοί, προγράμματα πρόληψης."},
            {t:"Ολιστική Διαχείριση", d:"Συντονισμός μεθόδων, προμηθειών και προσωπικού."},
            {t:"Κέντρο Αποκατάστασης", d:"Βελτιώσεις ροών και διόρθωση αποκλίσεων."},
            {t:"Τηλεσυμβουλευτική", d:"Απομακρυσμένη υποστήριξη και αξιολογήσεις."},
          ].map(card => (
            <ServiceCard key={card.t} title={card.t} copy={card.d} />
          ))}
        </div>
      </div>

      {/* About us */}
      <div id="about" className="grid md:grid-cols-2 gap-8 items-center">
        <div className="rounded-2xl border border-neutral-200 p-6 bg-white order-2 md:order-1">
          <h2 className="text-2xl font-semibold">Ποιοί είμαστε</h2>
          <p className="text-neutral-600 mt-2 text-sm">Ομάδα συμβούλων με εμπειρία σε HACCP & ISO 22000, εκπαίδευση προσωπικού και επιθεωρήσεις. 
            Εστιάζουμε σε πρακτικές λύσεις που εφαρμόζονται άμεσα και φέρνουν μετρήσιμα αποτελέσματα.</p>
          <ul className="mt-3 text-sm list-disc pl-5 space-y-1 text-neutral-700">
            <li>Εξειδικευμένη τεχνογνωσία ανά κλάδο (εστίαση, τρόφιμα, logistics)</li>
            <li>Εργαλεία και πρότυπα τεκμηρίωσης έτοιμα για χρήση</li>
            <li>Συνεχής υποστήριξη μετά την πιστοποίηση</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-6 bg-gradient-to-br from-[#F7FBFF] to-white order-1 md:order-2">
          <div className="aspect-[4/3] rounded-xl border border-neutral-200 grid place-items-center">
            <span className="text-neutral-500">Φωτογραφία ομάδας / χώρου</span>
          </div>
        </div>
      </div>

      {/* Clients / Partners */}
      <div id="clients">
        <h2 className="text-2xl font-semibold">Πελάτες & Συνεργάτες</h2>
        <p className="text-neutral-600 mt-1 text-sm">Ενδεικτική παρουσίαση — θα αντικατασταθεί με πραγματικά λογότυπα.</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map(i=> (
            <div key={i} className="h-12 rounded-xl border border-neutral-200 grid place-items-center text-neutral-400">Λογότυπο {i}</div>
          ))}
        </div>
      </div>

      {/* Process (steps) */}
      <div id="process">
        <h2 className="text-2xl font-semibold">Πώς λειτουργεί η διαδικασία</h2>
        <div className="mt-4 grid md:grid-cols-3 gap-4">
          <StepCard n={1} title="Επικοινωνία" copy="Συζητάμε τις ανάγκες σας και το χρονοδιάγραμμα."/>
          <StepCard n={2} title="Αποτύπωση" copy="Επιτόπιος ή απομακρυσμένος έλεγχος της τρέχουσας κατάστασης."/>
          <StepCard n={3} title="Σχεδιασμός & Υλοποίηση" copy="Δημιουργία/ενημέρωση HACCP & ISO 22000 και εκπαίδευση."/>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq">
        <h2 className="text-2xl font-semibold">Συχνές ερωτήσεις</h2>
        <div className="mt-4 divide-y divide-neutral-200 border border-neutral-200 rounded-2xl">
          <FAQ q="Τι υπηρεσίες προσφέρετε;" a="Συμβουλευτική, εκπαίδευση, επιθεωρήσεις, σχεδιασμό συστημάτων και υποστήριξη πιστοποίησης."/>
          <FAQ q="Πώς κλείνω ραντεβού;" a="Συμπληρώστε τη φόρμα επικοινωνίας ή καλέστε μας για άμεση ενημέρωση."/>
          <FAQ q="Τι να περιμένω στην πρώτη επίσκεψη;" a="Σύντομη αξιολόγηση αναγκών και προτάσεις ενεργειών και κόστους."/>
          <FAQ q="Μπορώ να έχω πρόγραμμα παρακολούθησης;" a="Ναι, προσφέρουμε μηνιαία/τριμηνιαία παρακολούθηση με αναφορές."/>
        </div>
      </div>

      {/* Contact */}
      <div id="contact" className="rounded-2xl border border-neutral-200 p-6 bg-white">
        <h2 className="text-2xl font-semibold">Επικοινωνία</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-3">
          <input placeholder="Όνομα" className="border border-neutral-200 rounded-full p-3"/>
          <input placeholder="Email" className="border border-neutral-200 rounded-full p-3"/>
          <input placeholder="Θέμα" className="border border-neutral-200 rounded-full p-3 sm:col-span-2"/>
          <textarea placeholder="Μήνυμα" className="border border-neutral-200 rounded-2xl p-3 sm:col-span-2" rows={4}/>
          <button className="px-5 py-3 rounded-full text-white w-max" style={{background:`linear-gradient(90deg, ${palette.primary}, ${palette.primaryLight})`}}>Αποστολή</button>
        </div>
      </div>
    </section>
  );
}

function Stat({k, v}:{k:string; v:string}){ return (
  <div>
    <div className="text-2xl font-semibold" style={{color: palette.primary}}>{k}</div>
    <div className="text-xs text-neutral-600">{v}</div>
  </div>
); }

function FeatureCard({title, copy, badge}:{title:string;copy:string;badge:string}){
  return (
    <div className="rounded-2xl border border-neutral-200 p-6 bg-white relative overflow-hidden">
      <span className="absolute -top-3 -right-3 text-[10px] rounded-full px-3 py-1" style={{backgroundColor:"#EAF2FF", color: palette.primary}}>{badge}</span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-neutral-600 mt-2">{copy}</p>
      <div className="mt-3 flex gap-2">
        <Chip>ISO 22000</Chip>
        <Chip>HACCP</Chip>
        <Chip>Εκπαίδευση</Chip>
      </div>
    </div>
  );
}

function ServiceCard({title, copy}:{title:string; copy:string}){
  return (
    <div className="rounded-2xl border border-neutral-200 p-4 bg-white">
      <div className="w-10 h-10 rounded-xl grid place-items-center mb-3" style={{backgroundColor: "#E6F0FF"}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke={palette.primary} strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
      <div className="font-medium">{title}</div>
      <p className="text-sm text-neutral-600 mt-1">{copy}</p>
    </div>
  );
}

function StepCard({n, title, copy}:{n:number; title:string; copy:string}){
  return (
    <div className="rounded-2xl border border-neutral-200 p-5 bg-white">
      <div className="text-xs text-neutral-500">Βήμα {n}</div>
      <div className="font-medium mt-1">{title}</div>
      <p className="text-sm text-neutral-600 mt-2">{copy}</p>
    </div>
  );
}

function FAQ({q, a}:{q:string; a:string}){
  const [open, setOpen] = useState(false);
  return (
    <details open={open} onClick={() => setOpen(o=>!o)} className="group">
      <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between">
        <span className="font-medium">{q}</span>
        <span className="text-neutral-500 group-open:rotate-180 transition">⌄</span>
      </summary>
      <div className="px-4 pb-4 text-sm text-neutral-600">{a}</div>
    </details>
  );
}

// --- Web app mocks in Greek ---
function LoginMockGR(){
  return (
    <section className="grid place-items-center min-h-[60vh]" id="login">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center gap-2 mb-4"><Logo/><span className="text-sm text-neutral-500">Web App</span></div>
        <h2 className="text-lg font-semibold mb-3">Σύνδεση</h2>
        <div className="space-y-3">
          <input placeholder="Email" className="border border-neutral-200 rounded-xl p-3 w-full"/>
          <input placeholder="Κωδικός πρόσβασης" type="password" className="border border-neutral-200 rounded-xl p-3 w-full"/>
          <button className="w-full rounded-full text-white py-3" style={{background:`linear-gradient(90deg, ${palette.primary}, ${palette.primaryLight})`}}>Είσοδος</button>
          <p className="text-xs text-neutral-500">Δεν έχετε λογαριασμό; <a className="underline" href="#">Δημιουργία λογαριασμού</a></p>
        </div>
      </div>
    </section>
  );
}

function DashboardMockGR(){
  const rows = [
    { name: "HACCP‑Report‑Sept.xlsx", date: "29 Σεπ 2025" },
    { name: "ISO22000‑Checklist.xlsx", date: "22 Σεπ 2025" },
  ];
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Τα αρχεία σας</h2>
        <div className="text-sm text-neutral-600">Συνδρομή: <span className="text-green-600 font-medium">Ενεργή</span></div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left p-3">Όνομα</th>
              <th className="text-left p-3">Ημερομηνία</th>
              <th className="p-3">Ενέργεια</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.name} className="border-t border-neutral-200">
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.date}</td>
                <td className="p-3 text-center"><button className="px-3 py-1.5 rounded-full border border-neutral-200">Λήψη</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ----- Admin Shell (navy style, left sidebar) -----
function AdminShellGR(){
  const [view, setView] = useState("overview");
  return (
    <section className="border border-neutral-200 rounded-2xl overflow-hidden">
      <div className="grid grid-cols-12">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2" style={{backgroundColor: palette.ink}}>
          <div className="p-4 text-white font-medium">Διαχειριστής</div>
          <nav className="text-sm text-white/90">
            <AdminNavItem label="Επισκόπηση" active={view==="overview"} onClick={()=>setView("overview")} />
            <AdminNavItem label="Χρήστες" active={view==="users"} onClick={()=>setView("users")} />
            <AdminNavItem label="Αρχεία" active={view==="files"} onClick={()=>setView("files")} />
            <AdminNavItem label="Ρυθμίσεις" active={view==="settings"} onClick={()=>setView("settings")} />
          </nav>
        </aside>
        {/* Content */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 bg-white">
          {view === "overview" && <AdminOverviewGR />}
          {view === "users" && <AdminUsersListGR />}
          {view === "files" && <AdminFilesPlaceholder />}
          {view === "settings" && <AdminSettingsPlaceholder />}
        </div>
      </div>
    </section>
  );
}

function AdminNavItem({label, active, onClick}:{label:string; active:boolean; onClick:()=>void}){
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-2 ${active?"bg-white/10 font-medium":"hover:bg-white/5"}`} style={{color: "#fff"}}>
      {label}
    </button>
  );
}

function AdminOverviewGR(){
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Επισκόπηση</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Συνολικοί χρήστες" value="352"/>
        <KPI label="Ενεργές συνδρομές" value="291"/>
        <KPI label="Αναθέσεις αρχείων" value="1.2k"/>
        <KPI label="Αιτήματα/24h" value="43"/>
      </div>
      <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600">Γράφημα/πίνακας (placeholder)</div>
    </div>
  );
}

function KPI({label, value}:{label:string; value:string}){
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function AdminUsersListGR(){
  const users = [
    { email: "admin@example.com", role: "ADMIN", sub: true },
    { email: "user@client.com", role: "USER", sub: false },
  ];
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Χρήστες</h2>
      <form className="grid sm:grid-cols-2 gap-3 border border-neutral-200 p-4 rounded-2xl">
        <input className="border border-neutral-200 rounded-xl p-3" placeholder="Όνομα (προαιρετικό)"/>
        <input className="border border-neutral-200 rounded-xl p-3" placeholder="Email"/>
        <input className="border border-neutral-200 rounded-xl p-3 sm:col-span-2" placeholder="Κωδικός πρόσβασης"/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox"/> Ενεργοποίηση συνδρομής</label>
        <button className="px-4 py-2 rounded-full text-white w-max" style={{background:`linear-gradient(90deg, ${palette.primary}, ${palette.primaryLight})`}}>Δημιουργία</button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Ρόλος</th>
              <th className="text-left p-3">Συνδρομή</th>
              <th className="p-3">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u=> (
              <tr key={u.email} className="border-t border-neutral-200">
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.sub?"Ενεργή":"Ανενεργή"}</td>
                <td className="p-3"><button className="underline">{u.sub?"Απενεργοποίηση":"Ενεργοποίηση"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminFilesPlaceholder(){
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Αρχεία</h2>
      <div className="rounded-2xl border border-neutral-200 p-6 text-sm text-neutral-600">Περιοχή μεταφόρτωσης (drag & drop) και λίστα πρόσφατων αρχείων — placeholder.</div>
    </div>
  );
}

function AdminSettingsPlaceholder(){
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Ρυθμίσεις</h2>
      <div className="rounded-2xl border border-neutral-200 p-6 text-sm text-neutral-600">Μορφή λογαριασμού, αλλαγή κωδικού πρόσβασης, API keys — placeholder.</div>
    </div>
  );
}

function Palette(){
  const list = [
    { name: "Βαθύ μπλε (Ink)", hex: palette.ink, use: "Τίτλοι, header" },
    { name: "Μπλε (Primary)", hex: palette.primary, use: "Κύρια κουμπιά" },
    { name: "Ανοιχτό μπλε", hex: palette.primaryLight, use: "Hover/βαθμίδες" },
    { name: "Accent", hex: palette.accent, use: "Δευτερεύοντα highlights" },
    { name: "Κείμενο", hex: palette.text, use: "Κύριο κείμενο" },
    { name: "Σύνορα", hex: palette.border, use: "Πλαίσια, input" },
  ];
  return (
    <section id="palette" className="mt-12">
      <h2 className="text-xl font-semibold">Χρωματική παλέτα</h2>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(c=> (
          <div key={c.hex} className="rounded-2xl overflow-hidden border border-neutral-200">
            <div className="h-16" style={{ backgroundColor: c.hex }} />
            <div className="p-3 text-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-neutral-500">{c.use}</div>
              </div>
              <code className="text-xs bg-neutral-50 border border-neutral-200 rounded px-2 py-1">{c.hex}</code>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
