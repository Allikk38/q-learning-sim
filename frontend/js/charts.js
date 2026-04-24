const chartData = {
    reward: [],
    entropy: [],
    coverage: []
};

const MAX_POINTS = 200;

let chartCanvases = {};
let chartCtxs = {};

function initCharts() {
    chartCanvases.reward = document.getElementById('chart-reward');
    chartCanvases.entropy = document.getElementById('chart-entropy');
    chartCanvases.coverage = document.getElementById('chart-coverage');

    for (const key of ['reward', 'entropy', 'coverage']) {
        chartCtxs[key] = chartCanvases[key].getContext('2d');
        chartCanvases[key].width = chartCanvases[key].offsetWidth;
        chartCanvases[key].height = chartCanvases[key].offsetHeight;
    }
}

function updateCharts(metrics) {
    if (!metrics || !metrics.agents || !metrics.agents[0]) return;

    const agent = metrics.agents[0];

    chartData.reward.push(agent.avg_reward || 0);
    chartData.entropy.push(agent.entropy || 0);
    chartData.coverage.push(agent.state_coverage || 0);

    for (const key of ['reward', 'entropy', 'coverage']) {
        if (chartData[key].length > MAX_POINTS) {
            chartData[key].shift();
        }
    }

    drawChart('reward', chartData.reward, -2, 2, '#2ecc71');
    drawChart('entropy', chartData.entropy, 0, 3, '#f39c12');
    drawChart('coverage', chartData.coverage, 0, 1, '#3498db');
}

function drawChart(key, data, yMin, yMax, color) {
    const canvas = chartCanvases[key];
    const ctx = chartCtxs[key];
    const w = canvas.width;
    const h = canvas.height;
    const padding = 8;

    ctx.clearRect(0, 0, w, h);

    if (data.length < 2) return;

    const xStep = (w - padding * 2) / (data.length - 1);
    const yRange = yMax - yMin;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
        const x = padding + i * xStep;
        const y = h - padding - ((data[i] - yMin) / yRange) * (h - padding * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.stroke();

    // Подписи
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.fillText(key === 'reward' ? 'Reward' : key === 'entropy' ? 'Entropy' : 'Coverage', padding, 12);
}