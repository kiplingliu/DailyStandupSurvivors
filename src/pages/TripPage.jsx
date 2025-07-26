import React, { useState } from 'react';
import { createTrip } from '../services/firebase/firestoreService';
import { useNavigate } from 'react-router-dom';
import '../styles/TripPage.css'; // We'll create this CSS file later

const TripPage = () => {
  const [tripName, setTripName] = useState('');
  const [userName, setUserName] = useState('');
  const [tripLink, setTripLink] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setError('');
    setTripLink('');

    if (!tripName || !userName) {
      setError('Please enter both trip name and your name.');
      return;
    }

    try {
      // For now, we'll use a placeholder for initialLocation.
      // In a real app, you'd get this from the user's current location.
      const initialLocation = { latitude: 0, longitude: 0 }; 
      const tripId = await createTrip(tripName, userName, initialLocation);
      const link = `${window.location.origin}/trip/${tripId}`;
      setTripLink(link);
      // Optionally navigate to the trip details page or show a success message
      // navigate(`/trip/${tripId}`); 
    } catch (err) {
      console.error("Error creating trip:", err);
      setError(err.message || "Failed to create trip.");
    }
  };

  return (
    <div className="trip-page">
      <header className="header">
        <h1 className="app-title">Create a New Trip</h1>
      </header>
      <main className="main-content">
        <form onSubmit={handleCreateTrip} className="trip-form">
          <div className="form-group">
            <label htmlFor="tripName">Trip Name:</label>
            <input
              type="text"
              id="tripName"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="e.g., Weekend Getaway"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="userName">Your Name:</label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g., John Doe"
              required
            />
          </div>
          <button type="submit" className="create-trip-button">Create Trip</button>
        </form>

        {tripLink && (
          <div className="trip-link-section">
            <h2>Your Trip Link:</h2>
            <p>Share this link with your friends:</p>
            <a href={tripLink} target="_blank" rel="noopener noreferrer" className="shareable-link">
              {tripLink}
            </a>
            <button onClick={() => navigator.clipboard.writeText(tripLink)} className="copy-button">
              Copy Link
            </button>
          </div>
        )}

        {error && <p className="error-message">{error}</p>}
      </main>
    </div>
  );
};

export default TripPage;