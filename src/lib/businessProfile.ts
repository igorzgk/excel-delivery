import { z } from "zod";

export const BUSINESS_TYPES = [
  "ΕΣΤΙΑΤΟΡΙΟ – ΨΗΤΟΠΩΛΕΙΟ",
  "ΥΓΙΕΙΝΗ ΕΣΤΙΑΤΟΡΙΑ - ΨΗΤΟΠΩΛΕΙΑ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
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

// YYYY-MM-DD
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const EquipmentFlagsSchema = z.object({
  extractorHood: z.boolean().optional(),
  coffeeMachine: z.boolean().optional(),
  dehumidifier: z.boolean().optional(),
  foodDisplayAddons: z.boolean().optional(),
  slicerDairyColdCuts: z.boolean().optional(),
  meatGrinder: z.boolean().optional(),
  schnitzelMachine: z.boolean().optional(),
  iceMaker: z.boolean().optional(),
  mixerDough: z.boolean().optional(),
});

export const DateRangeSchema = z.object({
  from: ymd,
  to: ymd,
});

export const ProfileInputSchema = z.object({
  businessName: z.string().min(2),
  businessTypes: z.array(z.enum(BUSINESS_TYPES)).min(1),
  equipmentCount: z.number().int().nonnegative().optional(),
  hasDryAged: z.boolean().optional(),
  supervisorInitials: z.string().max(8).optional(),
  equipmentFlags: EquipmentFlagsSchema.optional(),

  // NEW:
  closedDaysText: z.string().optional(),
  holidayClosedDates: z.array(ymd).optional(),
  augustRange: DateRangeSchema.optional(),
  easterRange: DateRangeSchema.optional(),
});

export type ProfileInput = z.infer<typeof ProfileInputSchema>;
