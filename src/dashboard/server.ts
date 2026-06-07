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

// ─── Agent registry (all 12 agents) ─────────────────────────────────────────
const AGENT_LABELS: Record<AgentName, string> = {
  'supervisor':      'ผู้ควบคุม (Supervisor)',
  'trend-research':  'วิจัยเทรนด์',
  'claude-builder':  'นักเขียนสคริปต์ (Claude)',
  'asset-finder':    'หา Asset (Pexels)',
  'voiceover':       'สร้างเสียง (ElevenLabs)',
  'subtitle':        'สร้าง Subtitle',
  'video-render':    'ตัดต่อวิดีโอ (Creatomate)',
  'qa':              'ตรวจคุณภาพ (QA)',
  'publisher':       'เผยแพร่',
  'analytics':       'วิเคราะห์ผล',
  'codex-reviewer':  'Codex Reviewer',
  'gemini-research': 'Gemini Research',
};

const agentStates: Map<AgentName, AgentState> = new Map(
  (Object.keys(AGENT_LABELS) as AgentName[]).map(name => [
    name,
    { name, thaiLabel: AGENT_LABELS[name], status: 'idle', currentTask: '', lastUpdated: Date.now() },
  ])
);

const logs: { level: string; agent: string; message: string; timestamp: number }[] = [];
const tasks: Task[] = [];
const MAX_LOGS = 300;

// ─── Event bus → Socket.io bridge ────────────────────────────────────────────
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

// ─── Express + Socket.io ──────────────────────────────────────────────────────
const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketIO(httpServer, { cors: { origin: '*' } });

app.get('/health', (_req, res) => res.json({ ok: true, name: 'AI Agent Ops Control Center' }));

async function buildState() {
  const [clis, keys] = await Promise.all([checkAllClis(), Promise.resolve(checkApiKeys())]);
  return {
    agents: Array.from(agentStates.values()),
    tasks: tasks.slice(0, 30),
    logs: logs.slice(-80),
    cliStatus: { claude: clis['claude'].ok, codex: clis['codex'].ok, gemini: clis['gemini'].ok },
    apiStatus: keys,
    renderMode: {
      demo: mockVideoAllowed(),
      label: mockVideoAllowed() ? 'โหมดทดลอง (Mock)' : 'โหมดใช้งานจริง',
      hasCreatomateKey: !!config.creatomateApiKey,
    },
  };
}

app.get('/api/state', async (_req, res) => res.json(await buildState()));

app.post('/api/task', async (req, res) => {
  const { description } = req.body as { description?: string };
  if (!description) return res.status(400).json({ error: 'description required' });
  const supervisor = new SupervisorAgent();
  supervisor.run(description).catch(e => logger.error(`Task error: ${e.message}`));
  res.json({ ok: true });
});

app.get('/', (_req, res) => res.send(getDashboardHtml()));

io.on('connection', async (socket) => {
  socket.emit('init', await buildState());
});

// ─── Dashboard HTML ───────────────────────────────────────────────────────────
function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Agent Ops Control Center</title>
<script src="/socket.io/socket.io.js"></script>
<style>
:root{
  --bg:#060c18;--surf:#0d1526;--surf2:#111d33;--surf3:#162040;
  --bdr:#1c2d4a;--bdr2:#243660;
  --txt:#e2e8f0;--dim:#94a3b8;--muted:#64748b;
  --blue:#3b82f6;--blue-d:#1d4ed8;--blue-dim:#1e3a6b;
  --green:#10b981;--green-dim:#052a1a;
  --amber:#f59e0b;--amber-dim:#2a1a05;
  --red:#ef4444;--red-dim:#2a0505;
  --purple:#8b5cf6;--purple-dim:#1e1040;
  --sidebar:220px;--hdr:56px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:'Segoe UI',Arial,sans-serif;height:100vh;overflow:hidden}
code{font-family:'Consolas','Courier New',monospace}

/* ── Layout ── */
#app{height:100vh;display:grid;grid-template-rows:var(--hdr) 36px 1fr;overflow:hidden}
#layout{display:grid;grid-template-columns:var(--sidebar) 1fr;overflow:hidden}
#content{overflow-y:auto;padding:20px;background:var(--bg)}

