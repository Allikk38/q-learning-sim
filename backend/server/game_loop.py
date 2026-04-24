import math
from core.world import World


class GameLoop:
    def __init__(self, config: dict):
        self.config = config
        self.world = World(config)
        self.speed = 0
        self.running = False
        self.metrics = {"agents": []}
        self._previous_state = None

    def start(self):
        """Запуск игрового цикла."""
        self.running = True
        # Инициализируем мир при старте
        self.world._spawn_initial()

    def stop(self):
        """Остановка игрового цикла."""
        self.running = False

    def tick(self) -> dict:
        """
        Один тик симуляции:
        1. Сохранить предыдущее состояние для дельты
        2. Для каждого живого агента: получить состояние и выбрать действие
        3. Выполнить шаг мира
        4. Обновить Q-таблицы агентов
        5. Вычислить метрики
        Возвращает полное состояние мира с метриками.
        """
        # Сохраняем предыдущее состояние для дельты
        self._previous_state = self.world.get_state()

        # Собираем действия от всех живых агентов
        actions = {}
        states = {}

        for agent in self.world.agents:
            if agent.alive:
                # Получаем текущее состояние агента
                state = agent.get_state(self.world)
                states[agent.id] = state

                # Выбираем действие
                action = agent.act(state)
                actions[agent.id] = action

        # Выполняем шаг мира
        result = self.world.step(actions)

        # Обновляем Q-таблицы агентов с результатами шага
        for agent in self.world.agents:
            if agent.alive:
                state = states.get(agent.id)
                action = actions.get(agent.id)
                reward = result["rewards"].get(agent.id, 0)
                next_state = result["next_states"].get(agent.id)

                if state is not None and action is not None:
                    agent.update_q(state, action, reward, next_state)

        # Увеличиваем счётчик шагов мира
        self.world.step_count += 1

        # Вычисляем метрики
        self.metrics = self._compute_metrics()

        # Возвращаем полное состояние с метриками
        state = self.world.get_state()
        state["metrics"] = self.metrics

        return state

    def get_delta(self) -> list:
        """
        Возвращает список изменений (дельту) относительно предыдущего тика.
        Если предыдущего состояния нет — пустой список.
        """
        if self._previous_state is None:
            return []

        return self.world.to_delta(self._previous_state)

    def handle_command(self, command: dict):
        """
        Обработка команд от фронтенда.
        Поддерживаемые команды: set_speed, kill_agent, reset_world.
        """
        cmd = command.get("command")
        if cmd == "set_speed":
            self.speed = command.get("value", 1)
        elif cmd == "kill_agent":
            agent_id = command.get("id", 0)
            for agent in self.world.agents:
                if agent.id == agent_id:
                    agent.alive = False
        elif cmd == "reset_world":
            self.world.reset()

    def _compute_metrics(self) -> dict:
        """
        Вычисляет метрики для каждого агента:
        - avg_reward: средняя награда за последние 100 шагов
        - entropy: энтропия распределения действий за последние 100 шагов
        - state_coverage: доля посещённых уникальных состояний от 144
        """
        agents_metrics = []

        for agent in self.world.agents:
            # Средняя награда за последние 100 шагов
            recent_rewards = agent.reward_history[-100:]
            avg_reward = sum(recent_rewards) / len(recent_rewards) if recent_rewards else 0.0

            # Энтропия распределения действий за последние 100 шагов
            recent_actions = agent.action_history[-100:]
            entropy = 0.0
            if recent_actions:
                # Подсчитываем частоту каждого действия
                action_counts = {}
                for action in recent_actions:
                    action_counts[action] = action_counts.get(action, 0) + 1

                total = len(recent_actions)
                # Вычисляем энтропию: -sum(p * log2(p))
                for count in action_counts.values():
                    p = count / total
                    if p > 0:
                        entropy -= p * math.log2(p)

            # Покрытие состояний: доля уникальных состояний от 144 (3x3x4x4)
            recent_states = agent.state_history[-500:]
            unique_states = len(set(recent_states))
            state_coverage = unique_states / 144.0

            agents_metrics.append({
                "id": agent.id,
                "avg_reward": round(avg_reward, 4),
                "entropy": round(entropy, 4),
                "state_coverage": round(state_coverage, 4)
            })

        return {"agents": agents_metrics}