import sqlite3
import json
from datetime import datetime
import random
import string

class Database:
    def __init__(self, db_name="movie_night.db"):
        """
        Initialize database connection
        
        What this does:
        - Creates a connection to SQLite database file
        - If file doesn't exist, SQLite creates it automatically
        - db_name: name of the database file
        """
        self.db_name = db_name
        self.create_tables()
    
    def get_connection(self):
        """
        Get a new database connection
        
        Why we need this:
        - SQLite connections aren't thread-safe
        - Each request needs its own connection
        - check_same_thread=False allows multi-threading
        - timeout=10 allows waiting for locks instead of failing immediately
        """
        conn = sqlite3.connect(self.db_name, check_same_thread=False, timeout=10)
        conn.row_factory = sqlite3.Row  # This makes results return as dictionaries
        return conn
    
    def create_tables(self):
        """
        Create all database tables if they don't exist
        
        Tables we need:
        1. rooms - stores room information
        2. participants - stores users in each room
        3. movies - stores movies being voted on
        4. votes - stores each user's vote
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # ROOMS TABLE
        # Stores: room_code, created_at, status (active/finished)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rooms (
                room_code TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                status TEXT DEFAULT 'active'
            )
        ''')
        
        # PARTICIPANTS TABLE
        # Stores: who's in which room
        # user_id: unique identifier for each user
        # username: display name
        # room_code: which room they're in (links to rooms table)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS participants (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                room_code TEXT NOT NULL,
                joined_at TEXT NOT NULL,
                FOREIGN KEY (room_code) REFERENCES rooms(room_code)
            )
        ''')
        
        # MOVIES TABLE
        # Stores: which movies are being shown in which room
        # movie_id: TMDB movie ID
        # room_code: which room this movie belongs to
        # movie_data: JSON string with all movie details (title, poster, etc)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS movies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_code TEXT NOT NULL,
                movie_id INTEGER NOT NULL,
                movie_data TEXT NOT NULL,
                FOREIGN KEY (room_code) REFERENCES rooms(room_code)
            )
        ''')
        
        # VOTES TABLE
        # Stores: each person's vote on each movie
        # user_id: who voted
        # movie_id: which movie
        # vote: 1 for YES, 0 for NO
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                movie_id INTEGER NOT NULL,
                room_code TEXT NOT NULL,
                vote INTEGER NOT NULL,
                voted_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES participants(user_id),
                FOREIGN KEY (room_code) REFERENCES rooms(room_code)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def generate_room_code(self):
        """
        Generate a unique 6-character room code
        
        How it works:
        1. Generate random 6 letters/numbers
        2. Check if it already exists in database
        3. If exists, try again (recursion)
        4. If unique, return it
        
        Example output: "ABC123", "XYZ789"
        """
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        # Check if code already exists
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT room_code FROM rooms WHERE room_code = ?", (code,))
        exists = cursor.fetchone()
        conn.close()
        
        if exists:
            # Code already exists, generate a new one
            return self.generate_room_code()
        
        return code
    
    def create_room(self):
        """
        Create a new room in database
        
        Returns: room_code (string)
        
        Steps:
        1. Generate unique room code
        2. Insert into rooms table with current timestamp
        3. Return the code
        """
        room_code = self.generate_room_code()
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO rooms (room_code, created_at, status) VALUES (?, ?, ?)",
            (room_code, datetime.now().isoformat(), 'active')
        )
        
        conn.commit()
        conn.close()
        
        return room_code
    
    def join_room(self, room_code, username):
        """
        Add a user to a room
        
        Parameters:
        - room_code: which room to join
        - username: user's display name
        
        Returns: user_id (unique identifier for this user)
        
        Steps:
        1. Check if room exists
        2. Generate unique user_id
        3. Insert into participants table
        4. Return user_id
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Check if room exists
        cursor.execute("SELECT room_code FROM rooms WHERE room_code = ?", (room_code,))
        room = cursor.fetchone()
        
        if not room:
            conn.close()
            return None
        
        # Generate unique user_id
        user_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
        
        cursor.execute(
            "INSERT INTO participants (user_id, username, room_code, joined_at) VALUES (?, ?, ?, ?)",
            (user_id, username, room_code, datetime.now().isoformat())
        )
        
        conn.commit()
        conn.close()
        
        return user_id
    
    def get_participants(self, room_code):
        """
        Get all participants in a room
        
        Returns: list of dictionaries
        Example: [
            {"user_id": "abc123", "username": "John"},
            {"user_id": "def456", "username": "Jane"}
        ]
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT user_id, username FROM participants WHERE room_code = ?",
            (room_code,)
        )
        
        participants = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return participants
    
    def remove_participant(self, user_id, room_code):
        """
        Remove a participant from a room and delete all their votes
        
        Parameters:
        - user_id: the user to remove
        - room_code: which room they're leaving
        
        What this does:
        1. Delete all votes by this user in this room
        2. Delete the participant record
        
        Called when a user leaves the room or disconnects
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # First, delete all votes by this user in this room
        cursor.execute(
            "DELETE FROM votes WHERE user_id = ? AND room_code = ?",
            (user_id, room_code)
        )
        
        # Then delete the participant
        cursor.execute(
            "DELETE FROM participants WHERE user_id = ? AND room_code = ?",
            (user_id, room_code)
        )
        
        conn.commit()
        conn.close()
    
    def add_movies_to_room(self, room_code, movies):
        """
        Add movies to a room for voting
        
        Parameters:
        - room_code: which room
        - movies: list of movie dictionaries from TMDB
        
        Each movie is stored as JSON in the database
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        for movie in movies:
            cursor.execute(
                "INSERT INTO movies (room_code, movie_id, movie_data) VALUES (?, ?, ?)",
                (room_code, movie['id'], json.dumps(movie))
            )
        
        conn.commit()
        conn.close()
    
    def get_movies_for_room(self, room_code):
        """
        Get all movies for a room
        
        Returns: list of movie dictionaries
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT movie_id, movie_data FROM movies WHERE room_code = ?",
            (room_code,)
        )
        
        movies = []
        for row in cursor.fetchall():
            movie_data = json.loads(row['movie_data'])
            movies.append(movie_data)
        
        conn.close()
        return movies
    
    def save_vote(self, user_id, movie_id, room_code, vote):
        """
        Save a user's vote
        
        Parameters:
        - user_id: who's voting
        - movie_id: which movie
        - room_code: which room
        - vote: 1 for YES, 0 for NO
        
        Why we need room_code:
        - Same movie might be in multiple rooms
        - We need to track votes per room
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Check if user already voted on this movie in this room
        cursor.execute(
            "SELECT id FROM votes WHERE user_id = ? AND movie_id = ? AND room_code = ?",
            (user_id, movie_id, room_code)
        )
        existing = cursor.fetchone()
        
        if existing:
            # Update existing vote
            cursor.execute(
                "UPDATE votes SET vote = ?, voted_at = ? WHERE id = ?",
                (vote, datetime.now().isoformat(), existing['id'])
            )
        else:
            # Insert new vote
            cursor.execute(
                "INSERT INTO votes (user_id, movie_id, room_code, vote, voted_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, movie_id, room_code, vote, datetime.now().isoformat())
            )
        
        conn.commit()
        conn.close()
    
    def get_matched_movies(self, room_code):
        """
        Find movies that EVERYONE voted YES on
        
        Algorithm:
        1. Get all participants in room (count them)
        2. For each movie, count how many DISTINCT participants voted YES
        3. If YES count = participant count, it's a match!
        
        Returns: list of matched movie dictionaries
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Get participant count
        cursor.execute(
            "SELECT COUNT(*) as count FROM participants WHERE room_code = ?",
            (room_code,)
        )
        participant_count = cursor.fetchone()['count']
        
        # Get movies with unanimous YES votes
        cursor.execute('''
            SELECT m.movie_id, m.movie_data
            FROM movies m
            WHERE m.room_code = ?
            AND m.movie_id IN (
                SELECT v.movie_id
                FROM votes v
                WHERE v.room_code = ?
                AND v.vote = 1
                GROUP BY v.movie_id
                HAVING COUNT(DISTINCT v.user_id) = ?
            )
        ''', (room_code, room_code, participant_count))
        
        matched = []
        for row in cursor.fetchall():
            movie_data = json.loads(row['movie_data'])
            matched.append(movie_data)
        
        conn.close()
        return matched
    
    def count_matched_movies(self, room_code):
        """
        Count how many movies have unanimous YES votes from all participants
        
        Returns: integer count of matched movies
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Get participant count
        cursor.execute(
            "SELECT COUNT(*) as count FROM participants WHERE room_code = ?",
            (room_code,)
        )
        participant_count = cursor.fetchone()['count']
        
        # Count movies with all YES votes
        cursor.execute('''
            SELECT COUNT(*) as count
            FROM (
                SELECT m.movie_id, COUNT(v.id) as yes_count
                FROM movies m
                LEFT JOIN votes v ON m.movie_id = v.movie_id 
                    AND m.room_code = v.room_code 
                    AND v.vote = 1
                WHERE m.room_code = ?
                GROUP BY m.movie_id
                HAVING COUNT(v.id) = ?
            ) as matched
        ''', (room_code, participant_count))
        
        result = cursor.fetchone()
        count = result['count'] if result else 0
        
        conn.close()
        return count
        
        conn.close()
        return matched
    
    def get_vote_progress(self, room_code):
        """
        Get voting progress for a room
        
        Returns: dictionary with stats
        Example: {
            "total_movies": 20,
            "movies_with_all_votes": 5,
            "participants": 4
        }
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Get participant count
        cursor.execute(
            "SELECT COUNT(*) as count FROM participants WHERE room_code = ?",
            (room_code,)
        )
        participant_count = cursor.fetchone()['count']
        
        # Get total movies
        cursor.execute(
            "SELECT COUNT(*) as count FROM movies WHERE room_code = ?",
            (room_code,)
        )
        total_movies = cursor.fetchone()['count']
        
        conn.close()
        
        # Get count of matched movies (unanimous YES votes)
        matched_count = self.count_matched_movies(room_code)
        
        return {
            "total_movies": total_movies,
            "movies_with_all_votes": matched_count,
            "participants": participant_count
        }

## 🎯 UNDERSTANDING `database.py`

### **What We Just Built:**
'''
1. **Database Connection** - Opens SQLite file

2. **4 Tables:**
   - `rooms` - Room codes and status
   - `participants` - Users in rooms
   - `movies` - Movies to vote on
   - `votes` - Each user's votes

3. **Key Functions:**
   - `create_room()` - Make new room, get code
   - `join_room()` - Add user to room
   - `save_vote()` - Record YES/NO vote
   - `get_matched_movies()` - Find unanimous picks

###### **The Matching Algorithm Explained:** #######
Room has 4 people
Movie "Inception" gets:
- User1: YES
- User2: YES  
- User3: YES
- User4: YES
= 4 YES votes = 4 people = MATCH! ✅

Movie "Titanic" gets:
- User1: YES
- User2: NO
- User3: YES
- User4: YES
= 3 YES votes ≠ 4 people = NO MATCH ❌
################################################
'''

