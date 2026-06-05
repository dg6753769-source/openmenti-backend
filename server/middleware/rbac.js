const permissions = {
  super_admin: ['*'],
  org_admin: [
    'patients:read', 'patients:write', 'patients:delete',
    'providers:read', 'providers:write', 'providers:delete',
    'encounters:read', 'encounters:write',
    'observations:read', 'observations:write',
    'conditions:read', 'conditions:write',
    'medications:read', 'medications:write',
    'pipelines:read', 'pipelines:write', 'pipelines:run',
    'sources:read', 'sources:write',
    'analytics:read', 'quality:read', 'quality:write',
    'fhir:read', 'fhir:write',
    'users:read', 'users:write', 'org:read', 'org:write'
  ],
  provider: [
    'patients:read', 'patients:write',
    'encounters:read', 'encounters:write',
    'observations:read', 'observations:write',
    'conditions:read', 'conditions:write',
    'medications:read', 'medications:write',
    'providers:read', 'analytics:read', 'fhir:read'
  ],
  analyst: [
    'patients:read', 'encounters:read', 'observations:read',
    'conditions:read', 'medications:read', 'providers:read',
    'analytics:read', 'quality:read', 'fhir:read', 'pipelines:read'
  ],
  viewer: [
    'patients:read', 'encounters:read', 'observations:read',
    'conditions:read', 'medications:read', 'providers:read'
  ]
};

export const authorize = (...required) => (req, res, next) => {
  const userPerms = permissions[req.user?.role] || [];
  if (userPerms.includes('*')) return next();
  const hasAll = required.every(p => userPerms.includes(p));
  if (!hasAll) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};
