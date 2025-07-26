import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoadingScreen from './components/LoadingScreen';
import HomePage from './pages/HomePage';
import RendezvousMapPage from './pages/RendezvousMapPage';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = () => {
    setIsLoading(false);
    // Always redirect to home page after loading
    window.history.replaceState({}, '', '/');
  };

  if (isLoading) {
    return (
      <div className="App">
        <LoadingScreen onLoadingComplete={handleLoadingComplete} />
      </div>
    );
  }

  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rendezvous/:rendezvousData" element={<RendezvousMapPage />} />
          {/* Redirect any other routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
