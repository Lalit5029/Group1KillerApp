import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const advisorEmail = "demo@group1.local";
  const advisorPassword = "demo123";

  const existingAdvisor = await prisma.user.findUnique({
    where: { email: advisorEmail },
    select: { id: true },
  });

  if (existingAdvisor) {
    const students = await prisma.student.findMany({
      where: { advisorId: existingAdvisor.id },
      select: { id: true },
    });
    const studentIds = students.map((student) => student.id);

    if (studentIds.length > 0) {
      await prisma.selectedCourse.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.academicCourse.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.degreeRequirement.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.student.deleteMany({ where: { advisorId: existingAdvisor.id } });
    }

    await prisma.user.deleteMany({ where: { id: existingAdvisor.id } });
  }

  const hashedPassword = await bcrypt.hash(advisorPassword, 10);

  const advisor = await prisma.user.create({
    data: {
      email: advisorEmail,
      name: "Demo Advisor",
      password: hashedPassword,
      role: "ADVISOR",
    },
  });

  const student = await prisma.student.create({
    data: {
      advisorId: advisor.id,
      name: "Alex Johnson",
      externalStudentId: "900123456",
      email: "alex.johnson@syr.edu",
      major: "Computer Science, BS",
      academicYear: "Junior",
    },
  });

  await prisma.academicCourse.createMany({
    data: [
      {
        studentId: student.id,
        code: "CIS 252",
        name: "Data Structures",
        term: "Fall 2024",
        grade: "A",
        credits: "3",
        course: "CIS 252",
        title: "Data Structures",
        requirementGroup: "Major",
      },
      {
        studentId: student.id,
        code: "CIS 275",
        name: "Software Design",
        term: "Fall 2024",
        grade: "B+",
        credits: "3",
        course: "CIS 275",
        title: "Software Design",
        requirementGroup: "Major",
      },
      {
        studentId: student.id,
        code: "MAT 295",
        name: "Calculus I",
        term: "Fall 2023",
        grade: "A-",
        credits: "4",
        course: "MAT 295",
        title: "Calculus I",
        requirementGroup: "Core",
      },
      {
        studentId: student.id,
        code: "WRT 105",
        name: "Studio 1",
        term: "Fall 2023",
        grade: "P",
        credits: "3",
        course: "WRT 105",
        title: "Studio 1",
        requirementGroup: "Core",
      },
      {
        studentId: student.id,
        code: "PHI 107",
        name: "Intro to Ethics",
        term: "Spring 2024",
        grade: "B",
        credits: "3",
        course: "PHI 107",
        title: "Intro to Ethics",
        requirementGroup: "Elective",
      },
    ],
  });

  await prisma.degreeRequirement.createMany({
    data: [
      {
        studentId: student.id,
        title: "Core Requirements",
        status: "In Progress",
        courses: ["MAT 295", "WRT 105"],
      },
      {
        studentId: student.id,
        title: "Major Requirements",
        status: "In Progress",
        courses: ["CIS 252", "CIS 275"],
      },
      {
        studentId: student.id,
        title: "Electives",
        status: "In Progress",
        courses: ["PHI 107"],
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo advisor:", advisorEmail, "| Password:", advisorPassword);
  console.log("Demo student:", student.name, "| Student ID:", student.externalStudentId);
  console.log("Sign in at /login and then choose a student at /students.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
