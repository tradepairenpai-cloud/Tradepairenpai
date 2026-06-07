import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import * as dotenv from 'dotenv';
import { config, checkApiKeys, ensureDirs, mockVideoAllowed } from '../lib/config';
import { checkAllClis } from '../lib/cli-tools';
import { eventBus } from '../agents/event-bus';
import { AgentState, AgentName, Task } from '../agents/types';
import { logger } from '../lib/logger';
import { SupervisorAgent } from '../agents/supervisor';

dotenv.config();

const AGENT_LABELS: Record<AgentName, string> = {
  'supervisor': 'ผู้ควบคุม',
  'claude-builder': 'สร้างเนื้อหา (Claude)',
  'codex-reviewer': 'ตรวจสอบ (Codex)',
  'gemini-research': 'วิจัย (Gemini)',
  'asset-finder': 'หา Asset (Pexels)',
  'voiceover': 'สร้างเสียง (ElevenLabs)',
  'video-render': 'เรนเดอร์วิดีโอ (Creatomate)',
  'qa': 'ตรวจคุณภาพ (QA)',
};

const agentStates: Map<AgentName, AgentState> = new Map(
  (Object.keys(AGENT_LABELS) as AgentName[]).map(name => [
    name,
    { name, thaiLabel: AGENT_LABELS[name], status: 'idle', currentTask: '', lastUpdated: Date.now() },
  ])
);

const logs: { level: string; agent: string; message: string; timestamp: number }[] = [];
const tasks: Task[] = [];
const MAX_LOGS = 200;

eventBus.on('agent:update', (event) => {
  const state = agentStates.get(event.agent);
  if (state) {
    state.status = event.status;
    state.currentTask = event.task;
    state.lastUpdated = event.timestamp;
  }
  io.emit('agent:update', event);
});

eventBus.on('log', (event) => {
  logs.push(event);
  if (logs.length > MAX_LOGS) logs.shift();
  io.emit('log', event);
});

eventBus.on('task:update', (task: Task) => {
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) tasks[idx] = task;
  else tasks.unshift(task);
  io.emit('task:update', task);
});

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketIO(httpServer, { cors: { origin: '*' } });

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/state', async (_req, res) => {
  const [clis, keys] = await Promise.all([checkAllClis(), Promise.resolve(checkApiKeys())]);
  res.json({
    agents: Array.from(agentStates.values()),
    tasks: tasks.slice(0, 20),
    logs: logs.slice(-50),
    cliStatus: { claude: clis['claude'].ok, codex: clis['codex'].ok, gemini: clis['gemini'].ok },
    apiStatus: keys,
    renderMode: {
      demo: mockVideoAllowed(),
      label: mockVideoAllowed() ? 'โหมดทดลอง (Mock)' : 'โหมดใช้งานจริง',
      hasCreatomateKey: !!config.creatomateApiKey,
    },
  });
});

app.post('/api/task', async (req, res) => {
  const { description } = req.body as { description?: string };
  if (!description) return res.status(400).json({ error: 'description required' });
  const supervisor = new SupervisorAgent();
  // Run async — don't block the HTTP response
  supervisor.run(description).catch(e => logger.error(`Task error: ${e.message}`));
  res.json({ ok: true, message: 'Task started' });
});

app.get('/', (_req, res) => {
  res.send(getDashboardHtml());
});

