require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Board, List, Task, Comment, Activity } = require('../models');

const day = (n) => new Date(Date.now() + n * 864e5);
const STATUS = { t: 'todo', p: 'in_progress', d: 'done' };
const PRIORITY = { l: 'low', m: 'medium', h: 'high' };

const people = [
  ['demo', 'Demo Admin', 'demo@taskflow.com', 'Project Owner'],
  ['sarah', 'Sarah Ahmed', 'sarah@example.com', 'Project Manager'],
  ['omar', 'Omar Hassan', 'omar@example.com', 'Backend Developer'],
  ['nour', 'Nour Ali', 'nour@example.com', 'UI/UX Designer'],
  ['youssef', 'Youssef Mohamed', 'youssef@example.com', 'QA / Developer'],
  ['mariam', 'Mariam Adel', 'mariam@example.com', 'Frontend Developer'],
];

// task row: list|title|description|status(t/p/d)|priority(l/m/h)|assignee|due date offset in days
const boards = [
  {
    title: 'Website Redesign', description: 'Redesign the company website and improve the user experience.',
    members: ['sarah', 'omar', 'nour', 'mariam', 'youssef'],
    lists: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    tasks: [
      'Backlog|Add dark mode option|Offer a dark theme across the site|t|l|nour|30',
      'Backlog|Set up A/B testing for hero section|Compare two hero layouts for sign-ups|t|m|sarah|21',
      'To Do|Design responsive navbar|Navbar that collapses cleanly on mobile|t|h|nour|4',
      'To Do|Fix navigation issues|Broken links and wrong active states in the menu|t|m|youssef|-2',
      'In Progress|Implement landing page|Build the approved landing page in React|p|h|mariam|5',
      'In Progress|Optimize mobile layout|Fix spacing and image sizes on small screens|p|m|mariam|9',
      'Review|Review accessibility|Check contrast, focus states and alt text|p|m|youssef|3',
      'Done|Analyze current website UX|Heatmaps and user interviews summary|d|h|nour|-20',
      'Done|Create homepage wireframe|Low-fidelity wireframe approved by stakeholders|d|h|nour|-12',
      'Done|Finalize homepage design|Final visual design handed over to development|d|m|sarah|-5',
    ],
  },
  {
    title: 'Mobile App Development', description: 'Development and release of the new mobile application.',
    members: ['sarah', 'omar', 'nour', 'mariam', 'youssef'],
    lists: ['Ideas', 'To Do', 'In Progress', 'Testing', 'Done'],
    tasks: [
      'Ideas|Explore biometric login|Evaluate fingerprint and face unlock|t|l|omar|40',
      'To Do|Design onboarding screens|Three-step welcome flow for new users|t|m|nour|6',
      'To Do|Implement push notifications|Notify users about task assignments|t|h|omar|12',
      'In Progress|Implement login API|JWT login endpoint with validation|p|h|omar|2',
      'In Progress|Connect login form to API|Hook the login screen to the backend|p|m|mariam|3',
      'Testing|Test registration flow|Cover valid, invalid and duplicate sign-ups|p|m|youssef|1',
      'Testing|Fix authentication bugs|Token refresh fails after app restart|p|h|youssef|-1',
      'Done|Create authentication flow|Screens and navigation for sign-in|d|h|omar|-10',
      'Done|Set up CI pipeline|Automated build and tests on every push|d|m|omar|-15',
    ],
  },
  {
    title: 'Marketing Campaign', description: 'Planning and executing the upcoming digital marketing campaign.',
    members: ['sarah', 'nour', 'mariam'],
    lists: ['Planning', 'Content', 'In Progress', 'Review', 'Completed'],
    tasks: [
      'Planning|Set campaign budget|Agree budget split across channels|t|m|sarah|7',
      'Planning|Plan influencer outreach|Shortlist creators and draft the pitch|t|m|sarah|14',
      'Content|Prepare social media content|Posts and captions for four weeks|p|m|nour|4',
      'Content|Write launch email copy|Announcement email and two follow-ups|t|l|sarah|8',
      'In Progress|Design campaign visuals|Banners and story templates|p|h|nour|3',
      'Review|Schedule Instagram posts|Queue approved posts in the scheduler|p|m|mariam|10',
      'Completed|Define campaign audience|Personas and target segments|d|h|sarah|-18',
      'Completed|Competitor analysis report|Summary of competitor campaigns|d|m|sarah|-9',
    ],
  },
];

// [task title, user, comment, days ago]
const comments = [
  ['Implement login API', 'omar', 'Authentication endpoint is ready for testing.', 2],
  ['Implement login API', 'mariam', "I'll connect the login form to the API.", 1],
  ['Implement login API', 'sarah', 'Please make sure validation errors are handled.', 1],
  ['Fix authentication bugs', 'youssef', 'Reproduced it: the token is lost after restarting the app.', 2],
  ['Fix authentication bugs', 'omar', 'Looking into the refresh logic today.', 1],
  ['Implement landing page', 'nour', 'Spacing in the hero section should follow the Figma file.', 3],
  ['Implement landing page', 'mariam', 'Updated, please check the latest build.', 2],
  ['Review accessibility', 'youssef', 'Found two contrast issues on the footer links.', 1],
  ['Design responsive navbar', 'sarah', 'Please include a visible search icon on mobile.', 2],
  ['Prepare social media content', 'sarah', 'Great start, keep the tone friendly and short.', 1],
  ['Design campaign visuals', 'nour', 'First banner drafts are ready for review.', 1],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User, Board, List, Task, Comment, Activity].map((m) => m.deleteMany({})));

  const password = await bcrypt.hash('12345678', 10);
  const U = {};
  for (const [key, username, email, role] of people) U[key] = await User.create({ username, email, password, role });

  const T = {}; // task title -> task doc
  for (const b of boards) {
    const board = await Board.create({
      title: b.title, description: b.description, owner: U.demo._id,
      members: [U.demo._id, ...b.members.map((k) => U[k]._id)],
    });
    await Activity.create({ board: board._id, user: U.demo._id, action: 'created board', target: b.title, createdAt: day(-30) });

    const L = {};
    for (const [i, title] of b.lists.entries()) L[title] = await List.create({ title, board: board._id, position: i });

    for (const [i, row] of b.tasks.entries()) {
      const [list, title, description, s, p, who, due] = row.split('|');
      const created = day(-(25 - i));
      const task = await Task.create({
        title, description, list: L[list]._id, board: board._id,
        status: STATUS[s], priority: PRIORITY[p], assignedTo: U[who]._id, createdBy: U.sarah._id,
        dueDate: day(Number(due)), createdAt: created,
      });
      T[title] = task;
      const act = (user, action) => Activity.create({ board: board._id, user: user._id, action, target: title, createdAt: created });
      await act(U.sarah, 'created task');
      await act(U.sarah, `assigned task to ${U[who].username}`);
      if (s !== 't') await act(U[who], `changed status from todo to ${STATUS[s]}`);
    }
  }

  for (const [title, who, text, ago] of comments) {
    const task = T[title];
    await Comment.create({ task: task._id, user: U[who]._id, text, createdAt: day(-ago) });
    await Activity.create({ board: task.board, user: U[who]._id, action: 'commented on task', target: title, createdAt: day(-ago) });
  }

  console.log('Seed complete. Demo login: demo@taskflow.com / 12345678');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
