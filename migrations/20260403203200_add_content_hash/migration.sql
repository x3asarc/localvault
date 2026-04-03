-- CreateTable: AISettings
CREATE TABLE "AISettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL DEFAULT 'claude-3-5-haiku-20241022',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "ollamaUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AISettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AISettings_userId_key" ON "AISettings"("userId");
