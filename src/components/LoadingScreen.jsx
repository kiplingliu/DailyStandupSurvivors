import React, { useEffect, useState } from 'react';
import '../styles/LoadingScreen.css';

const LoadingScreen = ({ onLoadingComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onLoadingComplete();
      }, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onLoadingComplete]);

  return (
    <div className={`loading-screen ${!isVisible ? 'fade-out' : ''}`}>
      <div className="loading-content">
        <img 
          src="/img/Rendezview_logo.svg" 
          alt="RendezView Logo" 
          className="loading-logo"
        />
      </div>
    </div>
  );
};

export default LoadingScreen; 