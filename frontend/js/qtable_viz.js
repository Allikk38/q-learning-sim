// qtable_viz.js — Q-радар (I3)

const radarCanvas = document.getElementById('radar-canvas');
let radarCtx = null;

let radarData = {
    qN: 0, qS: 0, qW: 0, qE: 0,
    targetQN: 0, targetQS: 0, targetQW: 0, targetQE: 0,
    currentAction: null,
    lerpFrames: 0
};

const MAX_RADIUS = 70;
const LERP_DURATION = 20;

if (radarCanvas) {
    radarCtx = radarCanvas.getContext('2d');
}

function updateRadar(qTable, currentAction, currentState) {
    if (!radarCtx) return;

    let stateKey = currentState;
    if (!stateKey || !qTable[stateKey]) {
        const keys = Object.keys(qTable);
        if (keys.length === 0) return;
        stateKey = keys[0];
    }

    const actions = qTable[stateKey];
    if (!actions) return;

    radarData.targetQN = actions['move_n'] ?? 0;
    radarData.targetQS = actions['move_s'] ?? 0;
    radarData.targetQW = actions['move_w'] ?? 0;
    radarData.targetQE = actions['move_e'] ?? 0;
    radarData.currentAction = currentAction;
    radarData.lerpFrames = LERP_DURATION;

    if (radarData.qN === 0 && radarData.qS === 0 && radarData.qW === 0 && radarData.qE === 0) {
        radarData.qN = radarData.targetQN;
        radarData.qS = radarData.targetQS;
        radarData.qW = radarData.targetQW;
        radarData.qE = radarData.targetQE;
        radarData.lerpFrames = 0;
    }

    drawRadar();
}

function lerpRadarValues() {
    if (radarData.lerpFrames <= 0) return;

    radarData.qN = radarData.qN + (radarData.targetQN - radarData.qN) * 0.2;
    radarData.qS = radarData.qS + (radarData.targetQS - radarData.qS) * 0.2;
    radarData.qW = radarData.qW + (radarData.targetQW - radarData.qW) * 0.2;
    radarData.qE = radarData.qE + (radarData.targetQE - radarData.qE) * 0.2;
    radarData.lerpFrames--;

    drawRadar();
}

function drawRadar() {
    if (!radarCtx) return;

    const w = 200;
    const h = 200;
    const cx = w / 2;
    const cy = h / 2;

    radarCtx.clearRect(0, 0, w, h);

    radarCtx.fillStyle = '#0f0f1a';
    radarCtx.fillRect(0, 0, w, h);

    radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    radarCtx.lineWidth = 1;
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, MAX_RADIUS, 0, Math.PI * 2);
    radarCtx.stroke();

    for (let r = MAX_RADIUS / 3; r <= MAX_RADIUS; r += MAX_RADIUS / 3) {
        radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        radarCtx.lineWidth = 0.5;
        radarCtx.beginPath();
        radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
        radarCtx.stroke();
    }

    radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    radarCtx.lineWidth = 0.5;
    radarCtx.beginPath();
    radarCtx.moveTo(cx - MAX_RADIUS, cy);
    radarCtx.lineTo(cx + MAX_RADIUS, cy);
    radarCtx.moveTo(cx, cy - MAX_RADIUS);
    radarCtx.lineTo(cx, cy + MAX_RADIUS);
    radarCtx.stroke();

    const absVals = [
        Math.abs(radarData.qN), Math.abs(radarData.qS),
        Math.abs(radarData.qW), Math.abs(radarData.qE)
    ];
    const maxAbsQ = Math.max(...absVals, 0.01);

    const directions = [
        { key: 'qN', angle: -Math.PI / 2,  label: 'N' },
        { key: 'qS', angle: Math.PI / 2,   label: 'S' },
        { key: 'qW', angle: Math.PI,       label: 'W' },
        { key: 'qE', angle: 0,             label: 'E' }
    ];

    for (const dir of directions) {
        const qValue = radarData[dir.key];
        const absQ = Math.abs(qValue);
        const length = (absQ / maxAbsQ) * MAX_RADIUS;
        const color = qValue >= 0 ? '#2ecc71' : '#e74c3c';

        const tipX = cx + Math.cos(dir.angle) * length;
        const tipY = cy + Math.sin(dir.angle) * length;

        radarCtx.fillStyle = qValue >= 0
            ? 'rgba(46, 204, 113, 0.3)'
            : 'rgba(231, 76, 60, 0.3)';
        radarCtx.beginPath();
        radarCtx.moveTo(cx, cy);
        radarCtx.lineTo(
            cx + Math.cos(dir.angle - 0.15) * length,
            cy + Math.sin(dir.angle - 0.15) * length
        );
        radarCtx.lineTo(tipX, tipY);
        radarCtx.lineTo(
            cx + Math.cos(dir.angle + 0.15) * length,
            cy + Math.sin(dir.angle + 0.15) * length
        );
        radarCtx.closePath();
        radarCtx.fill();

        radarCtx.strokeStyle = color;
        radarCtx.lineWidth = 1.5;
        radarCtx.beginPath();
        radarCtx.moveTo(cx, cy);
        radarCtx.lineTo(tipX, tipY);
        radarCtx.stroke();

        radarCtx.fillStyle = color;
        radarCtx.beginPath();
        radarCtx.arc(tipX, tipY, 3, 0, Math.PI * 2);
        radarCtx.fill();

        radarCtx.fillStyle = '#aaa';
        radarCtx.font = '9px monospace';
        radarCtx.textAlign = 'center';
        radarCtx.textBaseline = 'middle';
        radarCtx.fillText(
            qValue.toFixed(1),
            cx + Math.cos(dir.angle) * (length + 12),
            cy + Math.sin(dir.angle) * (length + 12)
        );
    }

    for (const dir of directions) {
        radarCtx.fillStyle = '#666';
        radarCtx.font = '10px monospace';
        radarCtx.textAlign = 'center';
        radarCtx.textBaseline = 'middle';
        radarCtx.fillText(
            dir.label,
            cx + Math.cos(dir.angle) * (MAX_RADIUS + 14),
            cy + Math.sin(dir.angle) * (MAX_RADIUS + 14)
        );
    }

    radarCtx.fillStyle = '#1a1a2e';
    radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    radarCtx.lineWidth = 1;
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, 12, 0, Math.PI * 2);
    radarCtx.fill();
    radarCtx.stroke();

    if (radarData.currentAction) {
        let arrowAngle = 0;
        switch (radarData.currentAction) {
            case 'move_n': arrowAngle = -Math.PI / 2; break;
            case 'move_s': arrowAngle = Math.PI / 2; break;
            case 'move_w': arrowAngle = Math.PI; break;
            case 'move_e': arrowAngle = 0; break;
            default: arrowAngle = 0;
        }

        radarCtx.fillStyle = '#f1c40f';
        radarCtx.beginPath();
        radarCtx.moveTo(
            cx + Math.cos(arrowAngle) * 10,
            cy + Math.sin(arrowAngle) * 10
        );
        radarCtx.lineTo(
            cx + Math.cos(arrowAngle + 2.5) * 7,
            cy + Math.sin(arrowAngle + 2.5) * 7
        );
        radarCtx.lineTo(
            cx + Math.cos(arrowAngle - 2.5) * 7,
            cy + Math.sin(arrowAngle - 2.5) * 7
        );
        radarCtx.closePath();
        radarCtx.fill();
    }
}

function animateRadar() {
    if (radarData.lerpFrames > 0) {
        lerpRadarValues();
    }
}