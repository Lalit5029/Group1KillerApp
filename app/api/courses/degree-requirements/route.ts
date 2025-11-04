import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession();
    console.log("GET - Session:", session);

    if (!session?.user?.email) {
      console.log("GET - Unauthorized: No user email in session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { degreeRequirements: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user.degreeRequirements);
  } catch (error) {
    console.error("Error fetching degree requirements:", error);
    return NextResponse.json(
      { error: "Failed to fetch degree requirements" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    console.log("POST - Session:", session);

    if (!session?.user?.email) {
      console.log("POST - Unauthorized: No user email in session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = await request.json();
    console.log("POST - Received data:", data);

    // Delete existing degree requirements
    await prisma.DegreeRequirement.deleteMany({
      where: {
        userId: user.id,
      },
    });

    // Create new degree requirements
    const degreeRequirements = await prisma.DegreeRequirement.createMany({
      data: data.map((block: any) => ({
        userId: user.id,
        title: block.title,
        status: block.status,
        courses: block.courses,
      })),
    });

    console.log("POST - Created degree requirements:", degreeRequirements);
    return NextResponse.json(degreeRequirements);
  } catch (error) {
    console.error("Error saving degree requirements:", error);
    return NextResponse.json(
      { error: "Failed to save degree requirements" },
      { status: 500 }
    );
  }
}
