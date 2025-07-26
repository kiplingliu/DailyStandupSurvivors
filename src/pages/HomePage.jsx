import React, { useState } from 'react';
import '../styles/HomePage.css';

const HomePage = () => {
  const [showModal, setShowModal] = useState(false);
  const [meetupForm, setMeetupForm] = useState({
    name: '',
    time: '',
    location: '',
    useCurrentLocation: false
  });

  // Fake meetups data
  const currentMeetups = [
    {
      id: 1,
      name: "Coffee & Code Morning",
      time: "9:00 AM - 11:00 AM",
      location: "Starbucks Downtown"
    },
    {
      id: 2,
      name: "Lunch Networking",
      time: "12:30 PM - 2:00 PM",
      location: "Central Park Food Court"
    },
    {
      id: 3,
      name: "Evening Walk & Talk",
      time: "6:00 PM - 7:30 PM",
      location: "Riverside Trail"
    },
    {
      id: 4,
      name: "Tech Meetup",
      time: "7:00 PM - 9:00 PM",
      location: "Innovation Hub"
    }
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMeetupForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // For demo purposes, we'll just show coordinates
          // In a real app, you'd reverse geocode this to get an address
          setMeetupForm(prev => ({
            ...prev,
            location: `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            useCurrentLocation: true
          }));
        },
        (error) => {
          alert('Unable to get your location. Please enter manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('New meetup:', meetupForm);
    // Here you would typically save to a database
    alert('Meetup created successfully!');
    setShowModal(false);
    setMeetupForm({ name: '', time: '', location: '', useCurrentLocation: false });
  };

  return (
    <div className="home-page">
      <header className="header">
        <div className="header-content">
          <div className="app-brand">
            <h1 className="app-title">RendezvView</h1>
            <h2 className="welcome-title">Welcome, Jayvee!</h2>
          </div>
        </div>
      </header>
      
      <main className="main-content">
        <div className="meetups-section">
          <div className="meetups-header">
            <h3 className="section-title">Current Meetups</h3>
            <button 
              className="create-meetup-btn"
              onClick={() => setShowModal(true)}
            >
              + Create Meetup
            </button>
          </div>
          
          <div className="meetups-list">
            {currentMeetups.map(meetup => (
              <div key={meetup.id} className="meetup-card">
                <div className="meetup-info">
                  <h4 className="meetup-name">{meetup.name}</h4>
                  <p className="meetup-time">{meetup.time}</p>
                  <p className="meetup-location">{meetup.location}</p>
                </div>
                <div className="meetup-actions">
                  <button className="action-btn">Join</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Create Meetup Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Meetup</h3>
              <button 
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="meetup-form">
              <div className="form-group">
                <label htmlFor="name">Meetup Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={meetupForm.name}
                  onChange={handleInputChange}
                  placeholder="Enter meetup name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="time">Time</label>
                <input
                  type="datetime-local"
                  id="time"
                  name="time"
                  value={meetupForm.time}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <div className="location-input-group">
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={meetupForm.location}
                    onChange={handleInputChange}
                    placeholder="Enter location or use current location"
                    required
                  />
                  <button
                    type="button"
                    className="location-btn"
                    onClick={handleGetCurrentLocation}
                  >
                    📍
                  </button>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Create Meetup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage; 