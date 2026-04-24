let canvas, ctx;
let gridWidth = 10;
let gridHeight = 10;
let cellSize = 40;
let heatMap = [];
let maxHeat = 1;

// V1: пылинки
let dustParticles = [];

// V2: предыдущие позиции
let prevAgentPositions = {};
let prevPredatorPositions = {};
let currentFrameTime = 0;

// V3: частицы
let particles = [];
// V6: camera shake
let shakeAmount = 0;

// V7 + I1: данные для HUD
let hudData = {
    step: 0,
    generation: 1,
    health: 100,
    energy: 80,
    hunger: 0,
    emotion: 'Бродит...'
};

// I2: мысли агента
let thoughtText = null;
let thoughtTimer = 0;
let thoughtStepCounter = 0;

// I5: вспышка перерождения
let rebornFlash = 0;

const COLORS = {
    empty: '#1a1a2e',
    food: '#2ecc71',
    poison: '#9b59b6',
    predator: '#e74c3c',
    agent: '#3498db'
};

// I5: состояния агента
const AGENT_STATES = {
    thriving: { body: '#00e5ff', glow: '#00e5ff', membrane: '#80deea' },
    healthy:  { body: '#00bcd4', glow: '#00e5ff', membrane: '#4dd0e1' },
    hungry:   { body: '#80cbc4', glow: '#90a4ae', membrane: '#b0bec5' },
    dying:    { body: '#ce93d8', glow: '#ce93d8', membrane: '#e1bee7' },
    reborn:   { body: '#ffffff', glow: '#ffffff', membrane: '#ffffff' }
};

const AGENT_COLORS = {
    core: '#e0f7fa',
    body: '#00bcd4',
    membrane: '#4dd0e1',
    glow: '#00e5ff',
    hunger_tint: '#90a4ae',
    poison_tint: '#ce93d8'
};

const FOOD_COLORS = {
    body_start: '#ffb300',
    body_end: '#ff8f00',
    inner_glow: 'rgba(255, 255, 200, 0.6)'
};

const POISON_COLORS = {
    body_start: '#7b1fa2',
    body_end: '#4a148c',
    outline: '#ce93d8',
    inner_glow: 'rgba(200, 100, 255, 0.5)'
};

const PREDATOR_COLORS = {
    body_start: '#b71c1c',
    body_end: '#f44336',
    outline: '#ff5252',
    eye: '#ffffff'
};

const GLOW_BASE_ALPHA = 0.08;

function initRenderer(canvasId) {
    canvas = document.getElementById(canvasId);
    ctx = canvas.getContext('2d');
}

function setGridSize(w, h) {
    gridWidth = w;
    gridHeight = h;
    cellSize = Math.floor(Math.min(
        (window.innerWidth - 340) / gridWidth,
        (window.innerHeight - 40) / gridHeight
    ));
    canvas.width = cellSize * gridWidth;
    canvas.height = cellSize * gridHeight + 30;
    heatMap = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
    generateDust();
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function generateDust() {
    dustParticles = [];
    const count = 30 + Math.floor(Math.random() * 11);
    for (let i = 0; i < count; i++) {
        dustParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height - 30),
            alpha: 0.1 + Math.random() * 0.2
        });
    }
}

// I5: внешний триггер вспышки перерождения
function triggerRebornFlash() {
    rebornFlash = 30;
}

function setThought(text) {
    thoughtText = text;
    thoughtTimer = 60;
}

function getEmotion(agent, metrics) {
    if (!agent) return 'Нет агента';

    const hunger = agent.hunger ?? 0;
    const health = agent.health ?? 100;
    const energy = agent.energy ?? 100;
    const entropy = metrics?.entropy ?? 0;
    const avgReward = metrics?.avg_reward ?? 0;

    if (hunger >= 70 && health < 40) return 'Отчаянно ищет еду';
    if (hunger >= 70 && health >= 40) return 'Голоден, но держится';
    if (hunger < 30 && entropy > 2.0) return 'Любопытный исследователь';
    if (hunger < 30 && entropy < 1.0 && avgReward > 0.5) return 'Научился избегать опасности';
    if (health < 40) return 'При смерти...';
    if (energy < 30) return 'Истощён';
    if (avgReward > 1.0) return 'Процветает';
    if (avgReward < -0.5) return 'Страдает';
    return 'Бродит...';
}

