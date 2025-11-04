/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `DegreeRequirement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DegreeRequirement_userId_key" ON "DegreeRequirement"("userId");
