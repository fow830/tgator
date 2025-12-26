import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = path.join(__dirname, '../../.env');

const router = express.Router();

// Get admin credentials from .env or use defaults
function getAdminCredentials() {
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const adminUsername = envContent.match(/^ADMIN_USERNAME=(.+)$/m)?.[1] || 'admin';
    const adminPassword = envContent.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1] || 'admin';
    return { username: adminUsername, password: adminPassword };
  }
  return { username: 'admin', password: 'admin' };
}

// POST login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const credentials = getAdminCredentials();
    
    // Simple password comparison (in production, use bcrypt)
    // For now, we'll store hashed password in .env
    let isValid = false;
    
    if (credentials.password.startsWith('$2a$') || credentials.password.startsWith('$2b$')) {
      // Password is hashed with bcrypt
      isValid = await bcrypt.compare(password, credentials.password);
    } else {
      // Plain text password (for initial setup)
      isValid = password === credentials.password;
    }
    
    if (username === credentials.username && isValid) {
      const token = generateToken(username);
      res.json({
        success: true,
        token,
        username,
      });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST logout (client-side token removal, but we can add server-side invalidation if needed)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET check auth status
router.get('/check', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.json({ authenticated: false });
  }
  
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.json({ authenticated: false });
      }
      res.json({ authenticated: true, username: user.username });
    });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

export default router;

