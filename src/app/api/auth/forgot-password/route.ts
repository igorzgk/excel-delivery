// src/app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { z } from "zod";
import { createMailer, getFrom } from "@/lib/mailer";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email(),
});

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  // Πάντα απαντάμε "ok" για να μην γίνεται email enumeration
  const genericOk = NextResponse.json(
    { ok: true, message: "Αν υπάρχει λογαριασμός, θα λάβετε email με οδηγίες." },
    { headers: { "Cache-Control": "no-store" } }
  );

  let data: z.infer<typeof BodySchema>;
  try {
    data = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
    select: { id: true, email: true, status: true },
  });

  if (!user) return genericOk;

  // (προαιρετικό) αν θες να επιτρέπεται και σε PENDING:
  // εδώ το αφήνω να δουλεύει για όλους
  // αν θες ΜΟΝΟ active:
  // if (user.status !== "ACTIVE") return genericOk;

  // Φτιάχνουμε raw token (θα σταλεί στο email) και αποθηκεύουμε ΜΟΝΟ hash
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);

  const ttl = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

  // (Optional) καθάρισε παλιά tokens του user (να μένει 1 ενεργό)
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  try {
    const transporter = createMailer();
    await transporter.sendMail({
      from: getFrom(),
      to: user.email,
      subject: "Επαναφορά κωδικού πρόσβασης",
      text: `Για επαναφορά κωδικού, άνοιξε το παρακάτω link (ισχύει για ${ttl} λεπτά):\n\n${resetUrl}\n\nΑν δεν το ζήτησες, αγνόησέ το.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Επαναφορά κωδικού</h2>
          <p>Πατήστε το κουμπί για να ορίσετε νέο κωδικό (ισχύει για <b>${ttl}</b> λεπτά).</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#25C3F4;color:#061630;text-decoration:none;font-weight:700;">
              Ορισμός νέου κωδικού
            </a>
          </p>
          <p style="color:#666;font-size:12px;">Αν δεν το ζητήσατε, αγνοήστε αυτό το email.</p>
          <p style="color:#666;font-size:12px;">Link: ${resetUrl}</p>
        </div>
      `,
    });
  } catch (e) {
    // δεν αποκαλύπτουμε error στον χρήστη
    console.error("forgot-password mail error", e);
  }

  return genericOk;
}
