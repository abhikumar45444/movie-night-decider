import React, { useState, useEffect, useRef } from 'react';
import MovieCard from './MovieCard';
import LoadingSpinner from './LoadingSpinner';

/**
 * ROOM PAGE COMPONENT
 * 
 * Main voting/room page where users:
 * 1. See room code and participants
 * 2. Vote on movies (swipe YES/NO)
 * 3. See real-time updates via WebSocket
 * 4. View progress bar
 * 5. See matched movies at the end
 * 
 * Props:
 * @param {Object} roomData - Room information
 *   - userId: Current user's ID
 *   - username: Current user's display name
 *   - roomCode: 6-character room code
 * 
 * @param {function} onLeaveRoom - Callback when user leaves room
 *   - Navigates back to landing page
 * 
 * State Management:
 * - movies: Array of all movies to vote on
 * - currentMovieIndex: Which movie we're currently showing (0-based)
 * - participants: Array of people in the room
 * - isLoading: Boolean - loading movies?
 * - isVoting: Boolean - vote in progress?
 * - error: String - error message
 * - votingComplete: Boolean - voted on all movies?
 * - matches: Array of matched movies
 * - showResults: Boolean - show results page?
 * - progress: Object - voting progress stats
 */
function RoomPage({ roomData, onLeaveRoom }) {
  /**
   * ==========================================
   * STATE DECLARATIONS
   * ==========================================
   */
  
  const [movies, setMovies] = useState([]);
  const [currentMovieIndex, setCurrentMovieIndex] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState('');
  const [votingComplete, setVotingComplete] = useState(false);
  const [matches, setMatches] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showPartialResults, setShowPartialResults] = useState(false);
  const [progress, setProgress] = useState({
    total_movies: 0,
    movies_with_all_votes: 0,
    participants: 0
  });

  /**
   * useRef Hook
   * 
   * What is useRef?
   * - Stores a mutable value that persists across renders
   * - Doesn't cause re-render when updated
   * - Perfect for storing WebSocket connection
   * 
   * Why not useState for WebSocket?
   * - useState triggers re-render on every update
   * - WebSocket doesn't need re-renders
   * - useRef is more efficient
   * 
   * Access value: websocketRef.current
   */
  const websocketRef = useRef(null);
  const isMountedRef = useRef(true);

  /**
   * API Configuration
   */
  const API_URL = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:8000';
  const WS_URL = import.meta.env.VITE_REACT_APP_WS_URL || 'ws://localhost:8000';

  /**
   * ==========================================
   * useEffect Hook - Component Lifecycle
   * ==========================================
   * 
   * useEffect runs side effects
   * Side effects = anything outside React (API calls, timers, subscriptions)
   * 
   * Syntax:
   * useEffect(() => {
   *   // Effect code
   *   return () => {
   *     // Cleanup code (optional)
   *   };
   * }, [dependencies]);
   * 
   * Dependencies array:
   * - [] = Run once on mount
   * - [value] = Run when value changes
   * - no array = Run on every render (usually bad!)
   */
  
  useEffect(() => {
    /**
     * COMPONENT MOUNT
     * 
     * This runs once when component appears
     * Perfect for:
     * - Initial data fetching
     * - Setting up subscriptions
     * - Connecting to WebSocket
     */
    
    // Mark component as mounted
    isMountedRef.current = true;
    
    // Fetch initial data
    fetchMovies();
    fetchParticipants();
    
    // Connect to WebSocket for real-time updates
    connectWebSocket();

    /**
     * CLEANUP FUNCTION
     * 
     * Return function runs when:
     * - Component unmounts (leaves screen)
     * - Before effect runs again (if dependencies change)
     * 
     * Important for:
     * - Closing connections
     * - Canceling timers
     * - Removing event listeners
     * - Preventing memory leaks
     */
    return () => {
      isMountedRef.current = false;
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close();
      }
    };
  }, []); // Empty array = run once on mount

  /**
   * ==========================================
   * WEBSOCKET FUNCTIONS
   * ==========================================
   */

  /**
   * Connect to WebSocket
   * 
   * WebSocket = persistent connection for real-time updates
   * 
   * Why WebSocket vs regular HTTP?
   * 
   * HTTP (Request-Response):
   * Client: "Any updates?"
   * Server: "Nope"
   * Client: "Any updates?" (1 second later)
   * Server: "Nope"
   * Client: "Any updates?" (1 second later)
   * Server: "Yes! Here's data"
   * = Wasteful, polling constantly
   * 
   * WebSocket (Persistent Connection):
   * Client: *connects*
   * Server: *sends update when ready*
   * = Efficient, instant updates
   */
  const connectWebSocket = () => {
    
    /**
     * Create WebSocket connection
     * 
     * URL format: ws://host:port/path
     * Our URL: ws://localhost:8000/ws/ABC123/user123
     */
    const ws = new WebSocket(
      `${WS_URL}/ws/${roomData.roomCode}/${roomData.userId}`
    );

    /**
     * WebSocket Event: onopen
     * 
     * Triggered when connection successfully opens
     */
    ws.onopen = () => {
    };

    /**
     * WebSocket Event: onmessage
     * 
     * Triggered when server sends a message
     * 
     * @param {MessageEvent} event - Contains message data
     */
    ws.onmessage = (event) => {
      try {
        /**
         * Parse JSON message
         * 
         * event.data is a string: '{"type":"vote_update","data":...}'
         * JSON.parse converts to object: {type: "vote_update", data: ...}
         */
        const message = JSON.parse(event.data);
        
        // Handle the message
        handleWebSocketMessage(message);
        
      } catch (err) {
        console.error('❌ Error parsing WebSocket message:', err);
      }
    };

    /**
     * WebSocket Event: onerror
     * 
     * Triggered when connection error occurs
     * Note: In React Strict Mode, some errors are expected during development
     * as the component mounts and unmounts twice
     */
    ws.onerror = (error) => {
      if (ws.readyState !== WebSocket.CLOSED) {
        console.error('❌ WebSocket error:', error);
      }
    };

    /**
     * WebSocket Event: onclose
     * 
     * Triggered when connection closes
     * Could be:
     * - User lost internet
     * - Server restarted
     * - Intentional disconnect
     */
    ws.onclose = () => {
      
      /**
       * Auto-reconnect after 3 seconds
       * 
       * Why?
       * - Network issues are often temporary
       * - User shouldn't have to refresh
       * - Provides better UX
       * 
       * setTimeout runs function after delay
       */
      setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    /**
     * Store WebSocket in ref
     * 
     * Why?
     * - Need to access it in cleanup function
     * - Need to close it when leaving room
     * - Ref persists across renders
     */
    websocketRef.current = ws;
  };

  /**
   * Handle incoming WebSocket messages
   * 
   * Different message types trigger different actions
   * 
   * @param {Object} message - Parsed message object
   */
  const handleWebSocketMessage = (message) => {
    /**
     * Switch statement for different message types
     * 
     * More readable than multiple if-else
     * Easy to add new message types
     */
    switch (message.type) {
      case 'connected':
        /**
         * Confirmation that we connected successfully
         * Receive initial state: participants and progress
         */
        if (message.participants) {
          setParticipants(message.participants);
        }
        if (message.progress) {
          setProgress(message.progress);
        }
        break;

      case 'vote_update':
        /**
         * Someone voted!
         * Update progress bar with fresh data
         */
        if (isMountedRef.current && message.progress) {
          setProgress(message.progress);
        }
        break;

      case 'user_joined':
        /**
         * New person joined the room
         * Update participant list and progress
         */
        if (message.participants) {
          setParticipants(message.participants);
          // Update progress with new participant count
          setProgress(prevProgress => ({
            ...prevProgress,
            participants: message.participants.length
          }));
        } else {
          fetchParticipants();
        }
        break;

      case 'user_left':
        /**
         * Someone left the room
         * Update participant list and progress
         */
        if (message.participants) {
          setParticipants(message.participants);
          // Update progress with new participant count
          setProgress(prevProgress => ({
            ...prevProgress,
            participants: message.participants.length
          }));
        } else {
          fetchParticipants();
        }
        break;

      default:
        /**
         * Unknown message type
         * Log it for debugging
         */
    }
  };

  /**
   * ==========================================
   * API FUNCTIONS
   * ==========================================
   */

  /**
   * Fetch movies for this room
   * 
   * Called once on component mount
   */
  const fetchMovies = async () => {
    try {

      
      const response = await fetch(
        `${API_URL}/api/rooms/${roomData.roomCode}/movies`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch movies');
      }

      const data = await response.json();

      
      // Only update if component is still mounted
      if (isMountedRef.current) {
        setMovies(data.movies);
        setProgress({
          ...progress,
          total_movies: data.movies.length
        });
        setIsLoading(false);
      }

    } catch (err) {
      console.error('❌ Error fetching movies:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load movies');
        setIsLoading(false);
      }
    }
  };

  /**
   * Fetch participants in this room
   * 
   * Called:
   * - On mount
   * - When someone joins/leaves (via WebSocket)
   */
  const fetchParticipants = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${roomData.roomCode}/participants`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch participants');
      }

      const data = await response.json();

      
      // Only update if component is still mounted
      if (isMountedRef.current) {
        setParticipants(data.participants);
      }

    } catch (err) {
      console.error('❌ Error fetching participants:', err);
    }
  };

  /**
   * Handle vote on current movie
   * 
   * @param {number} vote - 1 for YES, 0 for NO
   * 
   * Flow:
   * 1. Disable buttons (prevent double-voting)
   * 2. Send vote to backend
   * 3. Backend saves to database
   * 4. Backend broadcasts update via WebSocket
   * 5. Move to next movie
   * 6. Re-enable buttons
   */
  const handleVote = async (vote) => {
    const movie = movies[currentMovieIndex];

    
    // Disable voting during API call
    setIsVoting(true);

    try {
      const response = await fetch(`${API_URL}/api/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: roomData.userId,
          movie_id: movie.id,
          room_code: roomData.roomCode,
          vote: vote
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save vote');
      }

      const data = await response.json();
      
      // Update progress if provided
      if (data.progress) {
        setProgress(data.progress);
      }

      /**
       * Move to next movie
       * 
       * Check if more movies exist
       */
      if (currentMovieIndex < movies.length - 1) {
        // More movies to vote on
        setCurrentMovieIndex(currentMovieIndex + 1);
      } else {
        // All movies voted on!
        setVotingComplete(true);

      }

    } catch (err) {
      console.error('❌ Error voting:', err);
      setError(err.message || 'Failed to save vote');
    } finally {
      /**
       * finally block ALWAYS runs
       * 
       * Whether success or error:
       * - Re-enable voting buttons
       * - User can interact again
       */
      setIsVoting(false);
    }
  };

  /**
   * Fetch matched movies
   * 
   * Called when user clicks "See Results"
   * 
   * Finds movies where EVERYONE voted YES
   */
  const fetchMatches = async () => {
    try {

      
      const response = await fetch(
        `${API_URL}/api/rooms/${roomData.roomCode}/matches`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }

      const data = await response.json();

      
      // Only update if component is still mounted
      if (isMountedRef.current) {
        setMatches(data.matches);
        setShowResults(true);
      }

    } catch (err) {
      console.error('❌ Error fetching matches:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load results');
      }
    }
  };

  /**
   * View partial results (matches found so far)
   * Without completing all votes
   */
  const handleViewPartialResults = async () => {
    try {

      
      const response = await fetch(
        `${API_URL}/api/rooms/${roomData.roomCode}/matches`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }

      const data = await response.json();

      
      if (isMountedRef.current) {
        setMatches(data.matches);
        setShowPartialResults(true);
      }

    } catch (err) {
      console.error('❌ Error fetching partial matches:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load matches');
      }
    }
  };

  /**
   * Leave room and return to landing page
   * 
   * Cleanup:
   * - Close WebSocket connection
   * - Call parent's callback
   */
  const handleLeaveRoom = () => {

    
    // Close WebSocket
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    // Navigate back to landing page
    onLeaveRoom();
  };

  /**
   * Reset voting to start over
   * 
   * Allows voting on movies again
   */
  const handleResetVoting = () => {
    setCurrentMovieIndex(0);
    setVotingComplete(false);
    setShowResults(false);
    setMatches([]);
  };

  /**
   * ==========================================
   * COMPUTED VALUES
   * ==========================================
   * 
   * Calculate values based on state
   * Recalculated on every render
   */

  /**
   * Get current movie
   * 
   * Could be undefined if:
   * - Movies haven't loaded yet
   * - Index is out of bounds
   */
  const currentMovie = movies[currentMovieIndex];

  /**
   * Calculate progress percentage
   * 
   * Example:
   * currentMovieIndex = 4 (5th movie, 0-based)
   * movies.length = 20
   * Progress = (5 / 20) * 100 = 25%
   */
  const progressPercentage = movies.length > 0 
    ? ((currentMovieIndex + 1) / movies.length) * 100 
    : 0;
  /**
   * Why currentMovieIndex + 1?
   * 
   * currentMovieIndex is 0-based (0, 1, 2, ...)
   * Progress display is 1-based (1, 2, 3, ...)
   * 
   * When showing 1st movie (index 0):
   * - Progress should be "1 of 20" not "0 of 20"
   * - Percentage should be 5% not 0%
   */

  /**
   * ==========================================
   * RENDER COMPONENT
   * ==========================================
   */
  
  return (
    <div className="container">
      {/* HEADER */}
      <div className="header">
        <h1>🎬 Movie Night</h1>
        <p>Swipe to vote!</p>
      </div>

      <div className="content">
        {/* ROOM INFO BOX */}
        <div className="room-info">
          <div className="room-label">Room Code</div>
          <div 
            className="room-code"
            onClick={() => {
              // Copy room code to clipboard on click
              navigator.clipboard.writeText(roomData.roomCode);

            }}
            title="Click to copy"
          >
            {roomData.roomCode}
          </div>
          {/**
           * navigator.clipboard.writeText()
           * 
           * Browser API to copy text to clipboard
           * User can paste it anywhere
           * Great UX - easy sharing!
           */}
          
          <div className="participants">
            👥 {participants.length}{' '}
            {participants.length === 1 ? 'person' : 'people'} in room
          </div>
          {/**
           * Ternary for singular/plural
           * 
           * 1 person = "1 person in room"
           * 2+ people = "2 people in room"
           * 
           * Better grammar!
           */}
        </div>

        {/* 
          CONDITIONAL RENDERING
          
          Show different content based on state:
          1. Loading → LoadingSpinner
          2. ShowResults → Results page
          3. VotingComplete → "All done" message
          4. Has currentMovie → MovieCard
          5. Else → Nothing
        */}

        {isLoading ? (
          /* STATE 1: LOADING */
          <LoadingSpinner message="Loading movies..." />
          
        ) : showResults ? (
          /* STATE 2: SHOWING RESULTS */
          <div>
            {/* Success banner */}
            <div className="match-found">
              <h2>
                🎉 {matches.length}{' '}
                {matches.length === 1 ? 'Movie' : 'Movies'} Match!
              </h2>
              <p>Everyone voted YES on these</p>
            </div>

            {/* Check if any matches */}
            {matches.length === 0 ? (
              /* No matches found */
              <div className="all-voted">
                <p>No matches found! 😢</p>
                <p>Try voting on more movies or being less picky! 😄</p>
              </div>
            ) : (
              /* Show matched movies */
              <div className="matched-movies">
                {/**
                 * .map() to render list
                 * 
                 * Array method that transforms each item
                 * Perfect for rendering lists in React
                 * 
                 * matches.map(movie => <Component />)
                 * 
                 * Returns new array of React elements
                 */}
                {matches.map((movie) => (
                  <div key={movie.id} className="matched-movie">
                    {/**
                     * key prop is REQUIRED in lists
                     * 
                     * Why?
                     * - React uses keys to track which items changed
                     * - Optimizes re-rendering
                     * - Should be unique and stable
                     * 
                     * Good keys: movie.id, user.id
                     * Bad keys: array index (can change)
                     */}
                    
                    {/* Movie poster */}
                    <img 
                      src={movie.poster_path} 
                      alt={movie.title}
                      className="matched-poster"
                    />
                    
                    {/* Movie info */}
                    <div className="matched-info">
                      <h3>{movie.title}</h3>
                      <div className="movie-info">
                        ⭐ {movie.vote_average}/10 • {' '}
                        {movie.release_date?.split('-')[0]}
                      </div>
                      {/**
                       * Optional chaining: movie.release_date?.split()
                       * 
                       * If release_date is null/undefined:
                       * - Doesn't crash
                       * - Returns undefined
                       * 
                       * Without ?. :
                       * movie.release_date.split() → ERROR if null
                       * 
                       * With ?. :
                       * movie.release_date?.split() → undefined if null
                       */}
                      
                      <div className="movie-info">
                        {movie.overview?.substring(0, 100)}...
                      </div>
                      {/**
                       * .substring(0, 100)
                       * 
                       * Gets first 100 characters
                       * Keeps description short
                       * Prevents huge text blocks
                       */}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Vote again button */}
            <button 
              className="btn btn-create" 
              onClick={handleResetVoting}
            >
              Vote on More Movies
            </button>
          </div>

        ) : votingComplete ? (
          /* STATE 3: VOTING COMPLETE */
          <div className="all-voted">
            <h2>🎉 All Done!</h2>
            <p>You've voted on all movies</p>
            <button 
              className="btn btn-create" 
              onClick={fetchMatches}
            >
              See Results
            </button>
          </div>

        ) : currentMovie ? (
          /* STATE 4: SHOWING CURRENT MOVIE */
          <div>
            {/* Movie card with vote buttons */}
            <MovieCard 
              movie={currentMovie} 
              onVote={handleVote} 
              isVoting={isVoting}
            />

            {/* Progress info */}
            <div className="progress-info">
              {/* Text: "Movie 5 of 20" */}
              <div className="progress-text">
                Movie {currentMovieIndex + 1} of {movies.length}
              </div>

              {/* Progress bar */}
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progressPercentage}%` }}
                />
                {/**
                 * Inline styles in React
                 * 
                 * HTML: style="width: 50%"
                 * JSX: style={{ width: '50%' }}
                 * 
                 * Double curly braces:
                 * - Outer {} = JavaScript expression
                 * - Inner {} = JavaScript object
                 * 
                 * style={{width: `${progressPercentage}%`}}
                 * If progressPercentage = 50:
                 * Becomes: style={{width: '50%'}}
                 */}
              </div>

              {/* Vote status text */}
              <div className="vote-status">
                {progress.movies_with_all_votes} of{' '}
                {progress.total_movies} movies completed by all
              </div>

              {/* View partial results button */}
              <button 
                className="btn btn-secondary"
                onClick={handleViewPartialResults}
                style={{ marginTop: '20px' }}
              >
                👀 View Matches So Far ({progress.movies_with_all_votes})
              </button>
            </div>
          </div>

        ) : null}
        {/**
         * null renders nothing
         * 
         * Useful for conditional rendering
         * When you don't want to show anything
         */}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* LEAVE ROOM BUTTON */}
        <button 
          className="btn btn-secondary" 
          onClick={handleLeaveRoom}
          style={{ marginTop: '20px' }}
        >
          Leave Room
        </button>

        {/* PARTIAL RESULTS MODAL */}
        {showPartialResults && (
          <div className="modal-overlay" onClick={() => setShowPartialResults(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>👀 Matches So Far</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowPartialResults(false)}
                >
                  ✕
                </button>
              </div>

              {matches.length > 0 ? (
                <div>
                  <p style={{ marginBottom: '20px' }}>
                    {matches.length} {matches.length === 1 ? 'movie' : 'movies'} where everyone voted YES
                  </p>
                  <div className="matched-movies">
                    {matches.map((movie) => (
                      <div key={movie.id} className="matched-card">
                        <img 
                          src={movie.poster_path} 
                          alt={movie.title}
                          className="matched-poster"
                        />
                        <div className="matched-info">
                          <h3>{movie.title}</h3>
                          <div className="movie-info">
                            ⭐ {movie.vote_average}/10 • {' '}
                            {movie.release_date?.split('-')[0]}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowPartialResults(false)}
                    style={{ marginTop: '20px', width: '100%' }}
                  >
                    Continue Voting
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p>No unanimous matches yet...</p>
                  <p>Keep voting! 🍿</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowPartialResults(false)}
                    style={{ marginTop: '20px' }}
                  >
                    Back to Voting
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomPage;

/**
 * ==========================================
 * COMPONENT SUMMARY
 * ==========================================
 * 
 * RoomPage handles:
 * ✅ Loading movies from API
 * ✅ Displaying current movie
 * ✅ Voting mechanism
 * ✅ Progress tracking
 * ✅ Real-time updates via WebSocket
 * ✅ Participant management
 * ✅ Results display
 * ✅ Error handling
 * ✅ Leave room functionality
 * 
 * State flow:
 * 1. Component mounts
 * 2. Fetch movies & participants
 * 3. Connect WebSocket
 * 4. Display first movie
 * 5. User votes → API call
 * 6. Move to next movie
 * 7. Repeat 5-6 until done
 * 8. Show results
 * 
 * WebSocket flow:
 * 1. Connect on mount
 * 2. Listen for messages
 * 3. Update UI based on messages
 * 4. Reconnect if disconnected
 * 5. Close on unmount
 */