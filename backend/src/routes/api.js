const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User, Board, List, Task, Comment, Activity } = require('../models');
const auth = require('../middleware/auth');

// ---------- helpers ----------
const STATUSES = ['todo', 'in_progress', 'done'];
const err = (status, message) => Object.assign(new Error(message), { status });
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const send = (res, data, message = 'OK', code = 200) => res.status(code).json({ success: true, message, data });
const check = (...rules) => [...rules, (req, res, next) => {
  const e = validationResult(req);
  return e.isEmpty() ? next() : res.status(400).json({ success: false, message: e.array()[0].msg });
}];
const token = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const clean = (u) => ({ _id: u._id, username: u.username, email: u.email, role: u.role, profileImage: u.profileImage });
const log = (board, user, action, target) => Activity.create({ board, user, action, target });
const isMember = (board, userId) => board.members.some((m) => m.equals(userId));

// authorization helpers: each returns the document or throws 403/404
const getBoard = async (id, user, ownerOnly = false) => {
  const board = await Board.findById(id);
  if (!board) throw err(404, 'Board not found');
  if (!isMember(board, user._id)) throw err(403, 'You are not a member of this board');
  if (ownerOnly && !board.owner.equals(user._id)) throw err(403, 'Only the board owner can do this');
  return board;
};
const getList = async (id, user) => {
  const list = await List.findById(id);
  if (!list) throw err(404, 'List not found');
  return { list, board: await getBoard(list.board, user) };
};
const getTask = async (id, user) => {
  const task = await Task.findById(id);
  if (!task) throw err(404, 'Task not found');
  return { task, board: await getBoard(task.board, user) };
};
// only the task creator, the assignee or the board owner may change/delete a task
const canModify = (task, board, user) =>
  board.owner.equals(user._id) || task.createdBy?.equals(user._id) || task.assignedTo?.equals(user._id);
const assertCanModify = (task, board, user) => {
  if (!canModify(task, board, user)) throw err(403, 'You are not allowed to modify this task');
};
const assertAssignee = (board, id) => {
  if (id && !isMember(board, id)) throw err(400, 'Assignee must be a board member');
};
const populateTask = (q) => q.populate('assignedTo createdBy', 'username email profileImage');
const titleRule = body('title').trim().notEmpty().withMessage('Title is required');

// ---------- auth (public) ----------
router.post('/auth/register', check(
  body('username').trim().isLength({ min: 2 }).withMessage('Username must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
), h(async (req, res) => {
  const { username, email, password } = req.body;
  if (await User.findOne({ email: email.toLowerCase() })) throw err(409, 'Email already registered');
  const user = await User.create({ username, email, password: await bcrypt.hash(password, 10) });
  send(res, { user: clean(user), token: token(user) }, 'Registered successfully', 201);
}));

router.post('/auth/login', check(
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
), h(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) throw err(401, 'Invalid email or password');
  send(res, { user: clean(user), token: token(user) }, 'Logged in');
}));

// everything below requires a valid Bearer token
router.use(auth);

router.get('/auth/me', h(async (req, res) => send(res, clean(req.user))));

// ---------- users ----------
router.get('/users/profile', h(async (req, res) => send(res, clean(req.user))));
router.put('/users/profile', h(async (req, res) => {
  if (req.body.username) req.user.username = req.body.username;
  if (req.body.profileImage !== undefined) req.user.profileImage = req.body.profileImage;
  await req.user.save();
  send(res, clean(req.user), 'Profile updated');
}));
router.get('/users', h(async (req, res) => send(res, await User.find().select('username email role profileImage'))));

// ---------- boards ----------
router.post('/boards', check(titleRule), h(async (req, res) => {
  const members = [...new Set([req.user._id.toString(), ...(req.body.members || [])])];
  const board = await Board.create({ title: req.body.title, description: req.body.description, owner: req.user._id, members });
  await log(board._id, req.user._id, 'created board', board.title);
  send(res, board, 'Board created', 201);
}));

router.get('/boards', h(async (req, res) => {
  const boards = await Board.find({ members: req.user._id }).sort('-updatedAt').populate('owner', 'username').lean();
  for (const b of boards) {
    b.listCount = await List.countDocuments({ board: b._id });
    b.taskCount = await Task.countDocuments({ board: b._id });
  }
  send(res, boards);
}));

