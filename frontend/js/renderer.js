let canvas, ctx;
let gridWidth = 10;
let gridHeight = 10;
let cellSize = 40;
let heatMap = [];
let maxHeat = 1;

// Камера
let cameraX = 0;
let cameraY = 0;
let zoom = 1.0;

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
    ecoScore: 0,
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

// Выбранный агент
let selectedAgentId = null;

// Всплывашки достижений
let achievementPopup = null;
let achievementPopupTimer = 0;

// Поколения агентов
let agentGenerations = {};

// Данные клеток
let currentCells = [];
let currentAgents = [];

// Перетаскивание камеры
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartCamX = 0;
let panStartCamY = 0;

const AGENT_COLORS_PALETTE = [
    { body: '#3498db', glow: '#3498db', membrane: '#85c1e9' },
    { body: '#2ecc71', glow: '#2ecc71', membrane: '#82e0aa' },
    { body: '#e67e22', glow: '#e67e22', membrane: '#f0b27a' }
];

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function getCellFromEvent(e) {
    const coords = getCanvasCoords(e);
    const world = screenToWorld(coords.x, coords.y);
    return {
        x: Math.floor(world.x / cellSize),
        y: Math.floor(world.y / cellSize)
    };
}

function initRenderer(canvasId) {
    canvas = document.getElementById(canvasId);
    ctx = canvas.getContext('2d');

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const coords = getCanvasCoords(e);
        const worldX = (coords.x - cameraX) / zoom;
        const worldY = (coords.y - cameraY) / zoom;

        if (e.deltaY < 0) {
            zoom = Math.min(zoom * zoomFactor, 3.0);
        } else {
            zoom = Math.max(zoom / zoomFactor, 0.2);
        }

        cameraX = coords.x - worldX * zoom;
        cameraY = coords.y - worldY * zoom;
        clampCamera();
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            isPanning = true;
            const coords = getCanvasCoords(e);
            panStartX = coords.x;
            panStartY = coords.y;
            panStartCamX = cameraX;
            panStartCamY = cameraY;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const coords = getCanvasCoords(e);
            cameraX = panStartCamX + (coords.x - panStartX);
            cameraY = panStartCamY + (coords.y - panStartY);
            clampCamera();
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'default';
        }
    });

    canvas.addEventListener('click', (e) => {
        if (isPanning) return;
        const cell = getCellFromEvent(e);
        if (cell.x < 0 || cell.x >= gridWidth || cell.y < 0 || cell.y >= gridHeight) return;

        selectedAgentId = null;
        for (const agent of currentAgents) {
            if (agent.alive === false) continue;
            if (agent.x === cell.x && agent.y === cell.y) {
                selectedAgentId = agent.id;
                break;
            }
        }
    });

    initEditor(canvas);
}

function clampCamera() {
    const worldWidth = gridWidth * cellSize * zoom;
    const worldHeight = gridHeight * cellSize * zoom + 30;

    if (worldWidth <= canvas.width) {
        cameraX = (canvas.width - worldWidth) / 2;
    } else {
        cameraX = Math.min(0, Math.max(cameraX, canvas.width - worldWidth));
    }

    if (worldHeight <= canvas.height) {
        cameraY = (canvas.height - worldHeight) / 2;
    } else {
        cameraY = Math.min(0, Math.max(cameraY, canvas.height - worldHeight));
    }
}

function worldToScreen(wx, wy) {
    return {
        x: wx * zoom + cameraX,
        y: wy * zoom + cameraY
    };
}

function screenToWorld(sx, sy) {
    return {
        x: (sx - cameraX) / zoom,
        y: (sy - cameraY) / zoom
    };
}

