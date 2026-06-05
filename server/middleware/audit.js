import AuditLog from '../models/AuditLog.js';

export const auditLog = (action, resource) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = async (data) => {
    try {
      await AuditLog.create({
        organization: req.orgId,
        user: req.user?._id,
        userEmail: req.user?.email,
        userName: req.user ? `${req.user.name.first} ${req.user.name.last}` : 'system',
        action,
        resource,
        resourceId: req.params?.id || data?.data?._id?.toString(),
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: action === 'READ' || action === 'SEARCH' ? undefined : req.body
        },
        outcome: res.statusCode < 400 ? 'success' : 'failure',
        ipAddress: req.headers['x-forwarded-for'] || req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (e) {
      console.error('Audit log error:', e.message);
    }
    return originalJson(data);
  };
  next();
};
