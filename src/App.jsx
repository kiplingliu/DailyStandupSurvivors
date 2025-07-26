import React, { useState } from 'react';
import LoadingScreen from './components/LoadingScreen';
import HomePage from './pages/HomePage';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  return (
    <div className="App">
      {isLoading ? (
        <LoadingScreen onLoadingComplete={handleLoadingComplete} />
      ) : (
        <HomePage />
      )}
    </div>
  );
}

export default App;
