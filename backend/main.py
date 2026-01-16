from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict
import json
import asyncio

from database import Database
from tmdb_service import TMDBService

import os
from dotenv import load_dotenv

load_dotenv()

# ============================================
# PYDANTIC MODELS (Data Validation)
# ============================================

class CreateRoomResponse(BaseModel):
    """
    What we return when someone creates a room
    
    Pydantic models:
    - Validate data automatically
    - Generate documentation
    - Type checking
    """
    room_code: str
    message: str

class JoinRoomRequest(BaseModel):
    """
    What we expect when someone joins a room
    
    Why use Pydantic?
    - If username is missing → automatic error
    - If username is not a string → automatic error
    - No manual validation needed!
    """
    room_code: str
    username: str

class JoinRoomResponse(BaseModel):
    """
    What we return after successful join
    """
    user_id: str
    room_code: str
    username: str
    message: str

class VoteRequest(BaseModel):
    """
    What we expect when someone votes
    
    vote: 1 for YES, 0 for NO
    """
    user_id: str
    movie_id: int
    room_code: str
    vote: int  # 1 = YES, 0 = NO

# ============================================
# FASTAPI APP INITIALIZATION
# ============================================

app = FastAPI(
    title="Movie Night Decider API",
    description="Backend for collaborative movie selection",
    version="1.0.0"
)

# ============================================
# CORS MIDDLEWARE (Allow Frontend to Connect)
# ============================================

"""
What is CORS?
- CORS = Cross-Origin Resource Sharing
- Security feature in browsers
- Prevents malicious websites from accessing your API

Without CORS:
- Frontend (localhost:5500) tries to call API (localhost:8000)
- Browser blocks it! "Different origins!"

With CORS:
- We tell browser "localhost:5500 is allowed"
- Frontend can now make requests ✓
"""
ORIGIN_URL = os.getenv("ORIGIN_URL");

if not ORIGIN_URL:
    raise ValueError("❌ ORIGIN_URL environment variable not set!")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ "http://localhost:5173", # In production, specify exact origins
                    ORIGIN_URL, 
                    "*" ],  # TODO: Temporary - REMOVE AFTER TESTING
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# ============================================
# INITIALIZE SERVICES
# ============================================

# Database instance
db = Database()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")

if not TMDB_API_KEY:
    raise ValueError("❌ TMDB_API_KEY environment variable not set!")

tmdb = TMDBService(TMDB_API_KEY)

# ============================================
# WEBSOCKET CONNECTION MANAGER
# ============================================

class ConnectionManager:
    """
    Manages WebSocket connections for real-time updates
    
    Why do we need this?
    - Track who's connected to which room
    - Send updates to specific rooms
    - Handle disconnections gracefully
    
    How it works:
    - Store connections in a dictionary: {room_code: [websocket1, websocket2]}
    - When someone votes, notify everyone in that room
    """
    
    def __init__(self):
        """
        Initialize with empty connections dictionary
        
        Structure:
        {
            "ABC123": [websocket1, websocket2, websocket3],
            "XYZ789": [websocket4, websocket5]
        }
        """
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room_code: str):
        """
        Add a new WebSocket connection to a room
        
        Steps:
        1. Accept the WebSocket connection
        2. Add to the room's connection list
        3. If room doesn't exist in dict, create it
        """
        await websocket.accept()
        
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        
        self.active_connections[room_code].append(websocket)
        # print(f"✅ Client connected to room {room_code}")
    
    def disconnect(self, websocket: WebSocket, room_code: str):
        """
        Remove a WebSocket connection
        
        Why?
        - User closes browser tab
        - User loses internet connection
        - We need to clean up the connection
        """
        if room_code in self.active_connections:
            self.active_connections[room_code].remove(websocket)
            # print(f"❌ Client disconnected from room {room_code}")
            
            # Clean up empty room lists
            if len(self.active_connections[room_code]) == 0:
                del self.active_connections[room_code]
    
    async def broadcast_to_room(self, room_code: str, message: dict):
        """
        Send a message to everyone in a room
        
        Use cases:
        - Someone voted → notify everyone
        - New person joined → notify everyone
        - Voting complete → notify everyone
        
        Parameters:
        - room_code: which room
        - message: dictionary to send (will be converted to JSON)
        """
        if room_code in self.active_connections:
            # Loop through all connections in this room
            for connection in self.active_connections[room_code]:
                try:
                    # Send JSON message
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending message: {e}")

