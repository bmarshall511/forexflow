-- CreateTable
CREATE TABLE "ChartLayout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "layout" TEXT NOT NULL DEFAULT 'single',
    "panels" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);
