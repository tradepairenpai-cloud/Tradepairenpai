export function getAgentOfficeHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Agent Office – Live View</title>
<script src="/socket.io/socket.io.js"><\/script>
<style>
/* ── CSS VARIABLES ─────────────────────────────────────────────────────────── */
:root{
  --bg:#04080f;--sf:#080f1c;--s2:#0c1525;--s3:#101c30;
  --bd:#182036;--bd2:#1f2d4a;--bd3:#253560;
  --tx:#e2e8f0;--dm:#94a3b8;--mt:#4a5a72;
  --bl:#3b82f6;--bld:#1d4ed8;--bldm:#0d1e4a;
  --cy:#06b6d4;--cydm:#021820;--cyb:#0e7490;
  --gn:#10b981;--gndm:#021a10;--gnb:#065f46;
  --am:#f59e0b;--amdm:#1a1002;--amb:#92400e;
  --rd:#ef4444;--rddm:#1a0202;--rdb:#7f1d1d;
  --pp:#8b5cf6;--ppdm:#0e0820;--ppb:#4c1d95;
  --pk:#ec4899;--pkdm:#1a0410;
  --or:#f97316;--ordm:#1a0800;--orb:#7c2d12;
  --go:#fbbf24;--godm:#1a1000;--gob:#78350f;
  --tl:#14b8a6;--tldm:#021a18;--tlb:#0f4f47;
  --in:#6366f1;--indm:#080a20;--inb:#312e81;
  --lm:#84cc16;--lmdm:#0a1200;

  /* room-specific color vars (overridden per room) */
  --rm-col:var(--bl);
  --rm-rgb:59,130,246;
  --rm-bg:var(--bldm);
}

/* ── RESET & BASE ──────────────────────────────────────────────────────────── */
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:var(--bg);color:var(--tx);
  font-family:'Segoe UI',system-ui,Arial,sans-serif;
  height:100vh;overflow:hidden;
  display:flex;flex-direction:column;
}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--sf)}
::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:var(--bd3)}

/* ── COMMAND BAR ───────────────────────────────────────────────────────────── */
#cmd-bar{
  background:#060c18;border-bottom:1px solid var(--bd);
  display:flex;align-items:center;padding:0 14px;height:50px;gap:10px;flex-shrink:0;
  z-index:10;
}
.cb-brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;min-width:200px}
.cb-logo{font-size:1.25rem;animation:float 4s ease-in-out infinite;display:inline-block}
.cb-title{font-size:.85rem;font-weight:700;letter-spacing:.02em;line-height:1.1;color:var(--tx)}
.cb-sub{font-size:.58rem;color:var(--mt);line-height:1}
.live-pill{
  display:flex;align-items:center;gap:5px;padding:2px 9px;
  border-radius:99px;background:var(--gndm);border:1px solid #0d4a2a;
  font-size:.62rem;font-weight:700;color:var(--gn);flex-shrink:0;
}
.live-dot{width:5px;height:5px;border-radius:50%;background:var(--gn);animation:pulse 1.2s ease-in-out infinite}
.cb-stats{display:flex;gap:5px;flex:1;justify-content:center}
.cb-stat{
  display:flex;flex-direction:column;align-items:center;padding:2px 10px;
  background:var(--sf);border:1px solid var(--bd);border-radius:5px;min-width:52px;cursor:default;
}
.cb-val{font-size:.95rem;font-weight:700;line-height:1.1;transition:all .3s}
.cb-lbl{font-size:.54rem;color:var(--mt);margin-top:1px}
.c-bl{color:var(--bl)}.c-gn{color:var(--gn)}.c-rd{color:var(--rd)}.c-am{color:var(--am)}.c-pp{color:var(--pp)}.c-cy{color:var(--cy)}
.btn{
  padding:4px 12px;border-radius:5px;border:1px solid transparent;
  cursor:pointer;font-size:.7rem;font-weight:600;transition:all .15s;background:transparent;white-space:nowrap;
}
.btn-primary{background:var(--bl);color:#fff;border-color:var(--bld)}
.btn-primary:hover{background:var(--bld)}
.btn-ghost{color:var(--mt);border-color:var(--bd)}
.btn-ghost:hover{background:var(--s2);color:var(--tx)}
.btn-green{background:var(--gndm);color:var(--gn);border-color:#0d4a2a}
.btn-stop{background:var(--rddm);color:var(--rd);border-color:#4a0d0d}
.back-link{
  color:var(--mt);text-decoration:none;font-size:.68rem;padding:3px 8px;
  border:1px solid var(--bd);border-radius:4px;
}
.back-link:hover{color:var(--tx);background:var(--s2)}

/* ── MAIN LAYOUT ───────────────────────────────────────────────────────────── */
#main{flex:1;display:grid;grid-template-columns:1fr 300px;overflow:hidden;min-height:0}
#scene-wrap{overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
#right{
  background:#06080f;border-left:1px solid var(--bd);
  display:flex;flex-direction:column;overflow:hidden;min-height:0;
}

/* ── OFFICE GRID (CSS NAMED AREAS) ────────────────────────────────────────── */
#office-grid{
  display:grid;
  grid-template-columns:1fr 1fr 1fr 1fr;
  grid-template-rows:auto auto auto auto;
  grid-template-areas:
    "supervisor supervisor analytics analytics"
    "claude     codex      analytics analytics"
    "gemini     frontend   backend   backend"
    "qa         video      voiceover assets"
    "publisher  publisher  policy    policy";
  gap:7px;
  min-height:0;
}

/* ── ROOM BASE ─────────────────────────────────────────────────────────────── */
.room{
  border-radius:10px;border:1px solid var(--bd);overflow:hidden;
  position:relative;transition:border-color .5s,box-shadow .5s;
  background:linear-gradient(145deg,var(--sf),var(--bg));
}
.room.rm-active{
  border-color:var(--rm-col);
  box-shadow:0 0 16px rgba(var(--rm-rgb),.2),inset 0 0 30px rgba(var(--rm-rgb),.03);
}
/* ambient LED strip at bottom of each room */
.room::after{
  content:'';position:absolute;bottom:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,rgba(var(--rm-rgb),.6),transparent);
  opacity:0;transition:opacity .5s;pointer-events:none;
}
.room.rm-active::after{opacity:1;animation:led-sweep 3s linear infinite}

