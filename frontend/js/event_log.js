// event_log.js — лог событий симуляции

const eventLogContent = document.getElementById('event-log-content');
let lastEventCount = 0;

function getEventColor(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('умер') || lower.includes('смерт') || lower.includes('погиб') || lower.includes('died')) {
        return '#e74c3c';
    }
    if (lower.includes('возрождён') || lower.includes('появился') || lower.includes('рождён') || lower.includes('spawned') || lower.includes('ожил')) {
        return '#2ecc71';
    }
    if (lower.includes('прожил') || lower.includes('рекорд') || lower.includes('рекорд') || lower.includes('поколени')) {
        return '#f1c40f';
    }
    return '#ccc';
}

function updateEventLog(eventLog) {
    if (!eventLogContent) return;

    if (!eventLog || eventLog.length === 0) {
        eventLogContent.innerHTML = '<div style="color:#666;padding:4px;">Ожидание событий...</div>';
        lastEventCount = 0;
        return;
    }

    if (eventLog.length === lastEventCount) return;
    lastEventCount = eventLog.length;

    const lines = eventLog.map(msg => {
        const escaped = String(msg)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const color = getEventColor(escaped);
        return `<div style="padding:1px 0;border-bottom:1px solid rgba(255,255,255,0.03);color:${color};">▸ ${escaped}</div>`;
    });

    eventLogContent.innerHTML = lines.join('');
    eventLogContent.scrollTop = eventLogContent.scrollHeight;
}