router.get('/boards/:id', h(async (req, res) => {
  const board = await getBoard(req.params.id, req.user);
  await board.populate('members owner', 'username email role profileImage');
  const lists = await List.find({ board: board._id }).sort('position').lean();
  const tasks = await populateTask(Task.find({ board: board._id }).sort('createdAt')).lean();
  send(res, { board, lists, tasks });
}));

router.put('/boards/:id', check(titleRule), h(async (req, res) => {
  const board = await getBoard(req.params.id, req.user, true);
  board.title = req.body.title;
  if (req.body.description !== undefined) board.description = req.body.description;
  if (req.body.members) board.members = [...new Set([board.owner.toString(), ...req.body.members])];
  await board.save();
  await log(board._id, req.user._id, 'updated board', board.title);
  send(res, board, 'Board updated');
}));

router.delete('/boards/:id', h(async (req, res) => {
  const board = await getBoard(req.params.id, req.user, true);
  const taskIds = (await Task.find({ board: board._id }).select('_id')).map((t) => t._id);
  await Comment.deleteMany({ task: { $in: taskIds } });
  await Promise.all([Task, List, Activity].map((m) => m.deleteMany({ board: board._id })));
  await board.deleteOne();
  send(res, null, 'Board deleted');
}));

// ---------- lists ----------
router.post('/boards/:boardId/lists', check(titleRule), h(async (req, res) => {
  const board = await getBoard(req.params.boardId, req.user);
  const position = await List.countDocuments({ board: board._id });
  send(res, await List.create({ title: req.body.title, board: board._id, position }), 'List created', 201);
}));

router.get('/boards/:boardId/lists', h(async (req, res) => {
  const board = await getBoard(req.params.boardId, req.user);
  send(res, await List.find({ board: board._id }).sort('position'));
}));

router.put('/lists/:id', check(titleRule), h(async (req, res) => {
  const { list } = await getList(req.params.id, req.user);
  list.title = req.body.title;
  if (req.body.position !== undefined) list.position = req.body.position;
  await list.save();
  send(res, list, 'List updated');
}));

router.delete('/lists/:id', h(async (req, res) => {
  const { list } = await getList(req.params.id, req.user);
  const taskIds = (await Task.find({ list: list._id }).select('_id')).map((t) => t._id);
  await Comment.deleteMany({ task: { $in: taskIds } });
  await Task.deleteMany({ list: list._id });
  await list.deleteOne();
  send(res, null, 'List deleted');
}));

