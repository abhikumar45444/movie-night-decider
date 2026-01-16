# 🎬 Movie Night Decider

A real-time collaborative web application that helps groups decide which movie to watch together. Users can create or join rooms, swipe through popular movies, and see instant matches where everyone agrees!

![Movie Night Decider](https://img.shields.io/badge/Status-Active-success)
![Python](https://img.shields.io/badge/Python-3.8+-blue)
![React](https://img.shields.io/badge/React-18.0+-61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688)

## ✨ Features

- **Real-time Collaboration** - Multiple users can vote simultaneously with instant updates
- **TMDB Integration** - Access to thousands of popular movies with ratings, posters, and details
- **WebSocket Communication** - Live updates when users join, leave, or vote
- **Smart Matching Algorithm** - Finds movies everyone in the room voted YES on
- **Beautiful UI** - Modern, responsive design that works on desktop and mobile
- **Persistent Rooms** - SQLite database maintains room state
- **Fast & Efficient** - Async architecture for optimal performance

## 🎥 Demo
Check out: [demo]()

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework for building APIs
- **SQLite** - Lightweight database for storing rooms, votes, and participants
- **WebSocket** - Real-time bidirectional communication
- **aiohttp** - Async HTTP client for TMDB API calls
- **Uvicorn** - ASGI server for running FastAPI

### Frontend
- **React 18** - Component-based UI library
- **React Hooks** - useState, useEffect, useRef for state management
- **WebSocket API** - Browser WebSocket for real-time updates
- **Fetch API** - Modern HTTP requests
- **CSS3** - Custom styling with animations and gradients

### External APIs
- **TMDB API** - The Movie Database for movie information

## 📋 Prerequisites

Before running this project, make sure you have:

- **Python 3.8+** installed ([Download](https://www.python.org/downloads/))
- **Node.js 14+** and npm installed ([Download](https://nodejs.org/))
- **TMDB API Key** (free) - [Get one here](https://www.themoviedb.org/settings/api)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/abhikumar45444/movie-night-decider.git
cd movie-night-decider
```

### 2. Backend Setup
```bash
# Navigate to backend folder
  cd backend

# Create virtual environment
  python -m venv venv

# Activate virtual environment
 On Windows:
    venv\Scripts\activate

 On Mac/Linux:
    source venv/bin/activate

# Install dependencies
  pip install -r requirements.txt

# Add your TMDB API key
# Open main.py and replace YOUR_TMDB_API_KEY_HERE with your actual key
```

### 3. Frontend Setup
```bash
# Navigate to frontend-react folder (from project root)
cd frontend/frontend-react

# Install dependencies
npm install
```

## 🎮 Running the Application

### Start Backend Server
```bash
# From backend folder
cd backend
python main.py
```

Backend will run on `http://localhost:8000`

### Start Frontend Server
```bash
# From frontend-react folder (new terminal)
cd frontend/frontend-react
npm run dev
```

Frontend will open automatically at `http://localhost:3000`

## 📖 Usage Guide

### Creating a Room

1. Open the app at `http://localhost:3000`
2. Click **"Create New Room"**
3. You'll be assigned a random username (e.g., User123)
4. Share the 6-character room code with friends

### Joining a Room

1. Get the room code from your friend
2. Enter the room code and your name
3. Click **"Join Room"**

### Voting on Movies

1. View movie details (poster, rating, description)
2. Click **❌ Nope** if you don't want to watch it
3. Click **✅ Yes!** if you'd watch it
4. Progress bar shows how many movies you've voted on
5. Real-time updates show when others vote

### Viewing Results

1. After voting on all movies, click **"See Results"**
2. View movies that everyone voted YES on
3. Choose a movie and enjoy! 🍿

## 🏗️ Project Structure
```
movie-night-decider/
├── backend/
│   ├── main.py              # FastAPI app & endpoints
│   ├── database.py          # SQLite database logic
│   ├── env.howTo
│   ├── tmdb_service.py      # TMDB API integration
│   ├── requirements.txt     # Python dependencies
│   └── movie_night.db       # SQLite database (auto-created)
│
├── frontend/frontend-react/
│   ├── public/
│   │   └── icon.svg
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── LandingPage.jsx    # Home page
│   │   │   ├── RoomPage.jsx       # Voting page
│   │   │   ├── MovieCard.jsx      # Movie display
│   │   │   └── LoadingSpinner.jsx # Loading component
│   │   ├── App.jsx          # Main app component
│   │   ├── App.css          # Styles
│   │   ├── index.js         # Entry point
│   │   └── index.css        # Global styles
│   |── .gitignore
│   |── env.howTO
│   |── eslint.config.js
│   |── index.html
│   |── package.json         # Node dependencies         
│   |── README.md
│   └── vite.config.js
│
|── .gitignore
|── Schema-ER-Diagram.PNG
|── TEST_CASES.md
└── README.md
```

## 🔌 API Endpoints

### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/rooms/create` | Create a new room |
| POST | `/api/rooms/join` | Join existing room |
| GET | `/api/rooms/{code}/participants` | Get room participants |
| GET | `/api/rooms/{code}/movies` | Get movies for voting |
| POST | `/api/vote` | Submit a vote |
| GET | `/api/rooms/{code}/matches` | Get matched movies |

### WebSocket Endpoint

| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8000/ws/{room_code}/{user_id}` | Real-time updates |

### WebSocket Messages
```json
// Vote update
{
  "type": "vote_update",
  "movie_id": 123,
  "progress": {
    "total_movies": 20,
    "movies_with_all_votes": 5
  }
}

// User joined
{
  "type": "user_joined",
  "username": "Alice",
  "participants": [...]
}

// User left
{
  "type": "user_left",
  "user_id": "abc123"
}
```

## 💾 Database Schema

### Tables

**rooms**
```sql
room_code TEXT PRIMARY KEY
created_at TEXT
status TEXT
```

**participants**
```sql
user_id TEXT PRIMARY KEY
username TEXT
room_code TEXT (FK)
joined_at TEXT
```

**movies**
```sql
id INTEGER PRIMARY KEY
room_code TEXT (FK)
movie_id INTEGER
movie_data TEXT (JSON)
```

**votes**
```sql
id INTEGER PRIMARY KEY
user_id TEXT (FK)
movie_id INTEGER
room_code TEXT (FK)
vote INTEGER (1=YES, 0=NO)
voted_at TEXT
```

## 🧪 Testing

### Manual Testing

1. **Single User Flow**
   - Create room → Vote on movies → See results

2. **Multi User Flow**
   - Open two browsers (or incognito)
   - Create room in one, join in other
   - Vote differently
   - Check real-time updates
   - Verify matches

3. **Edge Cases**
   - Try joining non-existent room
   - Leave room and rejoin
   - Refresh page during voting

### Backend API Testing

Visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI)

## 🐛 Troubleshooting

### Backend Issues

**Problem:** `ModuleNotFoundError: No module named 'fastapi'`
```bash
# Solution: Install dependencies
pip install -r requirements.txt
```

**Problem:** `Failed to fetch movies`
```bash
# Solution: Check TMDB API key in main.py
# Verify you have internet connection
```

**Problem:** `Address already in use`
```bash
# Solution: Port 8000 is taken
# Kill the process or change port in main.py
```

### Frontend Issues

**Problem:** `npm: command not found`
```bash
# Solution: Install Node.js
# Download from https://nodejs.org/
```

**Problem:** WebSocket connection failed
```bash
# Solution: Make sure backend is running
# Check backend URL in component files
```

**Problem:** Movies not displaying
```bash
# Solution: Open browser console (F12)
# Check for CORS errors
# Verify backend is running on port 8000
```

## 🚀 Deployment

### Backend Deployment (Railway/Render/Heroku)

1. Add `Procfile`:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

2. Update CORS settings in `main.py`:
```python
allow_origins=["https://your-frontend-domain.com"]
```

3. Use environment variables for API key:
```python
import os
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
```

### Frontend Deployment (Vercel/Netlify)

1. Build production version:
```bash
npm run build
```

2. Update API URLs to production backend

3. Deploy `build` folder

## 🎯 Future Enhancements

- [ ] User authentication & profiles
- [ ] Save favorite movies
- [ ] Custom movie lists (not just popular)
- [ ] Filter by genre, year, rating
- [ ] Streaming service availability
- [ ] Movie trailers integration
- [ ] Chat functionality
- [ ] Private vs public rooms
- [ ] Room expiration timer
- [ ] Mobile app (React Native)
- [ ] Share results on social media
- [ ] Weighted voting system
- [ ] AI-powered recommendations

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- **Python:** Follow PEP 8 guidelines
- **JavaScript:** Use ESLint with React plugin
- **Comments:** Write clear, descriptive comments
- **Commits:** Use conventional commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Dinesh Kumar**
- GitHub: [@abhikumar45444](https://github.com/yabhikumar45444)
- LinkedIn: [Dinesh Kumar](https://linkedin.com/in/erdineshkr)

## 🙏 Acknowledgments

- [TMDB](https://www.themoviedb.org/) for the amazing movie database API
- [FastAPI](https://fastapi.tiangolo.com/) for the excellent documentation
- [React](https://react.dev/) for the powerful UI library
- All the open-source contributors who made this possible

## 📞 Support

If you have any questions or run into issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Search existing [Issues](https://github.com/yabhikumar45444/movie-night-decider/issues)
3. Open a new issue with:
   - Detailed description
   - Steps to reproduce
   - Error messages/screenshots
   - Your environment (OS, Python version, Node version)

## ⭐ Show Your Support

If you found this project helpful, please give it a ⭐ on GitHub!

---

**Made with ❤️ and lots of ☕**