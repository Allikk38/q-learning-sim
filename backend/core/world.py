import random
from core.agent import Agent, Creature, Predator


class Cell:
    def __init__(self, x: int, y: int):
        self.x = x
        self.y = y
        self.type = "empty"
        self.properties = {}

    def get_property(self, key: str, default: float) -> float:
        return self.properties.get(key, default)

    def to_dict(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "type": self.type,
            "fertility": self.properties.get("fertility", 0.0)
        }


class World:
    def __init__(self, config: dict):
        self.width = config["grid_width"]
        self.height = config["grid_height"]
        self.grid = [
            [Cell(x, y) for x in range(self.width)] for y in range(self.height)
        ]
        self.agents = []
        self.predators = []
        self.food_positions = set()
        self.poison_positions = set()
        self.step_count = 0
        self._previous_state = None

    def _get_random_empty_cell(self, occupied: set) -> tuple:
        """Возвращает случайную свободную клетку (x, y), исключая занятые."""
        all_cells = [(x, y) for x in range(self.width) for y in range(self.height)]
        free_cells = [c for c in all_cells if c not in occupied]
        if not free_cells:
            raise RuntimeError("Нет свободных клеток на сетке")
        return random.choice(free_cells)

    def _spawn_initial(self):
        """Размещает начальные сущности: только 1 агента и 1 хищника. Еда и яд НЕ спавнятся."""
        occupied = set()

        # Все клетки имеют fertility = 0.0 (уже по умолчанию)

        # 1 хищник
        x, y = self._get_random_empty_cell(occupied)
        predator = Predator(agent_id=0, x=x, y=y)
        self.predators.append(predator)
        occupied.add((x, y))

        # 1 агент
        x, y = self._get_random_empty_cell(occupied)
        agent = Creature(agent_id=0, x=x, y=y)
        self.agents.append(agent)
        occupied.add((x, y))

    def spawn_food(self):
        """
        Спавнит еду на пустых клетках с шансом fertility * 0.2.
        Вызывается из game_loop между тиками.
        """
        for row in self.grid:
            for cell in row:
                if cell.type == "empty":
                    fertility = cell.get_property("fertility", 0.0)
                    if fertility > 0 and random.random() < fertility * 0.2:
                        cell.type = "food"
                        self.food_positions.add((cell.x, cell.y))

    def _manhattan_distance(self, x1: int, y1: int, x2: int, y2: int) -> int:
        """Манхэттенское расстояние между двумя точками."""
        return abs(x1 - x2) + abs(y1 - y2)

    def get_visible_entities(self, x: int, y: int, radius: int = 3) -> list:
        """Возвращает список сущностей в радиусе Манхэттена от (x, y)."""
        entities = []

        # Еда в радиусе
        for fx, fy in self.food_positions:
            dist = self._manhattan_distance(x, y, fx, fy)
            if dist <= radius:
                entities.append({"type": "food", "x": fx, "y": fy, "distance": dist})

        # Яд в радиусе
        for px, py in self.poison_positions:
            dist = self._manhattan_distance(x, y, px, py)
            if dist <= radius:
                entities.append({"type": "poison", "x": px, "y": py, "distance": dist})

        # Хищники в радиусе
        for predator in self.predators:
            dist = self._manhattan_distance(x, y, predator.x, predator.y)
            if dist <= radius:
                entities.append({"type": "predator", "x": predator.x, "y": predator.y, "distance": dist})

        # Другие агенты в радиусе (кроме самого себя)
        for agent in self.agents:
            if agent.alive and (agent.x != x or agent.y != y):
                dist = self._manhattan_distance(x, y, agent.x, agent.y)
                if dist <= radius:
                    entities.append({"type": "agent", "x": agent.x, "y": agent.y, "distance": dist})

        return entities

    def _is_valid_position(self, x: int, y: int) -> bool:
        """Проверяет, что координаты внутри сетки."""
        return 0 <= x < self.width and 0 <= y < self.height

    def step(self, actions: dict) -> dict:
        """
        Обрабатывает один шаг симуляции.
        actions — словарь {agent_id: action_string}.
        Возвращает словарь с наградами и следующими состояниями.
        """
        rewards = {}
        next_states = {}

        # Обрабатываем действия для каждого живого агента
        for agent in self.agents:
            if not agent.alive:
                continue

            action = actions.get(agent.id, "rest")
            reward = -0.1  # базовый штраф за шаг

            if action == "move_n":
                new_y = agent.y - 1
                if self._is_valid_position(agent.x, new_y):
                    agent.y = new_y

            elif action == "move_s":
                new_y = agent.y + 1
                if self._is_valid_position(agent.x, new_y):
                    agent.y = new_y

            elif action == "move_w":
                new_x = agent.x - 1
                if self._is_valid_position(new_x, agent.y):
                    agent.x = new_x

            elif action == "move_e":
                new_x = agent.x + 1
                if self._is_valid_position(new_x, agent.y):
                    agent.x = new_x

            elif action == "eat":
                cell = self.grid[agent.y][agent.x]
                if cell.type == "food":
                    # Съедаем еду
                    cell.type = "empty"
                    self.food_positions.discard((agent.x, agent.y))
                    agent.health = min(100, agent.health + 20)
                    agent.energy = min(100, agent.energy + 20)
                    agent.hunger = max(0, agent.hunger - 10)
                    reward = 1.0
                elif cell.type == "poison":
                    # Отравление ядом (яд остаётся на клетке)
                    agent.health -= 20
                    reward = -2.0

            elif action == "rest":
                # Отдых восстанавливает энергию и снижает голод
                agent.energy = min(100, agent.energy + 5)
                agent.hunger = max(0, agent.hunger - 2)
                reward = 0.2

            elif action == "explore":
                # Случайное смещение на соседнюю клетку
                directions = [(0, -1), (0, 1), (-1, 0), (1, 0)]  # N, S, W, E
                random.shuffle(directions)
                for dx, dy in directions:
                    new_x = agent.x + dx
                    new_y = agent.y + dy
                    if self._is_valid_position(new_x, new_y):
                        agent.x = new_x
                        agent.y = new_y
                        break
                reward = -0.05

            # Общие для всех агентов: энергия -1, голод +0.5
            agent.energy = max(0, agent.energy - 1)
            agent.hunger += 0.5

            # Если голод >= 70, здоровье -2 за шаг
            if agent.hunger >= 70:
                agent.health -= 2

            # Проверка смерти
            if agent.health <= 0:
                agent.health = 0
                agent.alive = False

            rewards[agent.id] = reward

        # Вычисляем next_state для каждого живого агента после всех действий
        for agent in self.agents:
            if agent.alive:
                next_states[agent.id] = agent.get_state(self)
            else:
                next_states[agent.id] = None

        # Инкрементируем счётчик шагов
        self.step_count += 1

        return {"rewards": rewards, "next_states": next_states}

    def get_state(self) -> dict:
        """Возвращает полное состояние мира."""
        # Собираем все клетки
        cells = []
        for row in self.grid:
            for cell in row:
                cells.append(cell.to_dict())

        # Собираем данные агентов
        agents_data = []
        for agent in self.agents:
            agents_data.append({
                "id": agent.id,
                "x": agent.x,
                "y": agent.y,
                "health": agent.health,
                "energy": agent.energy,
                "hunger": agent.hunger,
                "action": agent.prev_action or "",
                "reward": agent.reward_history[-1] if agent.reward_history else 0,
                "alive": agent.alive,
                "q_table": agent.get_q_table_snapshot()
            })

        # Собираем данные хищников
        predators_data = [
            {"id": predator.id, "x": predator.x, "y": predator.y}
            for predator in self.predators
        ]

        return {
            "step": self.step_count,
            "grid": {"width": self.width, "height": self.height},
            "cells": cells,
            "agents": agents_data,
            "predators": predators_data
        }

    def to_delta(self, previous_state: dict) -> list:
        """
        Сравнивает текущее состояние с предыдущим и возвращает список изменений.
        """
        if previous_state is None:
            return []

        current_state = self.get_state()
        deltas = []

        # Словарь агентов из предыдущего состояния для быстрого поиска
        prev_agents = {a["id"]: a for a in previous_state.get("agents", [])}

        # Проверяем перемещения и смерти агентов
        for agent in current_state["agents"]:
            agent_id = agent["id"]
            prev_agent = prev_agents.get(agent_id)

            if prev_agent:
                # Проверка смерти
                if prev_agent["alive"] and not agent["alive"]:
                    deltas.append({
                        "type": "agent_died",
                        "id": agent_id
                    })
                # Проверка перемещения
                elif prev_agent["x"] != agent["x"] or prev_agent["y"] != agent["y"]:
                    deltas.append({
                        "type": "agent_moved",
                        "id": agent_id,
                        "from": [prev_agent["x"], prev_agent["y"]],
                        "to": [agent["x"], agent["y"]]
                    })

        # Проверяем съеденную еду: была в предыдущем состоянии, нет в текущем
        prev_cells = {
            (c["x"], c["y"]): c["type"]
            for c in previous_state.get("cells", [])
        }
        curr_cells = {
            (c["x"], c["y"]): c["type"]
            for c in current_state["cells"]
        }

        for (x, y), prev_type in prev_cells.items():
            curr_type = curr_cells.get((x, y))
            if prev_type == "food" and curr_type != "food":
                deltas.append({
                    "type": "food_consumed",
                    "x": x,
                    "y": y
                })

        return deltas

    def get_cell(self, x: int, y: int) -> Cell:
        return self.grid[y][x]

    def reset(self):
        """Сброс мира: очистка и повторный спавн. Еда и яд НЕ спавнятся."""
        # Очищаем сетку
        for row in self.grid:
            for cell in row:
                cell.type = "empty"
                cell.properties = {}
                # fertility сбрасывается в 0.0 (уже пустой словарь, get_property вернёт 0.0)

        # Очищаем все списки и множества
        self.agents.clear()
        self.predators.clear()
        self.food_positions.clear()
        self.poison_positions.clear()

        # Сбрасываем счётчик шагов
        self.step_count = 0
        self._previous_state = None

        # Запускаем начальный спавн (только агент и хищник)
        self._spawn_initial()