function generateThought(agents, predators) {
    if (!agents || agents.length === 0) return;

    const agent = agents[0];
    if (!agent || agent.alive === false) return;

    const randomThoughts = ['Что там?', 'Тут была еда...', 'Интересно...', 'Нужно двигаться'];

    if ((agent.hunger ?? 0) > 70) {
        setThought('Где еда?..');
        return;
    }

    if (agent.action === 'eat' && (agent.reward ?? 0) > 0) {
        setThought('Вкусно!');
        return;
    }

    if (agent.action === 'eat' && (agent.health ?? 100) < 50) {
        setThought('Отрава!');
        return;
    }

    for (const p of predators) {
        const dx = agent.x - p.x;
        const dy = agent.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 2) {
            setThought('Боюсь сюда идти');
            return;
        }
    }

    if (agent.q_table && agent.action) {
        for (const stateKey in agent.q_table) {
            const actions = agent.q_table[stateKey];
            if (actions[agent.action] !== undefined && actions[agent.action] < 0) {
                setThought('Не уверен...');
                return;
            }
        }
    }

    const randomIndex = Math.floor(Math.random() * randomThoughts.length);
    setThought(randomThoughts[randomIndex]);
}

function drawThoughtBubble(agent) {
    if (!agent || agent.alive === false) return;
    if (thoughtTimer <= 0 || !thoughtText) return;

    const id = agent.id;
    const cx = prevAgentPositions[id]?.x ?? (agent.x * cellSize + cellSize / 2);
    const cy = prevAgentPositions[id]?.y ?? (agent.y * cellSize + cellSize / 2);
    const radius = cellSize * 0.35;

    const tx = cx;
    const ty = cy - radius - 20;

    ctx.font = '10px monospace';
    const textWidth = ctx.measureText(thoughtText).width;
    const paddingX = 8;
    const paddingY = 5;
    const bubbleW = textWidth + paddingX * 2;
    const bubbleH = 16;
    const bubbleX = tx - bubbleW / 2;
    const bubbleY = ty - bubbleH / 2;

    const alpha = Math.min(1, thoughtTimer / 30);

    ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * alpha})`;
    ctx.beginPath();
    const cornerRadius = 6;
    ctx.moveTo(bubbleX + cornerRadius, bubbleY);
    ctx.lineTo(bubbleX + bubbleW - cornerRadius, bubbleY);
    ctx.arcTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + cornerRadius, cornerRadius);
    ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - cornerRadius);
    ctx.arcTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX + bubbleW - cornerRadius, bubbleY + bubbleH, cornerRadius);
    ctx.lineTo(bubbleX + cornerRadius, bubbleY + bubbleH);
    ctx.arcTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - cornerRadius, cornerRadius);
    ctx.lineTo(bubbleX, bubbleY + cornerRadius);
    ctx.arcTo(bubbleX, bubbleY, bubbleX + cornerRadius, bubbleY, cornerRadius);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * alpha})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(thoughtText, tx, ty);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    thoughtTimer--;
}

function updateHUD(step, generation, agent, metrics) {
    hudData.step = step;
    hudData.generation = generation;
    if (agent) {
        hudData.health = agent.health ?? 0;
        hudData.energy = agent.energy ?? 0;
        hudData.hunger = agent.hunger ?? 0;
        hudData.emotion = getEmotion(agent, metrics);
    } else {
        hudData.health = 0;
        hudData.energy = 0;
        hudData.hunger = 0;
        hudData.emotion = 'Нет агента';
    }
}

function drawHUD() {
    const gridHeightPx = cellSize * gridHeight;
    const barWidth = canvas.width;
    const barHeight = 4;
    const barGap = 3;

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Шаг: ${hudData.step} | Поколение: ${hudData.generation}`, 4, gridHeightPx + 1);

    const healthBarY = gridHeightPx + 15;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, healthBarY, barWidth, barHeight);
    const healthWidth = Math.max(0, Math.min(1, hudData.health / 100)) * barWidth;
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(0, healthBarY, healthWidth, barHeight);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    const energyBarY = healthBarY + barHeight + barGap;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, energyBarY, barWidth, barHeight);
    const energyWidth = Math.max(0, Math.min(1, hudData.energy / 100)) * barWidth;
    ctx.shadowColor = '#3498db';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, energyBarY, energyWidth, barHeight);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    const hungerBarY = energyBarY + barHeight + barGap;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, hungerBarY, barWidth, barHeight);
    const hungerWidth = Math.max(0, Math.min(1, hudData.hunger / 100)) * barWidth;
    ctx.shadowColor = '#e67e22';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(0, hungerBarY, hungerWidth, barHeight);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    const emotionY = hungerBarY + barHeight + 8;
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(hudData.emotion, 4, emotionY);
}

