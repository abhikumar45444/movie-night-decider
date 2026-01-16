import React from 'react';

/**
 * LOADING SPINNER COMPONENT
 * 
 * Reusable spinner component
 * Shows when data is loading
 * 
 * Props:
 * - message: Text to show below spinner (optional)
 */
function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
}

export default LoadingSpinner;