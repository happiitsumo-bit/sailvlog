import { Router, Request, Response } from "express";
import prisma from "../database";

const router = Router();

// GET /api/tags
router.get("/", async (_req: Request, res: Response) => {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  res.json(tags);
});

export default router;
