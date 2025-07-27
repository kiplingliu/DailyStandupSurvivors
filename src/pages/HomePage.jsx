import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space } from 'antd';
import '../styles/HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    datetime: '',
    location: '',
    transportation: 'car',
    useCurrentLocation: false
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const suggestionsRef = useRef(null);

  // ArcGIS API key
  const ARCGIS_API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurL6nxPIkajIUT_yWL44ecbAWd5Fs0xSXmPreZMEXzk6HSmBOc05PQbjX0cRXkfIwDMzyPeHaM_i8CHGCGigW4zmUKkyD-wgJ3m8k7lHsQ8NLmgiHhoXsN01cGdjAnAxLn3WOs5udBwQAA1iXwjWeGvGyD7OIeZhfUhOpAFYLF496OL1wEqBy-oV-tlvQrfVgRnuRMeHAPeoVf2OfPFytoFk6E0mTNJfpj2gbE1Z9fxpYAT1_8TEW7Qkn";

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Handle address search when typing in location field - search on any input
    if (name === 'location' && value.trim().length > 0) {
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Very fast response for immediate suggestions
      searchTimeoutRef.current = setTimeout(() => {
        searchAddresses(value);
      }, 100);
    } else if (name === 'location' && value.trim().length === 0) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const searchAddresses = async (searchText) => {
    if (!searchText || searchText.trim().length === 0) return;
    
    setIsSearching(true);
    
    try {
      // Load ArcGIS modules
      const locator = await new Promise((resolve) => {
        window.require(['esri/rest/locator'], resolve);
      });

      const serviceUrl = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      
      const params = {
        text: searchText,
        maxSuggestions: 10,
        category: "Address",
        apiKey: ARCGIS_API_KEY
      };

      const response = await locator.suggestLocations(serviceUrl, params);
      
      if (response && response.length > 0) {
        // suggestLocations returns suggestion objects with text and magicKey
        const suggestions = response.map(result => ({
          address: result.text,
          magicKey: result.magicKey,
          isCollection: result.isCollection || false
        }));
        
        setSearchSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Address search failed:', error);
      setSearchSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionClick = async (suggestion) => {
    // Set the address immediately for better UX
    setFormData(prev => ({
      ...prev,
      location: suggestion.address,
      useCurrentLocation: false
    }));
    setSearchSuggestions([]);
    setShowSuggestions(false);
    
    // Optionally geocode the selected suggestion to get coordinates
    // This happens in the background for future use
    try {
      const locator = await new Promise((resolve) => {
        window.require(['esri/rest/locator'], resolve);
      });

      const serviceUrl = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      
      const params = {
        address: {
          SingleLine: suggestion.address
        },
        magicKey: suggestion.magicKey,
        apiKey: ARCGIS_API_KEY
      };

      await locator.addressToLocations(serviceUrl, params);
      // We could store the coordinates here if needed for future features
    } catch (error) {
      console.error('Failed to geocode selected address:', error);
      // Not critical - the address text is already set
    }
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      // Load ArcGIS modules using window.require
      const locator = await new Promise((resolve) => {
        window.require(['esri/rest/locator'], resolve);
      });

      const serviceUrl = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      
      const params = {
        location: {
          x: longitude,
          y: latitude,
          spatialReference: { wkid: 4326 }
        },
        apiKey: ARCGIS_API_KEY
      };

      const response = await locator.locationToAddress(serviceUrl, params);
      
      if (response && response.address) {
        return response.address;
      } else {
        throw new Error('No address found');
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      throw error;
    }
  };

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setIsGettingLocation(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      
      try {
        // Use ArcGIS reverse geocoding to get the address
        const address = await reverseGeocode(latitude, longitude);
        
        setFormData(prev => ({
          ...prev,
          location: address,
          useCurrentLocation: true
        }));
      } catch {
        // Fallback to coordinates if reverse geocoding fails
        setFormData(prev => ({
          ...prev,
          location: `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          useCurrentLocation: true
        }));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      alert('Unable to get your location. Please enter manually.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('New rendezvous:', formData);
    
    // Encode the rendezvous data to pass via URL
    const rendezvousData = encodeURIComponent(JSON.stringify(formData));
    
    // Navigate to the map page
    navigate(`/rendezvous/${rendezvousData}`);
    
    // Reset form
    setShowForm(false);
    setFormData({ name: '', datetime: '', location: '', transportation: 'car', useCurrentLocation: false });
    setSearchSuggestions([]);
    setShowSuggestions(false);
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ name: '', datetime: '', location: '', transportation: 'car', useCurrentLocation: false });
    setSearchSuggestions([]);
    setShowSuggestions(false);
  };

  // Handle click outside suggestions to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setSearchSuggestions([]);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="home-page">
      <div className="header">
        <img
          src="/img/Rendezview_logo2-01.svg"
          alt="RendezView Logo"
          className="app-logo"
        />
        <p className="welcome-message">Welcome, Jayvee!</p>
      </div>

      {!showForm ? (
        <button
          className="create-rendezvous-btn"
          onClick={() => setShowForm(true)}
        >
          + Let's rendezview!
        </button>
      ) : (
        <div className="rendezvous-form-container">
          <form onSubmit={handleSubmit} className="rendezvous-form">
            <h3 className="form-title">Let's rendezview!</h3>
            
            <div className="form-group">
              <label htmlFor="name">Rendezview Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="What's the plan?"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="datetime">Date & Time</label>
              <input
                type="datetime-local"
                id="datetime"
                name="datetime"
                value={formData.datetime}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="transportation">Mode of Transportation</label>
              <select
                id="transportation"
                name="transportation"
                value={formData.transportation}
                onChange={handleInputChange}
                required
              >
                <option value="car">Car</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="location">Leaving From</label>
              <div className="location-input-group">
                <div className="location-search-container">
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="Enter location or use current location"
                    required
                    autoComplete="off"
                  />
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="search-suggestions" ref={suggestionsRef}>
                      {searchSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="suggestion-item"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          <div className="suggestion-address">{suggestion.address}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isSearching && (
                    <div className="search-loading">
                      <div className="search-spinner">🔍</div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={`location-btn ${isGettingLocation ? 'loading' : ''}`}
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                  title="Use current location"
                >
                  {isGettingLocation ? (
                    <span className="loading-emoji">⏳</span>
                  ) : (
                    <img 
                      src="/img/rendezview_pin-01.svg" 
                      alt="Location pin" 
                      className="location-pin-icon"
                    />
                  )}
                </button>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="cancel-btn"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button type="submit" className="submit-btn">
                Create Rendezview
              </button>
            </div>
          </form>
        </div>
      )}
      
      <h2 className="scheduled-heading">Upcoming Rendezvous</h2>
      
      <div className="rendezvous-list">
        <div className="rendezvous-card">
          <h3 className="rendezvous-name">Coffee & Catch Up ☕️</h3>
          <p className="rendezvous-date">Friday, August 1 2025</p>
          <p className="rendezvous-time">10:00 AM</p>
          <p className="rendezvous-location">Starbucks, 123 Main St, Downtown</p>
          <p className="rendezvous-people">People: Kevin, Deanne</p>
          <button className="view-btn">View</button>
        </div>
        
        <div className="rendezvous-card">
          <h3 className="rendezvous-name">Bicycle Purchase 🚲</h3>
          <p className="rendezvous-date">Sunday, August 3 2025</p>
          <p className="rendezvous-time">2:30 PM</p>
          <p className="rendezvous-location">TBD</p>
          <p className="rendezvous-people">People: Amit</p>
          <button className="view-btn">View</button>
        </div>
        
        <div className="rendezvous-card">
          <h3 className="rendezvous-name">Sunset Date 🌅💕</h3>
          <p className="rendezvous-date">Tuesday, August 5 2025</p>
          <p className="rendezvous-time">6:00 PM</p>
          <p className="rendezvous-location">Riverside Park, 456 River Ave</p>
          <p className="rendezvous-people">People: Kipling</p>
          <button className="view-btn">View</button>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 