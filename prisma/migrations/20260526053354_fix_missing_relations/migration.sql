/*
  Warnings:

  - You are about to drop the column `professor_id` on the `classes` table. All the data in the column will be lost.
  - You are about to drop the column `real_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `tech_stack` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `university_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `user_number` on the `users` table. All the data in the column will be lost.
  - Added the required column `professor_profile_id` to the `classes` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_ClassEnrollments" DROP CONSTRAINT "_ClassEnrollments_B_fkey";

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_professor_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_university_id_fkey";

-- AlterTable
ALTER TABLE "classes" DROP COLUMN "professor_id",
ADD COLUMN     "professor_profile_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "real_name",
DROP COLUMN "tech_stack",
DROP COLUMN "university_id",
DROP COLUMN "user_number";

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "real_name" TEXT NOT NULL,
    "student_number" TEXT NOT NULL,
    "tech_stack" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "real_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_university_id_student_number_key" ON "student_profiles"("university_id", "student_number");

-- CreateIndex
CREATE UNIQUE INDEX "professor_profiles_user_id_key" ON "professor_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_profiles" ADD CONSTRAINT "professor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_profiles" ADD CONSTRAINT "professor_profiles_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_professor_profile_id_fkey" FOREIGN KEY ("professor_profile_id") REFERENCES "professor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClassEnrollments" ADD CONSTRAINT "_ClassEnrollments_B_fkey" FOREIGN KEY ("B") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
