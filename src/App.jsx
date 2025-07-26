import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoadingScreen from './components/LoadingScreen';
import HomePage from './pages/HomePage';
import RendezvousMapPage from './pages/RendezvousMapPage';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = () => {
    setIsLoading(false);
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
        </Routes>
      </Router>
    </div>
  );
}

export default App;
