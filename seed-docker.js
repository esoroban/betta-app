// Standalone seed script for Docker — uses direct pg queries to avoid Prisma client generation issues
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const users = [
  { email: "owner@sylaslova.com", password: "owner123", displayName: "Owner", baseRole: "owner" },
  { email: "admin@sylaslova.com", password: "admin123", displayName: "Administrator", baseRole: "administrator" },
  { email: "revisioner@sylaslova.com", password: "rev123", displayName: "Revisioner", baseRole: "revisioner" },
  { email: "teacher1@sylaslova.com", password: "teach123", displayName: "Teacher One", baseRole: "teacher" },
  { email: "teacher2@sylaslova.com", password: "teach123", displayName: "Teacher Two", baseRole: "teacher" },
  { email: "student1@sylaslova.com", password: "stud123", displayName: "Student One", baseRole: "student" },
  { email: "student2@sylaslova.com", password: "stud123", displayName: "Student Two", baseRole: "student" },
];

async function main() {
  const existing = await pool.query("SELECT count(*) FROM users");
  if (parseInt(existing.rows[0].count) > 0) {
    console.log(`DB already has ${existing.rows[0].count} users, skipping seed.`);
    return;
  }

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    const id = `seed_${u.baseRole}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await pool.query(
      `INSERT INTO users (id, email, "passwordHash", "displayName", "baseRole", status, "preferredLang", "createdAt")
       VALUES ($1, $2, $3, $4, $5::\"Role\", 'active', 'en', NOW())
       ON CONFLICT (email) DO NOTHING`,
      [id, u.email, hash, u.displayName, u.baseRole]
    );
    console.log(`  Seeded: ${u.email} (${u.baseRole})`);
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error("Seed error:", e.message); })
  .finally(() => pool.end());
