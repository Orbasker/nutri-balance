import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  crons: [
    // Once daily at 2 AM UTC — scans for substance data gaps and queues research tasks
    { path: "/api/ai-tasks/schedule", schedule: "0 2 * * *" },

    // Every 15 minutes — picks up and processes pending AI research tasks (max 5 per run)
    { path: "/api/ai-tasks/process", schedule: "*/15 * * * *" },

    // Once daily at 3 AM UTC — reviews AI-generated observations, approves or rejects
    { path: "/api/ai-tasks/review", schedule: "0 3 * * *" },
  ],
};
