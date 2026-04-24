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
        pass

    def act(self, state: tuple, epsilon: float = 0.1) -> str:
        pass

    def update_q(self, state, action, reward, next_state, alpha=0.1, gamma=0.9):
        pass

    def inherit_q(self, parent_q: dict, factor: float = 0.3, sigma: float = 0.05) -> None:
        pass


class Creature(Agent):
    pass


class Predator(Agent):
    def act(self, state: tuple, epsilon: float = 0.0) -> str:
        return ACTION_REST