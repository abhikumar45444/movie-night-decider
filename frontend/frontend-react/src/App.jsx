import React, { useState } from 'react';
import './App.css';
import LandingPage from './Components/LandingPage';
import RoomPage from './Components/RoomPage';

function App() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [roomData, setRoomData] = useState(null);

  const goToRoom = (data) => {
    setRoomData(data);
    setCurrentPage('room');
  };

  const goToLanding = () => {
    setRoomData(null);
    setCurrentPage('landing');
  };

  return (
    <div className="container">
      {currentPage === 'landing' ? (
        <LandingPage onJoinRoom={goToRoom} />
      ) : (
        <RoomPage roomData={roomData} onLeaveRoom={goToLanding} />
      )}
    </div>
  );
}

export default App;