io.on('connection', async (socket) => {
  const [clis, keys] = await Promise.all([checkAllClis(), Promise.resolve(checkApiKeys())]);
  socket.emit('init', {
    agents: Array.from(agentStates.values()),
    tasks: tasks.slice(0, 20),
    logs: logs.slice(-50),
    cliStatus: { claude: clis['claude'].ok, codex: clis['codex'].ok, gemini: clis['gemini'].ok },
    apiStatus: keys,
  });
});

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ศูนย์ควบคุม Multi-Agent</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    header { background: #1e293b; padding: 16px 24px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    header h1 { font-size: 1.4rem; color: #38bdf8; }
    header span { font-size: 0.8rem; color: #64748b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 16px; }
    .card h2 { font-size: 0.9rem; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .agent-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #1e3a5f22; }
    .agent-row:last-child { border-bottom: none; }
    .badge { padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; font-weight: 600; }
    .idle { background: #334155; color: #94a3b8; }
    .running { background: #1d4ed8; color: #bfdbfe; }
    .blocked { background: #92400e; color: #fde68a; }
    .failed { background: #991b1b; color: #fecaca; }
    .completed { background: #166534; color: #bbf7d0; }
    .agent-name { flex: 1; font-size: 0.85rem; }
    .agent-task { font-size: 0.75rem; color: #64748b; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .log-box { height: 220px; overflow-y: auto; font-family: monospace; font-size: 0.72rem; }
    .log-line { padding: 2px 0; border-bottom: 1px solid #0f172a44; }
    .log-info { color: #7dd3fc; }
    .log-warn { color: #fde68a; }
    .log-error { color: #fca5a5; }
    .api-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .api-item { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot-ok { background: #22c55e; }
    .dot-missing { background: #ef4444; }
    .dot-warn { background: #f59e0b; }
    .mode-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 0.72rem; font-weight: 700; margin-left: 10px; }
    .mode-demo { background: #78350f; color: #fde68a; }
    .mode-real { background: #14532d; color: #86efac; }
    .task-form { display: flex; gap: 8px; margin-bottom: 12px; }
    .task-form input { flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; color: #e2e8f0; font-size: 0.85rem; }
    .task-form button { background: #2563eb; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 0.85rem; }
    .task-form button:hover { background: #1d4ed8; }
    .task-item { padding: 8px; border-radius: 6px; background: #0f172a; margin-bottom: 6px; font-size: 0.78rem; }
    .task-item .task-desc { font-weight: 600; margin-bottom: 4px; }
    .task-item .task-status { color: #64748b; }
    .report-box { max-height: 180px; overflow-y: auto; font-size: 0.75rem; background: #0f172a; border-radius: 6px; padding: 10px; white-space: pre-wrap; word-break: break-word; }
    .full-width { grid-column: 1 / -1; }
    .col-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    @media (max-width: 900px) { .col-3 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<header>
  <h1>🎬 ศูนย์ควบคุม Multi-Agent<span id="mode-badge" class="mode-badge mode-demo">โหมดทดลอง</span></h1>
  <span id="conn-status">กำลังเชื่อมต่อ...</span>
</header>

<div class="grid">
  <!-- สถานะเอเจนต์ -->
  <div class="card">
    <h2>สถานะเอเจนต์</h2>
    <div id="agent-list"></div>
  </div>

  <!-- สถานะ API -->
  <div class="card">
    <h2>สถานะ API และ CLI</h2>
    <div id="api-status" class="api-grid"></div>
  </div>

  <!-- คิวงาน / สั่งงาน -->
  <div class="card">
    <h2>งานที่กำลังทำ / คิวงาน</h2>
    <div class="task-form">
      <input id="task-input" placeholder="ป้อนงาน เช่น สร้างวิดีโอ TikTok เกี่ยวกับการออมเงิน..." />
      <button onclick="submitTask()">เริ่มงาน</button>
    </div>
    <div id="task-list"></div>
  </div>

  <!-- บันทึกการทำงาน -->
  <div class="card">
    <h2>บันทึกการทำงาน</h2>
    <div id="log-box" class="log-box"></div>
  </div>

  <!-- ไฟล์ผลลัพธ์ / รายงาน -->
  <div class="card full-width">
    <h2>ไฟล์ผลลัพธ์ / รายงานสรุป</h2>
    <div id="report-box" class="report-box">ยังไม่มีรายงาน — รันงานก่อน</div>
  </div>
</div>

<script>
  const socket = io();

  socket.on('connect', () => {
    document.getElementById('conn-status').textContent = 'เชื่อมต่อแล้ว ✓';
  });
  socket.on('disconnect', () => {
    document.getElementById('conn-status').textContent = 'ขาดการเชื่อมต่อ ✗';
  });

  socket.on('init', (data) => {
    renderAgents(data.agents);
    renderApiStatus(data.apiStatus, data.cliStatus, data.renderMode);
    data.logs.forEach(appendLog);
    data.tasks.forEach(updateTask);
    if (data.renderMode) applyRenderMode(data.renderMode);
  });

  socket.on('agent:update', (ev) => {
    updateAgentState(ev.agent, ev.status, ev.task);
  });

  socket.on('log', appendLog);
  socket.on('task:update', updateTask);

  const agentMap = {};

  function renderAgents(agents) {
    const el = document.getElementById('agent-list');
    el.innerHTML = '';
    agents.forEach(a => {
      agentMap[a.name] = a;
      el.innerHTML += agentRow(a);
    });
  }

  function agentRow(a) {
    return \`<div class="agent-row" id="agent-\${a.name}">
      <span class="badge \${a.status}">\${statusThai(a.status)}</span>
      <span class="agent-name">\${a.thaiLabel}</span>
      <span class="agent-task" title="\${a.currentTask}">\${a.currentTask || '-'}</span>
    </div>\`;
  }

  function statusThai(s) {
    return { idle: 'ว่าง', running: 'กำลังทำ', blocked: 'ติดขัด', failed: 'ผิดพลาด', completed: 'เสร็จ' }[s] || s;
  }

  function updateAgentState(name, status, task) {
    const row = document.getElementById('agent-' + name);
    if (!row) return;
    row.querySelector('.badge').className = 'badge ' + status;
    row.querySelector('.badge').textContent = statusThai(status);
    row.querySelector('.agent-task').textContent = task || '-';
    row.querySelector('.agent-task').title = task || '';
  }

  function applyRenderMode(renderMode) {
    const badge = document.getElementById('mode-badge');
    if (!badge) return;
    if (renderMode.demo) {
      badge.textContent = 'โหมดทดลอง';
      badge.className = 'mode-badge mode-demo';
    } else {
      badge.textContent = 'โหมดใช้งานจริง';
      badge.className = 'mode-badge mode-real';
    }
  }

  function renderApiStatus(apiStatus, cliStatus, renderMode) {
    const el = document.getElementById('api-status');
    const creatomateOk = apiStatus['CREATOMATE_API_KEY'];
    const all = { ...apiStatus, 'Claude CLI': cliStatus.claude, 'Codex CLI': cliStatus.codex, 'Gemini CLI': cliStatus.gemini };
    el.innerHTML = Object.entries(all).map(([k, ok]) => {
      const isMockVideo = k === 'CREATOMATE_API_KEY' && !ok && renderMode?.demo;
      const dotClass = ok ? 'dot-ok' : isMockVideo ? 'dot-warn' : 'dot-missing';
      const label = isMockVideo ? \`\${k} <small style="color:#f59e0b">(mock)</small>\` : k;
      return \`<div class="api-item"><div class="dot \${dotClass}"></div>\${label}</div>\`;
    }).join('');
  }

  function appendLog(ev) {
    const box = document.getElementById('log-box');
    const line = document.createElement('div');
    line.className = 'log-line log-' + ev.level;
    const t = new Date(ev.timestamp).toLocaleTimeString('th');
    line.textContent = \`[\${t}] [\${ev.agent}] \${ev.message}\`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  const taskStore = {};

  function updateTask(task) {
    taskStore[task.id] = task;
    renderTasks();
    if (task.finalReport) {
      document.getElementById('report-box').textContent = task.finalReport;
    }
  }

  function renderTasks() {
    const el = document.getElementById('task-list');
    const sorted = Object.values(taskStore).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
    el.innerHTML = sorted.map(t => \`<div class="task-item">
      <div class="task-desc">\${t.description.slice(0, 80)}</div>
      <div class="task-status">\${t.status} | ขั้นตอน: \${t.steps.length} | \${t.steps.filter(s => s.status === 'done').length} เสร็จ</div>
    </div>\`).join('');
  }

  async function submitTask() {
    const input = document.getElementById('task-input');
    const desc = input.value.trim();
    if (!desc) return;
    input.value = '';
    const res = await fetch('/api/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc }),
    });
    const data = await res.json();
    if (!data.ok) alert('Error: ' + data.error);
  }

  document.getElementById('task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitTask();
  });
</script>
</body>
</html>`;
}

const port = config.appPort;
httpServer.listen(port, () => {
  ensureDirs();
  logger.info(`Dashboard running at http://localhost:${port}`);
  logger.info('Press Ctrl+C to stop');
});

export { app, httpServer };