/* Room-specific named-area + theme */
.rm-supervisor{
  grid-area:supervisor;min-height:100px;
  --rm-col:#fbbf24;--rm-rgb:251,191,36;
  background:linear-gradient(145deg,#100c00,var(--sf));
}
.rm-claude{
  grid-area:claude;
  --rm-col:#3b82f6;--rm-rgb:59,130,246;
  background:linear-gradient(145deg,#040c1a,var(--sf));
}
.rm-codex{
  grid-area:codex;
  --rm-col:#8b5cf6;--rm-rgb:139,92,246;
  background:linear-gradient(145deg,#08041a,var(--sf));
}
.rm-analytics{
  grid-area:analytics;
  --rm-col:#6366f1;--rm-rgb:99,102,241;
  background:linear-gradient(145deg,#06061a,var(--sf));
}
.rm-gemini{
  grid-area:gemini;
  --rm-col:#ec4899;--rm-rgb:236,72,153;
  background:linear-gradient(145deg,#140610,var(--sf));
}
.rm-frontend{
  grid-area:frontend;
  --rm-col:#14b8a6;--rm-rgb:20,184,166;
  background:linear-gradient(145deg,#01120f,var(--sf));
}
.rm-backend{
  grid-area:backend;
  --rm-col:#06b6d4;--rm-rgb:6,182,212;
  background:linear-gradient(145deg,#011018,var(--sf));
}
.rm-qa{
  grid-area:qa;
  --rm-col:#10b981;--rm-rgb:16,185,129;
  background:linear-gradient(145deg,#011408,var(--sf));
}
.rm-video{
  grid-area:video;
  --rm-col:#f97316;--rm-rgb:249,115,22;
  background:linear-gradient(145deg,#120800,var(--sf));
}
.rm-voiceover{
  grid-area:voiceover;
  --rm-col:#a855f7;--rm-rgb:168,85,247;
  background:linear-gradient(145deg,#0a0514,var(--sf));
}
.rm-assets{
  grid-area:assets;
  --rm-col:#f59e0b;--rm-rgb:245,158,11;
  background:linear-gradient(145deg,#110900,var(--sf));
}
.rm-publisher{
  grid-area:publisher;min-height:100px;
  --rm-col:#06b6d4;--rm-rgb:6,182,212;
  background:linear-gradient(145deg,#001518,var(--sf));
}
.rm-policy{
  grid-area:policy;min-height:90px;
  --rm-col:#ef4444;--rm-rgb:239,68,68;
  background:linear-gradient(145deg,#120202,var(--sf));
}

/* ── ROOM HEADER ───────────────────────────────────────────────────────────── */
.rh{
  display:flex;align-items:center;gap:6px;padding:5px 9px;
  background:rgba(0,0,0,.4);border-bottom:1px solid rgba(var(--rm-rgb),.15);
  flex-shrink:0;
}
.rh-dot{
  width:6px;height:6px;border-radius:50%;background:var(--rm-col);
  box-shadow:0 0 5px rgba(var(--rm-rgb),.7);flex-shrink:0;
}
.rh-name{
  font-size:.61rem;font-weight:700;color:var(--rm-col);
  text-transform:uppercase;letter-spacing:.08em;flex:1;
}
.rh-cnt{font-size:.54rem;color:var(--mt)}
.rh-badge{
  font-size:.52rem;padding:1px 5px;border-radius:3px;
  background:rgba(var(--rm-rgb),.12);border:1px solid rgba(var(--rm-rgb),.25);
  color:var(--rm-col);
}

/* ── ROOM FLOOR (workstations) ─────────────────────────────────────────────── */
.rf{
  display:flex;flex-wrap:wrap;gap:5px;padding:7px;
  align-items:flex-end;position:relative;
}

/* ── WORKSTATION ───────────────────────────────────────────────────────────── */
.ws{
  display:flex;flex-direction:column;align-items:center;gap:1px;
  padding:5px 4px 4px;background:rgba(0,0,0,.3);border-radius:6px;
  border:1px solid rgba(255,255,255,.04);cursor:pointer;min-width:56px;
  transition:background .2s,border-color .2s,box-shadow .2s;position:relative;
}
.ws:hover{background:rgba(255,255,255,.05);border-color:var(--bd3)}
.ws.ws-on{
  border-color:var(--rm-col);background:rgba(var(--rm-rgb),.07);
  box-shadow:0 0 8px rgba(var(--rm-rgb),.15);
}

/* monitor */
.ws-mon{
  width:36px;height:22px;border-radius:3px 3px 0 0;
  background:#030609;border:1px solid var(--bd);
  position:relative;overflow:hidden;transition:border-color .3s,box-shadow .3s;
}
.ws.ws-on .ws-mon{border-color:var(--rm-col);box-shadow:0 0 7px rgba(var(--rm-rgb),.5)}

/* monitor scan line */
.ws-mon::before{
  content:'';position:absolute;left:0;right:0;height:1px;
  background:rgba(255,255,255,.04);
  animation:scan-line 2s linear infinite;pointer-events:none;
}

/* monitor screen content — role-specific */
.mon-code{
  position:absolute;inset:0;padding:2px 2px;
  font-size:3.8px;line-height:1.45;font-family:monospace;
  overflow:hidden;
}
.mon-code.mc-blue{color:rgba(59,130,246,.6);animation:code-scroll 1s linear infinite}
.mon-code.mc-purple{color:rgba(139,92,246,.6);animation:code-scroll 1.3s linear infinite}
.mon-code.mc-cyan{color:rgba(6,182,212,.6);animation:code-scroll 0.9s linear infinite}
.mon-code.mc-green{color:rgba(16,185,129,.6);animation:code-scroll 1.4s linear infinite}
.mon-code.mc-orange{color:rgba(249,115,22,.6);animation:code-scroll 1.1s linear infinite}
.mon-code.mc-pink{color:rgba(236,72,153,.6);animation:code-scroll 1.6s linear infinite}
.mon-code.mc-gold{color:rgba(251,191,36,.6);animation:code-scroll 0.8s linear infinite}
.mon-code.mc-idle{color:rgba(74,90,114,.4);animation:none}

/* waveform bars (voiceover room) */
.mon-wave{
  position:absolute;inset:0;display:flex;align-items:center;
  gap:1px;padding:3px 2px;
}
.wave-bar{
  flex:1;border-radius:1px;background:rgba(168,85,247,.7);
  animation:wave-pulse var(--wd,0.6s) ease-in-out infinite alternate;
}

/* timeline scrub (video room) */
.mon-timeline{
  position:absolute;inset:0;display:flex;flex-direction:column;
  padding:3px 2px;gap:2px;
}
.tl-track{
  height:3px;border-radius:1px;background:rgba(249,115,22,.2);
  position:relative;overflow:hidden;
}
.tl-track::after{
  content:'';position:absolute;left:0;top:0;height:100%;width:30%;
  background:rgba(249,115,22,.85);animation:tl-scrub 2s linear infinite;
}

/* chart bars (analytics room) */
.mon-chart{
  position:absolute;inset:0;display:flex;align-items:flex-end;
  gap:1px;padding:2px 2px 3px;
}
.ch-bar{
  flex:1;border-radius:1px 1px 0 0;min-height:2px;
  background:rgba(99,102,241,.7);
  animation:bar-grow var(--bd-dur,0.8s) ease-out both;
}

/* compliance scan (policy room) */
.mon-scan{
  position:absolute;inset:0;overflow:hidden;
}
.mon-scan::after{
  content:'';position:absolute;left:0;right:0;height:2px;
  background:rgba(239,68,68,.7);
  animation:scan 1.5s linear infinite;
}

/* upload beam (publisher room) */
.mon-upload{
  position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;overflow:hidden;
}
.upload-beam{
  width:2px;height:60%;border-radius:1px;
  background:linear-gradient(to top,var(--cy),transparent);
  animation:beam-rise 1s ease-in-out infinite;
}

/* gallery shimmer (assets room) */
.mon-gallery{
  position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;
  gap:1px;padding:2px;
}
.gal-thumb{
  border-radius:1px;background:rgba(245,158,11,.15);
  animation:shimmer 2s ease-in-out infinite;
}
.gal-thumb:nth-child(2){animation-delay:.3s}
.gal-thumb:nth-child(3){animation-delay:.6s}
.gal-thumb:nth-child(4){animation-delay:.9s}

/* UI preview (frontend room) */
.mon-ui{
  position:absolute;inset:0;display:flex;flex-direction:column;
  gap:1px;padding:2px;
}
.ui-block{height:4px;border-radius:1px;background:rgba(20,184,166,.25)}
.ui-block:nth-child(1){width:80%;animation:ui-appear .5s ease-out both}
.ui-block:nth-child(2){width:60%;animation:ui-appear .5s ease-out .2s both}
.ui-block:nth-child(3){width:70%;animation:ui-appear .5s ease-out .4s both}
.ui-cursor{
  position:absolute;width:2px;height:8px;background:var(--tl);
  animation:blink-cursor .7s step-end infinite;bottom:3px;right:5px;
}

/* stand + desk */
.ws-stand{width:8px;height:3px;background:var(--s3)}
.ws-desk{
  width:46px;height:4px;background:var(--s3);
  border:1px solid var(--bd);border-radius:1px;
}

/* agent figure */
.ws-agent{display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:3px;position:relative}
.ws-avatar{
  width:24px;height:24px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:11px;border:2px solid rgba(255,255,255,.1);
  position:relative;flex-shrink:0;transition:box-shadow .3s,transform .3s;
}
.ws.ws-on .ws-avatar{
  box-shadow:0 0 10px rgba(var(--rm-rgb),.5);
  animation:agent-float 2.5s ease-in-out infinite;
}
.ws-label{
  font-size:7.5px;color:var(--dm);text-align:center;max-width:56px;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:1.2;
}
.ws-label.typing::after{
  content:'|';color:var(--cy);
  animation:blink-cursor .6s step-end infinite;margin-left:1px;
}

/* status dot */
.ws-sdot{
  position:absolute;bottom:-1px;right:-1px;
  width:7px;height:7px;border-radius:50%;border:1.5px solid var(--bg);
}
.sd-idle{background:var(--mt)}
.sd-running{background:var(--bl);animation:pulse 1.2s ease-in-out infinite}
.sd-thinking{background:var(--pp);animation:pulse 1.6s ease-in-out infinite}
.sd-coding{background:var(--cy);animation:pulse 1s ease-in-out infinite}
.sd-reviewing{background:var(--pp);animation:pulse 1.4s ease-in-out infinite}
.sd-testing{background:var(--gn);animation:pulse 1s ease-in-out infinite}
.sd-failed{background:var(--rd)}
.sd-completed{background:var(--gn)}
.sd-waiting{background:var(--am);animation:pulse 2s ease-in-out infinite}
.sd-walking{background:var(--am);animation:walk-dot .4s step-end infinite}
.sd-publishing{background:var(--cy);animation:pulse .8s ease-in-out infinite}
.sd-scanning{background:var(--rd);animation:pulse 1.2s ease-in-out infinite}
.sd-rendering{background:var(--or);animation:pulse .9s ease-in-out infinite}
.sd-recording{background:var(--pp);animation:pulse .7s ease-in-out infinite}
.sd-uploading{background:var(--cy);animation:pulse .6s ease-in-out infinite}

/* thinking dots */
.think-dots{
  position:absolute;top:-14px;left:50%;transform:translateX(-50%);
  display:flex;gap:2px;align-items:center;pointer-events:none;
  opacity:0;transition:opacity .3s;
}
.ws.ws-on .think-dots.td-show{opacity:1}
.td{width:4px;height:4px;border-radius:50%;background:var(--pp);animation:think-bounce 1.2s ease-in-out infinite}
.td:nth-child(2){animation-delay:.2s}.td:nth-child(3){animation-delay:.4s}

/* walking agent overlay */
.ws-walk{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  pointer-events:none;opacity:0;transition:opacity .3s;
}
.ws.ws-walking .ws-walk{opacity:1}
.walk-figure{font-size:12px;animation:walk-bounce .35s ease-in-out infinite alternate}

/* tooltip */
.ws-tip{
  position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);
  background:rgba(8,14,28,.97);border:1px solid var(--bd3);border-radius:5px;
  padding:4px 8px;font-size:8.5px;white-space:nowrap;max-width:170px;
  text-overflow:ellipsis;pointer-events:none;opacity:0;transition:opacity .15s;z-index:20;
  color:var(--tx);box-shadow:0 4px 12px rgba(0,0,0,.5);overflow:hidden;
}
.ws-tip::after{
  content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);
  border:4px solid transparent;border-top-color:var(--bd3);
}
.ws:hover .ws-tip{opacity:1}

/* ── ANALYTICS ROOM SPECIFIC ───────────────────────────────────────────────── */
.analytics-screen{
  flex:1;background:#030612;border:1px solid var(--bd);border-radius:4px;
  padding:5px 7px;min-height:52px;overflow:hidden;
}
.an-title{font-size:.57rem;color:var(--mt);margin-bottom:2px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.an-metric{font-size:1.05rem;font-weight:700;line-height:1;margin-bottom:1px;color:var(--in)}
.an-sub{font-size:.53rem;color:var(--mt)}
.an-bars{display:flex;gap:2px;align-items:flex-end;height:22px;margin-top:4px}
.an-bar{flex:1;border-radius:1px 1px 0 0;min-height:2px;background:rgba(99,102,241,.6);animation:bar-grow .8s ease-out both}

/* supervisor pacing indicator */
.pace-line{
  position:absolute;bottom:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,rgba(251,191,36,.5),transparent);
  animation:pace-slide 3s ease-in-out infinite;
}

/* publisher progress bar */
.pub-progress{
  position:absolute;bottom:0;left:0;height:3px;width:0;
  background:linear-gradient(90deg,var(--cy),var(--bl));
  animation:pub-fill 4s ease-in-out infinite;border-radius:0 2px 0 0;
}

/* policy scan bar */
.policy-scanner{
  position:absolute;left:0;right:0;height:1px;top:0;
  background:rgba(239,68,68,.8);animation:policy-scan 2.5s linear infinite;pointer-events:none;
}

/* ambient glow zones */
.rm-ambient{
  position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 50% 100%,rgba(var(--rm-rgb),.06),transparent 70%);
  opacity:0;transition:opacity .5s;
}
.room.rm-active .rm-ambient{opacity:1}

/* ── SUPERVISOR room: wide floor ──────────────────────────────────────────── */
.rm-supervisor .rf{justify-content:space-around;padding:8px 12px}

/* ── PUBLISHER room: wide ─────────────────────────────────────────────────── */
.rm-publisher .rf{flex-direction:row;justify-content:space-around;padding:8px 12px}

/* ── ANALYTICS room: tall metrics ─────────────────────────────────────────── */
.rm-analytics .rf{flex-direction:column;gap:4px;align-items:stretch}

/* ── RIGHT PANEL ───────────────────────────────────────────────────────────── */
.rp-tabs{display:flex;border-bottom:1px solid var(--bd);flex-shrink:0}
.rp-tab{
  flex:1;padding:7px 4px;font-size:.61rem;font-weight:600;cursor:pointer;
  color:var(--mt);border-bottom:2px solid transparent;text-align:center;transition:all .15s;
}
.rp-tab.active{color:var(--bl);border-bottom-color:var(--bl);background:rgba(59,130,246,.05)}
.rp-tab:hover:not(.active){color:var(--dm);background:rgba(255,255,255,.02)}
.rp-badge{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:14px;height:14px;border-radius:7px;font-size:.5rem;
  margin-left:2px;padding:0 3px;background:var(--rddm);color:var(--rd);
}
.rp-body{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px}

/* feed items */
.feed-item{
  padding:6px 8px;border-radius:6px;border:1px solid var(--bd);background:var(--sf);
  font-size:.65rem;line-height:1.4;animation:fadeSlideIn .3s ease-out both;
}
.fi-agent{font-weight:700;font-size:.6rem}
.fi-msg{color:var(--dm);margin-top:1px}
.fi-time{font-size:.52rem;color:var(--mt);float:right;margin-left:6px}

/* task items */
.task-item{
  border-radius:6px;border:1px solid var(--bd);background:var(--sf);padding:7px 9px;
  animation:fadeSlideIn .3s ease-out both;
}
.ti-head{display:flex;align-items:center;gap:6px;margin-bottom:3px}
.ti-agent{font-size:.6rem;font-weight:700;padding:1px 5px;border-radius:3px}
.ti-status{font-size:.58rem;font-weight:600}
.ti-desc{font-size:.62rem;color:var(--dm);line-height:1.4}
.ti-prog{height:2px;border-radius:1px;background:var(--bd2);margin-top:5px;overflow:hidden}
.ti-prog-fill{height:100%;border-radius:1px;background:var(--bl);transition:width .5s}

/* approval items */
.ap-item{
  border-radius:7px;border:1px solid var(--bd);background:var(--sf);padding:8px 9px;
  animation:fadeSlideIn .3s ease-out both;
}
.ap-head{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.ap-icon{font-size:.95rem}
.ap-type{font-size:.62rem;font-weight:700;color:var(--am);flex:1}
.ap-pill{font-size:.52rem;padding:1px 5px;border-radius:3px;background:var(--amdm);color:var(--am);border:1px solid var(--amb)}
.ap-desc{font-size:.61rem;color:var(--dm);margin-bottom:6px;line-height:1.4}
.ap-btns{display:flex;gap:5px}
.ap-btn{
  flex:1;padding:3px 8px;border-radius:4px;border:none;cursor:pointer;
  font-size:.62rem;font-weight:600;transition:all .15s;
}
.ap-approve{background:var(--gndm);color:var(--gn);border:1px solid var(--gnb)}
.ap-approve:hover{background:#073a1e}
.ap-deny{background:var(--rddm);color:var(--rd);border:1px solid var(--rdb)}
.ap-deny:hover{background:#2a0505}

/* self-improve items */
.si-item{
  border-radius:7px;border:1px solid var(--bd);background:var(--sf);padding:7px 9px;
  animation:fadeSlideIn .3s ease-out both;
}
.si-head{display:flex;align-items:center;gap:5px;margin-bottom:3px}
.si-icon{font-size:.85rem}
.si-title{font-size:.62rem;font-weight:700;color:var(--cy);flex:1}
.si-tag{font-size:.5rem;padding:1px 4px;border-radius:3px;background:var(--cydm);color:var(--cy);border:1px solid var(--cyb)}
.si-desc{font-size:.6rem;color:var(--dm);margin-bottom:4px;line-height:1.4}
.si-footer{font-size:.55rem;color:var(--mt)}

/* system health panel */
.health-panel{
  background:var(--sf);border:1px solid var(--bd);border-radius:7px;padding:8px;
}
.health-title{font-size:.62rem;font-weight:700;color:var(--dm);margin-bottom:6px;display:flex;align-items:center;gap:5px}
.health-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.health-item{
  display:flex;align-items:center;gap:4px;padding:3px 5px;
  background:var(--s2);border-radius:4px;border:1px solid var(--bd);
}
.hi-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.hi-name{font-size:.56rem;color:var(--dm);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hi-status{font-size:.52rem;font-weight:600}

/* section header */
.sec-hdr{font-size:.6rem;font-weight:700;color:var(--mt);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}

/* empty state */
.empty-state{text-align:center;padding:16px 8px;color:var(--mt);font-size:.65rem}

/* ── KEYFRAME ANIMATIONS ───────────────────────────────────────────────────── */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes scan{from{top:-30%}to{top:130%}}
@keyframes scan-line{from{top:-10%}to{top:110%}}
@keyframes code-scroll{from{transform:translateY(0)}to{transform:translateY(-60%)}}
@keyframes think-bounce{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-4px);opacity:1}}
@keyframes agent-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes blink-cursor{0%,100%{opacity:1}50%{opacity:0}}
@keyframes walk-dot{0%{background:var(--am)}50%{background:var(--go)}100%{background:var(--am)}}
@keyframes walk-bounce{from{transform:translateY(-2px)}to{transform:translateY(2px)}}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes bar-grow{from{height:2px}to{height:var(--bh,70%)}}
@keyframes led-sweep{from{background-position:0% 50%}to{background-position:100% 50%}}
@keyframes wave-pulse{from{height:20%}to{height:80%}}
@keyframes tl-scrub{from{left:-40%}to{left:110%}}
@keyframes beam-rise{0%,100%{opacity:.3;transform:scaleY(.5)}50%{opacity:1;transform:scaleY(1)}}
@keyframes shimmer{0%,100%{opacity:.3}50%{opacity:.8}}
@keyframes ui-appear{from{opacity:0;transform:scaleX(.5)}to{opacity:1;transform:scaleX(1)}}
@keyframes pace-slide{0%,100%{transform:translateX(-50%);opacity:.4}50%{transform:translateX(50%);opacity:.9}}
@keyframes pub-fill{0%{width:0;opacity:.8}80%{width:100%;opacity:.9}100%{width:100%;opacity:0}}
@keyframes policy-scan{from{top:0%}to{top:100%}}
@keyframes glow-run{0%,100%{box-shadow:0 0 4px rgba(var(--rm-rgb),.2)}50%{box-shadow:0 0 12px rgba(var(--rm-rgb),.6)}}
@keyframes enter-pop{0%{transform:scale(.7);opacity:0}80%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
@keyframes screen-flicker{0%,100%{opacity:1}92%{opacity:1}94%{opacity:.6}96%{opacity:1}98%{opacity:.7}}
</style>
</head>
<body>

<!-- ── COMMAND BAR ──────────────────────────────────────────────────────────── -->
<div id="cmd-bar">
  <a href="/" class="back-link">← Home</a>
  <a href="/agent-office" class="cb-brand">
    <span class="cb-logo">🏢</span>
    <span>
      <div class="cb-title">AI Agent Office</div>
      <div class="cb-sub">Live Command Center</div>
    </span>
  </a>
  <span class="live-pill"><span class="live-dot"></span>LIVE</span>
  <div class="cb-stats">
    <div class="cb-stat"><span class="cb-val c-bl" id="stat-agents">0</span><span class="cb-lbl">Agents</span></div>
    <div class="cb-stat"><span class="cb-val c-gn" id="stat-active">0</span><span class="cb-lbl">Active</span></div>
    <div class="cb-stat"><span class="cb-val c-am" id="stat-queue">0</span><span class="cb-lbl">Queue</span></div>
    <div class="cb-stat"><span class="cb-val c-rd" id="stat-approvals">0</span><span class="cb-lbl">Approvals</span></div>
    <div class="cb-stat"><span class="cb-val c-cy" id="stat-completed">0</span><span class="cb-lbl">Done</span></div>
  </div>
  <button class="btn btn-green btn-sm" id="btn-start" onclick="startSim()">▶ Start</button>
  <button class="btn btn-stop btn-sm" id="btn-stop" onclick="stopSim()" style="display:none">■ Stop</button>
  <button class="btn btn-ghost btn-sm" onclick="window.location='/'">⬅ Dashboard</button>
</div>

<!-- ── MAIN ─────────────────────────────────────────────────────────────────── -->
<div id="main">
  <div id="scene-wrap">
    <div id="office-grid">

      <!-- SUPERVISOR ROOM -->
      <div class="room rm-supervisor" id="room-supervisor">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Supervisor HQ</div>
          <div class="rh-badge">Control</div>
          <div class="rh-cnt" id="rc-supervisor">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-supervisor" onclick="selectAgent('supervisor')">
            <div class="ws-mon">
              <div class="mon-code mc-gold" id="mon-supervisor">
                TASK_QUEUE=[...]\nAGENTS=13\nASSIGN(claude,\nscript_gen)\nMONIT_ALL()\n>>>OK\nSCHEDULE..\n
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#fbbf24,#f59e0b)">
                🎯
                <div class="ws-sdot sd-idle" id="sd-supervisor"></div>
              </div>
              <div class="ws-label" id="lbl-supervisor">Supervisor</div>
            </div>
            <div class="think-dots td-show" id="td-supervisor"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-supervisor">Coordinating all agents</div>
          </div>
        </div>
        <div class="pace-line" id="pace-supervisor"></div>
      </div>

      <!-- CLAUDE ROOM -->
      <div class="room rm-claude" id="room-claude">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Claude Studio</div>
          <div class="rh-badge">Script</div>
          <div class="rh-cnt" id="rc-claude">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-claude" onclick="selectAgent('claude')">
            <div class="ws-mon" style="animation:screen-flicker 8s ease-in-out infinite">
              <div class="mon-code mc-blue" id="mon-claude">
                // script gen\nconst hook=\n  await llm(\n  prompt);\noutput.push(\nhook,body,\ncta);\n
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8)">
                🤖
                <div class="ws-sdot sd-idle" id="sd-claude"></div>
              </div>
              <div class="ws-label" id="lbl-claude">Claude</div>
            </div>
            <div class="think-dots" id="td-claude"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-claude">Writing video scripts</div>
          </div>
        </div>
      </div>

      <!-- CODEX ROOM -->
      <div class="room rm-codex" id="room-codex">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Codex Lab</div>
          <div class="rh-badge">Code</div>
          <div class="rh-cnt" id="rc-codex">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-codex" onclick="selectAgent('codex')">
            <div class="ws-mon">
              <div class="mon-code mc-purple" id="mon-codex">
                def gen_code(\n  spec):\n  tokens=[]\n  for t in\n  stream:\n    yield t\n
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9)">
                💻
                <div class="ws-sdot sd-idle" id="sd-codex"></div>
              </div>
              <div class="ws-label" id="lbl-codex">Codex</div>
            </div>
            <div class="think-dots" id="td-codex"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-codex">Generating code</div>
          </div>
        </div>
      </div>

      <!-- ANALYTICS ROOM -->
      <div class="room rm-analytics" id="room-analytics">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Analytics Hub</div>
          <div class="rh-badge">Metrics</div>
          <div class="rh-cnt" id="rc-analytics">1 agent</div>
        </div>
        <div class="rf" style="flex-direction:column;align-items:stretch">
          <div class="analytics-screen">
            <div class="an-title">Videos Published</div>
            <div class="an-metric c-in" id="an-published">0</div>
            <div class="an-sub" id="an-sub1">this session</div>
            <div class="an-bars">
              <div class="an-bar" style="--bh:30%;animation-delay:0s"></div>
              <div class="an-bar" style="--bh:60%;animation-delay:.1s"></div>
              <div class="an-bar" style="--bh:45%;animation-delay:.2s"></div>
              <div class="an-bar" style="--bh:80%;animation-delay:.3s"></div>
              <div class="an-bar" style="--bh:55%;animation-delay:.4s"></div>
            </div>
          </div>
          <div style="display:flex;gap:4px;flex:1">
            <div class="ws" id="ws-analytics" onclick="selectAgent('analytics')" style="flex:1">
              <div class="ws-mon">
                <div class="mon-chart" id="mon-analytics">
                  <div class="ch-bar" style="--bh:40%"></div>
                  <div class="ch-bar" style="--bh:70%"></div>
                  <div class="ch-bar" style="--bh:55%"></div>
                  <div class="ch-bar" style="--bh:90%"></div>
                  <div class="ch-bar" style="--bh:35%"></div>
                </div>
              </div>
              <div class="ws-stand"></div>
              <div class="ws-desk"></div>
              <div class="ws-agent">
                <div class="ws-avatar" style="background:linear-gradient(135deg,#6366f1,#4338ca)">
                  📊
                  <div class="ws-sdot sd-idle" id="sd-analytics"></div>
                </div>
                <div class="ws-label" id="lbl-analytics">Analytics</div>
              </div>
              <div class="think-dots" id="td-analytics"><div class="td"></div><div class="td"></div><div class="td"></div></div>
              <div class="ws-tip" id="tip-analytics">Tracking performance</div>
            </div>
          </div>
        </div>
      </div>

      <!-- GEMINI ROOM -->
      <div class="room rm-gemini" id="room-gemini">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Gemini Research</div>
          <div class="rh-badge">Browse</div>
          <div class="rh-cnt" id="rc-gemini">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-gemini" onclick="selectAgent('gemini')">
            <div class="ws-mon">
              <div class="mon-code mc-pink" id="mon-gemini">
                SEARCH:\ntopic_trends\n>result[0]\n>result[1]\nSUMMARIZE\n...done\nSCORE:0.94\n
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#ec4899,#be185d)">
                🔍
                <div class="ws-sdot sd-idle" id="sd-gemini"></div>
              </div>
              <div class="ws-label" id="lbl-gemini">Gemini</div>
            </div>
            <div class="think-dots" id="td-gemini"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-gemini">Researching topics</div>
          </div>
        </div>
      </div>

      <!-- FRONTEND ROOM -->
      <div class="room rm-frontend" id="room-frontend">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Frontend Lab</div>
          <div class="rh-badge">UI</div>
          <div class="rh-cnt" id="rc-frontend">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-frontend" onclick="selectAgent('frontend')">
            <div class="ws-mon">
              <div class="mon-ui" id="mon-frontend">
                <div class="ui-block" style="--tc:var(--tl)"></div>
                <div class="ui-block" style="--tc:var(--tl)"></div>
                <div class="ui-block" style="--tc:var(--tl)"></div>
                <div class="ui-cursor"></div>
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#14b8a6,#0f766e)">
                🎨
                <div class="ws-sdot sd-idle" id="sd-frontend"></div>
              </div>
              <div class="ws-label" id="lbl-frontend">Frontend</div>
            </div>
            <div class="think-dots" id="td-frontend"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-frontend">Building UI components</div>
          </div>
        </div>
      </div>

      <!-- BACKEND ROOM -->
      <div class="room rm-backend" id="room-backend">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Backend Engine</div>
          <div class="rh-badge">Server</div>
          <div class="rh-cnt" id="rc-backend">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-backend" onclick="selectAgent('backend')">
            <div class="ws-mon">
              <div class="mon-code mc-cyan" id="mon-backend">
                [server]\nPOST /api\n200 OK 12ms\nGET /status\n200 OK 3ms\nDB.query()\n>15 rows\n
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#06b6d4,#0e7490)">
                ⚙️
                <div class="ws-sdot sd-idle" id="sd-backend"></div>
              </div>
              <div class="ws-label" id="lbl-backend">Backend</div>
            </div>
            <div class="think-dots" id="td-backend"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-backend">Managing API services</div>
          </div>
        </div>
      </div>

      <!-- QA ROOM -->
      <div class="room rm-qa" id="room-qa">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">QA Lab</div>
          <div class="rh-badge">Test</div>
          <div class="rh-cnt" id="rc-qa">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-qa" onclick="selectAgent('qa')">
            <div class="ws-mon">
              <div class="mon-code mc-green" id="mon-qa">
                ✓ test[1]\n✓ test[2]\n✓ test[3]\n✗ test[4]\n  assert=F\n RETRY...\n
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#10b981,#065f46)">
                🧪
                <div class="ws-sdot sd-idle" id="sd-qa"></div>
              </div>
              <div class="ws-label" id="lbl-qa">QA</div>
            </div>
            <div class="think-dots" id="td-qa"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-qa">Running quality checks</div>
          </div>
        </div>
      </div>

      <!-- VIDEO ROOM -->
      <div class="room rm-video" id="room-video">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Video Studio</div>
          <div class="rh-badge">Render</div>
          <div class="rh-cnt" id="rc-video">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-video-render" onclick="selectAgent('video-render')">
            <div class="ws-mon">
              <div class="mon-timeline" id="mon-video">
                <div class="tl-track"></div>
                <div class="tl-track"></div>
                <div class="tl-track"></div>
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#f97316,#c2410c)">
                🎬
                <div class="ws-sdot sd-idle" id="sd-video-render"></div>
              </div>
              <div class="ws-label" id="lbl-video-render">Video</div>
            </div>
            <div class="think-dots" id="td-video-render"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-video-render">Rendering video content</div>
          </div>
        </div>
      </div>

      <!-- VOICEOVER ROOM -->
      <div class="room rm-voiceover" id="room-voiceover">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Voice Studio</div>
          <div class="rh-badge">Audio</div>
          <div class="rh-cnt" id="rc-voiceover">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-voiceover" onclick="selectAgent('voiceover')">
            <div class="ws-mon">
              <div class="mon-wave" id="mon-voiceover">
                <div class="wave-bar" style="--wd:0.5s"></div>
                <div class="wave-bar" style="--wd:0.7s"></div>
                <div class="wave-bar" style="--wd:0.4s"></div>
                <div class="wave-bar" style="--wd:0.8s"></div>
                <div class="wave-bar" style="--wd:0.6s"></div>
                <div class="wave-bar" style="--wd:0.45s"></div>
                <div class="wave-bar" style="--wd:0.75s"></div>
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#a855f7,#7c3aed)">
                🎙️
                <div class="ws-sdot sd-idle" id="sd-voiceover"></div>
              </div>
              <div class="ws-label" id="lbl-voiceover">Voiceover</div>
            </div>
            <div class="think-dots" id="td-voiceover"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-voiceover">Generating voice audio</div>
          </div>
        </div>
      </div>

      <!-- ASSETS ROOM -->
      <div class="room rm-assets" id="room-assets">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Asset Library</div>
          <div class="rh-badge">Media</div>
          <div class="rh-cnt" id="rc-assets">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-assets" onclick="selectAgent('assets')">
            <div class="ws-mon">
              <div class="mon-gallery" id="mon-assets">
                <div class="gal-thumb"></div>
                <div class="gal-thumb"></div>
                <div class="gal-thumb"></div>
                <div class="gal-thumb"></div>
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#f59e0b,#b45309)">
                🖼️
                <div class="ws-sdot sd-idle" id="sd-assets"></div>
              </div>
              <div class="ws-label" id="lbl-assets">Assets</div>
            </div>
            <div class="think-dots" id="td-assets"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-assets">Fetching media assets</div>
          </div>
        </div>
      </div>

      <!-- PUBLISHER ROOM -->
      <div class="room rm-publisher" id="room-publisher">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Publisher HQ</div>
          <div class="rh-badge">Upload</div>
          <div class="rh-cnt" id="rc-publisher">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-publisher" onclick="selectAgent('publisher')">
            <div class="ws-mon">
              <div class="mon-upload" id="mon-publisher">
                <div class="upload-beam"></div>
              </div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#06b6d4,#0891b2)">
                📤
                <div class="ws-sdot sd-idle" id="sd-publisher"></div>
              </div>
              <div class="ws-label" id="lbl-publisher">Publisher</div>
            </div>
            <div class="think-dots" id="td-publisher"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-publisher">Publishing to platforms</div>
          </div>
        </div>
        <div class="pub-progress" id="pub-progress"></div>
      </div>

      <!-- POLICY ROOM -->
      <div class="room rm-policy" id="room-policy">
        <div class="rm-ambient"></div>
        <div class="rh">
          <div class="rh-dot"></div>
          <div class="rh-name">Policy Compliance</div>
          <div class="rh-badge">Guard</div>
          <div class="rh-cnt" id="rc-policy">1 agent</div>
        </div>
        <div class="rf">
          <div class="ws" id="ws-policy-check" onclick="selectAgent('policy-check')">
            <div class="ws-mon">
              <div class="mon-scan" id="mon-policy"></div>
            </div>
            <div class="ws-stand"></div>
            <div class="ws-desk"></div>
            <div class="ws-agent">
              <div class="ws-avatar" style="background:linear-gradient(135deg,#ef4444,#b91c1c)">
                🛡️
                <div class="ws-sdot sd-idle" id="sd-policy-check"></div>
              </div>
              <div class="ws-label" id="lbl-policy-check">Policy</div>
            </div>
            <div class="think-dots" id="td-policy-check"><div class="td"></div><div class="td"></div><div class="td"></div></div>
            <div class="ws-tip" id="tip-policy-check">Enforcing content policies</div>
          </div>
        </div>
        <div class="policy-scanner"></div>
      </div>

    </div><!-- /office-grid -->
  </div><!-- /scene-wrap -->

  <!-- ── RIGHT PANEL ─────────────────────────────────────────────────────────── -->
  <div id="right">
    <div class="rp-tabs">
      <div class="rp-tab active" onclick="showTab('feed')" id="tab-feed">Feed</div>
      <div class="rp-tab" onclick="showTab('tasks')" id="tab-tasks">Tasks</div>
      <div class="rp-tab" onclick="showTab('approvals')" id="tab-approvals">
        Approve<span class="rp-badge" id="badge-approvals" style="display:none">0</span>
      </div>
      <div class="rp-tab" onclick="showTab('improve')" id="tab-improve">Improve</div>
    </div>
    <div class="rp-body" id="rp-body"></div>
  </div>
</div>

<script>
// ── AGENT CONFIG ──────────────────────────────────────────────────────────────
const AGENTS = [
  {id:'supervisor',   name:'Supervisor',   room:'supervisor',  emoji:'🎯', color:'#fbbf24', role:'Orchestrating pipeline'},
  {id:'claude',       name:'Claude',       room:'claude',      emoji:'🤖', color:'#3b82f6', role:'Writing video scripts'},
  {id:'codex',        name:'Codex',        room:'codex',       emoji:'💻', color:'#8b5cf6', role:'Generating code'},
  {id:'analytics',    name:'Analytics',    room:'analytics',   emoji:'📊', color:'#6366f1', role:'Tracking metrics'},
  {id:'gemini',       name:'Gemini',       room:'gemini',      emoji:'🔍', color:'#ec4899', role:'Researching topics'},
  {id:'frontend',     name:'Frontend',     room:'frontend',    emoji:'🎨', color:'#14b8a6', role:'Building UI'},
  {id:'backend',      name:'Backend',      room:'backend',     emoji:'⚙️', color:'#06b6d4', role:'API services'},
  {id:'qa',           name:'QA',           room:'qa',          emoji:'🧪', color:'#10b981', role:'Quality assurance'},
  {id:'video-render', name:'Video Render', room:'video',       emoji:'🎬', color:'#f97316', role:'Rendering video'},
  {id:'voiceover',    name:'Voiceover',    room:'voiceover',   emoji:'🎙️', color:'#a855f7', role:'Generating audio'},
  {id:'assets',       name:'Assets',       room:'assets',      emoji:'🖼️', color:'#f59e0b', role:'Fetching media'},
  {id:'publisher',    name:'Publisher',    room:'publisher',   emoji:'📤', color:'#06b6d4', role:'Publishing content'},
  {id:'policy-check', name:'Policy',       room:'policy',      emoji:'🛡️', color:'#ef4444', role:'Compliance check'},
];

// ── STATE ─────────────────────────────────────────────────────────────────────
const STATE = {};
AGENTS.forEach(a => {
  STATE[a.id] = {
    status: 'idle', task: a.role, progress: 0,
    lastUpdate: Date.now(), taskCount: 0
  };
});

// ── SIMULATION CONFIG ─────────────────────────────────────────────────────────
const SIM_TICK = 1800;
const STATUS_WEIGHTS = {
  idle:       {thinking:0.3, idle:0.4, running:0.3},
  thinking:   {coding:0.3, running:0.4, idle:0.15, waiting:0.15},
  running:    {reviewing:0.25, coding:0.3, testing:0.2, idle:0.15, failed:0.05, completed:0.05},
  coding:     {reviewing:0.3, running:0.25, testing:0.2, thinking:0.15, idle:0.1},
  reviewing:  {completed:0.2, running:0.3, idle:0.2, thinking:0.15, testing:0.15},
  testing:    {completed:0.25, running:0.2, idle:0.2, reviewing:0.2, failed:0.15},
  completed:  {idle:0.6, thinking:0.3, running:0.1},
  failed:     {thinking:0.4, idle:0.4, running:0.2},
  waiting:    {running:0.4, thinking:0.3, idle:0.3},
};

// Role-specific status mappings
const ROLE_STATUSES = {
  'supervisor':   ['thinking','running','reviewing','idle'],
  'claude':       ['coding','thinking','running','reviewing','idle'],
  'codex':        ['coding','thinking','running','reviewing','idle'],
  'analytics':    ['running','thinking','completed','idle'],
  'gemini':       ['thinking','running','coding','idle'],
  'frontend':     ['coding','thinking','reviewing','running','idle'],
  'backend':      ['coding','running','testing','reviewing','idle'],
  'qa':           ['testing','running','reviewing','failed','completed','idle'],
  'video-render': ['running','thinking','completed','idle'],
  'voiceover':    ['running','thinking','completed','idle'],
  'assets':       ['running','thinking','completed','idle'],
  'publisher':    ['running','thinking','completed','waiting','idle'],
  'policy-check': ['running','testing','reviewing','completed','idle'],
};

// Role-specific task messages
const ROLE_TASKS = {
  'supervisor':   ['Delegating tasks to pipeline','Monitoring all 13 agents','Scheduling next batch','Reviewing pipeline health','Orchestrating workflow'],
  'claude':       ['Writing hook for video','Generating script outline','Polishing CTA section','Drafting B-roll notes','Finalizing script'],
  'codex':        ['Generating render function','Writing API integration','Optimizing output code','Debugging template','Building helper'],
  'analytics':    ['Aggregating view metrics','Calculating CTR trends','Building performance report','Tracking engagement','Analyzing audience'],
  'gemini':       ['Searching trending topics','Researching competitor content','Summarizing web sources','Finding viral hooks','Fact-checking script'],
  'frontend':     ['Building preview component','Styling dashboard tiles','Animating status indicators','Updating UI layout','Testing responsive'],
  'backend':      ['Handling POST /api/render','Updating job queue','Querying asset DB','Processing webhook','Managing auth tokens'],
  'qa':           ['Running script validation','Checking video quality','Verifying metadata','Testing publish endpoint','Scanning for policy violations'],
  'video-render': ['Rendering final video','Compositing B-roll','Applying transitions','Encoding H.264','Exporting 9:16 format'],
  'voiceover':    ['Synthesizing voice audio','Adjusting prosody','Generating SSML','Aligning timestamps','Mixing audio track'],
  'assets':       ['Fetching Pexels footage','Downloading stock images','Caching media assets','Indexing library','Resizing thumbnails'],
  'publisher':    ['Uploading to YouTube','Scheduling publish time','Setting video metadata','Generating tags','Confirming privacy: private'],
  'policy-check': ['Scanning content policy','Checking TOS compliance','Verifying age restrictions','Flagging sensitive terms','Approving for publish'],
};

// Status-to-label (what shows under agent name)
const STATUS_LABELS = {
  idle:'Idle', thinking:'Thinking...', running:'Running',
  coding:'Coding...', reviewing:'Reviewing', testing:'Testing',
  failed:'Failed!', completed:'Done ✓', waiting:'Waiting...',
  walking:'Walking', publishing:'Publishing', scanning:'Scanning',
  rendering:'Rendering', recording:'Recording', uploading:'Uploading',
};

let simTimer = null;
let simRunning = false;
let completedCount = 0;
let approvalQueue = [];
let feedItems = [];
let tasks = [];
let activeTab = 'feed';
let selectedAgent = null;

// ── SIMULATION ENGINE ─────────────────────────────────────────────────────────
function weightedRandom(weights) {
  const keys = Object.keys(weights);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let r = Math.random() * total;
  for (const k of keys) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

function pickTaskMsg(agentId) {
  const tasks = ROLE_TASKS[agentId] || ['Working...'];
  return tasks[Math.floor(Math.random() * tasks.length)];
}

function nextStatus(agentId, current) {
  const allowed = ROLE_STATUSES[agentId] || Object.keys(STATUS_WEIGHTS);
  const w = STATUS_WEIGHTS[current] || STATUS_WEIGHTS.idle;
  const filtered = {};
  for (const [k, v] of Object.entries(w)) {
    if (allowed.includes(k)) filtered[k] = v;
  }
  if (Object.keys(filtered).length === 0) return 'idle';
  return weightedRandom(filtered);
}

function tick() {
  const agentIds = AGENTS.map(a => a.id);
  // Update ~40% of agents per tick for natural stagger
  const toUpdate = agentIds.filter(() => Math.random() < 0.4);
  if (toUpdate.length === 0) toUpdate.push(agentIds[Math.floor(Math.random() * agentIds.length)]);

  toUpdate.forEach(id => {
    const s = STATE[id];
    const oldStatus = s.status;
    s.status = nextStatus(id, oldStatus);
    s.task = pickTaskMsg(id);
    s.progress = s.status === 'idle' ? 0 : Math.floor(Math.random() * 100);
    s.lastUpdate = Date.now();

    if (s.status === 'completed') {
      completedCount++;
      s.taskCount++;
      if (id === 'publisher') {
        const anPublished = document.getElementById('an-published');
        if (anPublished) anPublished.textContent = String(completedCount);
      }
    }

    // Rare: trigger approval for dangerous actions
    if (s.status === 'running' && id === 'publisher' && Math.random() < 0.08) {
      addApproval({
        type: 'YouTube Upload',
        icon: '📤',
        desc: 'Publisher requests approval to upload video to YouTube (private).',
        agentId: id,
      });
    }
    if (s.status === 'running' && id === 'supervisor' && Math.random() < 0.05) {
      addApproval({
        type: 'Pipeline Reset',
        icon: '⚡',
        desc: 'Supervisor requests permission to reset the task pipeline.',
        agentId: id,
      });
    }

    // Rare: self-improvement suggestion
    if (Math.random() < 0.03) {
      addSelfImprove(id, s.task);
    }

    renderAgentWs(id);
    addFeedItem(id, s.status, s.task);
  });

  updateStats();
  renderPanel();
}

function startSim() {
  if (simRunning) return;
  simRunning = true;
  document.getElementById('btn-start').style.display = 'none';
  document.getElementById('btn-stop').style.display = '';
  // Immediate first tick, then interval
  tick();
  simTimer = setInterval(tick, SIM_TICK);
}

function stopSim() {
  if (!simRunning) return;
  simRunning = false;
  clearInterval(simTimer);
  document.getElementById('btn-start').style.display = '';
  document.getElementById('btn-stop').style.display = 'none';
  AGENTS.forEach(a => {
    STATE[a.id].status = 'idle';
    renderAgentWs(a.id);
  });
  updateStats();
}

// ── RENDER AGENT WORKSTATION ──────────────────────────────────────────────────
function renderAgentWs(id) {
  const s = STATE[id];
  const ws = document.getElementById('ws-' + id);
  const sdot = document.getElementById('sd-' + id);
  const lbl = document.getElementById('lbl-' + id);
  const tip = document.getElementById('tip-' + id);
  const tdEl = document.getElementById('td-' + id);
  const room = document.getElementById('room-' + AGENTS.find(a => a.id === id)?.room);

  if (!ws || !sdot) return;

  const isActive = s.status !== 'idle';
  ws.classList.toggle('ws-on', isActive);
  if (room) room.classList.toggle('rm-active', isActive);

  // Status dot
  sdot.className = 'ws-sdot sd-' + s.status;

  // Label with typing cursor for coding states
  if (lbl) {
    lbl.textContent = STATUS_LABELS[s.status] || s.status;
    lbl.classList.toggle('typing', ['coding','running','thinking'].includes(s.status));
  }

  // Tooltip
  if (tip) tip.textContent = s.task;

  // Think dots visible during thinking
  if (tdEl) {
    tdEl.classList.toggle('td-show', s.status === 'thinking');
  }

  // Monitor content: update color based on status
  const mon = document.getElementById('mon-' + id);
  if (mon) {
    const activeClass = s.status === 'idle' ? 'mc-idle' : null;
    if (activeClass) {
      mon.className = mon.className.replace(/mc-\w+/, activeClass);
    } else {
      mon.className = mon.className.replace('mc-idle', '');
    }
  }
}

// ── FEED ──────────────────────────────────────────────────────────────────────
function addFeedItem(agentId, status, msg) {
  const agent = AGENTS.find(a => a.id === agentId);
  if (!agent) return;
  const now = new Date();
  const time = now.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  feedItems.unshift({agentId, agentName: agent.name, color: agent.color, status, msg, time});
  if (feedItems.length > 60) feedItems.pop();
}

// ── APPROVALS ─────────────────────────────────────────────────────────────────
function addApproval(ap) {
  ap.id = Date.now() + Math.random();
  approvalQueue.unshift(ap);
  updateApprovalBadge();
}

function updateApprovalBadge() {
  const badge = document.getElementById('badge-approvals');
  if (!badge) return;
  if (approvalQueue.length > 0) {
    badge.style.display = '';
    badge.textContent = String(approvalQueue.length);
  } else {
    badge.style.display = 'none';
  }
}

function approveAction(apId, approved) {
  approvalQueue = approvalQueue.filter(a => a.id !== apId);
  updateApprovalBadge();
  addFeedItem('supervisor', approved ? 'completed' : 'failed',
    approved ? 'Action approved by operator' : 'Action denied by operator');
  renderPanel();
}

// ── SELF-IMPROVE ──────────────────────────────────────────────────────────────
const selfImproveSuggestions = [];
const SI_LIBRARY = [
  {icon:'⚡', title:'Parallelize renders',     tag:'Performance', desc:'Run video render and voiceover generation in parallel to reduce pipeline time by ~40%.'},
  {icon:'🔁', title:'Cache script templates',  tag:'Efficiency',  desc:'Cache frequently used script templates in memory to avoid repeated LLM calls.'},
  {icon:'📊', title:'Add CTR tracking',         tag:'Analytics',   desc:'Track per-video click-through rates to improve future hook generation.'},
  {icon:'🛡️', title:'Pre-scan policy violations',tag:'Safety',    desc:'Run policy checks earlier in pipeline before render to avoid wasted compute.'},
  {icon:'🎯', title:'Smarter task routing',     tag:'Routing',     desc:'Route tasks by agent load to avoid bottlenecks in the video render queue.'},
  {icon:'💾', title:'Persist completed tasks',  tag:'Storage',     desc:'Save completed task results to disk for audit trail and replay capability.'},
  {icon:'🔔', title:'Notify on completion',     tag:'UX',          desc:'Send desktop notification when a full pipeline run completes.'},
];
function addSelfImprove(agentId, task) {
  const s = SI_LIBRARY[Math.floor(Math.random() * SI_LIBRARY.length)];
  selfImproveSuggestions.unshift({...s, agentId, id: Date.now() + Math.random()});
  if (selfImproveSuggestions.length > 20) selfImproveSuggestions.pop();
}

// ── TASKS ─────────────────────────────────────────────────────────────────────
function buildTasks() {
  return AGENTS.map(a => ({
    id: a.id,
    agentId: a.id,
    agentName: a.name,
    color: a.color,
    status: STATE[a.id].status,
    desc: STATE[a.id].task,
    progress: STATE[a.id].progress,
  }));
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const active = AGENTS.filter(a => STATE[a.id].status !== 'idle' && STATE[a.id].status !== 'failed').length;
  const failed = AGENTS.filter(a => STATE[a.id].status === 'failed').length;
  document.getElementById('stat-agents').textContent = String(AGENTS.length);
  document.getElementById('stat-active').textContent = String(active);
  document.getElementById('stat-queue').textContent = String(failed);
  document.getElementById('stat-approvals').textContent = String(approvalQueue.length);
  document.getElementById('stat-completed').textContent = String(completedCount);
}

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────
function showTab(tab) {
  activeTab = tab;
  ['feed','tasks','approvals','improve'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.classList.toggle('active', t === tab);
  });
  renderPanel();
}

// ── PANEL RENDER ──────────────────────────────────────────────────────────────
function renderPanel() {
  const body = document.getElementById('rp-body');
  if (!body) return;
  if (activeTab === 'feed')      body.innerHTML = renderFeedHtml();
  if (activeTab === 'tasks')     body.innerHTML = renderTasksHtml();
  if (activeTab === 'approvals') body.innerHTML = renderApprovalsHtml();
  if (activeTab === 'improve')   body.innerHTML = renderImproveHtml();
}

function renderFeedHtml() {
  if (feedItems.length === 0) return '<div class="empty-state">No activity yet — click Start to begin</div>';
  return feedItems.slice(0,40).map(f => {
    const statusColor = {
      idle:'#4a5a72', thinking:'#8b5cf6', running:'#3b82f6',
      coding:'#06b6d4', reviewing:'#a855f7', testing:'#10b981',
      failed:'#ef4444', completed:'#10b981', waiting:'#f59e0b',
    }[f.status] || '#4a5a72';
    return \`<div class="feed-item">
      <span class="fi-agent" style="color:\${f.color}">\${f.agentName}</span>
      <span style="font-size:.52rem;color:\${statusColor};margin-left:4px">[\${f.status.toUpperCase()}]</span>
      <span class="fi-time">\${f.time}</span>
      <div class="fi-msg">\${f.msg}</div>
    </div>\`;
  }).join('');
}

function renderTasksHtml() {
  const tlist = buildTasks();
  if (tlist.length === 0) return '<div class="empty-state">No tasks yet</div>';
  return tlist.map(t => {
    const statusColor = {running:'var(--bl)',coding:'var(--cy)',thinking:'var(--pp)',testing:'var(--gn)',reviewing:'var(--pp)',completed:'var(--gn)',failed:'var(--rd)',waiting:'var(--am)',idle:'var(--mt)'}[t.status] || 'var(--mt)';
    return \`<div class="task-item">
      <div class="ti-head">
        <span class="ti-agent" style="background:rgba(0,0,0,.3);color:\${t.color};border:1px solid \${t.color}40">\${t.agentName}</span>
        <span class="ti-status" style="color:\${statusColor}">\${STATUS_LABELS[t.status]||t.status}</span>
      </div>
      <div class="ti-desc">\${t.desc}</div>
      <div class="ti-prog"><div class="ti-prog-fill" style="width:\${t.progress}%;background:\${t.color}"></div></div>
    </div>\`;
  }).join('');
}

function renderApprovalsHtml() {
  let html = '';
  if (approvalQueue.length === 0) {
    html += '<div class="empty-state">No pending approvals</div>';
  } else {
    html += approvalQueue.map(ap => \`<div class="ap-item">
      <div class="ap-head">
        <span class="ap-icon">\${ap.icon}</span>
        <span class="ap-type">\${ap.type}</span>
        <span class="ap-pill">PENDING</span>
      </div>
      <div class="ap-desc">\${ap.desc}</div>
      <div class="ap-btns">
        <button class="ap-btn ap-approve" onclick="approveAction(\${ap.id}, true)">✓ Approve</button>
        <button class="ap-btn ap-deny" onclick="approveAction(\${ap.id}, false)">✗ Deny</button>
      </div>
    </div>\`).join('');
  }
  // System health
  html += '<div class="sec-hdr" style="margin-top:10px">System Health</div>';
  html += '<div class="health-panel"><div class="health-title">🩺 API Status</div><div class="health-grid" id="health-grid">Loading...</div></div>';
  fetchHealth();
  return html;
}

function renderImproveHtml() {
  if (selfImproveSuggestions.length === 0) {
    return '<div class="empty-state">No suggestions yet — agents generate these while working</div>';
  }
  return selfImproveSuggestions.slice(0,12).map(s => \`<div class="si-item">
    <div class="si-head">
      <span class="si-icon">\${s.icon}</span>
      <span class="si-title">\${s.title}</span>
      <span class="si-tag">\${s.tag}</span>
    </div>
    <div class="si-desc">\${s.desc}</div>
    <div class="si-footer">Suggested by \${s.agentId} agent — review before applying</div>
  </div>\`).join('');
}

function fetchHealth() {
  fetch('/api/system/health').then(r => r.json()).then(data => {
    const grid = document.getElementById('health-grid');
    if (!grid) return;
    const keys = data.apiKeys || {};
    grid.innerHTML = Object.entries(keys).map(([k,v]) => {
      const ok = v === true;
      return \`<div class="health-item">
        <div class="hi-dot" style="background:\${ok?'var(--gn)':'var(--rd)'}"></div>
        <div class="hi-name">\${k.replace(/_API_KEY$/,'').replace(/_/g,' ')}</div>
        <div class="hi-status" style="color:\${ok?'var(--gn)':'var(--rd)'}">\${ok?'OK':'—'}</div>
      </div>\`;
    }).join('');
  }).catch(() => {
    const grid = document.getElementById('health-grid');
    if (grid) grid.innerHTML = '<div style="color:var(--mt);font-size:.6rem">Health check unavailable</div>';
  });
}

// ── AGENT SELECT ──────────────────────────────────────────────────────────────
function selectAgent(id) {
  selectedAgent = id;
  showTab('tasks');
}

// ── SOCKET.IO OVERLAY ─────────────────────────────────────────────────────────
(function() {
  try {
    const socket = io({transports:['websocket','polling'],reconnectionDelay:2000});
    socket.on('agent:update', data => {
      if (!data || !data.name) return;
      const id = data.name;
      if (STATE[id]) {
        const mapped = {running:'running',idle:'idle',blocked:'failed',failed:'failed',completed:'completed'}[data.status] || data.status;
        STATE[id].status = mapped;
        if (data.currentTask) STATE[id].task = data.currentTask;
        renderAgentWs(id);
        addFeedItem(id, mapped, data.currentTask || STATE[id].task);
        updateStats();
        if (activeTab !== 'feed') return;
        renderPanel();
      }
    });
    socket.on('log', data => {
      if (data && data.message) {
        addFeedItem('supervisor', 'running', String(data.message).slice(0,80));
        if (activeTab === 'feed') renderPanel();
      }
    });
  } catch(e) {}
})();

// ── INIT ──────────────────────────────────────────────────────────────────────
updateStats();
renderPanel();
startSim();
<\/script>
</body>
</html>`;
}
