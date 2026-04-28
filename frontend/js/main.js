(function () {
    const host = location.hostname || 'localhost';

    initRenderer('game-canvas');
    initCharts();
    initControls();

    onFullState((state) => {
        if (state.grid) {
            setGridSize(state.grid.width, state.grid.height);
        }
        if (state.agent_generations) {
            agentGenerations = state.agent_generations;
        }
        drawGrid(state.cells || [], state.agents || [], state.predators || []);

        const selectedAgent = state.agents?.find(a => a.id === selectedAgentId) || state.agents?.[0];
        if (selectedAgent) {
            const metrics = state.metrics?.agents?.find(m => m.id === selectedAgent.id) || null;
            updateHUD(state.step, state.generation, state.eco_score, selectedAgent, metrics);
            if (selectedAgent.q_table) {
                updateRadar(selectedAgent.q_table, selectedAgent.action, null);
            }
        } else {
            updateHUD(state.step, state.generation, state.eco_score, null, null);
        }

        if (state.metrics) {
            updateCharts(state.metrics);
        }
        if (state.event_log) {
            updateEventLog(state.event_log);
        }
        if (state.achievement_messages && state.achievement_messages.length > 0) {
            showAchievementPopup(state.achievement_messages[state.achievement_messages.length - 1]);
        }
    });

    onDelta((step, deltas) => {
        applyDeltas(deltas);
    });

    onMetrics((metrics) => {
        updateCharts(metrics);
    });

    connect(host + ':8000');
})();