// ---------- tasks ----------
const taskRules = [
  titleRule,
  body('status').optional().isIn(STATUSES).withMessage('Status must be todo, in_progress or done'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium or high'),
  body('dueDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid due date'),
];

router.post('/lists/:listId/tasks', check(...taskRules), h(async (req, res) => {
  const { list, board } = await getList(req.params.listId, req.user);
  const { title, description, status, priority, dueDate, assignedTo } = req.body;
  assertAssignee(board, assignedTo);
  const task = await Task.create({
    title, description, status, priority,
    dueDate: dueDate || undefined, assignedTo: assignedTo || undefined,
    list: list._id, board: board._id, createdBy: req.user._id,
  });
  await log(board._id, req.user._id, 'created task', title);
  send(res, await populateTask(Task.findById(task._id)), 'Task created', 201);
}));

router.get('/lists/:listId/tasks', h(async (req, res) => {
  const { list } = await getList(req.params.listId, req.user);
  send(res, await populateTask(Task.find({ list: list._id }).sort('createdAt')));
}));

// GET /api/tasks?status=todo  (tasks from all boards the user belongs to)
router.get('/tasks', h(async (req, res) => {
  const { status, priority, board } = req.query;
  if (status && !STATUSES.includes(status)) throw err(400, 'Invalid status filter');
  const ids = (await Board.find({ members: req.user._id }).select('_id')).map((b) => b._id);
  const filter = { board: { $in: ids } };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (board) filter.board = board;
  send(res, await populateTask(Task.find(filter).sort('-updatedAt')));
}));

router.get('/tasks/:id', h(async (req, res) => {
  const { task } = await getTask(req.params.id, req.user);
  send(res, await populateTask(Task.findById(task._id)));
}));

router.put('/tasks/:id', check(...taskRules), h(async (req, res) => {
  const { task, board } = await getTask(req.params.id, req.user);
  assertCanModify(task, board, req.user);
  for (const f of ['title', 'description', 'priority', 'status']) if (req.body[f] !== undefined) task[f] = req.body[f];
  if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate || undefined;
  await task.save();
  await log(board._id, req.user._id, 'updated task', task.title);
  send(res, await populateTask(Task.findById(task._id)), 'Task updated');
}));

router.put('/tasks/:id/assign', h(async (req, res) => {
  const { task, board } = await getTask(req.params.id, req.user);
  assertCanModify(task, board, req.user);
  const { assignedTo } = req.body; // null/empty unassigns
  assertAssignee(board, assignedTo);
  task.assignedTo = assignedTo || undefined;
  await task.save();
  const who = assignedTo ? (await User.findById(assignedTo)).username : 'nobody';
  await log(board._id, req.user._id, `assigned task to ${who}`, task.title);
  send(res, await populateTask(Task.findById(task._id)), 'Task assigned');
}));

router.put('/tasks/:id/status', check(body('status').isIn(STATUSES).withMessage('Status must be todo, in_progress or done')), h(async (req, res) => {
  const { task, board } = await getTask(req.params.id, req.user);
  assertCanModify(task, board, req.user);
  const old = task.status;
  task.status = req.body.status;
  await task.save();
  await log(board._id, req.user._id, `changed status from ${old} to ${task.status}`, task.title);
  send(res, await populateTask(Task.findById(task._id)), 'Status updated');
}));

router.delete('/tasks/:id', h(async (req, res) => {
  const { task, board } = await getTask(req.params.id, req.user);
  assertCanModify(task, board, req.user);
  await Comment.deleteMany({ task: task._id });
  await task.deleteOne();
  await log(board._id, req.user._id, 'deleted task', task.title);
  send(res, null, 'Task deleted');
}));

// ---------- comments ----------
router.post('/tasks/:taskId/comments', check(body('text').trim().notEmpty().withMessage('Comment text is required')), h(async (req, res) => {
  const { task, board } = await getTask(req.params.taskId, req.user);
  const comment = await Comment.create({ task: task._id, user: req.user._id, text: req.body.text });
  await log(board._id, req.user._id, 'commented on task', task.title);
  send(res, await comment.populate('user', 'username profileImage'), 'Comment added', 201);
}));

router.get('/tasks/:taskId/comments', h(async (req, res) => {
  const { task } = await getTask(req.params.taskId, req.user);
  send(res, await Comment.find({ task: task._id }).sort('createdAt').populate('user', 'username profileImage'));
}));

router.delete('/comments/:id', h(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) throw err(404, 'Comment not found');
  if (!comment.user.equals(req.user._id)) throw err(403, 'You can only delete your own comments');
  await comment.deleteOne();
  send(res, null, 'Comment deleted');
}));

// ---------- activity ----------
router.get('/boards/:boardId/activity', h(async (req, res) => {
  const board = await getBoard(req.params.boardId, req.user);
  send(res, await Activity.find({ board: board._id }).sort('-createdAt').limit(50).populate('user', 'username'));
}));

// ---------- dashboard summary ----------
router.get('/dashboard', h(async (req, res) => {
  const ids = (await Board.find({ members: req.user._id }).select('_id')).map((b) => b._id);
  const tasks = await Task.find({ board: { $in: ids } }).populate('assignedTo', 'username').populate('board', 'title').lean();
  const now = new Date();
  const weekAhead = new Date(Date.now() + 7 * 864e5);
  const open = tasks.filter((t) => t.status !== 'done' && t.dueDate);
  const stats = {
    totalBoards: ids.length,
    totalTasks: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    upcoming: open.filter((t) => t.dueDate >= now && t.dueDate <= weekAhead).length,
    overdue: open.filter((t) => t.dueDate < now).length,
  };
  const upcomingTasks = open.filter((t) => t.dueDate >= now).sort((a, b) => a.dueDate - b.dueDate).slice(0, 6);
  const recentTasks = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const activity = await Activity.find({ board: { $in: ids } }).sort('-createdAt').limit(8)
    .populate('user', 'username').populate('board', 'title');
  send(res, { stats, upcomingTasks, recentTasks, activity });
}));

module.exports = router;
