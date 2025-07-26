import React from 'react';
import '../styles/HomePage.css';

const HomePage = () => {
  return (
    <div className="home-page">
      <header className="header">
        <div className="header-content">
          <h1 className="app-title">Daily Standup Survivors</h1>
          <p className="app-subtitle">Social Meetup Planner</p>
        </div>
      </header>
      
      <main className="main-content">
        <div className="welcome-section">
          <h2 className="welcome-title">Welcome to Your Meetup Hub</h2>
          <p className="welcome-text">
            Plan, discover, and join amazing social meetups in your area.
          </p>
        </div>
        
        <div className="placeholder-section">
          <div className="placeholder-card">
            <h3>🚀 Coming Soon</h3>
            <p>Map integration, meetup creation, and social features will be added here.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage; 