const { Schema, model } = require('mongoose');
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });
const opts = { timestamps: true };

const User = model('User', new Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: String,
  profileImage: String,
}, opts));

const Board = model('Board', new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  owner: ref('User'),
  members: [ref('User')],
}, opts));

const List = model('List', new Schema({
  title: { type: String, required: true, trim: true },
  board: ref('Board'),
  position: { type: Number, default: 0 },
}, opts));

const Task = model('Task', new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  list: ref('List'),
  board: ref('Board'),
  assignedTo: ref('User'),
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: Date,
  createdBy: ref('User'),
}, opts));

const Comment = model('Comment', new Schema({
  task: ref('Task'),
  user: ref('User'),
  text: { type: String, required: true, trim: true },
}, opts));

const Activity = model('Activity', new Schema({
  board: ref('Board'),
  user: ref('User'),
  action: String,
  target: String,
}, opts));

module.exports = { User, Board, List, Task, Comment, Activity };
