import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const demoEmail = "demo@group1.local";
  const demoPassword = "demo123";

  const existing = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (existing) {
    await prisma.academicCourse.deleteMany({ where: { userId: existing.id } });
    await prisma.degreeRequirement.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const hashedPassword = await bcrypt.hash(demoPassword, 10);

  const user = await prisma.user.create({
    data: {
      email: demoEmail,
      name: "Demo Student",
      password: hashedPassword,
    },
  });

  await prisma.academicCourse.createMany({
    data: [
      { userId: user.id, code: "CIS 252", name: "Data Structures", term: "Fall 2024", grade: "A", credits: "3", course: "CIS 252", title: "Data Structures", requirementGroup: "Major" },
      { userId: user.id, code: "CIS 275", name: "Software Design", term: "Fall 2024", grade: "B+", credits: "3", course: "CIS 275", title: "Software Design", requirementGroup: "Major" },
      { userId: user.id, code: "MAT 295", name: "Calculus I", term: "Fall 2023", grade: "A-", credits: "4", course: "MAT 295", title: "Calculus I", requirementGroup: "Core" },
      { userId: user.id, code: "WRT 105", name: "Studio 1", term: "Fall 2023", grade: "P", credits: "3", course: "WRT 105", title: "Studio 1", requirementGroup: "Core" },
      { userId: user.id, code: "PHI 107", name: "Intro to Ethics", term: "Spring 2024", grade: "B", credits: "3", course: "PHI 107", title: "Intro to Ethics", requirementGroup: "Elective" },
    ],
  });

  await prisma.degreeRequirement.createMany({
    data: [
      { userId: user.id, title: "Core Requirements", status: "In Progress", courses: ["MAT 295", "WRT 105"] },
      { userId: user.id, title: "Major Requirements", status: "In Progress", courses: ["CIS 252", "CIS 275"] },
      { userId: user.id, title: "Electives", status: "In Progress", courses: ["PHI 107"] },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo user:", demoEmail, "| Password:", demoPassword);
  console.log("Log in at /login to see data from MongoDB.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
