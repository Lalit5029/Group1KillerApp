/*
  Warnings:

  - Added the required column `updatedAt` to the `SelectedCourse` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "AcademicCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "credits" TEXT NOT NULL,
    "requirementGroup" TEXT,
    "course" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "catalogGroup" TEXT NOT NULL,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isFuture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AcademicCourse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SelectedCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseClass" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "instructor" TEXT,
    "daysTimes" TEXT,
    "room" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SelectedCourse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SelectedCourse" ("courseClass", "createdAt", "daysTimes", "id", "instructor", "room", "section", "userId") SELECT "courseClass", "createdAt", "daysTimes", "id", "instructor", "room", "section", "userId" FROM "SelectedCourse";
DROP TABLE "SelectedCourse";
ALTER TABLE "new_SelectedCourse" RENAME TO "SelectedCourse";
CREATE INDEX "SelectedCourse_userId_idx" ON "SelectedCourse"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
