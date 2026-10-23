import jwt from 'jsonwebtoken';
import { db } from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'campaignhq-dev-secret-change-in-production';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authentication token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Loads the workspace and the caller's membership. Responds 404 when the
// workspace does not exist (or the caller is not a member — deliberately the
// same response, so membership is never leaked).
export function requireWorkspace(minRole = 'member') {
  const rank = { member: 1, admin: 2, owner: 3 };
  return (req, res, next) => {
    const workspaceId = Number(req.params.workspaceId || req.params.id);
    const membership = db
      .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get(workspaceId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Workspace not found' });
    if (rank[membership.role] < rank[minRole]) {
      return res.status(403).json({ error: `Requires ${minRole} role or above` });
    }
    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
    req.workspace = workspace;
    req.membership = membership;
    next();
  };
}

// Loads a campaign and verifies the caller belongs to its workspace.
export function requireCampaign(req, res, next) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(Number(req.params.campaignId || req.params.id));
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const membership = db
    .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .get(campaign.workspace_id, req.user.id);
  if (!membership) return res.status(404).json({ error: 'Campaign not found' });
  req.campaign = campaign;
  req.membership = membership;
  next();
}