# Create global connection manager instance
manager = ConnectionManager()

# ============================================
# HTTP ENDPOINTS (REST API)
# ============================================

@app.get("/")
async def root():
    """
    Root endpoint - just to check if server is running
    
    Try: http://localhost:8000/
    """
    return {
        "message": "🎬 Movie Night Decider API",
        "status": "running",
        "docs": "http://localhost:8000/docs"  # Auto-generated API docs!
    }

@app.post("/api/rooms/create", response_model=CreateRoomResponse)
async def create_room():
    """
    CREATE ROOM ENDPOINT
    
    What it does:
    1. Generate unique room code
    2. Insert into database
    3. Fetch 20 popular movies from TMDB
    4. Store movies for this room
    5. Return room code
    
    Frontend calls this when user clicks "Create Room"
    
    HTTP Method: POST
    URL: /api/rooms/create
    Body: (none needed)
    Response: {"room_code": "ABC123", "message": "Room created"}
    """
    try:
        # Step 1: Create room in database
        room_code = db.create_room()
        
        # Step 2: Fetch movies from TMDB
        movies = await tmdb.get_popular_movies(total_movies=20)
        
        # Step 3: Store movies for this room
        db.add_movies_to_room(room_code, movies)
        
        return CreateRoomResponse(
            room_code=room_code,
            message="Room created successfully"
        )
    
    except Exception as e:
        # If something goes wrong, return error
        raise HTTPException(status_code=500, detail=f"Error creating room: {str(e)}")

@app.post("/api/rooms/join", response_model=JoinRoomResponse)
async def join_room(request: JoinRoomRequest):
    """
    JOIN ROOM ENDPOINT
    
    What it does:
    1. Check if room exists
    2. Add user to participants table
    3. Return user_id (so frontend knows who they are)
    
    Frontend calls this when user enters room code and name
    
    HTTP Method: POST
    URL: /api/rooms/join
    Body: {"room_code": "ABC123", "username": "John"}
    Response: {"user_id": "abc123xyz", "room_code": "ABC123", "username": "John"}
    """
    try:
        # Attempt to join room
        user_id = db.join_room(request.room_code, request.username)
        
        if not user_id:
            # Room doesn't exist
            raise HTTPException(status_code=404, detail="Room not found")
        
        # Get all participants after join
        all_participants = db.get_participants(request.room_code)
        
        # Broadcast to room that someone joined
        await manager.broadcast_to_room(request.room_code, {
            "type": "user_joined",
            "username": request.username,
            "participants": all_participants
        })
        
        return JoinRoomResponse(
            user_id=user_id,
            room_code=request.room_code,
            username=request.username,
            message="Joined successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error joining room: {str(e)}")

@app.get("/api/rooms/{room_code}/participants")
async def get_participants(room_code: str):
    """
    GET PARTICIPANTS ENDPOINT
    
    Returns list of everyone in the room
    
    URL: /api/rooms/ABC123/participants
    Response: [
        {"user_id": "abc", "username": "John"},
        {"user_id": "def", "username": "Jane"}
    ]
    """
    try:
        participants = db.get_participants(room_code)
        return {"participants": participants}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rooms/{room_code}/movies")
