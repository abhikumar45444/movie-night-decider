import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * LANDING PAGE COMPONENT
 * 
 * First page users see
 * Two main actions:
 * 1. Create a new room
 * 2. Join an existing room
 * 
 * Props:
 * @param {function} onJoinRoom - Callback when user successfully joins a room
 *                                 Receives: {userId, username, roomCode}
 * 
 * State Management:
 * - roomCode: User's input for room code
 * - username: User's input for display name
 * - isCreating: Boolean - is create room in progress?
 * - isJoining: Boolean - is join room in progress?
 * - error: String - error message to display
 */
function LandingPage({ onJoinRoom }) {
  /**
   * LOCAL STATE
   * 
   * useState Hook:
   * const [value, setValue] = useState(initialValue)
   * 
   * - value: current state value
   * - setValue: function to update the value
   * - initialValue: starting value
   * 
   * When setValue is called, React re-renders the component!
   */
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  /**
   * API Configuration
   * In production, use environment variable:
   * const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
   */
  const API_URL = import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:8000';

  /**
   * CREATE ROOM HANDLER
   * 
   * Flow:
   * 1. Set loading state (show spinner)
   * 2. Call backend API to create room
   * 3. Generate random username
   * 4. Join the newly created room
   * 5. On success: parent component navigates to room page
   * 6. On error: show error message
   */
  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError('');

    try {
      // Call create room API
      const response = await fetch(`${API_URL}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      /**
       * response.ok
       * - true if status code 200-299
       * - false if 400, 404, 500, etc.
       */
      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      /**
       * Parse JSON response
       * Backend returns: {room_code: "ABC123", message: "..."}
       */
      const data = await response.json();
      
      /**
       * Generate random username
       * Math.random() generates 0-0.999...
       * Multiply by 1000 = 0-999.999...
       * Math.floor() rounds down = 0-999
       * Result: "User0" to "User999"
       */
      const generatedUsername = `User${Math.floor(Math.random() * 1000)}`;

      // Join the room we just created
      await joinExistingRoom(data.room_code, generatedUsername);

    } catch (err) {
      /**
       * Error handling
       * err.message: "Failed to create room" or network error
       * Display to user
       */
      setError(err.message || 'Failed to create room');
      setIsCreating(false);
    }
  };

  /**
   * JOIN ROOM HANDLER
   * 
   * Called when user submits the join form
   * 
   * @param {Event} e - Form submit event
   */
  const handleJoinRoom = async (e) => {
    e.preventDefault();
    
    /**
     * e.preventDefault()
     * 
     * Why?
     * - Forms normally submit and reload page
     * - We're handling submission with JavaScript
     * - preventDefault() stops the default behavior
     * - Keeps everything smooth (no page reload!)
     */

    /**
     * VALIDATION
     * 
     * Check user input before making API call
     * Saves unnecessary network requests
     * Provides immediate feedback
     */
    
    // Check if fields are empty
    if (!roomCode.trim() || !username.trim()) {
      setError('Please enter both room code and username');
      return; // Exit function early
    }

    /**
     * .trim() removes whitespace from both ends
     * "  ABC123  " becomes "ABC123"
     * Prevents users from entering just spaces
     */

    // Check room code length
    if (roomCode.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }

    // Start loading state
    setIsJoining(true);
    setError('');

    /**
     * .toUpperCase() converts to capitals
     * "abc123" becomes "ABC123"
     * Ensures consistency with backend
     */
    await joinExistingRoom(roomCode.toUpperCase(), username.trim());
  };

  /**
   * JOIN EXISTING ROOM
   * 
   * Core function used by both:
   * - Create room (joins own room)
   * - Join room (joins someone else's room)
   * 
   * @param {string} code - 6-character room code
   * @param {string} name - User's display name
   */
  const joinExistingRoom = async (code, name) => {
    try {
      const response = await fetch(`${API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_code: code,
          username: name
        })
      });

      /**
       * JSON.stringify()
       * 
       * Converts JavaScript object to JSON string
       * 
       * Input: {room_code: "ABC123", username: "John"}
       * Output: '{"room_code":"ABC123","username":"John"}'
       * 
       * Backend expects JSON string in request body
       */

      /**
       * Handle different error types
       */
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Room not found');
        }
        throw new Error('Failed to join room');
      }

      /**
       * Success! Parse response
       * Backend returns: {user_id: "...", username: "...", room_code: "..."}
       */
      const data = await response.json();

      /**
       * Save to localStorage
       * 
       * Why?
       * - Survives page refresh
       * - Can restore session if user accidentally refreshes
       * - Simple browser storage (no database needed)
       * 
       * localStorage API:
       * - setItem(key, value) - save
       * - getItem(key) - retrieve
       * - removeItem(key) - delete
       * - clear() - delete all
       */
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('username', data.username);
      localStorage.setItem('roomCode', data.room_code);

      /**
       * Call parent component's callback
       * 
       * This tells App.jsx to:
       * 1. Store room data
       * 2. Navigate to room page
       * 
       * Props flow:
       * App.jsx passes onJoinRoom → LandingPage receives it → calls it with data
       */
      onJoinRoom({
        userId: data.user_id,
        username: data.username,
        roomCode: data.room_code
      });

    } catch (err) {
      /**
       * Error handling
       * Show error and reset loading states
       */
      setError(err.message || 'Failed to join room');
      setIsJoining(false);
      setIsCreating(false);
    }
  };

  /**
   * JSX RETURN
   * 
   * This is what gets rendered to the screen
   * Looks like HTML but it's JSX (JavaScript XML)
   * 
   * Key differences from HTML:
   * - className instead of class
   * - htmlFor instead of for
   * - onClick instead of onclick
   * - Curly braces {} for JavaScript expressions
   * - camelCase for attributes (onClick not onclick)
   */
  return (
    <div className="container">
      {/* HEADER SECTION */}
      <div className="header">
        <h1>🎬 Movie Night</h1>
        <p>Find the perfect movie together</p>
      </div>

      <div className="content">
        {/* 
          CREATE ROOM SECTION 
          
          Conditional rendering: {condition ? <A/> : <B/>}
          If isCreating is true, show LoadingSpinner
          If isCreating is false, show button
        */}
        {isCreating ? (
          <LoadingSpinner message="Creating room..." />
        ) : (
          <button 
            className="btn btn-create" 
            onClick={handleCreateRoom}
          >
            Create New Room
          </button>
        )}

        {/* DIVIDER */}
        <div className="divider">OR</div>

        {/* 
          JOIN ROOM FORM 
          
          onSubmit triggers when:
          - User clicks submit button
          - User presses Enter in an input
        */}
        <form onSubmit={handleJoinRoom}>
          {/* ROOM CODE INPUT */}
          <div className="input-group">
            <label htmlFor="roomCode">Enter Room Code</label>
            <input
              type="text"
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g., ABC123"
              maxLength={6}
              disabled={isJoining}
            />
            {/**
             * CONTROLLED COMPONENT
             * 
             * value={roomCode}
             * - React controls the input value
             * - Input displays what's in state
             * 
             * onChange={(e) => setRoomCode(e.target.value)}
             * - When user types, update state
             * - e.target.value = what user typed
             * 
             * This is "controlled" because React is the source of truth
             * 
             * Alternative (uncontrolled):
             * <input /> with no value prop
             * Access value later with ref or e.target.value
             * But controlled is preferred in React!
             */}
          </div>

          {/* USERNAME INPUT */}
          <div className="input-group">
            <label htmlFor="username">Your Name</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              disabled={isJoining}
            />
          </div>

          {/* JOIN BUTTON OR LOADING */}
          {isJoining ? (
            <LoadingSpinner message="Joining room..." />
          ) : (
            <button type="submit" className="btn btn-join">
              Join Room
            </button>
          )}
        </form>

        {/* 
          ERROR MESSAGE 
          
          Conditional rendering: {condition && <Component/>}
          If error is truthy (not empty string), render div
          If error is falsy (empty string), render nothing
          
          Shorthand for: {error ? <div>...</div> : null}
        */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default LandingPage;

/**
 * COMPONENT LIFECYCLE
 * 
 * 1. Component mounts (appears on screen)
 * 2. Initial render with default state
 * 3. User interacts (types, clicks)
 * 4. State updates via setState functions
 * 5. Component re-renders with new state
 * 6. Repeat steps 3-5 as needed
 * 7. Component unmounts (leaves screen)
 * 
 * React automatically handles re-rendering!
 * You just update state, React does the rest!
 */