/* ── Header ── */
#hdr{
  background:#080e1e;border-bottom:1px solid var(--bdr);
  display:flex;align-items:center;padding:0 18px;gap:12px;z-index:20;
}
.hdr-brand{display:flex;align-items:center;gap:10px;min-width:260px}
.hdr-logo{font-size:1.4rem;line-height:1}
.hdr-title{font-size:0.92rem;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.hdr-sub{font-size:0.67rem;color:var(--muted);margin-top:1px}
.hdr-mid{flex:1;display:flex;align-items:center;justify-content:center;gap:14px}
.hdr-clock{font-family:monospace;font-size:0.95rem;color:var(--dim);letter-spacing:.08em}
.sys-badge{padding:3px 11px;border-radius:99px;font-size:.7rem;font-weight:700;display:flex;align-items:center;gap:5px}
.sys-ok{background:var(--green-dim);color:var(--green);border:1px solid #0d4a2a}
.sys-warn{background:var(--amber-dim);color:var(--amber);border:1px solid #4a2d0d}
.sys-err{background:var(--red-dim);color:var(--red);border:1px solid #4a0d0d}
.hdr-right{display:flex;gap:7px;align-items:center}

/* ── Buttons ── */
.btn{padding:5px 13px;border-radius:6px;border:1px solid transparent;cursor:pointer;font-size:.76rem;font-weight:600;transition:all .15s;white-space:nowrap}
.btn-primary{background:var(--blue);color:#fff;border-color:var(--blue-d)}
.btn-primary:hover{background:var(--blue-d)}
.btn-danger{background:var(--red-dim);color:var(--red);border-color:#4a0d0d}
.btn-danger:hover{background:#3a0808}
.btn-ghost{background:transparent;color:var(--muted);border-color:var(--bdr)}
.btn-ghost:hover{background:var(--surf2);color:var(--txt)}
.btn-sm{padding:4px 10px;font-size:.72rem}

/* ── Sidebar ── */
#sidebar{
  background:#080e1e;border-right:1px solid var(--bdr);
  display:flex;flex-direction:column;overflow-y:auto;
}
.nav-sep{padding:14px 14px 4px;font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.nav-item{
  display:flex;align-items:center;gap:9px;padding:8px 16px;
  color:var(--muted);cursor:pointer;font-size:.8rem;
  border-left:3px solid transparent;transition:all .15s;user-select:none;
}
.nav-item:hover{background:var(--surf2);color:var(--txt)}
.nav-item.active{background:var(--surf2);color:var(--blue);border-left-color:var(--blue);font-weight:600}
.nav-icon{width:16px;text-align:center;font-size:.9rem}
.sb-bottom{margin-top:auto;padding:12px 14px;border-top:1px solid var(--bdr);font-size:.7rem;color:var(--muted)}
.sb-row{display:flex;justify-content:space-between;padding:2px 0}
.sb-mock{margin-top:8px;padding:4px 8px;border-radius:4px;background:var(--amber-dim);color:var(--amber);border:1px solid #4a2d0d;font-size:.67rem;text-align:center}

/* ── Sections ── */
.section{display:none}
.section.active{display:block}
.pg-title{font-size:1.05rem;font-weight:700;margin-bottom:3px}
.pg-sub{font-size:.76rem;color:var(--muted);margin-bottom:18px}

/* ── Cards ── */
.card{background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:15px}
.card-title{font-size:.74rem;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:11px;font-weight:600;display:flex;align-items:center;gap:6px}

/* ── Stat row ── */
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.stat-card{background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:13px 15px}
.stat-lbl{font-size:.7rem;color:var(--muted);margin-bottom:5px}
.stat-val{font-size:1.55rem;font-weight:700;line-height:1}
.stat-sub{font-size:.65rem;color:var(--muted);margin-top:3px}
.c-blue{color:var(--blue)}.c-green{color:var(--green)}.c-amber{color:var(--amber)}.c-red{color:var(--red)}

/* ── Overview grid ── */
.ov-grid{display:grid;grid-template-columns:1fr 320px;gap:14px}
.ov-right{display:flex;flex-direction:column;gap:14px}

/* ── Agent compact cards ── */
.ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:9px}
.ag-card{background:var(--surf);border:1px solid var(--bdr);border-radius:8px;padding:11px;transition:border-color .2s}
.ag-card:hover{border-color:var(--bdr2)}
.ag-top{display:flex;align-items:center;gap:7px;margin-bottom:7px}
.ag-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.d-idle{background:var(--muted)}.d-running{background:var(--blue);animation:pulse 1.4s ease-in-out infinite}
.d-blocked{background:var(--amber)}.d-failed{background:var(--red)}.d-completed{background:var(--green)}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.ag-name{font-size:.76rem;font-weight:600;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ag-badge{font-size:.63rem;padding:2px 6px;border-radius:99px;font-weight:700;flex-shrink:0}
.b-idle{background:#1e293b;color:var(--muted)}.b-running{background:var(--blue-dim);color:#93c5fd}
.b-blocked{background:#3b2200;color:var(--amber)}.b-failed{background:#3b0000;color:#fca5a5}
.b-completed{background:var(--green-dim);color:#6ee7b7}
.ag-task{font-size:.67rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-time{font-size:.62rem;color:#475569;margin-top:3px}

/* ── Briefing ── */
.brief-row{padding:7px 0;border-bottom:1px solid var(--bdr)}
.brief-row:last-child{border-bottom:none}
.brief-lbl{font-size:.67rem;color:var(--muted);margin-bottom:3px}
.brief-val{font-size:.76rem}

/* ── Mini log ── */
.log-mini{height:190px;overflow-y:auto;font-family:'Consolas',monospace;font-size:.68rem}
.log-line{padding:2px 3px;border-bottom:1px solid #080e1e;display:flex;gap:7px}
.lt{color:#475569;flex-shrink:0}.la{color:#536280;flex-shrink:0;min-width:75px}
.lv-info{color:#7dd3fc}.lv-warn{color:#fde68a}.lv-error{color:#fca5a5}

/* ── Agent detail grid ── */
.ad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.ad-card{background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:15px}
.ad-hdr{display:flex;gap:11px;margin-bottom:11px}
.ad-icon{font-size:1.35rem;line-height:1}
.ad-name{font-size:.86rem;font-weight:700}
.ad-role{font-size:.7rem;color:var(--muted);margin-top:2px;line-height:1.4}
.ad-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:.76rem}
.ad-key{color:var(--muted)}
.ad-task{font-size:.69rem;color:var(--dim);padding:6px 8px;background:var(--surf2);border-radius:4px;margin-top:7px;min-height:26px;line-height:1.4}
.prog-bar{height:3px;background:var(--bdr);border-radius:2px;margin:7px 0 4px;overflow:hidden}
.prog-fill{height:100%;background:var(--blue);border-radius:2px;animation:prog 2.5s ease-in-out infinite}
@keyframes prog{0%{width:20%}50%{width:80%}100%{width:20%}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes glow{0%,100%{box-shadow:0 0 4px rgba(59,130,246,.3)}50%{box-shadow:0 0 14px rgba(59,130,246,.8),0 0 28px rgba(59,130,246,.3)}}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes scanline{0%{top:0}100%{top:100%}}
@keyframes countUp{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}

/* Running card glow */
.ag-card.is-running{border-color:var(--blue) !important;animation:glow 2s ease-in-out infinite}
.ad-card.is-running{border-color:var(--blue) !important;animation:glow 2s ease-in-out infinite}
.ag-icon-float{display:inline-block;animation:float 3s ease-in-out infinite}

/* Log entry slide-in */
.log-line{animation:fadeSlideIn .25s ease}

/* Scanline overlay on running pipeline stage */
.pipe-stage.is-running{border-color:var(--blue);overflow:hidden}
.pipe-stage.is-running::before{content:'';position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--blue),transparent);animation:scanline 2s linear infinite;z-index:1}

/* Sim control bar */
.sim-bar{display:flex;align-items:center;gap:7px;padding:6px 16px;background:#060e20;border-bottom:1px solid var(--bdr);font-size:.72rem}
.sim-label{color:var(--muted);margin-right:2px}
.sim-dot{width:6px;height:6px;border-radius:50%;background:var(--muted);display:inline-block;margin-right:4px;transition:background .3s}
.sim-dot.active{background:var(--green);animation:pulse 1.2s ease-in-out infinite}
.sim-speed{background:var(--surf);border:1px solid var(--bdr);color:var(--txt);border-radius:4px;padding:2px 6px;font-size:.7rem;cursor:pointer}

/* Stat card animation on change */
.stat-val.bump{animation:countUp .3s ease}

/* ── Pipeline ── */
.pipe-wrap{overflow-x:auto;padding-bottom:4px}
.pipeline{display:flex;align-items:stretch;min-width:860px;padding:2px}
.pipe-stage{
  flex:1;background:var(--surf);border:1px solid var(--bdr);border-radius:8px;
  padding:11px 8px;text-align:center;position:relative;margin-right:26px;
}
.pipe-stage:last-child{margin-right:0}
.pipe-stage::after{content:'→';position:absolute;right:-20px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:.9rem}
.pipe-stage:last-child::after{display:none}
.p-icon{font-size:1.1rem;margin-bottom:3px}
.p-name{font-size:.7rem;font-weight:600;margin-bottom:2px}
.p-agent{font-size:.62rem;color:var(--muted)}
.p-badge{font-size:.62rem;margin-top:5px;padding:2px 6px;border-radius:4px;display:inline-block}
.p-idle{background:#1e293b;color:var(--muted)}
.p-running{background:var(--blue-dim);color:#93c5fd}
.p-done{background:var(--green-dim);color:#6ee7b7}
.p-failed{background:#3b0000;color:#fca5a5}

/* ── Task list ── */
.task-item{background:var(--surf);border:1px solid var(--bdr);border-radius:8px;padding:12px 14px;margin-bottom:8px}
.t-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.t-desc{font-size:.83rem;font-weight:600}
.t-meta{font-size:.63rem;color:var(--muted);font-family:monospace;margin-top:2px}
.t-steps{display:flex;gap:4px;flex-wrap:wrap}
.sc{font-size:.63rem;padding:2px 7px;border-radius:99px;background:var(--surf2);color:var(--muted)}
.sc-done{background:var(--green-dim);color:#6ee7b7}
.sc-running{background:var(--blue-dim);color:#93c5fd}
.sc-failed{background:#3b0000;color:#fca5a5}

/* ── Log full ── */
.log-full-box{height:calc(100vh - 195px);overflow-y:auto;font-family:'Consolas',monospace;font-size:.71rem;background:var(--surf);border:1px solid var(--bdr);border-radius:8px;padding:10px}
.log-filter-row{display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap}
.lf-btn{padding:4px 12px;border-radius:4px;border:1px solid var(--bdr);background:var(--surf);color:var(--muted);cursor:pointer;font-size:.73rem}
.lf-btn.active{background:var(--surf2);color:var(--txt);border-color:var(--bdr2)}

/* ── Integration cards ── */
.int-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:11px}
.int-card{background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:15px}
.int-hdr{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.int-icon{font-size:1.25rem}
.int-name{font-size:.84rem;font-weight:700}
.int-type{font-size:.62rem;color:var(--muted)}
.int-status{font-size:.7rem;padding:3px 10px;border-radius:99px;font-weight:600;margin-bottom:8px;display:inline-block}
.is-ok{background:var(--green-dim);color:var(--green);border:1px solid #0d4a2a}
.is-mock{background:var(--amber-dim);color:var(--amber);border:1px solid #4a2d0d}
.is-miss{background:#1e293b;color:var(--muted);border:1px solid var(--bdr)}
.int-desc{font-size:.7rem;color:var(--muted);line-height:1.5}
.int-key{font-size:.65rem;font-family:monospace;color:#475569;margin-top:6px;padding:3px 6px;background:var(--surf2);border-radius:3px;display:inline-block}

/* ── Settings table ── */
.stbl{width:100%;border-collapse:collapse}
.stbl th{text-align:left;padding:7px 12px;font-size:.7rem;color:var(--muted);border-bottom:1px solid var(--bdr)}
.stbl td{padding:7px 12px;font-size:.76rem;border-bottom:1px solid #080e1e}
.stbl tr:hover td{background:var(--surf2)}
.k-ok{color:var(--green)}.k-miss{color:var(--red)}

/* ── Report box ── */
.report-box{font-size:.78rem;white-space:pre-wrap;word-break:break-word;background:var(--surf);border:1px solid var(--bdr);border-radius:8px;padding:18px;min-height:180px;line-height:1.7}

/* ── Modal ── */
.modal-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center}
.modal-ov.open{display:flex}
.modal{background:var(--surf);border:1px solid var(--bdr2);border-radius:12px;padding:24px;width:510px;max-width:92vw}
.modal-title{font-size:1rem;font-weight:700;margin-bottom:14px}
.modal-inp{width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:10px 13px;color:var(--txt);font-size:.84rem;margin-bottom:10px;outline:none;resize:vertical;min-height:60px}
.modal-inp:focus{border-color:var(--blue)}
.modal-hint{font-size:.7rem;color:var(--muted);margin-bottom:12px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}

/* ── Queue input ── */
.q-row{display:flex;gap:9px;margin-bottom:8px}
.q-inp{flex:1;background:var(--bg);border:1px solid var(--bdr);border-radius:6px;padding:9px 13px;color:var(--txt);font-size:.83rem;outline:none}
.q-inp:focus{border-color:var(--blue)}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--surf)}
::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--bdr2)}

/* ── Responsive ── */
@media(max-width:1100px){.ov-grid{grid-template-columns:1fr}.stats-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:750px){:root{--sidebar:0px}#sidebar{display:none}.stats-row{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>

<!-- ─── MODAL: New Task ─────────────────────────────────────────────────────── -->
<div id="modal-task" class="modal-ov">
  <div class="modal">
    <div class="modal-title">🚀 เริ่มงานใหม่</div>
    <textarea id="task-inp" class="modal-inp" rows="3" placeholder="อธิบายงานที่ต้องการ เช่น: สร้างวิดีโอ TikTok 30 วินาทีเกี่ยวกับการอ่าน Market Structure แบบ ICT..."></textarea>
    <div class="modal-hint">Supervisor Agent จะรับงานและมอบหมายให้เอเจนต์ที่เกี่ยวข้องโดยอัตโนมัติ</div>
    <div class="modal-actions">
      <button onclick="closeModal()" class="btn btn-ghost">ยกเลิก</button>
      <button onclick="submitModal()" class="btn btn-primary">เริ่มงาน →</button>
    </div>
  </div>
</div>

<!-- ─── APP ──────────────────────────────────────────────────────────────────── -->
<div id="app">

  <!-- HEADER -->
  <header id="hdr">
    <div class="hdr-brand">
      <span class="hdr-logo">⚡</span>
      <div>
        <div class="hdr-title">AI Agent Ops Control Center</div>
        <div class="hdr-sub">ศูนย์ควบคุมการทำงานของ AI Agents</div>
      </div>
    </div>
    <div class="hdr-mid">
      <div id="sys-badge" class="sys-badge sys-warn">● กำลังเชื่อมต่อ...</div>
      <div id="hdr-clock" class="hdr-clock">--:--:--</div>
    </div>
    <div class="hdr-right">
      <button onclick="openModal()" class="btn btn-primary btn-sm">+ เริ่มงานใหม่</button>
      <button onclick="nav('report')" class="btn btn-ghost btn-sm">📋 รายงาน</button>
      <button onclick="nav('integrations')" class="btn btn-ghost btn-sm">🔌 APIs</button>
      <button onclick="nav('settings')" class="btn btn-ghost btn-sm">⚙</button>
    </div>
  </header>

  <!-- SIM BAR -->
  <div class="sim-bar">
    <span class="sim-label">Simulation:</span>
    <span id="sim-dot" class="sim-dot"></span>
    <span id="sim-status-txt" style="color:var(--muted)">หยุด</span>
    <span style="color:var(--bdr2);margin:0 4px">|</span>
    <button id="btn-sim-start" onclick="startSimulation()" class="btn btn-sm" style="background:var(--green-dim);color:var(--green);border-color:#0d4a2a;padding:2px 10px">▶ จำลอง</button>
    <button id="btn-sim-stop"  onclick="stopSimulation()"  class="btn btn-sm btn-ghost" style="padding:2px 10px" disabled>⏹ หยุด</button>
    <button onclick="resetAgents()" class="btn btn-sm btn-ghost" style="padding:2px 10px">↺ รีเซ็ต</button>
    <span style="color:var(--bdr2);margin:0 4px">|</span>
    <span class="sim-label">ความเร็ว:</span>
    <select id="sim-speed" class="sim-speed" onchange="setSimSpeed(this.value)">
      <option value="3000">ช้า (3s)</option>
      <option value="2000" selected>ปกติ (2s)</option>
      <option value="1000">เร็ว (1s)</option>
    </select>
    <span style="margin-left:auto;font-size:.67rem;color:var(--muted)" id="sim-tick-info">tick: 0</span>
  </div>

  <!-- LAYOUT -->
  <div id="layout">

    <!-- SIDEBAR -->
    <aside id="sidebar">
      <div class="nav-sep">เมนูหลัก</div>
      <div class="nav-item active" id="nav-overview" onclick="nav('overview')"><span class="nav-icon">🏠</span>ภาพรวมระบบ</div>
      <div class="nav-item" id="nav-agents" onclick="nav('agents')"><span class="nav-icon">🤖</span>เอเจนต์ทั้งหมด</div>
      <div class="nav-item" id="nav-tasks" onclick="nav('tasks')"><span class="nav-icon">▶</span>งานที่กำลังทำ</div>
      <div class="nav-item" id="nav-queue" onclick="nav('queue')"><span class="nav-icon">📋</span>คิวงาน</div>
      <div class="nav-sep">รายงาน</div>
      <div class="nav-item" id="nav-report" onclick="nav('report')"><span class="nav-icon">📊</span>รายงาน Supervisor</div>
      <div class="nav-item" id="nav-logs" onclick="nav('logs')"><span class="nav-icon">📜</span>Logs</div>
      <div class="nav-sep">ระบบ</div>
      <div class="nav-item" id="nav-integrations" onclick="nav('integrations')"><span class="nav-icon">🔌</span>Integrations</div>
      <div class="nav-item" id="nav-settings" onclick="nav('settings')"><span class="nav-icon">⚙</span>ตั้งค่า</div>
      <div class="sb-bottom">
        <div class="sb-row"><span>เอเจนต์ทำงาน</span><span id="sb-run" style="color:var(--blue)">0</span></div>
        <div class="sb-row"><span>งานสำเร็จ</span><span id="sb-done" style="color:var(--green)">0</span></div>
        <div class="sb-row"><span>งานผิดพลาด</span><span id="sb-err" style="color:var(--red)">0</span></div>
        <div id="sb-mock" class="sb-mock">⚠ Mock Mode Active</div>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main id="content">

      <!-- ── OVERVIEW ── -->
      <section id="sec-overview" class="section active">
        <div class="pg-title">ภาพรวมระบบ</div>
        <div class="pg-sub">สถานะการทำงานของ AI Agent Ops Control Center ทั้งหมด</div>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-lbl">เอเจนต์ที่กำลังทำงาน</div><div class="stat-val c-blue" id="s-running">0</div><div class="stat-sub">จาก 12 เอเจนต์</div></div>
          <div class="stat-card"><div class="stat-lbl">งานที่กำลังดำเนินการ</div><div class="stat-val c-amber" id="s-tasks">0</div><div class="stat-sub">ในระบบขณะนี้</div></div>
          <div class="stat-card"><div class="stat-lbl">งานสำเร็จ (Session)</div><div class="stat-val c-green" id="s-done">0</div><div class="stat-sub">เซสชันนี้</div></div>
          <div class="stat-card"><div class="stat-lbl">ข้อผิดพลาด</div><div class="stat-val c-red" id="s-fail">0</div><div class="stat-sub">ต้องตรวจสอบ</div></div>
        </div>
        <div class="ov-grid">
          <div>
            <div class="card" style="margin-bottom:14px">
              <div class="card-title">🤖 เอเจนต์ทั้งหมด (12)</div>
              <div id="ag-grid" class="ag-grid"></div>
            </div>
            <div class="card">
              <div class="card-title" style="justify-content:space-between">
                <span>▶ งานล่าสุด</span>
                <button onclick="openModal()" class="btn btn-primary btn-sm">+ ใหม่</button>
              </div>
              <div id="recent-tasks"></div>
            </div>
          </div>
          <div class="ov-right">
            <div class="card">
              <div class="card-title">🎯 รายงาน Supervisor</div>
              <div id="briefing">
                <div class="brief-row"><div class="brief-lbl">งานที่กำลังทำ</div><div class="brief-val" id="br-cur">รอรับงาน...</div></div>
                <div class="brief-row"><div class="brief-lbl">สิ่งที่เสร็จแล้ว</div><div class="brief-val" id="br-done">—</div></div>
                <div class="brief-row"><div class="brief-lbl">ปัญหาที่ต้องแก้</div><div class="brief-val" id="br-issues">ไม่มีปัญหา</div></div>
                <div class="brief-row"><div class="brief-lbl">ขั้นตอนถัดไป</div><div class="brief-val" id="br-next">รอรับคำสั่ง</div></div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">📜 กิจกรรมล่าสุด</div>
              <div id="mini-log" class="log-mini"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── AGENTS ── -->
      <section id="sec-agents" class="section">
        <div class="pg-title">เอเจนต์ทั้งหมด</div>
        <div class="pg-sub">12 AI Agents สำหรับผลิต Short-Form Content ครบวงจร</div>
        <div style="display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap">
          <button class="lf-btn active" onclick="filterAg('all',this)">ทั้งหมด (12)</button>
          <button class="lf-btn" onclick="filterAg('running',this)">🔵 กำลังทำงาน</button>
          <button class="lf-btn" onclick="filterAg('idle',this)">⚫ ว่าง</button>
          <button class="lf-btn" onclick="filterAg('blocked',this)">🟡 ติดขัด</button>
          <button class="lf-btn" onclick="filterAg('failed',this)">🔴 ผิดพลาด</button>
          <button class="lf-btn" onclick="filterAg('completed',this)">🟢 เสร็จ</button>
        </div>
        <div id="ad-grid" class="ad-grid"></div>
      </section>

      <!-- ── TASKS ── -->
      <section id="sec-tasks" class="section">
        <div class="pg-title">งานที่กำลังทำ</div>
        <div class="pg-sub">Pipeline การผลิต Content จาก Trend Research ถึง Analytics</div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">⚙ Pipeline ผลิต Content</div>
          <div class="pipe-wrap"><div id="pipeline" class="pipeline"></div></div>
        </div>
        <div class="card">
          <div class="card-title" style="justify-content:space-between">
            <span>รายการงาน</span>
            <button onclick="openModal()" class="btn btn-primary btn-sm">+ งานใหม่</button>
          </div>
          <div id="task-list"></div>
        </div>
      </section>

      <!-- ── QUEUE ── -->
      <section id="sec-queue" class="section">
        <div class="pg-title">คิวงาน</div>
        <div class="pg-sub">เพิ่มงานใหม่และติดตามสถานะทุกงาน</div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-title">+ เพิ่มงานใหม่</div>
          <div class="q-row">
            <input id="q-inp" class="q-inp" placeholder="อธิบายงานที่ต้องการ เช่น: สร้างวิดีโอ TikTok เกี่ยวกับ ICT Concepts..." />
            <button onclick="submitQueue()" class="btn btn-primary">เริ่มงาน →</button>
          </div>
          <div style="font-size:.7rem;color:var(--muted)">ตัวอย่าง: "อธิบายการอ่าน Marketstructure เบื้องต้น 40 วินาที สำหรับนักเทรดมือใหม่"</div>
        </div>
        <div class="card">
          <div class="card-title">รายการงานทั้งหมด</div>
          <div id="queue-list"></div>
        </div>
      </section>

      <!-- ── REPORT ── -->
      <section id="sec-report" class="section">
        <div class="pg-title">รายงาน Supervisor</div>
        <div class="pg-sub">ผลลัพธ์สุดท้ายจาก Supervisor Agent — อัปเดตอัตโนมัติเมื่องานเสร็จ</div>
        <div id="report-box" class="report-box">ยังไม่มีรายงาน — รันงานก่อน รายงานจะปรากฏที่นี่โดยอัตโนมัติ</div>
      </section>

      <!-- ── LOGS ── -->
      <section id="sec-logs" class="section">
        <div class="pg-title">Logs</div>
        <div class="pg-sub">บันทึกการทำงานของระบบแบบ Real-time</div>
        <div class="log-filter-row">
          <button class="lf-btn active" onclick="setLogFilter('all',this)">ทั้งหมด</button>
          <button class="lf-btn" style="color:#7dd3fc" onclick="setLogFilter('info',this)">INFO</button>
          <button class="lf-btn" style="color:#fde68a" onclick="setLogFilter('warn',this)">WARN</button>
          <button class="lf-btn" style="color:#fca5a5" onclick="setLogFilter('error',this)">ERROR</button>
          <button class="lf-btn" style="margin-left:auto;color:var(--red)" onclick="clearLogs()">ล้าง</button>
        </div>
        <div id="log-full" class="log-full-box"></div>
      </section>

      <!-- ── INTEGRATIONS ── -->
      <section id="sec-integrations" class="section">
        <div class="pg-title">Integrations</div>
        <div class="pg-sub">สถานะการเชื่อมต่อ API และ CLI Tools ทั้งหมด</div>
        <div id="int-grid" class="int-grid"></div>
      </section>

      <!-- ── SETTINGS ── -->
      <section id="sec-settings" class="section">
        <div class="pg-title">ตั้งค่า</div>
        <div class="pg-sub">Environment Variables และการกำหนดค่าระบบ</div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-title">🔑 สถานะ API Keys และ CLI Tools</div>
          <table class="stbl">
            <tr><th>ตัวแปร / เครื่องมือ</th><th>สถานะ</th><th>ใช้กับ Agent</th></tr>
            <tbody id="stbl-body"></tbody>
          </table>
        </div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-title">📄 วิธีตั้งค่า</div>
          <div style="font-size:.8rem;line-height:1.9;color:var(--dim)">
            <div>1. คัดลอกไฟล์ <code style="color:var(--blue)">.env.example</code> เป็น <code style="color:var(--blue)">.env</code></div>
            <div>2. ใส่ API Keys ที่ต้องการในไฟล์ .env</div>
            <div>3. รีสตาร์ทเซิร์ฟเวอร์: <code style="color:var(--green)">npm run dev:dash</code></div>
            <div style="margin-top:10px;color:var(--amber)">⚠ หากไม่มี API Key ระบบทำงานในโหมด Mock อัตโนมัติ — ไม่ crash</div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">⚙ ข้อมูลระบบ</div>
          <div style="font-size:.78rem;color:var(--dim);line-height:1.8">
            <div>Project: <span style="color:var(--txt)">AI Agent Ops Control Center</span></div>
            <div>Framework: <span style="color:var(--txt)">Node.js + TypeScript + Express + Socket.io</span></div>
            <div>Dashboard: <span style="color:var(--txt)">http://localhost:3000</span></div>
            <div>CLI Task: <span style="color:var(--txt)">npm run dev task "..."</span></div>
            <div>Preflight: <span style="color:var(--txt)">npm run preflight</span></div>
          </div>
        </div>
      </section>

    </main>
  </div>
</div>

<script>
// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════
const agentStore = {};
const taskStore  = {};
const allLogs    = [];
let logFilter    = 'all';
let agFilter     = 'all';
let curSection   = 'overview';

// ══════════════════════════════════════════════════════════════════════════════
// AGENT & PIPELINE META
// ══════════════════════════════════════════════════════════════════════════════
const AMETA = {
  'supervisor':      { icon: '🎯', role: 'จัดการ มอบหมายงาน และรายงานผล' },
  'trend-research':  { icon: '🔍', role: 'ค้นหาหัวข้อ trending สำหรับ short-form content' },
  'claude-builder':  { icon: '✍️', role: 'เขียนสคริปต์วิดีโอด้วย Claude AI' },
  'asset-finder':    { icon: '🎬', role: 'ค้นหา stock video/photo จาก Pexels' },
  'voiceover':       { icon: '🎙️', role: 'สร้างเสียงพูดภาษาไทย/อังกฤษ (ElevenLabs)' },
  'subtitle':        { icon: '📝', role: 'สร้างคำบรรยาย subtitle อัตโนมัติ' },
  'video-render':    { icon: '🎥', role: 'เรนเดอร์และตัดต่อวิดีโอ 9:16 (Creatomate)' },
  'qa':              { icon: '✅', role: 'ตรวจสอบคุณภาพ ลิขสิทธิ์ และ platform policy' },
  'publisher':       { icon: '🚀', role: 'อัปโหลดไปยัง TikTok / YouTube / Instagram Reels' },
  'analytics':       { icon: '📊', role: 'ติดตาม engagement และ performance หลังเผยแพร่' },
  'codex-reviewer':  { icon: '🔎', role: 'ตรวจสอบคุณภาพและความปลอดภัย (Codex CLI)' },
  'gemini-research': { icon: '🌟', role: 'วิจัยเชิงลึกและตรวจสอบข้อมูล (Gemini CLI)' },
};

const PIPE = [
  { icon:'🔍', lbl:'วิจัยเทรนด์',  ag:'trend-research' },
  { icon:'✍️', lbl:'เขียนสคริปต์', ag:'claude-builder' },
  { icon:'🎬', lbl:'หา Asset',      ag:'asset-finder' },
  { icon:'🎙️', lbl:'สร้างเสียง',   ag:'voiceover' },
  { icon:'📝', lbl:'Subtitle',      ag:'subtitle' },
  { icon:'🎥', lbl:'ตัดต่อ',        ag:'video-render' },
  { icon:'✅', lbl:'QA',            ag:'qa' },
  { icon:'🚀', lbl:'เผยแพร่',       ag:'publisher' },
  { icon:'📊', lbl:'วิเคราะห์',     ag:'analytics' },
];

const INT_META = [
  { key:'claude',              name:'Claude CLI',   icon:'🤖', type:'CLI', env:null,                   desc:'เรียกใช้ Claude AI ผ่าน Command Line' },
  { key:'codex',               name:'Codex CLI',    icon:'🔎', type:'CLI', env:null,                   desc:'ตรวจสอบคุณภาพด้วย OpenAI Codex' },
  { key:'gemini',              name:'Gemini CLI',   icon:'🌟', type:'CLI', env:null,                   desc:'วิจัยและวิเคราะห์ด้วย Google Gemini' },
  { key:'CREATOMATE_API_KEY',  name:'Creatomate',   icon:'🎥', type:'API', env:'CREATOMATE_API_KEY',   desc:'เรนเดอร์วิดีโอ 9:16 สำหรับ short-form' },
  { key:'ELEVENLABS_API_KEY',  name:'ElevenLabs',  icon:'🎙️', type:'API', env:'ELEVENLABS_API_KEY',   desc:'สร้างเสียงพูดภาษาไทย/อังกฤษคุณภาพสูง' },
  { key:'PEXELS_API_KEY',      name:'Pexels',       icon:'📷', type:'API', env:'PEXELS_API_KEY',       desc:'ค้นหา stock video/photo royalty-free' },
  { key:'TIKTOK_API_KEY',      name:'TikTok API',  icon:'🎵', type:'API', env:'TIKTOK_API_KEY',       desc:'เผยแพร่วิดีโอไปยัง TikTok อัตโนมัติ' },
  { key:'YOUTUBE_API_KEY',     name:'YouTube API',  icon:'▶',  type:'API', env:'YOUTUBE_API_KEY',      desc:'อัปโหลด YouTube Shorts อัตโนมัติ' },
  { key:'META_API_KEY',        name:'Meta Reels',   icon:'📱', type:'API', env:'META_API_KEY',         desc:'เผยแพร่ Instagram Reels ผ่าน Meta API' },
];

const STBL_ROWS = [
  { k:'ANTHROPIC_API_KEY',   ag:'Supervisor / Claude Builder' },
  { k:'OPENAI_API_KEY',      ag:'Codex Reviewer' },
  { k:'GEMINI_API_KEY',      ag:'Gemini Research' },
  { k:'CREATOMATE_API_KEY',  ag:'Video Render Agent' },
  { k:'ELEVENLABS_API_KEY',  ag:'Voiceover Agent' },
  { k:'PEXELS_API_KEY',      ag:'Asset Finder Agent' },
  { k:'TIKTOK_API_KEY',      ag:'Publisher Agent (TikTok)' },
  { k:'YOUTUBE_API_KEY',     ag:'Publisher Agent (YouTube Shorts)' },
  { k:'META_API_KEY',        ag:'Publisher Agent (Instagram Reels)' },
  { k:'Claude CLI',          ag:'Script Writer (live CLI)' },
  { k:'Codex CLI',           ag:'Codex Reviewer (live CLI)' },
  { k:'Gemini CLI',          ag:'Gemini Research (live CLI)' },
];

// ══════════════════════════════════════════════════════════════════════════════
// SOCKET.IO
// ══════════════════════════════════════════════════════════════════════════════
const socket = io();

socket.on('connect', () => setSysBadge('warn','กำลังโหลด...'));
socket.on('disconnect', () => setSysBadge('err','ขาดการเชื่อมต่อ'));

socket.on('init', data => {
  data.agents.forEach(a => { agentStore[a.name] = a; });
  data.logs.forEach(l  => allLogs.push(l));
  if (data.tasks) data.tasks.forEach(t => { taskStore[t.id] = t; });

  renderAll();
  renderIntegrations(data.apiStatus, data.cliStatus);
  renderSettings(data.apiStatus, data.cliStatus);
  updateSysBadge(data.apiStatus, data.cliStatus);

  const hasMock = !data.renderMode?.hasCreatomateKey;
  document.getElementById('sb-mock').style.display = hasMock ? 'block' : 'none';
});

socket.on('agent:update', ev => {
  if (!agentStore[ev.agent]) agentStore[ev.agent] = { name:ev.agent, thaiLabel:ev.agent, status:'idle', currentTask:'', lastUpdated:ev.timestamp };
  agentStore[ev.agent].status = ev.status;
  agentStore[ev.agent].currentTask = ev.task;
  agentStore[ev.agent].lastUpdated = ev.timestamp;
  renderAgGrid(); renderAdGrid(); updateStats(); renderPipeline(); updateBriefing();
});

socket.on('log', ev => {
  allLogs.push(ev);
  if (allLogs.length > 500) allLogs.shift();
  appendLog(ev, document.getElementById('mini-log'), 80);
  if (logFilter === 'all' || ev.level === logFilter)
    appendLog(ev, document.getElementById('log-full'), null);
  updateStats();
});

socket.on('task:update', t => {
  taskStore[t.id] = t;
  renderTasks(); renderQueue(); updateStats(); updateBriefing();
  if (t.finalReport) document.getElementById('report-box').textContent = t.finalReport;
});

// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
function nav(s) {
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('[id^="nav-"]').forEach(el => el.classList.remove('active'));
  const sec = document.getElementById('sec-' + s);
  const ni  = document.getElementById('nav-' + s);
  if (sec) sec.classList.add('active');
  if (ni)  ni.classList.add('active');
  curSection = s;
  document.getElementById('content').scrollTop = 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════════════════
function renderAll() {
  renderAgGrid(); renderAdGrid(); renderTasks(); renderQueue(); renderPipeline();
  renderRecentLogs(); renderRecentTasks(); updateStats();
}

/* Compact agent grid (overview) */
function renderAgGrid() {
  const el = document.getElementById('ag-grid');
  if (!el) return;
  el.innerHTML = Object.values(agentStore).map(a => {
    const m = AMETA[a.name] || { icon:'🤖', role:'' };
    const isRun = a.status === 'running';
    return \`<div class="ag-card \${isRun ? 'is-running' : ''}">
      <div class="ag-top">
        <div class="ag-dot d-\${a.status}"></div>
        <span class="ag-name">\${isRun ? \`<span class='ag-icon-float'>\${m.icon}</span>\` : m.icon} \${a.thaiLabel}</span>
        <span class="ag-badge b-\${a.status}">\${stThai(a.status)}</span>
      </div>
      <div class="ag-task">\${esc(a.currentTask) || 'ว่าง'}</div>
      <div class="ag-time">\${timeAgo(a.lastUpdated)}</div>
    </div>\`;
  }).join('');
}

/* Detailed agent grid */
function renderAdGrid() {
  const el = document.getElementById('ad-grid');
  if (!el) return;
  const list = Object.values(agentStore).filter(a => agFilter === 'all' || a.status === agFilter);
  el.innerHTML = list.map(a => {
    const m = AMETA[a.name] || { icon:'🤖', role:'AI Agent' };
    const isRun = a.status === 'running';
    return \`<div class="ad-card \${isRun ? 'is-running' : ''}">
      <div class="ad-hdr">
        <div class="ad-icon \${isRun ? 'ag-icon-float' : ''}">\${m.icon}</div>
        <div><div class="ad-name">\${a.thaiLabel}</div><div class="ad-role">\${m.role}</div></div>
      </div>
      <div class="ad-row"><span class="ad-key">สถานะ</span><span class="ag-badge b-\${a.status}">\${stThai(a.status)}</span></div>
      <div class="ad-row"><span class="ad-key">อัปเดต</span><span style="font-size:.7rem;color:var(--dim)">\${timeAgo(a.lastUpdated)}</span></div>
      \${isRun ? '<div class="prog-bar"><div class="prog-fill"></div></div>' : ''}
      <div class="ad-task">\${esc(a.currentTask) || '—'}</div>
    </div>\`;
  }).join('') || '<div style="color:var(--muted);font-size:.8rem;padding:16px 0">ไม่พบเอเจนต์ที่ตรงกัน</div>';
}

/* Pipeline */
function renderPipeline() {
  const el = document.getElementById('pipeline');
  if (!el) return;
  el.innerHTML = PIPE.map(s => {
    const a = agentStore[s.ag];
    const st = a?.status || 'idle';
    const cls = st === 'running' ? 'p-running' : st === 'completed' ? 'p-done' : st === 'failed' ? 'p-failed' : 'p-idle';
    const lbl = { running:'กำลังทำ', completed:'เสร็จ', failed:'ผิดพลาด', idle:'รอ', blocked:'ติดขัด' }[st] || st;
    return \`<div class="pipe-stage \${st === 'running' ? 'is-running' : ''}" data-agent="\${s.ag}">
      <div class="p-icon \${st === 'running' ? 'ag-icon-float' : ''}">\${s.icon}</div>
      <div class="p-name">\${s.lbl}</div>
      <div class="p-agent">\${a?.thaiLabel || s.ag}</div>
      <div class="p-badge \${cls}">\${lbl}</div>
    </div>\`;
  }).join('');
}

/* Task list */
function renderTasks() {
  const el = document.getElementById('task-list');
  if (!el) return;
  const ts = Object.values(taskStore).sort((a,b) => b.createdAt - a.createdAt);
  if (!ts.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:14px 0">ยังไม่มีงาน — กด + เริ่มงานใหม่</div>'; return; }
  el.innerHTML = ts.slice(0,25).map(t => {
    const done = t.steps.filter(s => s.status === 'done').length;
    const chips = t.steps.map(s => \`<span class="sc sc-\${s.status}">\${s.agent}</span>\`).join('');
    const bst = t.status === 'done' ? 'completed' : t.status === 'running' ? 'running' : t.status === 'failed' ? 'failed' : 'idle';
    return \`<div class="task-item">
      <div class="t-hdr">
        <div><div class="t-desc">\${esc(t.description.slice(0,85))}\${t.description.length > 85 ? '…' : ''}</div>
        <div class="t-meta">\${t.id.slice(0,8)} · \${stThai(t.status)} · \${done}/\${t.steps.length} ขั้นตอน · \${new Date(t.createdAt).toLocaleTimeString('th')}</div></div>
        <span class="ag-badge b-\${bst}" style="flex-shrink:0;margin-left:8px">\${stThai(t.status)}</span>
      </div>
      <div class="t-steps">\${chips}</div>
    </div>\`;
  }).join('');
}

/* Queue list */
function renderQueue() {
  const el = document.getElementById('queue-list');
  if (!el) return;
  const ts = Object.values(taskStore).sort((a,b) => b.createdAt - a.createdAt);
  if (!ts.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:12px 0">คิวว่าง</div>'; return; }
  el.innerHTML = ts.slice(0,30).map(t => {
    const bst = t.status === 'done' ? 'completed' : t.status === 'running' ? 'running' : t.status === 'failed' ? 'failed' : 'idle';
    return \`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bdr)">
      <span class="ag-badge b-\${bst}" style="flex-shrink:0">\${stThai(t.status)}</span>
      <span style="flex:1;font-size:.8rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">\${esc(t.description)}</span>
      <span style="font-size:.67rem;color:var(--muted);flex-shrink:0">\${new Date(t.createdAt).toLocaleTimeString('th')}</span>
    </div>\`;
  }).join('');
}

/* Recent tasks (overview) */
function renderRecentTasks() {
  const el = document.getElementById('recent-tasks');
  if (!el) return;
  const ts = Object.values(taskStore).sort((a,b) => b.createdAt - a.createdAt).slice(0,6);
  if (!ts.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.78rem;padding:8px 0">ยังไม่มีงาน</div>'; return; }
  el.innerHTML = ts.map(t => {
    const bst = t.status === 'done' ? 'completed' : t.status === 'running' ? 'running' : t.status === 'failed' ? 'failed' : 'idle';
    return \`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #080e1e">
      <span class="ag-badge b-\${bst}" style="flex-shrink:0">\${stThai(t.status)}</span>
      <span style="font-size:.78rem;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">\${esc(t.description)}</span>
      <span style="font-size:.65rem;color:var(--muted);flex-shrink:0">\${timeAgo(t.createdAt)}</span>
    </div>\`;
  }).join('');
}

function renderRecentLogs() {
  const box = document.getElementById('mini-log');
  if (!box) return;
  box.innerHTML = '';
  allLogs.slice(-50).forEach(l => appendLog(l, box, null));
  box.scrollTop = box.scrollHeight;
}

function appendLog(ev, box, max) {
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'log-line';
  line.dataset.lv = ev.level;
  const t = new Date(ev.timestamp).toLocaleTimeString('th', { hour12:false });
  line.innerHTML = \`<span class="lt">\${t}</span><span class="la">[\${ev.agent}]</span><span class="lv-\${ev.level}">\${esc(ev.message)}</span>\`;
  box.appendChild(line);
  if (max) while (box.children.length > max) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

/* Integrations */
function renderIntegrations(api, cli) {
  const el = document.getElementById('int-grid');
  if (!el) return;
  el.innerHTML = INT_META.map(m => {
    const isApi = m.type === 'API';
    const ok = isApi ? api?.[m.key] : cli?.[m.key];
    const lbl = ok ? (isApi ? 'เชื่อมต่อแล้ว' : 'ติดตั้งแล้ว') : (isApi ? 'Mock Mode' : 'ยังไม่ได้ติดตั้ง');
    const cls = ok ? 'is-ok' : isApi ? 'is-mock' : 'is-miss';
    const note = !ok && isApi
      ? \`<div style="font-size:.67rem;color:var(--amber);margin-top:4px">⚠ ทำงานในโหมด Mock</div>\`
      : !ok && !isApi
        ? \`<div style="font-size:.67rem;color:var(--muted);margin-top:4px">ติดตั้ง: npm i -g \${m.key}-cli</div>\`
        : '';
    const envLine = !ok && m.env ? \`<div class="int-key">\${m.env}</div>\` : '';
    return \`<div class="int-card">
      <div class="int-hdr"><div class="int-icon">\${m.icon}</div><div><div class="int-name">\${m.name}</div><div class="int-type">\${m.type}</div></div></div>
      <div class="int-status \${cls}">\${lbl}</div>
      <div class="int-desc">\${m.desc}</div>
      \${envLine}\${note}
    </div>\`;
  }).join('');
}

/* Settings keys table */
function renderSettings(api, cli) {
  const el = document.getElementById('stbl-body');
  if (!el) return;
  el.innerHTML = STBL_ROWS.map(r => {
    const isCli = r.k.endsWith(' CLI');
    const ok = isCli ? cli?.[r.k.replace(' CLI','').toLowerCase()] : api?.[r.k];
    return \`<tr>
      <td><code style="color:var(--blue);font-size:.73rem">\${r.k}</code></td>
      <td class="\${ok ? 'k-ok' : 'k-miss'}">\${ok ? '✅ ตั้งค่าแล้ว' : '❌ ยังไม่ได้ตั้งค่า (Mock)'}</td>
      <td style="color:var(--muted)">\${r.ag}</td>
    </tr>\`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS & SYSTEM STATUS
// ══════════════════════════════════════════════════════════════════════════════
function updateStats() {
  const ags = Object.values(agentStore);
  const ts  = Object.values(taskStore);
  const run  = ags.filter(a => a.status === 'running').length;
  const tRun = ts.filter(t => t.status === 'running').length;
  const tDone= ts.filter(t => t.status === 'done').length;
  const tFail= ts.filter(t => t.status === 'failed').length;

  setText('s-running', run);
  setText('s-tasks',   tRun);
  setText('s-done',    tDone);
  setText('s-fail',    tFail);
  setText('sb-run',    run);
  setText('sb-done',   tDone);
  setText('sb-err',    tFail);
  renderRecentTasks();
}

function updateBriefing() {
  const ts = Object.values(taskStore);
  const running = ts.filter(t => t.status === 'running');
  const done    = ts.filter(t => t.status === 'done');
  const failed  = ts.filter(t => t.status === 'failed');
  setText('br-cur',    running.length ? running.map(t => esc(t.description.slice(0,50))).join(' / ') : 'ว่าง — รอรับงาน');
  setText('br-done',   done.length   ? \`\${done.length} งาน เสร็จแล้ว\` : '—');
  setText('br-issues', failed.length ? \`\${failed.length} งาน ผิดพลาด\` : 'ไม่มีปัญหา');
  setText('br-next',   running.length ? 'รอผลลัพธ์จากเอเจนต์' : done.length ? 'พร้อมรับงานใหม่' : 'รอรับคำสั่ง');
}

function updateSysBadge(api, cli) {
  const anyKey = Object.values(api || {}).some(v => v);
  const claudeOk = cli?.claude;
  if (anyKey || claudeOk) setSysBadge('warn','ออนไลน์ (บางส่วน Mock)');
  else setSysBadge('warn','ออนไลน์ — Mock Mode');
}

function setSysBadge(type, label) {
  const el = document.getElementById('sys-badge');
  if (!el) return;
  el.className = 'sys-badge sys-' + type;
  el.textContent = '● ' + label;
}

// ══════════════════════════════════════════════════════════════════════════════
// FILTERS
// ══════════════════════════════════════════════════════════════════════════════
function setLogFilter(lv, btn) {
  logFilter = lv;
  document.querySelectorAll('.log-filter-row .lf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const box = document.getElementById('log-full');
  box.innerHTML = '';
  allLogs.filter(l => lv === 'all' || l.level === lv).forEach(l => appendLog(l, box, null));
}

function filterAg(f, btn) {
  agFilter = f;
  document.querySelectorAll('#sec-agents .lf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAdGrid();
}

function clearLogs() {
  allLogs.length = 0;
  ['log-full','mini-log'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL & TASK SUBMIT
// ══════════════════════════════════════════════════════════════════════════════
function openModal() {
  document.getElementById('modal-task').classList.add('open');
  setTimeout(() => document.getElementById('task-inp').focus(), 50);
}
function closeModal() { document.getElementById('modal-task').classList.remove('open'); }

document.getElementById('modal-task').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-task')) closeModal();
});
document.getElementById('task-inp').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitModal(); }
  if (e.key === 'Escape') closeModal();
});
document.getElementById('q-inp').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitQueue();
});

async function submitModal() {
  const v = document.getElementById('task-inp').value.trim();
  if (!v) return;
  document.getElementById('task-inp').value = '';
  closeModal();
  await postTask(v);
}
async function submitQueue() {
  const el = document.getElementById('q-inp');
  const v = el.value.trim();
  if (!v) return;
  el.value = '';
  await postTask(v);
  nav('tasks');
}

async function postTask(desc) {
  try {
    const r = await fetch('/api/task', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ description: desc }),
    });
    const d = await r.json();
    if (!d.ok) console.error('task error:', d.error);
  } catch(e) { console.error('submit failed:', e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// CLOCK
// ══════════════════════════════════════════════════════════════════════════════
function tick() {
  const el = document.getElementById('hdr-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('th', { hour12:false });
}
setInterval(tick, 1000); tick();

// ══════════════════════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════════════════════
function stThai(s) {
  return { idle:'ว่าง', running:'กำลังทำ', blocked:'ติดขัด', failed:'ผิดพลาด', completed:'เสร็จ', done:'เสร็จ', pending:'รอ' }[s] || s;
}
function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'เมื่อกี้';
  if (s < 60) return \`\${s}s ที่แล้ว\`;
  if (s < 3600) return \`\${Math.floor(s/60)}m ที่แล้ว\`;
  return \`\${Math.floor(s/3600)}h ที่แล้ว\`;
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

// ══════════════════════════════════════════════════════════════════════════════
// SIMULATION ENGINE
// ══════════════════════════════════════════════════════════════════════════════
const SIM_TASKS = {
  'supervisor':      ['กำหนดกลยุทธ์ content สำหรับ Q3','มอบหมายงานให้ทีม','ตรวจสอบ pipeline','รอผลจาก agents','วิเคราะห์ KPI ประจำสัปดาห์'],
  'trend-research':  ['ค้นหา trending topics TikTok','วิเคราะห์ hashtag #ICT #Forex','ตรวจสอบ viral content 24h','เก็บข้อมูล engagement rate','ค้นหา keyword สำหรับ Shorts'],
  'claude-builder':  ['เขียนสคริปต์ 30 วินาที ICT Concepts','ปรับ hook ให้ดึงดูดมากขึ้น','เพิ่ม CTA ท้ายวิดีโอ','ตรวจทาน script ครั้งที่ 2','เขียน caption และ hashtag'],
  'asset-finder':    ['ค้นหา stock video "trading chart"','ดาวน์โหลด B-roll จาก Pexels','ค้นหาภาพ candlestick pattern','เลือก thumbnail จาก 48 รูป','ค้นหา background เพลงธีมเทรด'],
  'voiceover':       ['สร้างเสียงพูดภาษาไทย ElevenLabs','ปรับ pitch และ speed','render ไฟล์ .mp3 คุณภาพสูง','ตรวจสอบ timing กับ script','export เสียงพร้อมใช้งาน'],
  'subtitle':        ['สร้าง subtitle .srt อัตโนมัติ','ซิงค์ subtitle กับเสียง','ปรับ font size และ style','ตรวจสอบ timing ทุก segment','export subtitle ฝังวิดีโอ'],
  'video-render':    ['เรนเดอร์วิดีโอ 9:16 Creatomate','ใส่ B-roll layer 2','overlay subtitle บนวิดีโอ','เพิ่ม intro/outro animation','compress เป็น H.264 25MB'],
  'qa':              ['ตรวจสอบ copyright compliance','วิเคราะห์ platform policy TikTok','ตรวจ script ความยาว ≤60s','QA checklist 12 รายการ','ยืนยัน aspect ratio 9:16'],
  'publisher':       ['อัปโหลดไปยัง TikTok draft','ตั้งเวลา post 18:00 น.','sync ไปยัง YouTube Shorts','อัปโหลด Instagram Reels','ตรวจสอบ upload status'],
  'analytics':       ['ดึงข้อมูล view 24h แรก','วิเคราะห์ watch-time graph','ตรวจ CTR และ engagement','เปรียบเทียบกับ baseline','สร้าง performance report'],
  'codex-reviewer':  ['ตรวจสอบโค้ด pipeline','review API integration','วิเคราะห์ error handling','ตรวจสอบ security policy','รายงานผล code quality'],
  'gemini-research': ['วิจัย ICT concepts เชิงลึก','ตรวจสอบความถูกต้องของข้อมูล','เปรียบเทียบกับ source 5 แหล่ง','สรุป key insights','validate market structure data'],
};

const SIM_LOGS = [
  { agent:'supervisor',      level:'info',  msgs:['มอบหมายงานเขียน script ให้ claude-builder','เริ่ม pipeline รอบใหม่','ตรวจสอบสถานะ agents ทั้งหมด','รายงานความคืบหน้า 65%'] },
  { agent:'trend-research',  level:'info',  msgs:['พบ trending topic: "SMC เบื้องต้น" views 2.4M','hashtag #OrderBlock ติด Top 10','เก็บ 47 topics สำหรับ queue'] },
  { agent:'claude-builder',  level:'info',  msgs:['สร้าง script hook: "รู้แค่ 3 จุดนี้ก็เทรดได้"','ความยาว script: 38 วินาที ✓','ผ่าน readability check'] },
  { agent:'asset-finder',    level:'info',  msgs:['ดาวน์โหลด 12 clips จาก Pexels','พบ video "candlestick" 4K 15 รายการ','asset cache อัปเดตแล้ว'] },
  { agent:'voiceover',       level:'info',  msgs:['render เสียงเสร็จ 8.2 วินาที','bitrate: 192kbps ✓','ส่งไฟล์ให้ subtitle agent'] },
  { agent:'subtitle',        level:'info',  msgs:['สร้าง 24 subtitle segments','sync offset: +0.12s ✓','export .srt เสร็จแล้ว'] },
  { agent:'video-render',    level:'info',  msgs:['Creatomate job started: job_8f3a2c','render 38% complete...','เรนเดอร์เสร็จ: output_20mb.mp4'] },
  { agent:'qa',              level:'info',  msgs:['QA ผ่านทั้งหมด ✓ (12/12)','ตรวจ policy TikTok: ผ่าน','ไม่พบ copyright issue'] },
  { agent:'publisher',       level:'info',  msgs:['TikTok upload: 100% ✓','YouTube Shorts scheduled 18:00','Instagram Reels posted'] },
  { agent:'analytics',       level:'info',  msgs:['1h views: 1,247 👀','CTR: 8.3% (avg 4.2%)','watch-time avg: 82% ✓'] },
  { agent:'codex-reviewer',  level:'info',  msgs:['code review passed ✓','0 critical issues','2 minor suggestions'] },
  { agent:'gemini-research', level:'info',  msgs:['ยืนยันข้อมูล ICT จาก 5 แหล่ง','พบ 3 insights ใหม่','accuracy score: 97%'] },
  { agent:'supervisor',      level:'warn',  msgs:['voiceover ใช้เวลานานกว่าปกติ 15s','retry asset-finder: Pexels rate limit','หน่วยความจำ cache ใกล้เต็ม 80%'] },
  { agent:'video-render',    level:'warn',  msgs:['Creatomate queue: 3 jobs รออยู่','render time สูงกว่า SLA: 45s','retry render attempt 2/3'] },
  { agent:'qa',              level:'warn',  msgs:['script ยาวกว่ากำหนด: 62s (max 60s)','warning: background music volume สูง','แนะนำ trim 2 วินาที'] },
];

let simInterval   = null;
let simTick       = 0;
let simSpeedMs    = 2000;
let simRunning    = false;
const simAgentTimers = {};

function setSimSpeed(val) { simSpeedMs = parseInt(val); if (simRunning) { stopSimulation(); startSimulation(); } }

function startSimulation() {
  if (simRunning) return;
  simRunning = true;
  document.getElementById('sim-dot').classList.add('active');
  setText('sim-status-txt', 'กำลังจำลอง...');
  document.getElementById('sim-status-txt').style.color = 'var(--green)';
  document.getElementById('btn-sim-start').disabled = true;
  document.getElementById('btn-sim-stop').disabled  = false;
  simInterval = setInterval(simulationTick, simSpeedMs);
  simulationTick();
}

function stopSimulation() {
  simRunning = false;
  clearInterval(simInterval);
  simInterval = null;
  document.getElementById('sim-dot').classList.remove('active');
  setText('sim-status-txt', 'หยุด');
  document.getElementById('sim-status-txt').style.color = 'var(--muted)';
  document.getElementById('btn-sim-start').disabled = false;
  document.getElementById('btn-sim-stop').disabled  = true;
}

function resetAgents() {
  stopSimulation();
  Object.keys(agentStore).forEach(name => {
    agentStore[name].status      = 'idle';
    agentStore[name].currentTask = '';
    agentStore[name].lastUpdated = Date.now();
  });
  Object.keys(simAgentTimers).forEach(k => { clearTimeout(simAgentTimers[k]); delete simAgentTimers[k]; });
  renderAll();
  updateStats();
  setText('sim-tick-info', 'tick: 0');
  simTick = 0;
}

function simulationTick() {
  simTick++;
  setText('sim-tick-info', \`tick: \${simTick}\`);

  const agentNames  = Object.keys(AMETA);
  const idleAgents  = agentNames.filter(n => agentStore[n]?.status === 'idle' || agentStore[n]?.status === 'completed');
  const runningCount = agentNames.filter(n => agentStore[n]?.status === 'running').length;

  // Activate 1-3 idle agents per tick (keep max 4 running at once)
  const toActivate = Math.min(idleAgents.length, Math.max(1, 3 - runningCount));
  const shuffled   = idleAgents.sort(() => Math.random() - .5).slice(0, toActivate);

  shuffled.forEach(name => {
    const tasks = SIM_TASKS[name] || ['ประมวลผล...'];
    const task  = tasks[Math.floor(Math.random() * tasks.length)];
    simSetAgent(name, 'running', task);

    // Schedule completion after 4–12 seconds
    const duration = 4000 + Math.random() * 8000;
    clearTimeout(simAgentTimers[name]);
    simAgentTimers[name] = setTimeout(() => {
      const outcome = Math.random() < .08 ? 'failed' : 'completed';
      simSetAgent(name, outcome, outcome === 'failed' ? 'เกิดข้อผิดพลาด — retry...' : task);

      // Return to idle after 2s (or longer if failed)
      const cooldown = outcome === 'failed' ? 5000 : 2000;
      simAgentTimers[name + '_cool'] = setTimeout(() => {
        simSetAgent(name, 'idle', '');
      }, cooldown);
    }, duration);
  });

  // Randomly block one running agent occasionally
  if (Math.random() < .12) {
    const running = agentNames.filter(n => agentStore[n]?.status === 'running');
    if (running.length) {
      const pick = running[Math.floor(Math.random() * running.length)];
      simSetAgent(pick, 'blocked', 'รอ dependency...');
      setTimeout(() => {
        if (agentStore[pick]?.status === 'blocked') simSetAgent(pick, 'running', SIM_TASKS[pick]?.[0] || 'กำลังประมวลผล');
      }, 3000);
    }
  }

  // Push a random log entry
  const logSrc  = SIM_LOGS[Math.floor(Math.random() * SIM_LOGS.length)];
  const msg     = logSrc.msgs[Math.floor(Math.random() * logSrc.msgs.length)];
  const logEv   = { agent: logSrc.agent, level: logSrc.level, message: msg, timestamp: Date.now() };
  allLogs.push(logEv);
  if (allLogs.length > 500) allLogs.shift();
  appendLog(logEv, document.getElementById('mini-log'), 80);
  if (logFilter === 'all' || logEv.level === logFilter)
    appendLog(logEv, document.getElementById('log-full'), null);
}

function simSetAgent(name, status, task) {
  if (!agentStore[name]) return;
  agentStore[name].status      = status;
  agentStore[name].currentTask = task;
  agentStore[name].lastUpdated = Date.now();
  renderAgGrid(); renderAdGrid(); updateStats(); renderPipeline(); updateBriefing();
  // Highlight pipeline stage if matching
  document.querySelectorAll('.pipe-stage').forEach(el => {
    if (el.dataset.agent === name) el.classList.toggle('is-running', status === 'running');
  });
}

// Auto-start simulation after socket connects & init data loads
socket.on('init', () => setTimeout(() => { if (!simRunning) startSimulation(); }, 800));
</script>
</body>
</html>`;
}

// ─── Server start ──────────────────────────────────────────────────────────────
const port = config.appPort;
httpServer.listen(port, () => {
  ensureDirs();
  logger.info(`AI Agent Ops Control Center → http://localhost:${port}`);
  logger.info('Press Ctrl+C to stop');
});

export { app, httpServer };
