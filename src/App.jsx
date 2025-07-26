import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoadingScreen from './components/LoadingScreen';
import HomePage from './pages/HomePage';
import TripPage from './pages/TripPage';
import { ensureSignedIn } from './services/firebase/authService'; // Import ensureSignedIn
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const authenticateUser = async () => {
      try {
        await ensureSignedIn();
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Authentication failed:", error);
        // Handle authentication error, maybe show an error message
      } finally {
        setIsLoading(false);
      }
    };

    authenticateUser();
  }, []);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <div className="App">
      {isAuthenticated ? (
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create-trip" element={<TripPage />} />
          <Route path="/trip/:tripId" element={<TripPage />} />
        </Routes>
      ) : (
        <div className="auth-error">
          <p>Authentication required. Please refresh the page or check your internet connection.</p>
        </div>
      )}
    </div>
  );
}

export default App;
