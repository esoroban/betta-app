import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log("Seeding database...");

  const users = [
    { email: "owner@sylaslova.com", password: "owner123", displayName: "Owner", baseRole: Role.owner },
    { email: "admin@sylaslova.com", password: "admin123", displayName: "Administrator", baseRole: Role.administrator },
    { email: "revisioner@sylaslova.com", password: "rev123", displayName: "Revisioner", baseRole: Role.revisioner },
    { email: "teacher1@sylaslova.com", password: "teach123", displayName: "Teacher One", baseRole: Role.teacher },
    { email: "teacher2@sylaslova.com", password: "teach123", displayName: "Teacher Two", baseRole: Role.teacher },
    { email: "student1@sylaslova.com", password: "stud123", displayName: "Student One", baseRole: Role.student },
    { email: "student2@sylaslova.com", password: "stud123", displayName: "Student Two", baseRole: Role.student },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: await hash(u.password),
        displayName: u.displayName,
        baseRole: u.baseRole,
      },
    });
    console.log(`  ${u.baseRole}: ${u.email}`);
  }

  console.log("Seed complete: 7 users created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
