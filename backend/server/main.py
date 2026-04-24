import asyncio
import json
from fastapi import FastAPI, WebSocket
from core.config import load_config
from server.game_loop import GameLoop

app = FastAPI()
game_loop = None
connected_clients = []


@app.on_event("startup")
async def startup():
    global game_loop
    config = load_config()
    game_loop = GameLoop(config)
    game_loop.world._spawn_initial()
    game_loop.start()
    asyncio.create_task(game_tick())


async def game_tick():
    while True:
        if game_loop and game_loop.running and game_loop.speed > 0:
            for _ in range(game_loop.speed):
                game_loop.tick()
            state = game_loop.world.get_state()
            message = {
                "type": "full_state",
                **state
            }
            for ws in connected_clients:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    pass
        await asyncio.sleep(0.5)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)

    if game_loop:
        state = game_loop.world.get_state()
        await websocket.send_text(json.dumps({
            "type": "full_state",
            **state
        }))

    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data)
            if game_loop:
                game_loop.handle_command(command)
    except Exception:
        pass
    finally:
        connected_clients.remove(websocket)