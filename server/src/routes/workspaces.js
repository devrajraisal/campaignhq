import { Router } from 'express';
import crypto from 'node:crypto';
import { db, logActivity } from '../db.js';
import { requireAuth, requireWorkspace } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT w.*, wm.role FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = ? ORDER BY w.created_at`
    )
    .all(req.user.id);
  res.json({ workspaces: rows });
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Workspace name is required' });
  const info = db.prepare('INSERT INTO workspaces (name, owner_id) VALUES (?, ?)').run(String(name).trim(), req.user.id);
  db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)')
    .run(info.lastInsertRowid, req.user.id, 'owner');
  logActivity(info.lastInsertRowid, req.user.id, 'workspace.created', name);
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ workspace });
});

router.get('/:id', requireWorkspace(), (req, res) => {
  res.json({ workspace: req.workspace, myRole: req.membership.role });
});

router.get('/:id/members', requireWorkspace(), (req, res) => {
  const members = db
    .prepare(
      `SELECT u.id, u.name, u.email, wm.role, wm.joined_at FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id WHERE wm.workspace_id = ? ORDER BY wm.joined_at`
    )
    .all(req.workspace.id);
  const invites = db
    .prepare("SELECT id, email, role, status, created_at FROM invites WHERE workspace_id = ? AND status = 'pending'")
    .all(req.workspace.id);
  res.json({ members, invites });
});

router.post('/:id/invites', requireWorkspace('admin'), (req, res) => {
  const { email, role = 'member' } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'role must be admin or member' });
  const token = crypto.randomBytes(24).toString('hex');
  const info = db
    .prepare('INSERT INTO invites (workspace_id, email, role, token) VALUES (?, ?, ?, ?)')
    .run(req.workspace.id, String(email).toLowerCase(), role, token);
  logActivity(req.workspace.id, req.user.id, 'member.invited', email);
  const invite = db.prepare('SELECT * FROM invites WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ invite });
});

router.delete('/:id/members/:userId', requireWorkspace('admin'), (req, res) => {
  const targetId = Number(req.params.userId);
  const target = db
    .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .get(req.workspace.id, targetId);
  if (!target) return res.status(404).json({ error: 'Member not found' });
  if (target.role === 'owner') return res.status(400).json({ error: 'The workspace owner cannot be removed' });
  db.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?').run(req.workspace.id, targetId);
  logActivity(req.workspace.id, req.user.id, 'member.removed', `user ${targetId}`);
  res.json({ ok: true });
});

// Accept an invite: the caller must be signed in; the invite email does not
// have to match the account email (teams often invite a different address),
// but the token itself is the credential.
router.post('/invites/accept', (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });
  const invite = db.prepare("SELECT * FROM invites WHERE token = ? AND status = 'pending'").get(token);
  if (!invite) return res.status(404).json({ error: 'Invite not found or already used' });
  const existing = db
    .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .get(invite.workspace_id, req.user.id);
  if (!existing) {
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)')
      .run(invite.workspace_id, req.user.id, invite.role);
  }
  db.prepare("UPDATE invites SET status = 'accepted' WHERE id = ?").run(invite.id);
  logActivity(invite.workspace_id, req.user.id, 'member.joined', req.user.email);
  res.json({ ok: true, workspaceId: invite.workspace_id });
});

router.get('/:id/activity', requireWorkspace(), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db
    .prepare(
      `SELECT a.*, u.name AS user_name FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.workspace_id = ? ORDER BY a.id DESC LIMIT ?`
    )
    .all(req.workspace.id, limit);
  res.json({ activity: rows });
});

export default router;
