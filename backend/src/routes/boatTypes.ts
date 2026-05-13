import { Router, Request, Response } from "express";
import prisma from "../database";

const router = Router();

// GET /api/boat-types
router.get("/", async (_req: Request, res: Response) => {
  const boatTypes = await prisma.boatType.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, slug: true, description: true },
  });
  res.json(boatTypes);
});

export default router;