async def get_room_movies(room_code: str):
    """
    GET MOVIES ENDPOINT
    
    Returns all movies for voting in this room
    
    URL: /api/rooms/ABC123/movies
    Response: [
        {"id": 123, "title": "Inception", "poster_path": "...", ...},
        {"id": 456, "title": "Dark Knight", ...}
    ]
    """
    try:
        movies = db.get_movies_for_room(room_code)
        return {"movies": movies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/vote")
async def vote(request: VoteRequest):
    """
    VOTE ENDPOINT
    
    What it does:
    1. Save vote to database
    2. Check if everyone has voted on this movie
    3. Broadcast update to everyone in room
    
    Frontend calls this when user swipes YES or NO
    
    HTTP Method: POST
    URL: /api/vote
    Body: {
        "user_id": "abc123",
        "movie_id": 27205,
        "room_code": "ABC123",
        "vote": 1  // 1=YES, 0=NO
    }
    """
    try:
        # Save vote to database
        db.save_vote(
            request.user_id,
            request.movie_id,
            request.room_code,
            request.vote
        )
        
        # Get voting progress
        progress = db.get_vote_progress(request.room_code)
        
        # Broadcast update to everyone in room
        await manager.broadcast_to_room(request.room_code, {
            "type": "vote_update",
            "movie_id": request.movie_id,
            "progress": progress
        })
        
        return {"message": "Vote recorded", "progress": progress}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rooms/{room_code}/matches")
async def get_matches(room_code: str):
    """
    GET MATCHES ENDPOINT
    
    Returns movies that everyone voted YES on
    
    URL: /api/rooms/ABC123/matches
    Response: {
        "matches": [
            {"id": 123, "title": "Inception", ...},
            {"id": 456, "title": "Interstellar", ...}
        ]
    }
    """
    try:
        matches = db.get_matched_movies(room_code)
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# WEBSOCKET ENDPOINT (Real-time Communication)
# ============================================

@app.websocket("/ws/{room_code}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, user_id: str):
    """
    WEBSOCKET ENDPOINT
    
    What is this for?
    - Real-time updates when someone votes
    - See who's online
    - Live progress bar updates
    
    How it works:
    1. User connects via WebSocket
    2. Connection stays open
    3. Server can send updates anytime
    4. User disconnects when leaving page
    
    URL: ws://localhost:8000/ws/ABC123/user_abc123
    
    Messages sent to clients:
    - {"type": "connected", "message": "Connected to room ABC123"}
    - {"type": "vote_update", "movie_id": 123, "progress": {...}}
    - {"type": "user_joined", "username": "John"}
    """
    await manager.connect(websocket, room_code)
    
    try:
        # Get current participants when user connects
        current_participants = db.get_participants(room_code)
        current_progress = db.get_vote_progress(room_code)
        
        # Send confirmation with current state
        await websocket.send_json({
            "type": "connected",
            "message": f"Connected to room {room_code}",
            "participants": current_participants,
            "progress": current_progress
        })
        
        # Keep connection alive
        # This loop runs forever until user disconnects
        while True:
            # Wait for messages from client (if any)
            data = await websocket.receive_text()
            
            # You can handle client messages here if needed
            # For now, we just echo back
            await websocket.send_json({
                "type": "echo",
                "message": f"Server received: {data}"
            })
    
    except WebSocketDisconnect:
        # User closed tab or lost connection
        print(f"🔌 [DISCONNECT] user_id={user_id}, room={room_code}")
        manager.disconnect(websocket, room_code)
        
        # Remove participant from database and their votes
        print(f"   [REMOVE] Calling remove_participant...")
        db.remove_participant(user_id, room_code)
        print(f"   [REMOVE] ✓ Participant removed from DB")
        
        # Get updated participants list
        updated_participants = db.get_participants(room_code)
        print(f"   [REMOVE] Remaining in room: {len(updated_participants)}")
        
        # Notify others that someone left with updated participant list
        await manager.broadcast_to_room(room_code, {
            "type": "user_left",
            "user_id": user_id,
            "participants": updated_participants
        })

# ============================================
# STARTUP EVENT
# ============================================

@app.on_event("startup")
async def startup_event():
    """
    Runs when server starts
    
    Good place for:
    - Database initialization
    - Loading config
    - Starting background tasks
    """
    print("=" * 50)
    print("🎬 Movie Night Decider API Starting...")
    print("=" * 50)
    print("✅ Database initialized")
    print("✅ TMDB service ready")
    print("✅ WebSocket manager ready")
    print("=" * 50)
    print("📡 Server running on http://localhost:8000")
    print("📖 API Docs: http://localhost:8000/docs")
    print("=" * 50)

# ============================================
# RUN SERVER (for development)
# ============================================

if __name__ == "__main__":
    import uvicorn
    
    """
    Start the server
    
    uvicorn = ASGI server (like running a web server)
    
    Parameters:
    - app: the FastAPI app we created
    - host: "0.0.0.0" means accessible from any IP
    - port: 8000 (standard for development)
    - reload: True = auto-restart when code changes (AWESOME for development!)
    """
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Auto-reload on code changes
    )

'''

## 🧠 DEEP DIVE: Understanding `main.py`

### **1. What is FastAPI?**

FastAPI is a **web framework** that lets you create APIs easily.

**What's an API?**
- API = Application Programming Interface
- It's how frontend talks to backend
- Like a waiter between you (frontend) and kitchen (backend)

**Example Flow:**
```
Frontend                     Backend
   |                            |
   |------ "Create room" ------>|
   |                            | (creates room in DB)
   |<----- "ABC123" ------------|
   |                            |
   |------ "Get movies" ------->|
   |                            | (fetches from TMDB)
   |<----- [20 movies] ---------|

'''