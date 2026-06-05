import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { authenticate, generateTokens } from '../middleware/auth.js';

const router = Router();

// POST /api/v1/auth/register  — creates org + first admin user
router.post('/register', [
  body('orgName').trim().notEmpty().withMessage('Organization name required'),
  body('orgType').isIn(['hospital', 'clinic', 'lab', 'pharmacy', 'payer', 'hie', 'aco', 'provider_group']),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 chars'),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { orgName, orgType, npi, email, password, firstName, lastName } = req.body;

    if (await User.findOne({ email })) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
    const org = await Organization.create({ name: orgName, slug, type: orgType, npi });

    const user = await User.create({
      email, password,
      name: { first: firstName, last: lastName },
      role: 'org_admin',
      organization: org._id
    });

    const { accessToken, refreshToken } = generateTokens(user._id.toString());
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      message: 'Registration successful',
      data: { user: user.toSafeObject(), organization: org, accessToken, refreshToken }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/v1/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('organization');
    if (!user || !await user.comparePassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isActive) return res.status(403).json({ error: 'Account inactive' });

    const { accessToken, refreshToken } = generateTokens(user._id.toString());
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.json({ message: 'Login successful', data: { user: user.toSafeObject(), accessToken, refreshToken } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const tokens = generateTokens(user._id.toString());
    user.refreshToken = tokens.refreshToken;
    await user.save();
    res.json({ data: tokens });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  req.user.refreshToken = undefined;
  await req.user.save();
  res.json({ message: 'Logged out' });
});

// GET /api/v1/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ data: req.user.toSafeObject() });
});

// POST /api/v1/auth/users  — invite team member (org admin only)
router.post('/users', authenticate, [
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['org_admin', 'provider', 'analyst', 'viewer']),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('password').isLength({ min: 8 })
], async (req, res) => {
  if (!['super_admin', 'org_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password, firstName, lastName, role } = req.body;
    if (await User.findOne({ email })) return res.status(409).json({ error: 'Email taken' });

    const user = await User.create({
      email, password,
      name: { first: firstName, last: lastName },
      role,
      organization: req.orgId
    });
    res.status(201).json({ data: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
