import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAppNotification from '../hooks/useAppNotification';
import '../styles/RendezvousMapPage.css';
import HamburgerMenu from './HamburgerMenu';
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import * as locator from "@arcgis/core/rest/locator";

const RendezvousMapPage = () => {
  const { rendezvousData } = useParams();
  const navigate = useNavigate();
  const notification = useAppNotification();
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const mapViewRef = useRef(null);
  const placesLayerRef = useRef(null);
  const [rendezvous, setRendezvous] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Hardcoded nice-looking shareable link
  const shareableLink = "https://rendezview.app/join/748372590";

  // ArcGIS API key
  const ARCGIS_API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurL6nxPIkajIUT_yWL44ecbAWd5Fs0xSXmPreZMEXzk6HSmBOc05PQbjX0cRXkfIwDMzyPeHaM_i8CHGCGigW4zmUKkyD-wgJ3m8k7lHsQ8NLmgiHhoXsN01cGdjAnAxLn3WOs5udBwQAA1iXwjWeGvGyD7OIeZhfUhOpAFYLF496OL1wEqBy-oV-tlvQrfVgRnuRMeHAPeoVf2OfPFytoFk6E0mTNJfpj2gbE1Z9fxpYAT1_8TEW7Qkn";

  // Generate user locations in an expanded irregular triangle formation
  const generateUserLocations = (centerLat, centerLng) => {
    const radius = 0.025; // Much larger radius for wide spread
    return [
      {
        id: 'user_1',
        name: 'Barry Allen',
        latitude: centerLat + radius * 1.1,
        longitude: centerLng - radius * 0.6
      },
      {
        id: 'user_2', 
        name: 'Pietro Maximoff',
        latitude: centerLat + radius * 0.8,
        longitude: centerLng + radius * 1.3
      }
    ];
  };

  useEffect(() => {
    // Decode the rendezvous data from URL params
    if (rendezvousData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(rendezvousData));
        setRendezvous(decoded);
      } catch (error) {
        console.error('Error parsing rendezvous data:', error);
        navigate('/');
      }
    }
  }, [rendezvousData, navigate]);

  useEffect(() => {
    if (rendezvous && !mapLoaded) {
      initializeMap();
    }
  }, [rendezvous, mapLoaded]);

  // Make navigation function globally available for popup buttons
  useEffect(() => {
    window.navigateToPlace = navigateToPlace;
    return () => {
      delete window.navigateToPlace;
    };
  }, []);

  // Click outside handler for search suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const geocodeAddress = async (address) => {
    try {
      const serviceUrl = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      
      const params = {
        address: {
          SingleLine: address
        },
        apiKey: ARCGIS_API_KEY
      };

      const response = await locator.addressToLocations(serviceUrl, params);
      
      if (response && response.length > 0) {
        const location = response[0].location;
        return [location.longitude, location.latitude];
      } else {
        throw new Error('No coordinates found for address');
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    }
  };



  const initializeMap = async () => {
    try {

      let coordinates;
      
      // Check if location is coordinates or address
      if (rendezvous.location.includes('Current Location') && rendezvous.location.includes('(')) {
        // Extract coordinates from "Current Location (lat, lng)" format
        const coordMatch = rendezvous.location.match(/\(([^)]+)\)/);
        if (coordMatch) {
          const [lat, lng] = coordMatch[1].split(',').map(coord => parseFloat(coord.trim()));
          coordinates = [lng, lat]; // ArcGIS uses [longitude, latitude]
        }
      } else {
        // Geocode the address
        coordinates = await geocodeAddress(rendezvous.location);
      }

      if (!coordinates) {
        console.error('Could not get coordinates for location');
        return;
      }

      // Create the map
      const map = new Map({
        basemap: "arcgis/navigation", // Street view basemap
        apiKey: ARCGIS_API_KEY
      });

      // Create the view
      const view = new MapView({
        container: mapRef.current,
        map: map,
        center: coordinates,
        zoom: 15 // Good zoom level for street view
      });

      // Store the view reference for later use
      mapViewRef.current = view;

      view.ui.move("zoom", "bottom-right");

      // Create graphics layer for the rendezvous point
      const graphicsLayer = new GraphicsLayer();
      map.add(graphicsLayer);

      // Create graphics layer for places search results
      const placesLayer = new GraphicsLayer();
      map.add(placesLayer);
      placesLayerRef.current = placesLayer;

      // Create a point graphic for the rendezvous location
      const point = {
        type: "point",
        longitude: coordinates[0],
        latitude: coordinates[1]
      };

      const markerSymbol = {
        type: "simple-marker",
        color: [255, 107, 107], // Coral color
        size: "16px",
        outline: {
          color: [255, 255, 255],
          width: 2
        }
      };

      const popupTemplate = {
        title: rendezvous.name,
        content: `
          <div style="padding: 10px;">
            <p><strong>Time:</strong> ${new Date(rendezvous.datetime).toLocaleString()}</p>
            <p><strong>Location:</strong> ${rendezvous.location}</p>
            <p style="margin-top: 10px; color: #007bff;">
              📍 Rendezvous point - Share this link with others to join!
            </p>
          </div>
        `
      };

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
        popupTemplate: popupTemplate
      });

      graphicsLayer.add(pointGraphic);

      // Show popup by default
      view.popup.open({
        features: [pointGraphic],
        location: point
      });

      setMapLoaded(true);

    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const copyShareableLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notification.success('Link copied!');

      // Get rendezvous coordinates to generate user locations
      let rendezvousCoords;
      if (rendezvous.location.includes('Current Location') && rendezvous.location.includes('(')) {
        const coordMatch = rendezvous.location.match(/\(([^)]+)\)/);
        if (coordMatch) {
          const [lat, lng] = coordMatch[1].split(',').map(coord => parseFloat(coord.trim()));
          rendezvousCoords = { latitude: lat, longitude: lng };
        }
      } else {
        // If it's an address, geocode it first
        const coordinates = await geocodeAddress(rendezvous.location);
        if (coordinates) {
          rendezvousCoords = { latitude: coordinates[1], longitude: coordinates[0] };
        }
      }

      if (rendezvousCoords) {
        // Generate user locations near the rendezvous
        const usersToJoin = generateUserLocations(rendezvousCoords.latitude, rendezvousCoords.longitude);
        
        // Simulate users joining with delays
                 const simulateUserJoining = async (user, delay) => {
           setTimeout(async () => {
             notification.success(`${user.name} joined the rendezvous!`);
            
            // Add user's marker to the map
            if (mapViewRef.current && placesLayerRef.current) {
              const point = {
                type: "point",
                longitude: user.longitude,
                latitude: user.latitude
              };

              const userSymbol = {
                type: "simple-marker",
                color: [46, 204, 113], // Green color for joined users
                size: "16px",
                outline: {
                  color: [255, 255, 255],
                  width: 2
                }
              };

              const userPopupTemplate = {
                title: user.name,
                content: `
                  <div style="padding: 10px;">
                    <p><strong>User:</strong> ${user.name}</p>
                    <p style="margin-top: 10px; color: #2ecc71; font-weight: bold;">
                      ✅ Joined the rendezvous!
                    </p>
                  </div>
                `
              };

              const userGraphic = new Graphic({
                geometry: point,
                symbol: userSymbol,
                popupTemplate: userPopupTemplate,
                attributes: {
                  userId: user.id,
                  userName: user.name
                }
              });

              placesLayerRef.current.add(userGraphic);
            }
          }, delay);
        };

        // Add delays between users joining (2 seconds after copy, then 3 seconds between users)
        simulateUserJoining(usersToJoin[0], 2000); // First user joins after 2 seconds
        simulateUserJoining(usersToJoin[1], 5000); // Second user joins after 5 seconds
      }

    } catch (error) {
      console.error('Failed to copy link:', error);
      notification.error('Failed to copy link.');
    }
  };

  const searchAddresses = async (searchText) => {
    if (!searchText || searchText.trim().length === 0) return;
    
    try {
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
    }
  };

  const handleSuggestionClick = async (suggestion) => {
    setSearchValue(suggestion.address);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    
    // Geocode the selected suggestion and navigate to it
    try {
      const serviceUrl = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      
      const geocodeParams = {
        address: { SingleLine: suggestion.address },
        apiKey: ARCGIS_API_KEY
      };

      // If suggestion has magicKey, use it for better accuracy
      if (suggestion.magicKey) {
        geocodeParams.magicKey = suggestion.magicKey;
      }

      const geocodeResponse = await locator.addressToLocations(serviceUrl, geocodeParams);
      
      if (geocodeResponse && geocodeResponse.length > 0) {
        const result = geocodeResponse[0];
        const longitude = result.location.longitude;
        const latitude = result.location.latitude;
        
        // Navigate the map to the selected location
        if (mapViewRef.current) {
          mapViewRef.current.goTo({
            center: [longitude, latitude],
            zoom: 16
          });
          
          // Clear existing search markers and add new one
          if (placesLayerRef.current) {
            placesLayerRef.current.removeAll();
            
            // Add marker for the selected location
            const point = {
              type: "point",
              longitude: longitude,
              latitude: latitude
            };

            const markerSymbol = {
              type: "simple-marker",
              color: [0, 123, 255], // Blue color
              size: "14px",
              outline: {
                color: [255, 255, 255],
                width: 2
              }
            };

            const popupTemplate = {
              title: result.attributes?.PlaceName || suggestion.address,
              content: `
                <div style="padding: 10px;">
                  <p><strong>Address:</strong> ${result.address}</p>
                  <p style="margin-top: 10px; color: #007bff;">
                    📍 Selected location
                  </p>
                </div>
              `
            };

            const pointGraphic = new Graphic({
              geometry: point,
              symbol: markerSymbol,
              popupTemplate: popupTemplate
            });

            placesLayerRef.current.add(pointGraphic);
            
            // Show popup for the selected location
            mapViewRef.current.popup.open({
              features: [pointGraphic],
              location: point
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to geocode selected suggestion:', error);
      // Still navigate even if geocoding fails - just set the search value
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    
    // Handle address search when typing - search on any input
    if (value.trim().length > 0) {
      // Debounce search
      clearTimeout(window.searchTimeout);
      window.searchTimeout = setTimeout(() => {
        searchAddresses(value);
      }, 300);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Clear any pending debounced search
      clearTimeout(window.searchTimeout);
      // Trigger immediate search
      searchAddresses(searchValue);
    }
  };

  const navigateToPlace = (latitude, longitude, placeName) => {
    // Get user's current location first
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser. Please use a maps app manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        // Create ArcGIS navigation URL
        const arcgisUrl = `https://www.arcgis.com/apps/directions/index.html?startLat=${userLat}&startLng=${userLng}&endLat=${latitude}&endLng=${longitude}`;
        
        // Try different navigation options based on device
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // For mobile, try ArcGIS Navigator app first, then fallback options
          const navigatorAppUrl = `arcgis-navigator://?stop=${latitude},${longitude}&stopname=${encodeURIComponent(placeName)}&start=${userLat},${userLng}&startname=Current%20Location`;
          
          // Try ArcGIS Navigator app
          const tempLink = document.createElement('a');
          tempLink.href = navigatorAppUrl;
          tempLink.click();
          
          // Fallback to web version after a short delay
          setTimeout(() => {
            // Try ArcGIS web directions
            window.open(arcgisUrl, '_blank');
          }, 1000);
          
          // Additional fallback to device's default maps after longer delay
          setTimeout(() => {
            // iOS Maps fallback
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
              const appleMapsUrl = `http://maps.apple.com/?saddr=${userLat},${userLng}&daddr=${latitude},${longitude}&dirflg=d`;
              window.open(appleMapsUrl, '_blank');
            } else {
              // Android - use generic maps intent
              const genericMapsUrl = `https://maps.google.com/maps?saddr=${userLat},${userLng}&daddr=${latitude},${longitude}&dirflg=d`;
              window.open(genericMapsUrl, '_blank');
            }
          }, 2000);
        } else {
          // Desktop - open ArcGIS directions in new tab
          window.open(arcgisUrl, '_blank');
        }
      },
      (error) => {
        console.error('Error getting user location:', error);
        // Fallback - just open ArcGIS with destination
        const fallbackUrl = `https://www.arcgis.com/home/webmap/viewer.html?center=${longitude},${latitude}&level=16&marker=${longitude},${latitude}`;
        window.open(fallbackUrl, '_blank');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const clearSearch = () => {
    setSearchValue('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
    clearTimeout(window.searchTimeout);
    
    // Clear place markers from map
    if (placesLayerRef.current) {
      placesLayerRef.current.removeAll();
    }
    
    // Return to rendezvous location
    if (mapViewRef.current && rendezvous) {
      // Get rendezvous coordinates and return to them
      if (rendezvous.location.includes('Current Location') && rendezvous.location.includes('(')) {
        const coordMatch = rendezvous.location.match(/\(([^)]+)\)/);
        if (coordMatch) {
          const [lat, lng] = coordMatch[1].split(',').map(coord => parseFloat(coord.trim()));
          mapViewRef.current.goTo({
            center: [lng, lat],
            zoom: 15
          });
        }
      }
    }
  };

  if (!rendezvous) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading rendezvous...</div>
      </div>
    );
  }

  return (
    <div className="rendezvous-map-page">
      <HamburgerMenu
        title={rendezvous.name}
        time={rendezvous.datetime}
        userAddress={rendezvous.location}
        shareableLink={shareableLink}
        copyShareableLink={copyShareableLink}
        copied={copied}
      />
      
      {/* Search Bar */}
      <div className="search-bar-container" ref={searchRef}>
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search for places..."
            value={searchValue}
            onChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
          />
          {searchValue && (
            <button className="clear-search-btn" onClick={clearSearch}>
              ✕
            </button>
          )}
        </div>
        
        {showSuggestions && searchSuggestions.length > 0 && (
          <div className="search-suggestions">
            {searchSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className="search-suggestion-item"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion.address}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="map-container" ref={mapRef}></div>
    </div>
  );
};

export default RendezvousMapPage; 