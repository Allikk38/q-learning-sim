import random
import math
from core.world import World
from core.agent import Creature


class GameLoop:
    def __init__(self, config: dict):
        self.config = config
        self.world = World(config)
        self.speed = 0
        self.running = False
        self.metrics = {"agents": []}
        self._previous_state = None
        self.generation = 1
        self.event_log = []
        # Словарь для отслеживания поколений агентов: agent_id -> generation
        self._agent_generations = {}
        # Словарь для отслеживания шагов выживания: agent_id -> steps_alive
        self._agent_steps_alive = {}

    def start(self):
        """Запуск игрового цикла."""
        self.running = True
        # Инициализируем мир при старте
        self.world._spawn_initial()
        # Назначаем поколение начальному агенту
        for agent in self.world.agents:
            self._agent_generations[agent.id] = self.generation
            self._agent_steps_alive[agent.id] = 0
            self.event_log.append(
                f"Шаг {self.world.step_count}: агент поколения {self.generation} появился"
            )

    def stop(self):
        """Остановка игрового цикла."""
        self.running = False

    def _get_random_empty_position(self) -> tuple:
        """Возвращает случайную пустую клетку на сетке."""
        empty_cells = []
        for row in self.world.grid:
            for cell in row:
                if cell.type == "empty":
                    # Проверяем, что на клетке нет агента или хищника
                    occupied = False
                    for agent in self.world.agents:
                        if agent.alive and agent.x == cell.x and agent.y == cell.y:
                            occupied = True
                            break
                    for predator in self.world.predators:
                        if predator.x == cell.x and predator.y == cell.y:
                            occupied = True
                            break
                    if not occupied:
                        empty_cells.append((cell.x, cell.y))

        if empty_cells:
            return random.choice(empty_cells)
        # Если нет пустых клеток, возвращаем случайную (запасной вариант)
        return (random.randint(0, self.world.width - 1),
                random.randint(0, self.world.height - 1))

    def tick(self) -> dict:
        """
        Один тик симуляции:
        1. Сохранить предыдущее состояние для дельты
        2. Для каждого живого агента: получить состояние и выбрать действие
        3. Выполнить шаг мира
        4. Обновить Q-таблицы агентов
        5. Обработать смерть и наследование
        6. Вычислить метрики
        Возвращает полное состояние мира с метриками, логом и поколением.
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

                # Увеличиваем счётчик шагов выживания
                if agent.id in self._agent_steps_alive:
                    self._agent_steps_alive[agent.id] += 1
                else:
                    self._agent_steps_alive[agent.id] = 1

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

        # Обрабатываем смерть агентов и наследование
        for i, agent in enumerate(self.world.agents):
            if not agent.alive:
                # Получаем поколение умершего агента
                old_gen = self._agent_generations.get(agent.id, self.generation)
                steps_alive = self._agent_steps_alive.get(agent.id, 0)

                # Увеличиваем счётчик поколений
                self.generation += 1
                new_gen = self.generation

                # Создаём нового агента с наследованием Q-таблицы
                new_agent = Creature(agent_id=agent.id, x=0, y=0)
                new_agent.inherit_q(
                    agent.q_table,
                    factor=self.config["inheritance_factor"],
                    sigma=self.config["inheritance_noise_sigma"]
                )

                # Спавним в случайной пустой клетке
                new_x, new_y = self._get_random_empty_position()
                new_agent.x = new_x
                new_agent.y = new_y

                # Сбрасываем историю нового агента
                new_agent.reward_history = []
                new_agent.state_history = []
                new_agent.action_history = []

                # Заменяем мёртвого агента в списке
                self.world.agents[i] = new_agent

                # Обновляем отслеживание поколений
                self._agent_generations[agent.id] = new_gen
                self._agent_steps_alive[agent.id] = 0

                # Логирование смерти и возрождения
                self.event_log.append(
                    f"Шаг {self.world.step_count}: агент умер (поколение {old_gen}), "
                    f"возрождён как поколение {new_gen}"
                )
                self.event_log.append(
                    f"Шаг {self.world.step_count}: агент поколения {new_gen} появился"
                )

        # Проверяем выживание кратно 100 шагов для живых агентов
        for agent in self.world.agents:
            if agent.alive:
                agent_id = agent.id
                steps = self._agent_steps_alive.get(agent_id, 0)
                agent_gen = self._agent_generations.get(agent_id, self.generation)
                if steps > 0 and steps % 100 == 0:
                    self.event_log.append(
                        f"Шаг {self.world.step_count}: агент поколения {agent_gen} прожил {steps} шагов"
                    )

        # Обрезаем лог до последних 50 записей
        if len(self.event_log) > 50:
            self.event_log = self.event_log[-50:]

        # Увеличиваем счётчик шагов мира
        self.world.step_count += 1

        # Вычисляем метрики
        self.metrics = self._compute_metrics()

        # Возвращаем полное состояние с метриками, логом и поколением
        state = self.world.get_state()
        state["metrics"] = self.metrics
        state["event_log"] = self.event_log
        state["generation"] = self.generation

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
            # Сбрасываем счётчики при ресете мира
            self.generation = 1
            self.event_log = []
            self._agent_generations = {}
            self._agent_steps_alive = {}
            # Назначаем поколение новому агенту после ресета
            for agent in self.world.agents:
                self._agent_generations[agent.id] = self.generation
                self._agent_steps_alive[agent.id] = 0

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