function spawnFoodParticles(cx, cy, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.04,
            radius: 1.5 + Math.random() * 2.5,
            color: `hsl(${40 + Math.random() * 20}, 100%, ${60 + Math.random() * 20}%)`
        });
    }
}

function spawnPoisonFlash(cx, cy) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.03 + Math.random() * 0.05,
            radius: 1 + Math.random() * 3,
            color: `hsl(${280 + Math.random() * 30}, 80%, ${50 + Math.random() * 30}%)`
        });
    }
}

function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function triggerShake(intensity) {
    shakeAmount = Math.max(shakeAmount, intensity);
}

function getOccupiedCells(cells, agents, predators) {
    const occupied = new Set();
    for (const cell of cells) {
        if (cell.type !== 'empty') occupied.add(`${cell.x},${cell.y}`);
    }
    for (const a of agents) {
        if (a.alive !== false) occupied.add(`${a.x},${a.y}`);
    }
    for (const p of predators) {
        occupied.add(`${p.x},${p.y}`);
    }
    return occupied;
}

function drawCellGlow(cx, cy, type) {
    const radius = cellSize * 0.5;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    let color;
    switch (type) {
        case 'food':    color = [46, 204, 113]; break;
        case 'poison':  color = [155, 89, 182]; break;
        case 'predator': color = [231, 76, 60]; break;
        case 'agent':   color = [52, 152, 219]; break;
        default: return;
    }
    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${GLOW_BASE_ALPHA})`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

function drawHeatMap() {
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const heat = heatMap[y]?.[x] || 0;
            if (heat === 0) continue;
            const cx = x * cellSize + cellSize / 2;
            const cy = y * cellSize + cellSize / 2;
            const alpha = Math.log(heat + 1) / Math.log(maxHeat + 1) * 0.4;
            const radius = cellSize * 0.6;
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            gradient.addColorStop(0, `rgba(255, 140, 0, ${alpha})`);
            gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawDust() {
    for (const p of dustParticles) {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fillRect(p.x, p.y, 1, 1);
    }
}

function drawGridLines() {
    const gridHeightPx = cellSize * gridHeight;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= gridWidth; x++) {
        const px = x * cellSize;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, gridHeightPx);
    }
    for (let y = 0; y <= gridHeight; y++) {
        const py = y * cellSize;
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.width, py);
    }
    ctx.stroke();
}

function drawPredator(predator) {
    const id = predator.id;
    const targetX = predator.x * cellSize + cellSize / 2;
    const targetY = predator.y * cellSize + cellSize / 2;
    if (!prevPredatorPositions[id]) {
        prevPredatorPositions[id] = { x: targetX, y: targetY };
    }
    prevPredatorPositions[id].x = lerp(prevPredatorPositions[id].x, targetX, 0.2);
    prevPredatorPositions[id].y = lerp(prevPredatorPositions[id].y, targetY, 0.2);
    const cx = prevPredatorPositions[id].x;
    const cy = prevPredatorPositions[id].y;
    const halfLength = cellSize * 0.25;
    const halfWidth = cellSize * 0.1;
    const now = currentFrameTime;

    const auraRadius = cellSize * 1.5;
    const auraGradient = ctx.createRadialGradient(cx, cy, halfLength * 0.5, cx, cy, auraRadius);
    auraGradient.addColorStop(0, 'rgba(255, 0, 0, 0.15)');
    auraGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = auraGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    const waveOffset = Math.sin(now / 400) * cellSize * 0.05;
    const topX = cx;
    const topY = cy - halfLength;
    const rightX = cx + halfWidth + waveOffset;
    const rightY = cy;
    const bottomX = cx;
    const bottomY = cy + halfLength;
    const leftX = cx - halfWidth - waveOffset;
    const leftY = cy;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(bottomX, bottomY);
    ctx.lineTo(leftX, leftY);
    ctx.closePath();

    const bodyGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, halfLength);
    bodyGradient.addColorStop(0, PREDATOR_COLORS.body_start);
    bodyGradient.addColorStop(1, PREDATOR_COLORS.body_end);
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.strokeStyle = PREDATOR_COLORS.outline;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const eyeX = cx;
    const eyeY = cy - halfLength * 0.35;
    ctx.fillStyle = PREDATOR_COLORS.eye;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawPoison(poison, cellSize, frameTime) {
    const cx = poison.x * cellSize + cellSize / 2;
    const cy = poison.y * cellSize + cellSize / 2;
    const baseRadius = cellSize * 0.28;
    const spikes = 6;

    const glowRadius = baseRadius * 2.5;
    const glowGradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, glowRadius);
    glowGradient.addColorStop(0, 'rgba(180, 0, 200, 0.2)');
    glowGradient.addColorStop(1, 'rgba(180, 0, 200, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
        const angle = i * Math.PI / 3 + frameTime / 1500;
        const spikeLength = baseRadius * (1 + Math.sin(frameTime / 600 + i) * 0.3);
        const px = cx + Math.cos(angle) * spikeLength;
        const py = cy + Math.sin(angle) * spikeLength;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const bodyGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius);
    bodyGradient.addColorStop(0, POISON_COLORS.body_start);
    bodyGradient.addColorStop(1, POISON_COLORS.body_end);
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.strokeStyle = POISON_COLORS.outline;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const innerRadius = baseRadius * 0.15;
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerRadius);
    innerGlow.addColorStop(0, 'rgba(200, 100, 255, 0.5)');
    innerGlow.addColorStop(1, 'rgba(200, 100, 255, 0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
}

function drawFood(food, cellSize, frameTime) {
    const cx = food.x * cellSize + cellSize / 2;
    const cy = food.y * cellSize + cellSize / 2;
    const baseRadius = cellSize * 0.3;

    const glowRadius = baseRadius * 2;
    const glowGradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, glowRadius);
    glowGradient.addColorStop(0, 'rgba(255, 200, 50, 0.15)');
    glowGradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    const points = 10;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const offset = Math.sin(frameTime / 800 + i * 1.5) * baseRadius * 0.15;
        const r = baseRadius + offset;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const bodyGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius);
    bodyGradient.addColorStop(0, FOOD_COLORS.body_start);
    bodyGradient.addColorStop(1, FOOD_COLORS.body_end);
    ctx.fillStyle = bodyGradient;
    ctx.fill();

    const innerRadius = baseRadius * 0.2;
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerRadius);
    innerGlow.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
    innerGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
}

// I5: определение состояния агента по показателям
function getAgentState(agent) {
    if (rebornFlash > 0) return 'reborn';

    const health = agent.health ?? 100;
    const hunger = agent.hunger ?? 0;
    const reward = agent.reward ?? 0;

    if (health > 70 && hunger < 30 && reward > 0.5) return 'thriving';
    if (health > 50 && hunger < 50) return 'healthy';
    if (hunger > 70) return 'hungry';
    if (health < 30) return 'dying';
    return 'healthy';
}

function drawAgent(agent) {
    if (agent.alive === false) return;
    const id = agent.id;
    const targetX = agent.x * cellSize + cellSize / 2;
    const targetY = agent.y * cellSize + cellSize / 2;
    if (!prevAgentPositions[id]) {
        prevAgentPositions[id] = { x: targetX, y: targetY };
    }
    prevAgentPositions[id].x = lerp(prevAgentPositions[id].x, targetX, 0.2);
    prevAgentPositions[id].y = lerp(prevAgentPositions[id].y, targetY, 0.2);
    const cx = prevAgentPositions[id].x;
    const cy = prevAgentPositions[id].y;
    const radius = cellSize * 0.35;
    const now = currentFrameTime;

    // I5: выбор состояния
    const stateName = getAgentState(agent);
    const state = AGENT_STATES[stateName];

    // I5: пульсация зависит от состояния
    let corePulse, coreRadiusMult;
    switch (stateName) {
        case 'thriving':
            corePulse = Math.sin(now / 300) * 0.3 + 1;
            coreRadiusMult = 0.35;
            break;
        case 'hungry':
            corePulse = Math.sin(now / 250) * 0.3 + 1;
            coreRadiusMult = 0.2;
            break;
        case 'dying':
            corePulse = Math.sin(now / 400) * Math.sin(now / 200) * 0.5 + 1;
            coreRadiusMult = 0.3;
            break;
        case 'reborn':
            corePulse = Math.sin(now / 200) * 0.4 + 1;
            coreRadiusMult = 0.4;
            break;
        default: // healthy
            corePulse = Math.sin(now / 500) * 0.2 + 1;
            coreRadiusMult = 0.3;
    }

    // 1. Внешнее свечение
    const glowRadius = radius + 3;
    const glowGradient = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, glowRadius);
    glowGradient.addColorStop(0, state.glow);
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Тело
    ctx.fillStyle = state.body;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Мембрана
    const membraneAlpha = Math.sin(now / 300) * 0.15 + 0.7;
    ctx.strokeStyle = state.membrane;
    ctx.globalAlpha = membraneAlpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 4. Ядро
    const coreRadius = radius * coreRadiusMult * corePulse;
    ctx.fillStyle = AGENT_COLORS.core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    // I5: уменьшаем счётчик вспышки
    if (rebornFlash > 0) rebornFlash--;
}

function drawGrid(cells, agents, predators) {
    currentFrameTime = Date.now();

    thoughtStepCounter++;

    if (thoughtStepCounter % 4 === 0 && thoughtTimer <= 0) {
        generateThought(agents, predators);
    }

    let shakeApplied = false;
    if (shakeAmount > 0.01) {
        const sx = (Math.random() - 0.5) * shakeAmount * 2;
        const sy = (Math.random() - 0.5) * shakeAmount * 2;
        ctx.save();
        ctx.translate(sx, sy);
        shakeAmount *= 0.85;
        shakeApplied = true;
    } else {
        shakeAmount = 0;
    }

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawDust();

    const occupied = getOccupiedCells(cells, agents, predators);
    for (const key of occupied) {
        const [gx, gy] = key.split(',').map(Number);
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        let cellType = 'agent';
        const cell = cells.find(c => c.x === gx && c.y === gy);
        if (cell && cell.type !== 'empty') {
            cellType = cell.type;
        } else {
            const hasAgent = agents.some(a => a.x === gx && a.y === gy && a.alive !== false);
            const hasPredator = predators.some(p => p.x === gx && p.y === gy);
            if (hasAgent) cellType = 'agent';
            else if (hasPredator) cellType = 'predator';
        }
        drawCellGlow(cx, cy, cellType);
    }

    drawHeatMap();

    drawGridLines();

    for (const cell of cells) {
        if (cell.type === 'food') drawFood(cell, cellSize, currentFrameTime);
    }

    for (const cell of cells) {
        if (cell.type === 'poison') drawPoison(cell, cellSize, currentFrameTime);
    }

    for (const p of predators) {
        drawPredator(p);
    }

    for (const a of agents) {
        drawAgent(a);
        drawThoughtBubble(a);

        if (a.alive !== false && heatMap[a.y] !== undefined) {
            heatMap[a.y][a.x] = (heatMap[a.y][a.x] || 0) + 1;
            if (heatMap[a.y][a.x] > maxHeat) maxHeat = heatMap[a.y][a.x];
        }
    }

    updateAndDrawParticles();
    animateRadar();

    drawHUD();

    if (shakeApplied) {
        ctx.restore();
    }
}

function applyDeltas(deltas) {
    for (const d of deltas) {
        if (d.type === 'agent_moved') {
            heatMap[d.from[1]][d.from[0]] = (heatMap[d.from[1]][d.from[0]] || 0) + 0;
        }
        if (d.type === 'food_consumed') {
            const cx = d.x * cellSize + cellSize / 2;
            const cy = d.y * cellSize + cellSize / 2;
            spawnFoodParticles(cx, cy, 8);
            triggerShake(1);
        }
        if (d.type === 'poison_consumed') {
            const cx = d.x * cellSize + cellSize / 2;
            const cy = d.y * cellSize + cellSize / 2;
            spawnPoisonFlash(cx, cy);
            triggerShake(3);
        }
        if (d.type === 'agent_died') {
            triggerRebornFlash();
        }
    }
}

function resetRenderer() {
    heatMap = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
    maxHeat = 1;
    prevAgentPositions = {};
    prevPredatorPositions = {};
    particles = [];
    shakeAmount = 0;
    hudData = { step: 0, generation: 1, health: 100, energy: 80, hunger: 0, emotion: 'Бродит...' };
    thoughtText = null;
    thoughtTimer = 0;
    thoughtStepCounter = 0;
    rebornFlash = 0;
}