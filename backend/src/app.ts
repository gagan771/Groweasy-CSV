import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config";
import { importsRouter } from "./routes/imports";
import { importsStreamRouter } from "./routes/imports-stream";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/imports/stream", importsStreamRouter);
  app.use("/api/imports", importsRouter);

  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // multer errors (e.g. file too large, wrong file type) should be 400, not 500
      if (error instanceof multer.MulterError || (error instanceof Error && (error.message === "Only CSV files are accepted."))) {
        res.status(400).json({ message: (error as Error).message });
        return;
      }
      const message = error instanceof Error ? error.message : "Unexpected server error";
      res.status(500).json({ message });
    },
  );

  return app;
}

