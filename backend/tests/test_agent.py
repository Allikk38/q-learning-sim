import pytest
import random
from collections import defaultdict
from core.world import World
from core.agent import Agent, Creature


class TestAgentBoundaries:
    """T2: Граничные условия перемещения."""

    def test_move_north_at_boundary(self, test_config):
        """Агент на y=0 не может двигаться на север."""
        w = World(config=test_config)
        w.agents.clear()
        w.predators.clear()
        w.food_positions.clear()
        w.poison_positions.clear()
        a = Creature(agent_id=1, x=5, y=0)
        w.agents.append(a)

        old_y = a.y
        w.step({a.id: "move_n"})

        assert a.y == old_y, (
            f"Агент на y=0 не должен двигаться на север. "
            f"Было y={old_y}, стало y={a.y}"
        )

    def test_move_south_at_boundary(self, test_config):
        """Агент на y=9 не может двигаться на юг."""
        w = World(config=test_config)
        w.agents.clear()
        w.predators.clear()
        w.food_positions.clear()
        w.poison_positions.clear()
        a = Creature(agent_id=1, x=5, y=9)
        w.agents.append(a)

        old_y = a.y
        w.step({a.id: "move_s"})
        assert a.y == old_y

    def test_move_west_at_boundary(self, test_config):
        """Агент на x=0 не может двигаться на запад."""
        w = World(config=test_config)
        w.agents.clear()
        w.predators.clear()
        w.food_positions.clear()
        w.poison_positions.clear()
        a = Creature(agent_id=1, x=0, y=5)
        w.agents.append(a)

        old_x = a.x
        w.step({a.id: "move_w"})
        assert a.x == old_x

    def test_move_east_at_boundary(self, test_config):
        """Агент на x=9 не может двигаться на восток."""
        w = World(config=test_config)
        w.agents.clear()
        w.predators.clear()
        w.food_positions.clear()
        w.poison_positions.clear()
        a = Creature(agent_id=1, x=9, y=5)
        w.agents.append(a)

        old_x = a.x
        w.step({a.id: "move_e"})
        assert a.x == old_x


class TestAgentStarvation:
    """T3: Агент с доступной едой не умирает от голода."""

    def test_agent_with_food_survives_100_steps(self, world_with_food):
        """Агент с едой рядом выживает 100 шагов."""
        w, a = world_with_food
        a.health = 100
        a.hunger = 0
        a.energy = 100

        for step in range(100):
            if not a.alive:
                break
            
            # Стратегия: держим hunger < 50
            # Если мы на клетке с едой — едим
            if w.grid[a.y][a.x].type == "food":
                w.step({a.id: "eat"})
            # Если еды нет на клетке, но есть рядом — идём к ней
            elif (5, 4) in w.food_positions:
                if a.y < 5:
                    w.step({a.id: "move_s"})  # возвращаемся
                else:
                    w.step({a.id: "move_n"})  # идём к еде
            else:
                # Еда кончилась — восстанавливаем
                w.grid[4][5].type = "food"
                w.food_positions.add((5, 4))
                w.step({a.id: "rest"})

        assert a.alive, (
            f"Агент умер за 100 шагов. health={a.health}, "
            f"hunger={a.hunger}, energy={a.energy}"
        )


class TestQLearning:
    """T4, T5, T6: Q-обучение и наследование."""

    def test_update_q_changes_value(self, agent):
        """update_q() изменяет Q-значение."""
        state = (0, 1, 1, 2)
        action = "explore"
        next_state = (0, 2, 0, 0)

        agent.q_table[state][action] = 0.5
        q_before = agent.q_table[state][action]

        agent.update_q(state, action, reward=1.0, next_state=next_state)

        q_after = agent.q_table[state][action]
        assert q_before != q_after, (
            f"Q-значение должно измениться. До: {q_before}, После: {q_after}"
        )

    def test_update_q_different_rewards(self, agent):
        """Разные награды дают разные Q."""
        state = (0, 1, 1, 0)
        action = "eat"

        a2 = Creature(agent_id=2, x=5, y=5)
        a2.q_table[state][action] = 0.5
        agent.q_table[state][action] = 0.5

        agent.update_q(state, action, reward=1.0, next_state=(0, 2, 0, 0))
        a2.update_q(state, action, reward=-1.0, next_state=(2, 0, 0, 0))

        assert agent.q_table[state][action] != a2.q_table[state][action], (
            "Q для разных наград должны различаться"
        )

    def test_inherit_q_creates_independent_copy(self, agent):
        """inherit_q() копирует с шумом, но не связывает таблицы."""
        parent_q = defaultdict(lambda: defaultdict(float))
        parent_q[(0, 1, 1, 2)]["move_n"] = 1.0
        parent_q[(0, 1, 1, 2)]["eat"] = 0.8

        child = Creature(agent_id=2, x=5, y=5)
        child.inherit_q(parent_q, factor=1.0, sigma=0.0)

        child.q_table[(0, 1, 1, 2)]["move_n"] = 999.0
        child.q_table[("new_state",)]["new_action"] = 123.0

        assert parent_q[(0, 1, 1, 2)]["move_n"] != 999.0, (
            "Изменение копии повлияло на оригинал"
        )
        assert ("new_state",) not in parent_q, (
            "Новый ключ попал в оригинальную Q-таблицу"
        )

    def test_inherit_q_applies_mutation(self, agent):
        """inherit_q() применяет мутацию."""
        parent_q = defaultdict(lambda: defaultdict(float))
        parent_q[(0, 1, 1, 2)]["move_n"] = 1.0

        children_values = []
        for i in range(10):
            child = Creature(agent_id=10 + i, x=5, y=5)
            child.inherit_q(parent_q, factor=0.3, sigma=0.05)
            children_values.append(child.q_table[(0, 1, 1, 2)]["move_n"])

        assert len(set(children_values)) > 1 or max(children_values) != min(children_values), (
            "Мутация не применена: все значения одинаковы"
        )

    def test_to_delta_agent_moved(self, world):
        """World.to_delta() возвращает запись agent_moved."""
        w = world
        a = Creature(agent_id=1, x=5, y=5)
        w.agents.append(a)

        prev = w.get_state()
        w.step({a.id: "move_e"})

        deltas = w.to_delta(prev)
        moved = [d for d in deltas if d["type"] == "agent_moved"]

        assert len(moved) > 0, "Дельта должна содержать agent_moved"
        d = moved[0]
        assert "from" in d, "Нет поля from"
        assert "to" in d, "Нет поля to"
        assert d["from"] == [5, 5], f"from: ожидалось [5,5], получено {d['from']}"
        assert d["to"] == [6, 5], f"to: ожидалось [6,5], получено {d['to']}"