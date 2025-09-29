import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@example.com";
  const password = "Admin123!";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", passwordHash, subscriptionActive: true },
    create: { email, role: "ADMIN", name: "Admin", passwordHash, subscriptionActive: true },
  });

  console.log("Admin ready:", email, password);
}

main().finally(() => prisma.$disconnect());
