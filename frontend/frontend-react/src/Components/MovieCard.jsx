import React from 'react';

/**
 * MOVIE CARD COMPONENT
 * 
 * Displays a single movie with:
 * - Poster image
 * - Title
 * - Rating, year, genres
 * - Overview/description
 * - Vote buttons (YES/NO)
 * 
 * Props:
 * @param {Object} movie - Movie object from TMDB API
 *   - id: Movie ID
 *   - title: Movie title
 *   - poster_path: Full URL to poster image
 *   - vote_average: Rating (0-10)
 *   - release_date: Release date (YYYY-MM-DD)
 *   - genres: Array of genre strings
 *   - overview: Movie description
 * 
 * @param {function} onVote - Callback when user votes
 *   - Called with: 1 for YES, 0 for NO
 * 
 * @param {boolean} isVoting - Is a vote in progress?
 *   - Disables buttons while voting
 *   - Prevents double-voting
 * 
 * Usage:
 * <MovieCard 
 *   movie={currentMovie} 
 *   onVote={(vote) => handleVote(vote)} 
 *   isVoting={isVoting}
 * />
 */
function MovieCard({ movie, onVote, isVoting }) {
  /**
   * EXTRACT DATA FROM MOVIE OBJECT
   * 
   * Destructuring with default values
   */
  
  /**
   * Extract year from release_date
   * 
   * movie.release_date = "2010-07-16"
   * .split('-') = ["2010", "07", "16"]
   * [0] = "2010"
   * 
   * If release_date is null/undefined, use "Unknown"
   */
  const releaseYear = movie.release_date 
    ? movie.release_date.split('-')[0] 
    : 'Unknown';

  /**
   * Format genres array
   * 
   * movie.genres = ["Action", "Sci-Fi", "Thriller"]
   * .join(', ') = "Action, Sci-Fi, Thriller"
   * 
   * If genres is empty or missing, use "Unknown"
   */
  const genres = movie.genres && movie.genres.length > 0 
    ? movie.genres.join(', ') 
    : 'Unknown';

  /**
   * RENDER COMPONENT
   */
  return (
    <div className="movie-card">
      {/* POSTER IMAGE */}
      <div className="movie-poster-container">
        <img
          src={movie.poster_path || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="750"%3E%3Crect width="500" height="750" fill="%23333"/%3E%3Ctext x="50%25" y="50%25" font-size="24" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Poster Available%3C/text%3E%3C/svg%3E'}
          alt={movie.title}
          className="movie-poster"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="750"%3E%3Crect width="500" height="750" fill="%23333"/%3E%3Ctext x="50%25" y="50%25" font-size="24" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3EImage Failed%3C/text%3E%3C/svg%3E';
          }}
        />
        {/**
         * alt attribute is important!
         * - Screen readers read it to blind users
         * - Shows if image fails to load
         * - SEO (search engines use it)
         * - Accessibility best practice
         * 
         * onError: If image fails to load, show SVG placeholder instead
         */}
      </div>

      {/* MOVIE TITLE */}
      <div className="movie-title">{movie.title}</div>

      {/* MOVIE INFO BAR */}
      <div className="movie-info">
        <span>⭐ {movie.vote_average}/10</span>
        <span>{releaseYear}</span>
        <span>{genres}</span>
      </div>

      {/* MOVIE DESCRIPTION */}
      <div className="movie-overview">
        {movie.overview || 'No description available'}
        {/**
         * || operator (OR)
         * 
         * If movie.overview is falsy (empty, null, undefined):
         *   Use 'No description available'
         * Otherwise:
         *   Use movie.overview
         */}
      </div>

      {/* VOTE BUTTONS */}
      <div className="vote-buttons">
        {/* NO BUTTON */}
        <button
          className="vote-btn vote-no"
          onClick={() => onVote(0)}
          disabled={isVoting}
        >
          ❌ Nope
        </button>

        {/* YES BUTTON */}
        <button
          className="vote-btn vote-yes"
          onClick={() => onVote(1)}
          disabled={isVoting}
        >
          ✅ Yes!
        </button>

        {/**
         * onClick={() => onVote(1)}
         * 
         * Arrow function needed here!
         * 
         * WRONG: onClick={onVote(1)}
         * - This CALLS onVote immediately
         * - onVote runs during render
         * - Button doesn't work!
         * 
         * CORRECT: onClick={() => onVote(1)}
         * - This creates a function
         * - Function is called when button is clicked
         * - onVote runs at the right time!
         * 
         * Alternative:
         * onClick={handleYesClick}
         * 
         * const handleYesClick = () => {
         *   onVote(1);
         * }
         */}
      </div>
    </div>
  );
}

export default MovieCard;

/**
 * WHY SEPARATE COMPONENT?
 * 
 * Benefits:
 * 1. REUSABILITY
 *    - Could show multiple movies at once
 *    - Could use in different pages
 *    - Easy to create movie browsing features
 * 
 * 2. MAINTAINABILITY
 *    - Movie display logic in one place
 *    - Easy to update styling
 *    - Easy to add features (like favorites)
 * 
 * 3. TESTABILITY
 *    - Can test MovieCard in isolation
 *    - Mock different movie data
 *    - Test voting behavior
 * 
 * 4. READABILITY
 *    - Parent component stays clean
 *    - <MovieCard movie={m} /> vs 50 lines of JSX
 *    - Clear separation of concerns
 */

/**
 * PROPS EXPLANATION
 * 
 * Props flow down (parent → child)
 * Events flow up (child → parent via callbacks)
 * 
 * Parent (RoomPage):
 * <MovieCard 
 *   movie={currentMovie}        ← Data flows down
 *   onVote={handleVote}         ← Callback flows down
 *   isVoting={isVoting}         ← State flows down
 * />
 * 
 * Child (MovieCard):
 * function MovieCard({ movie, onVote, isVoting }) {
 *   // Use props
 *   return <button onClick={() => onVote(1)} />
 *   // Event flows up ↑
 * }
 * 
 * This is "unidirectional data flow"
 * - Makes apps predictable
 * - Easy to debug
 * - Core React principle
 */