function setGridSize(w, h) {
    gridWidth = w;
    gridHeight = h;
    cellSize = 8;
    canvas.width = Math.floor(Math.min(window.innerWidth - 340, window.innerHeight - 40));
    canvas.height = Math.floor(canvas.width * (h / w)) + 30;
    zoom = Math.min(canvas.width / (gridWidth * cellSize), (canvas.height - 30) / (gridHeight * cellSize));
    cameraX = 0;
    cameraY = 0;
    clampCamera();
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

function triggerRebornFlash() {
    rebornFlash = 30;
}

function setThought(text) {
    thoughtText = text;
    thoughtTimer = 60;
}

function getEmotion(agent, metrics) {
    if (!agent) return 'Нет Агента';
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
    const targetId = selectedAgentId !== null ? selectedAgentId : agents[0]?.id;
    const agent = agents.find(a => a.id === targetId) || agents[0];
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
    if (selectedAgentId !== null && agent.id !== selectedAgentId) return;
    const id = agent.id;
    const px = prevAgentPositions[id]?.x ?? (agent.x * cellSize + cellSize / 2);
    const py = prevAgentPositions[id]?.y ?? (agent.y * cellSize + cellSize / 2);
    const screen = worldToScreen(px, py);
    const cx = screen.x;
    const cy = screen.y;
    const radius = cellSize * zoom * 0.35;
    const tx = cx;
    const ty = cy - radius - 20 * zoom;
    ctx.font = `${10 * zoom}px monospace`;
    const textWidth = ctx.measureText(thoughtText).width;
    const paddingX = 8 * zoom;
    const paddingY = 5 * zoom;
    const bubbleW = textWidth + paddingX * 2;
    const bubbleH = 16 * zoom;
    const bubbleX = tx - bubbleW / 2;
    const bubbleY = ty - bubbleH / 2;
    const alpha = Math.min(1, thoughtTimer / 30);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * alpha})`;
    ctx.beginPath();
    const cornerRadius = 6 * zoom;
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
    ctx.lineWidth = 0.5 * zoom;
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = `${10 * zoom}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(thoughtText, tx, ty);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    thoughtTimer--;
}

function updateHUD(step, generation, ecoScore, agent, metrics) {
    hudData.step = step;
    hudData.generation = generation;
    hudData.ecoScore = ecoScore || 0;
    if (agent) {
        hudData.health = agent.health ?? 0;
        hudData.energy = agent.energy ?? 0;
        hudData.hunger = agent.hunger ?? 0;
        hudData.emotion = getEmotion(agent, metrics);
    } else {
        hudData.health = 0;
        hudData.energy = 0;
        hudData.hunger = 0;
        hudData.emotion = 'Нет Агента';
    }
}

function drawHUD() {
    const barWidth = canvas.width;
    const barHeight = 3;
    const barGap = 2;
    const hudY = 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, 28);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`EcoScore: ${hudData.ecoScore}`, 8, hudY + 2);

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText(`Шаг: ${hudData.step} | Поколение: ${hudData.generation}`, 180, hudY + 4);

    const selectedLabel = selectedAgentId !== null ? ` | Агент #${selectedAgentId}` : '';
    ctx.fillText(selectedLabel, 180, hudY + 4);

    const healthBarY = hudY + 18;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, healthBarY, barWidth, barHeight);
    const healthWidth = Math.max(0, Math.min(1, hudData.health / 100)) * barWidth;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(0, healthBarY, healthWidth, barHeight);

    const energyBarY = healthBarY + barHeight + barGap;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, energyBarY, barWidth, barHeight);
    const energyWidth = Math.max(0, Math.min(1, hudData.energy / 100)) * barWidth;
    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, energyBarY, energyWidth, barHeight);

    const hungerBarY = energyBarY + barHeight + barGap;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, hungerBarY, barWidth, barHeight);
    const hungerWidth = Math.max(0, Math.min(1, hudData.hunger / 100)) * barWidth;
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(0, hungerBarY, hungerWidth, barHeight);
}

