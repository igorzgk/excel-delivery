// src/lib/businessProfile.ts
import { z } from "zod";

// Allowed business types (Greek labels kept as-is)
export const BUSINESS_TYPES = [
  "ΕΣΤΙΑΤΟΡΙΟ – ΨΗΤΟΠΩΛΕΙΟ",
  "ΕΣΤΙΑΤΟΡΙΟ – ΨΗΤΟΠΩΛΕΙΟ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "BAR – WINE BAR",
  "ΑΝΑΨΥΚΤΗΡΙΟ – ΚΑΦΕΤΕΡΙΑ",
  "ΚΥΛΙΚΕΙΟ",
  "ΠΡΑΤΗΡΙΟ ΖΑΧ/ΚΗΣ – ΓΑΛΑΚΤΟΣ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΠΡΑΤΗΡΙΟ ΖΑΧ/ΚΗΣ – ΓΑΛΑΚΤΟΣ ΧΩΡΙΣ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΠΡΑΤΗΡΙΟ ΑΡΤΟΥ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΚΡΕΟΠΩΛΕΙΟ",
  "ΚΡΕΟΠΩΛΕΙΟ ΜΕ ΖΕΣΤΗ ΓΩΝΙΑ",
  "ΙΧΘΥΟΠΩΛΕΙΟ",
  "ΙΧΘΥΟΠΩΛΕΙΟ ΜΕ ΖΕΣΤΗ ΓΩΝΙΑ",
  "ΔΙΑΘΕΣΗ ΠΡΟΪΟΝΤΩΝ ΑΛΛΑΝΤΟΠΟΙΪΑΣ/ΤΥΡΟΚΟΜΙΑΣ",
  "ΑΡΤΟΠΟΙΕΙΟ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΑΡΤΟΠΟΙΕΙΟ ΧΩΡΙΣ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΑΡΤΟΠΟΙΕΙΟ – ΖΑΧΑΡΟΠΛΑΣΤΕΙΟ",
  "ΖΑΧΑΡΟΠΛΑΣΤΕΙΟ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΖΑΧΑΡΟΠΛΑΣΤΕΙΟ ΧΩΡΙΣ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΠΑΝΤΟΠΩΛΕΙΟ / ΟΠΩΡΟΠΩΛΕΙΟ",
  "ΚΑΒΑ – ΚΑΤΑΣΤΗΜΑ ΞΗΡΩΝ ΚΑΡΠΩΝ",
  "ΠΡΑΤΗΡΙΟ ΚΑΤΕΨΥΓΜΕΝΩΝ ΠΡΟΪΟΝΤΩΝ",
  "ΣΥΣΚΕΥΑΣΜΕΝΑ ΠΡΟΪΟΝΤΑ ΝΩΠΑ / ΚΑΤΕΨΥΓΜΕΝΑ / ΞΗΡΟΥ ΦΟΡΤΙΟΥ",
  "ΠΑΓΩΤΟΠΩΛΕΙΟ",
  "ΠΑΡΑΣΚΕΥΗ – ΠΩΛΗΣΗ ΣΦΟΛΙΑΤΟΕΙΔΩΝ ΠΡΟΪΟΝΤΩΝ",
] as const;

export const EquipmentFlagsSchema = z.object({
  extractorHood: z.boolean().optional(),          // e1 απαγωγικό σύστημα
  coffeeMachine: z.boolean().optional(),          // e2 μηχανή καφέ
  dehumidifier: z.boolean().optional(),           // e3 αποχηνότητα (πιθανό τυπογραφικό)
  foodDisplayAddons: z.boolean().optional(),      // e4 προσθήκες έκθεσης τροφίμων
  slicerDairyColdCuts: z.boolean().optional(),    // e5 μηχανές κοπής τυροκομικών/αλλαντικών
  meatGrinder: z.boolean().optional(),            // e6 μηχανές κοπής κιμά
  schnitzelMachine: z.boolean().optional(),       // e7 σνιτσελομηχανή
  iceMaker: z.boolean().optional(),               // e8 παγομηχανή
  mixerDough: z.boolean().optional(),             // e9 μίξερ – ζυμωτήρια
});

export const ProfileInputSchema = z.object({
  businessName: z.string().min(2),
  businessTypes: z.array(z.enum(BUSINESS_TYPES)).min(1),
  equipmentCount: z.number().int().nonnegative().optional(),
  hasDryAged: z.boolean().optional(),
  supervisorInitials: z.string().max(8).optional(),
  equipmentFlags: EquipmentFlagsSchema.optional(),
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;
