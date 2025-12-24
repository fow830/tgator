import express from 'express';
import { prisma } from '../models/index.js';

const router = express.Router();

// GET all alerts
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const alerts = await prisma.alert.findMany({
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { createdAt: 'desc' },
      include: {
        chat: true,
        keywordRef: true,
      },
    });

    const total = await prisma.alert.count();

    res.json({
      alerts,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

export default router;

