-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tradingMode" TEXT NOT NULL DEFAULT 'practice',
    "practiceToken" TEXT,
    "practiceAccountId" TEXT,
    "liveToken" TEXT,
    "liveAccountId" TEXT,
    "updatedAt" DATETIME NOT NULL
);
