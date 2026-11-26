-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "owner_id" TEXT;

-- CreateIndex
CREATE INDEX "Project_owner_id_idx" ON "Project"("owner_id");
