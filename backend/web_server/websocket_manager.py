import asyncio
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Store active WebSocket connections by room_id
        self.active_connections: dict = {}

    async def connect(self, websocket: WebSocket, room_id: str = "default"):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        logger.info(f"Client connected to room {room_id}. Total in room: {len(self.active_connections[room_id])}")

    def disconnect(self, websocket: WebSocket, room_id: str = "default"):
        if room_id in self.active_connections and websocket in self.active_connections[room_id]:
            self.active_connections[room_id].remove(websocket)
            logger.info(f"Client disconnected from room {room_id}. Total in room: {len(self.active_connections[room_id])}")
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_json(self, data: dict, room_id: str = "default"):
        """
        Broadcast JSON data to all connected clients in a specific room.
        """
        if room_id not in self.active_connections:
            return
            
        for connection in list(self.active_connections[room_id]):
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.error(f"Error sending data to a client in room {room_id}: {e}")
                self.disconnect(connection, room_id)

# Global instance to be used across the app
manager = ConnectionManager()
