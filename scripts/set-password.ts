// Set a login's password from the command line (when nobody can sign in to
// reset it in the app):
//
//   npm run set-password -- you@example.com "new password here"
//
// Changes every staff login with that email (in any business) and the
// platform admin login with that email.
import { PrismaClient } from "@prisma/client";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const [rawEmail, password] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !password) {
    console.error('Usage: npm run set-password -- you@example.com "new password"');
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  const staff = await prisma.staffUser.updateMany({ where: { email: { equals: email, mode: "insensitive" } }, data: { passwordHash } });
  const platform = await prisma.platformUser.updateMany({ where: { email: { equals: email, mode: "insensitive" } }, data: { passwordHash } });
  if (staff.count + platform.count === 0) {
    const known = await prisma.staffUser.findMany({ select: { email: true }, orderBy: { email: "asc" }, take: 20 });
    console.error(`No login uses ${email}. Staff logins on file: ${known.map((k) => k.email).join(", ") || "none"}`);
    process.exit(1);
  }
  console.log(`Password updated for ${email}: ${staff.count} staff login${staff.count === 1 ? "" : "s"}${platform.count ? ", and the platform admin login" : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
