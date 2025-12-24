import express from 'express';
import { prisma } from '../models/index.js';

const router = express.Router();

// GET all keywords
router.get('/', async (req, res) => {
  try {
    const keywords = await prisma.keyword.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(keywords);
  } catch (error) {
    console.error('Error fetching keywords:', error);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// POST create keyword
router.post('/', async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return res.status(400).json({ error: 'keyword is required and must be a non-empty string' });
    }

    const keywordRecord = await prisma.keyword.upsert({
      where: { keyword: keyword.trim().toLowerCase() },
      update: {},
      create: {
        keyword: keyword.trim().toLowerCase(),
      },
    });

    res.json(keywordRecord);
  } catch (error) {
    console.error('Error creating keyword:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Keyword already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create keyword' });
    }
  }
});

// DELETE keyword
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.keyword.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting keyword:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Keyword not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete keyword' });
    }
  }
});

export default router;

