import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('organization');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = user;
    req.orgId = user.organization?._id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};
