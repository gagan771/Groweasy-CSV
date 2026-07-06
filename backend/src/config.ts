export const config = {
  port: Number(process.env.PORT ?? 8000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  uploadLimitMb: Number(process.env.UPLOAD_LIMIT_MB ?? 10),
  batchSize: Number(process.env.BATCH_SIZE ?? 10),
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1",
  aiApiKey: process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? "",
  aiModel: process.env.OPENROUTER_MODEL ?? process.env.AI_MODEL ?? "auto",
};
