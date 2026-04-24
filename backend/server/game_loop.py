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
        self.running = True

    def stop(self):
        self.running = False

    def tick(self) -> dict:
        pass

    def get_delta(self) -> list:
        pass

    def handle_command(self, command: dict):
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
        pass