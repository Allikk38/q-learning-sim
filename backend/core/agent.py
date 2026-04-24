import random
from collections import defaultdict

ACTION_MOVE_N = "move_n"
ACTION_MOVE_S = "move_s"
ACTION_MOVE_W = "move_w"
ACTION_MOVE_E = "move_e"
ACTION_EAT = "eat"
ACTION_REST = "rest"
ACTION_EXPLORE = "explore"

ACTIONS = [
    ACTION_MOVE_N, ACTION_MOVE_S, ACTION_MOVE_W, ACTION_MOVE_E,
    ACTION_EAT, ACTION_REST, ACTION_EXPLORE
]


class Agent:
    def __init__(self, agent_id: int, x: int, y: int):
        self.id = agent_id
        self.x = x
        self.y = y
        self.health = 100
        self.energy = 100
        self.hunger = 0
        self.alive = True
        self.q_table = defaultdict(lambda: defaultdict(float))
        self.prev_state = None
        self.prev_action = None
        self.reward_history = []
        self.state_history = []
        self.action_history = []

    def get_state(self, world) -> tuple:
        """
        Возвращает кортеж (hunger_level, energy_level, sector_food, sector_threat).
        hunger_level: 0 (hunger < 30), 1 (30-69), 2 (>=70)
        energy_level: 0 (energy < 30), 1 (30-69), 2 (>=70)
        sector_food: 1-4 (сектор с ближайшей едой), 0 (нет еды в радиусе)
        sector_threat: 1-4 (сектор с ближайшей угрозой), 0 (нет угроз в радиусе)
        """
        # Уровень голода
        if self.hunger < 30:
            hunger_level = 0
        elif self.hunger < 70:
            hunger_level = 1
        else:
            hunger_level = 2

        # Уровень энергии
        if self.energy < 30:
            energy_level = 0
        elif self.energy < 70:
            energy_level = 1
        else:
            energy_level = 2

        # Получаем видимые сущности
        visible = world.get_visible_entities(self.x, self.y, radius=3)

        # Функция для определения сектора (1=NW, 2=NE, 3=SW, 4=SE)
        def get_sector(ax, ay, ex, ey):
            """Определяет сектор сущности относительно агента."""
            if ex < ax:  # запад
                if ey < ay:  # север
                    return 1  # NW
                else:  # юг
                    return 3  # SW
            else:  # восток
                if ey < ay:  # север
                    return 2  # NE
                else:  # юг
                    return 4  # SE

        # Поиск ближайшей еды по секторам
        closest_food = {1: None, 2: None, 3: None, 4: None}
        for entity in visible:
            if entity["type"] == "food":
                sector = get_sector(self.x, self.y, entity["x"], entity["y"])
                dist = entity["distance"]
                if closest_food[sector] is None or dist < closest_food[sector]:
                    closest_food[sector] = dist

        # Выбираем сектор с ближайшей едой
        sector_food = 0
        min_dist = float("inf")
        for sector in [1, 2, 3, 4]:
            if closest_food[sector] is not None and closest_food[sector] < min_dist:
                min_dist = closest_food[sector]
                sector_food = sector

        # Поиск ближайшей угрозы (яд или хищник) по секторам
        closest_threat = {1: None, 2: None, 3: None, 4: None}
        for entity in visible:
            if entity["type"] in ("poison", "predator"):
                sector = get_sector(self.x, self.y, entity["x"], entity["y"])
                dist = entity["distance"]
                if closest_threat[sector] is None or dist < closest_threat[sector]:
                    closest_threat[sector] = dist

        # Выбираем сектор с ближайшей угрозой
        sector_threat = 0
        min_dist = float("inf")
        for sector in [1, 2, 3, 4]:
            if closest_threat[sector] is not None and closest_threat[sector] < min_dist:
                min_dist = closest_threat[sector]
                sector_threat = sector

        return (hunger_level, energy_level, sector_food, sector_threat)

    def act(self, state: tuple, epsilon: float = 0.1) -> str:
        """
        Выбор действия по эпсилон-жадной стратегии.
        С вероятностью epsilon — случайное действие.
        Иначе — действие с максимальным Q-value для данного состояния.
        Если для состояния нет записей в Q-таблице — случайное.
        """
        # Сохраняем предыдущее состояние
        self.prev_state = state

        # epsilon-greedy выбор
        if random.random() < epsilon:
            action = random.choice(ACTIONS)
        else:
            # Ищем действие с максимальным Q-value
            state_q = self.q_table[state]
            if state_q:
                max_q = max(state_q.values())
                # Собираем все действия с максимальным Q (на случай равенства)
                best_actions = [a for a, q in state_q.items() if q == max_q]
                action = random.choice(best_actions)
            else:
                # Нет записей для этого состояния — случайное действие
                action = random.choice(ACTIONS)

        # Сохраняем выбранное действие
        self.prev_action = action
        self.action_history.append(action)

        # Сохраняем состояние в историю
        self.state_history.append(state)

        return action

    def update_q(self, state, action, reward, next_state, alpha=0.1, gamma=0.9):
        """
        Vanilla Q-learning обновление.
        Q(s,a) = Q(s,a) + alpha * (reward + gamma * max(Q(s',a')) - Q(s,a))
        """
        # Получаем максимальный Q для следующего состояния
        next_state_q = self.q_table[next_state] if next_state is not None else {}
        best_next = max(next_state_q.values()) if next_state_q else 0.0

        # Текущее значение Q
        current_q = self.q_table[state][action]

        # Обновление по формуле Q-learning
        self.q_table[state][action] = current_q + alpha * (reward + gamma * best_next - current_q)

        # Сохраняем награду в историю
        self.reward_history.append(reward)

    def inherit_q(self, parent_q: dict, factor: float = 0.3, sigma: float = 0.05) -> None:
        """
        Копирует Q-таблицу родителя с фактором наследования и гауссовым шумом.
        self.q_table[state][action] = parent_q[state][action] * factor + random.gauss(0, sigma)
        """
        # Очищаем свою Q-таблицу
        self.q_table.clear()

        # Копируем с шумом из родительской Q-таблицы
        for state, actions in parent_q.items():
            for action, q_value in actions.items():
                # Применяем фактор наследования и добавляем гауссов шум
                inherited_value = q_value * factor + random.gauss(0, sigma)
                self.q_table[state][action] = inherited_value

    def get_q_table_snapshot(self) -> dict:
        """
        Возвращает снимок Q-таблицы в формате {str(state): {action: float}}.
        Включает только состояния с непустыми словарями действий.
        """
        snapshot = {}
        for state, actions in self.q_table.items():
            if actions:  # только непустые
                snapshot[str(state)] = dict(actions)
        return snapshot


class Creature(Agent):
    """Основной агент с Q-обучением. Наследует всё от Agent."""
    pass


class Predator(Agent):
    """Хищник-заглушка: всегда отдыхает."""
    def act(self, state: tuple, epsilon: float = 0.0) -> str:
        # Хищник всегда возвращает действие REST, игнорируя epsilon
        self.prev_state = state
        self.prev_action = ACTION_REST
        self.action_history.append(ACTION_REST)
        self.state_history.append(state)
        return ACTION_REST