function showAchievementPopup(msg) {
    achievementPopup = msg;
    achievementPopupTimer = 180;
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
        ctx.arc(p.x, p.y, p.radius * zoom, 0, Math.PI * 2);
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

function getFertilityColor(fertility) {
    if (fertility === undefined || fertility === null || fertility <= 0) return null;
    let r, g, b;
    if (fertility <= 0.5) {
        const t = fertility / 0.5;
        r = Math.round(26 + (61 - 26) * t);
        g = Math.round(26 + (92 - 26) * t);
        b = Math.round(26 + (61 - 26) * t);
    } else {
        const t = (fertility - 0.5) / 0.5;
        r = Math.round(61 + (76 - 61) * t);
        g = Math.round(92 + (175 - 92) * t);
        b = Math.round(61 + (80 - 61) * t);
    }
    return `rgb(${r}, ${g}, ${b})`;
}

function drawCellGlow(cx, cy, type) {
    const radius = cellSize * zoom * 0.5;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    let color;
    switch (type) {
        case 'food':    color = [46, 204, 113]; break;
        case 'poison':  color = [155, 89, 182]; break;
        case 'predator': color = [231, 76, 60]; break;
        case 'agent':   color = [52, 152, 219]; break;
        default: return;
    }
    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.08)`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

function drawHeatMap() {
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const heat = heatMap[y]?.[x] || 0;
            if (heat === 0) continue;
            const worldX = x * cellSize + cellSize / 2;
            const worldY = y * cellSize + cellSize / 2;
            const screen = worldToScreen(worldX, worldY);
            const alpha = Math.log(heat + 1) / Math.log(maxHeat + 1) * 0.4;
            const radius = cellSize * zoom * 0.6;
            const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
            gradient.addColorStop(0, `rgba(255, 140, 0, ${alpha})`);
            gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
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
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(canvas.width, canvas.height - 30);
    const startCellX = Math.max(0, Math.floor(topLeft.x / cellSize));
    const startCellY = Math.max(0, Math.floor(topLeft.y / cellSize));
    const endCellX = Math.min(gridWidth, Math.ceil(bottomRight.x / cellSize) + 1);
    const endCellY = Math.min(gridHeight, Math.ceil(bottomRight.y / cellSize) + 1);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5 * zoom;
    ctx.beginPath();
    for (let x = startCellX; x <= endCellX; x++) {
        const screen = worldToScreen(x * cellSize, 0);
        ctx.moveTo(screen.x, worldToScreen(0, startCellY * cellSize).y);
        ctx.lineTo(screen.x, worldToScreen(0, endCellY * cellSize).y);
    }
    for (let y = startCellY; y <= endCellY; y++) {
        const screen = worldToScreen(0, y * cellSize);
        ctx.moveTo(worldToScreen(startCellX * cellSize, 0).x, screen.y);
        ctx.lineTo(worldToScreen(endCellX * cellSize, 0).x, screen.y);
    }
    ctx.stroke();
}

function drawPredator(predator) {
    const id = predator.id;
    const targetScreen = worldToScreen(
        predator.x * cellSize + cellSize / 2,
        predator.y * cellSize + cellSize / 2
    );
    if (!prevPredatorPositions[id]) {
        prevPredatorPositions[id] = { x: targetScreen.x, y: targetScreen.y };
    }
    prevPredatorPositions[id].x = lerp(prevPredatorPositions[id].x, targetScreen.x, 0.2);
    prevPredatorPositions[id].y = lerp(prevPredatorPositions[id].y, targetScreen.y, 0.2);
    const cx = prevPredatorPositions[id].x;
    const cy = prevPredatorPositions[id].y;
    const halfLength = cellSize * zoom * 0.25;
    const halfWidth = cellSize * zoom * 0.1;
    const now = currentFrameTime;

    const auraRadius = cellSize * zoom * 1.5;
    const auraGradient = ctx.createRadialGradient(cx, cy, halfLength * 0.5, cx, cy, auraRadius);
    auraGradient.addColorStop(0, 'rgba(255, 0, 0, 0.15)');
    auraGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = auraGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    const waveOffset = Math.sin(now / 400) * cellSize * zoom * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfLength);
    ctx.lineTo(cx + halfWidth + waveOffset, cy);
    ctx.lineTo(cx, cy + halfLength);
    ctx.lineTo(cx - halfWidth - waveOffset, cy);
    ctx.closePath();
    const bodyGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, halfLength);
    bodyGradient.addColorStop(0, '#b71c1c');
    bodyGradient.addColorStop(1, '#f44336');
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.strokeStyle = '#ff5252';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1 * zoom;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy - halfLength * 0.35, 2.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
}

function drawPoison(poison, cellSizeParam, frameTime) {
    const cx = poison.x * cellSizeParam + cellSizeParam / 2;
    const cy = poison.y * cellSizeParam + cellSizeParam / 2;
    const screen = worldToScreen(cx, cy);
    const baseRadius = cellSizeParam * zoom * 0.28;
    const spots = 6;

    const glowRadius = baseRadius * 2.5;
    const glowGradient = ctx.createRadialGradient(screen.x, screen.y, baseRadius * 0.4, screen.x, screen.y, glowRadius);
    glowGradient.addColorStop(0, 'rgba(180, 0, 200, 0.2)');
    glowGradient.addColorStop(1, 'rgba(180, 0, 200, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < spots; i++) {
        const angle = i * Math.PI / 3 + frameTime / 1500;
        const spikeLength = baseRadius * (1 + Math.sin(frameTime / 600 + i) * 0.3);
        const px = screen.x + Math.cos(angle) * spikeLength;
        const py = screen.y + Math.sin(angle) * spikeLength;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const bodyGradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, baseRadius);
    bodyGradient.addColorStop(0, '#7b1fa2');
    bodyGradient.addColorStop(1, '#4a148c');
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.strokeStyle = '#ce93d8';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1 * zoom;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const innerRadius = baseRadius * 0.15;
    const innerGlow = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, innerRadius);
    innerGlow.addColorStop(0, 'rgba(200, 100, 255, 0.5)');
    innerGlow.addColorStop(1, 'rgba(200, 100, 255, 0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, innerRadius, 0, Math.PI * 2);
    ctx.fill();
}

function drawFood(food, cellSizeParam, frameTime) {
    const cx = food.x * cellSizeParam + cellSizeParam / 2;
    const cy = food.y * cellSizeParam + cellSizeParam / 2;
    const screen = worldToScreen(cx, cy);
    const baseRadius = cellSizeParam * zoom * 0.3;

    const glowRadius = baseRadius * 2;
    const glowGradient = ctx.createRadialGradient(screen.x, screen.y, baseRadius * 0.5, screen.x, screen.y, glowRadius);
    glowGradient.addColorStop(0, 'rgba(255, 200, 50, 0.15)');
    glowGradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    const points = 10;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const offset = Math.sin(frameTime / 800 + i * 1.5) * baseRadius * 0.15;
        const r = baseRadius + offset;
        const px = screen.x + Math.cos(angle) * r;
        const py = screen.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const bodyGradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, baseRadius);
    bodyGradient.addColorStop(0, '#ffb300');
    bodyGradient.addColorStop(1, '#ff8f00');
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    const innerRadius = baseRadius * 0.2;
    const innerGlow = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, innerRadius);
    innerGlow.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
    innerGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, innerRadius, 0, Math.PI * 2);
    ctx.fill();
}

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
    const palette = AGENT_COLORS_PALETTE[id % AGENT_COLORS_PALETTE.length];
    const targetScreen = worldToScreen(
        agent.x * cellSize + cellSize / 2,
        agent.y * cellSize + cellSize / 2
    );
    if (!prevAgentPositions[id]) {
        prevAgentPositions[id] = { x: targetScreen.x, y: targetScreen.y };
    }
    prevAgentPositions[id].x = lerp(prevAgentPositions[id].x, targetScreen.x, 0.2);
    prevAgentPositions[id].y = lerp(prevAgentPositions[id].y, targetScreen.y, 0.2);
    const cx = prevAgentPositions[id].x;
    const cy = prevAgentPositions[id].y;
    const radius = cellSize * zoom * 0.35;
    const now = currentFrameTime;
    const stateName = getAgentState(agent);

    let corePulse = Math.sin(now / 500) * 0.2 + 1;
    let coreRadiusMult = 0.3;
    if (stateName === 'thriving') { corePulse = Math.sin(now / 300) * 0.3 + 1; coreRadiusMult = 0.35; }
    else if (stateName === 'hungry') { corePulse = Math.sin(now / 250) * 0.3 + 1; coreRadiusMult = 0.2; }
    else if (stateName === 'dying') { corePulse = Math.sin(now / 400) * Math.sin(now / 200) * 0.5 + 1; coreRadiusMult = 0.3; }
    else if (stateName === 'reborn') { corePulse = Math.sin(now / 200) * 0.4 + 1; coreRadiusMult = 0.4; }

    const glowRadius = radius + 3 * zoom;
    const glowGradient = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, glowRadius);
    glowGradient.addColorStop(0, palette.glow);
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.body;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const membraneAlpha = Math.sin(now / 300) * 0.15 + 0.7;
    ctx.strokeStyle = palette.membrane;
    ctx.globalAlpha = membraneAlpha;
    ctx.lineWidth = 1 * zoom;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const coreRadius = radius * coreRadiusMult * corePulse;
    ctx.fillStyle = '#e0f7fa';
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    if (selectedAgentId === id) {
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2 * zoom;
        ctx.setLineDash([4 * zoom, 2 * zoom]);
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 4 * zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    const gen = agentGenerations[id];
    if (gen !== undefined) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(8, 9 * zoom)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`G${gen}`, cx, cy - radius - 4 * zoom);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    if (rebornFlash > 0) rebornFlash--;
}

function drawGrid(cells, agents, predators) {
    currentFrameTime = Date.now();
    currentCells = cells;
    currentAgents = agents;

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

    if (cells) {
        for (const cell of cells) {
            if (cell.fertility !== undefined && cell.fertility > 0) {
                const screen = worldToScreen(cell.x * cellSize, cell.y * cellSize);
                const color = getFertilityColor(cell.fertility);
                ctx.fillStyle = color || '#1a1a1a';
                ctx.fillRect(screen.x, screen.y, cellSize * zoom + 1, cellSize * zoom + 1);
            }
        }
    }

    drawDust();

    const occupied = getOccupiedCells(cells, agents, predators);
    for (const key of occupied) {
        const [gx, gy] = key.split(',').map(Number);
        const worldX = gx * cellSize + cellSize / 2;
        const worldY = gy * cellSize + cellSize / 2;
        const screen = worldToScreen(worldX, worldY);
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
        drawCellGlow(screen.x, screen.y, cellType);
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

    if (achievementPopup && achievementPopupTimer > 0) {
        const alpha = Math.min(1, achievementPopupTimer / 60);
        ctx.fillStyle = `rgba(241, 196, 15, ${alpha})`;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(achievementPopup, canvas.width / 2, canvas.height / 3);
        ctx.textAlign = 'start';
        achievementPopupTimer--;
        if (achievementPopupTimer <= 0) achievementPopup = null;
    }

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
            const screen = worldToScreen(d.x * cellSize + cellSize / 2, d.y * cellSize + cellSize / 2);
            spawnFoodParticles(screen.x, screen.y, 8);
            triggerShake(1);
        }
        if (d.type === 'poison_consumed') {
            const screen = worldToScreen(d.x * cellSize + cellSize / 2, d.y * cellSize + cellSize / 2);
            spawnPoisonFlash(screen.x, screen.y);
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
    selectedAgentId = null;
    agentGenerations = {};
    currentAgents = [];
    hudData = { step: 0, generation: 1, ecoScore: 0, health: 100, energy: 80, hunger: 0, emotion: 'Бродит...' };
    thoughtText = null;
    thoughtTimer = 0;
    thoughtStepCounter = 0;
    rebornFlash = 0;
    achievementPopup = null;
    achievementPopupTimer = 0;
}