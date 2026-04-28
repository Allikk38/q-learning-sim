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
        self._agent_generations = {}
        self._agent_steps_alive = {}
        self.previous_generation_q = None
        self._food_spawn_counter = 0
        self.eco_score = 0
        self._eco_step_accumulator = 0.0
        self._achievements = set()
        self._achievement_messages = []

    def _check_achievements(self):
        alive_agents = [a for a in self.world.agents if a.alive]
        alive_count = len(alive_agents)

        if self.generation >= 2 and "first_generation" not in self._achievements:
            self._achievements.add("first_generation")
            msg = "🏆 Первое поколение: агент эволюционировал!"
            self.event_log.append(f"Шаг {self.world.step_count}: {msg}")
            self._achievement_messages.append(msg)

        for agent in alive_agents:
            steps = self._agent_steps_alive.get(agent.id, 0)
            if steps >= 200 and f"survivor_{agent.id}" not in self._achievements:
                self._achievements.add(f"survivor_{agent.id}")
                gen = self._agent_generations.get(agent.id, self.generation)
                msg = f"🏆 Выживший: агент поколения {gen} прожил 200 шагов!"
                self.event_log.append(f"Шаг {self.world.step_count}: {msg}")
                self._achievement_messages.append(msg)

        if self.generation >= 5 and "legacy" not in self._achievements:
            self._achievements.add("legacy")
            msg = "🏆 Наследие: достигнуто 5 поколение!"
            self.event_log.append(f"Шаг {self.world.step_count}: {msg}")
            self._achievement_messages.append(msg)

        if alive_count >= 3 and len(self.world.agents) >= 3 and "ecosystem" not in self._achievements:
            self._achievements.add("ecosystem")
            msg = "🏆 Экосистема: одновременно живы 3 агента!"
            self.event_log.append(f"Шаг {self.world.step_count}: {msg}")
            self._achievement_messages.append(msg)

    def start(self):
        self.running = True
        self.world._spawn_initial()
        for agent in self.world.agents:
            self._agent_generations[agent.id] = self.generation
            self._agent_steps_alive[agent.id] = 0
            self.event_log.append(
                f"Шаг {self.world.step_count}: агент {agent.id} поколения {self.generation} появился"
            )

    def stop(self):
        self.running = False

    def _get_random_empty_position(self) -> tuple:
        empty_cells = []
        creature_cells = self.world._get_occupied_creature_cells()
        for row in self.world.grid:
            for cell in row:
                if cell.type == "empty" and (cell.x, cell.y) not in creature_cells:
                    empty_cells.append((cell.x, cell.y))
        if empty_cells:
            return random.choice(empty_cells)
        return (random.randint(0, self.world.width - 1),
                random.randint(0, self.world.height - 1))

    def _compare_generations(self, old_q: dict, new_q: dict, new_gen: int):
        key_actions = ["eat", "move_n", "move_s", "move_w", "move_e"]
        old_avg = {}
        new_avg = {}
        for action in key_actions:
            old_values = []
            new_values = []
            for state, actions in old_q.items():
                if action in actions:
                    old_values.append(actions[action])
            for state, actions in new_q.items():
                if action in actions:
                    new_values.append(actions[action])
            if old_values:
                old_avg[action] = sum(old_values) / len(old_values)
            if new_values:
                new_avg[action] = sum(new_values) / len(new_values)
        max_change = 0.0
        changed_action = None
        for action in key_actions:
            if action in old_avg and action in new_avg:
                change = abs(new_avg[action] - old_avg[action])
                if change > max_change:
                    max_change = change
                    changed_action = action
        if max_change <= 0.3:
            return f"Поколение {new_gen}: без значительных изменений"
        old_val = old_avg.get(changed_action, 0)
        new_val = new_avg.get(changed_action, 0)
        diff = new_val - old_val
        action_names = {
            "eat": "отношение к еде/яду",
            "move_n": "навык ходьбы на север",
            "move_s": "навык ходьбы на юг",
            "move_w": "навык ходьбы на запад",
            "move_e": "навык ходьбы на восток"
        }
        action_desc = action_names.get(changed_action, f"Q_{changed_action}")
        if changed_action == "eat":
            if diff < 0:
                desc = "страх перед ядом усилился"
            else:
                desc = "тяга к еде возросла"
        else:
            direction = "научился ходить" if diff > 0.3 else "стал реже ходить"
            desc = f"{direction} ({action_desc})"
        return f"Поколение {new_gen}: {desc} (Q_{changed_action}: {old_val:.1f} → {new_val:.1f})"

    def tick(self) -> dict:
        self._previous_state = self.world.get_state()
        actions = {}
        states = {}
        alive_count_this_tick = 0
        for agent in self.world.agents:
            if agent.alive:
                alive_count_this_tick += 1
                state = agent.get_state(self.world)
                states[agent.id] = state
                action = agent.act(state)
                actions[agent.id] = action
                if agent.id in self._agent_steps_alive:
                    self._agent_steps_alive[agent.id] += 1
                else:
                    self._agent_steps_alive[agent.id] = 1
        result = self.world.step(actions)
        for agent in self.world.agents:
            if agent.alive:
                state = states.get(agent.id)
                action = actions.get(agent.id)
                reward = result["rewards"].get(agent.id, 0)
                next_state = result["next_states"].get(agent.id)
                if state is not None and action is not None:
                    agent.update_q(state, action, reward, next_state)
                if reward > 0.5:
                    self.eco_score += 5

        self._eco_step_accumulator += alive_count_this_tick * 0.1
        if self._eco_step_accumulator >= 1.0:
            floored = int(self._eco_step_accumulator)
            self.eco_score += floored
            self._eco_step_accumulator -= floored

        for i, agent in enumerate(self.world.agents):
            if not agent.alive:
                old_gen = self._agent_generations.get(agent.id, self.generation)
                dead_q_table = dict(agent.q_table)
                self.generation += 1
                new_gen = self.generation
                new_agent = Creature(agent_id=agent.id, x=0, y=0)
                new_agent.inherit_q(
                    agent.q_table,
                    factor=self.config["inheritance_factor"],
                    sigma=self.config["inheritance_noise_sigma"]
                )
                new_x, new_y = self._get_random_empty_position()
                new_agent.x = new_x
                new_agent.y = new_y
                new_agent.reward_history = []
                new_agent.state_history = []
                new_agent.action_history = []
                self.world.agents[i] = new_agent
                self._agent_generations[agent.id] = new_gen
                self._agent_steps_alive[agent.id] = 0
                self.event_log.append(
                    f"Шаг {self.world.step_count}: агент {agent.id} умер (поколение {old_gen}), "
                    f"возрождён как поколение {new_gen}"
                )
                if self.previous_generation_q is not None:
                    comparison = self._compare_generations(
                        self.previous_generation_q, dead_q_table, old_gen
                    )
                    self.event_log.append(comparison)
                self.previous_generation_q = dead_q_table
                self.event_log.append(
                    f"Шаг {self.world.step_count}: агент {agent.id} поколения {new_gen} появился"
                )
                self.eco_score += 20

        for agent in self.world.agents:
            if agent.alive:
                agent_id = agent.id
                steps = self._agent_steps_alive.get(agent_id, 0)
                agent_gen = self._agent_generations.get(agent_id, self.generation)
                if steps > 0 and steps % 100 == 0:
                    self.event_log.append(
                        f"Шаг {self.world.step_count}: агент {agent_id} поколения {agent_gen} прожил {steps} шагов"
                    )
        self._food_spawn_counter += 1
        interval = self.config.get("food_spawn_interval", 50)
        if self._food_spawn_counter >= interval:
            self._food_spawn_counter = 0
            self.world.spawn_food()
        if len(self.event_log) > 50:
            self.event_log = self.event_log[-50:]
        self.world.step_count += 1
        self._check_achievements()
        self.metrics = self._compute_metrics()
        state = self.world.get_state()
        state["metrics"] = self.metrics
        state["event_log"] = self.event_log
        state["generation"] = self.generation
        state["eco_score"] = self.eco_score
        state["achievement_messages"] = self._achievement_messages.copy()
        self._achievement_messages.clear()
        state["agent_generations"] = dict(self._agent_generations)
        return state

    def get_delta(self) -> list:
        if self._previous_state is None:
            return []
        return self.world.to_delta(self._previous_state)

    def handle_command(self, command: dict):
        cmd = command.get("command")
        if cmd == "set_speed":
            self.speed = command.get("value", 1)
        elif cmd == "kill_agent":
            agent_id = command.get("id", 0)
            for agent in self.world.agents:
                if agent.id == agent_id and agent.alive:
                    agent.alive = False
                    old_gen = self._agent_generations.get(agent.id, self.generation)
                    self.event_log.append(
                        f"Шаг {self.world.step_count}: агент {agent.id} умер (поколение {old_gen}), "
                        f"убит пользователем"
                    )
                    if len(self.event_log) > 50:
                        self.event_log = self.event_log[-50:]
        elif cmd == "reset_world":
            self.world.reset()
            self.generation = 1
            self.event_log = []
            self._agent_generations = {}
            self._agent_steps_alive = {}
            self.previous_generation_q = None
            self._food_spawn_counter = 0
            self.eco_score = 0
            self._eco_step_accumulator = 0.0
            self._achievements = set()
            self._achievement_messages = []
            for agent in self.world.agents:
                self._agent_generations[agent.id] = self.generation
                self._agent_steps_alive[agent.id] = 0
        elif cmd == "apply_brush":
            x = command.get("x", 0)
            y = command.get("y", 0)
            fertility = command.get("fertility", 0.0)
            radius = command.get("radius", 2)
            self.world.apply_brush(x, y, fertility, radius)

    def _compute_metrics(self) -> dict:
        agents_metrics = []
        for agent in self.world.agents:
            recent_rewards = agent.reward_history[-100:]
            avg_reward = sum(recent_rewards) / len(recent_rewards) if recent_rewards else 0.0
            recent_actions = agent.action_history[-100:]
            entropy = 0.0
            if recent_actions:
                action_counts = {}
                for action in recent_actions:
                    action_counts[action] = action_counts.get(action, 0) + 1
                total = len(recent_actions)
                for count in action_counts.values():
                    p = count / total
                    if p > 0:
                        entropy -= p * math.log2(p)
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