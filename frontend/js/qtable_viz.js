// qtable_viz.js — визуализация Q-таблицы агента

const qtableContainer = document.getElementById('qtable-content');

function updateQTable(qTableData) {
    if (!qtableContainer) return;

    if (!qTableData || Object.keys(qTableData).length === 0) {
        qtableContainer.innerHTML = '<div style="color:#666;padding:8px;">Нет данных Q-таблицы</div>';
        return;
    }

    // Собираем все Q-значения для поиска максимума
    let maxAbsQ = 0;
    for (const stateKey in qTableData) {
        const actions = qTableData[stateKey];
        for (const actionName in actions) {
            const absVal = Math.abs(actions[actionName]);
            if (absVal > maxAbsQ) maxAbsQ = absVal;
        }
    }
    if (maxAbsQ === 0) maxAbsQ = 1;

    let html = '';

    for (const stateKey in qTableData) {
        const actions = qTableData[stateKey];

        // Заголовок состояния: зелёный кружок если есть положительные, иначе серый
        const hasPositive = Object.values(actions).some(v => v > 0);
        const indicatorColor = hasPositive ? '#2ecc71' : '#555';
        html += `<div style="margin-bottom:6px;">`;
        html += `<span style="color:${indicatorColor};">●</span> `;
        html += `<span style="color:#f1c40f;font-weight:bold;">Состояние ${stateKey}</span>`;
        html += `<div style="margin-left:14px;">`;

        // Сортируем действия по убыванию Q
        const sortedActions = Object.entries(actions).sort((a, b) => b[1] - a[1]);

        for (const [actionName, qValue] of sortedActions) {
            const absVal = Math.abs(qValue);
            const barWidth = Math.round((absVal / maxAbsQ) * 100);
            const barColor = qValue >= 0 ? '#2ecc71' : '#e74c3c';
            const barBg = qValue >= 0 ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.2)';
            const formattedQ = qValue.toFixed(2);
            const sign = qValue >= 0 ? '+' : '';

            html += `<div style="display:flex;align-items:center;margin:2px 0;font-size:12px;">`;
            html += `<span style="color:#aaa;width:70px;text-align:right;margin-right:6px;">${actionName}</span>`;
            html += `<div style="flex:1;height:14px;background:${barBg};border-radius:2px;overflow:hidden;position:relative;">`;
            html += `<div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:2px;transition:width 0.3s;"></div>`;
            html += `</div>`;
            html += `<span style="color:${barColor};width:52px;text-align:right;margin-left:6px;font-weight:bold;">${sign}${formattedQ}</span>`;
            html += `</div>`;
        }

        html += `</div></div>`;
    }

    qtableContainer.innerHTML = html;
}