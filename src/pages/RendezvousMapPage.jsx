import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const mapViewRef = useRef(null);
  const placesLayerRef = useRef(null);
  const [rendezvous, setRendezvous] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // ArcGIS API key
  const ARCGIS_API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurL6nxPIkajIUT_yWL44ecbAWd5Fs0xSXmPreZMEXzk6HSmBOc05PQbjX0cRXkfIwDMzyPeHaM_i8CHGCGigW4zmUKkyD-wgJ3m8k7lHsQ8NLmgiHhoXsN01cGdjAnAxLn3WOs5udBwQAA1iXwjWeGvGyD7OIeZhfUhOpAFYLF496OL1wEqBy-oV-tlvQrfVgRnuRMeHAPeoVf2OfPFytoFk6E0mTNJfpj2gbE1Z9fxpYAT1_8TEW7Qkn";

  useEffect(() => {
    // Decode the rendezvous data from URL params
    if (rendezvousData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(rendezvousData));
        setRendezvous(decoded);
        
        // Generate shareable link
        const currentUrl = window.location.href;
        setShareableLink(currentUrl);
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

  // Click outside handler for search results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
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
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      // Clear existing place markers
      if (placesLayerRef.current) {
        placesLayerRef.current.removeAll();
      }
      return;
    }

    try {
      // Get the rendezvous location coordinates for nearby search
      let searchCenter;
      if (rendezvous.location.includes('Current Location') && rendezvous.location.includes('(')) {
        const coordMatch = rendezvous.location.match(/\(([^)]+)\)/);
        if (coordMatch) {
          const [lat, lng] = coordMatch[1].split(',').map(coord => parseFloat(coord.trim()));
          searchCenter = { latitude: lat, longitude: lng };
        }
      } else {
        // If it's an address, geocode it first
        const coordinates = await geocodeAddress(rendezvous.location);
        if (coordinates) {
          searchCenter = { latitude: coordinates[1], longitude: coordinates[0] };
        }
      }

      // If we don't have search center, use default (this shouldn't happen)
      if (!searchCenter) {
        searchCenter = { latitude: 34.0522, longitude: -118.2437 }; // Default to LA
      }

      // Use standard geocoding service to find places
      const serviceUrl = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      
      const params = {
        address: {
          SingleLine: query
        },
        location: {
          x: searchCenter.longitude,
          y: searchCenter.latitude,
          spatialReference: { wkid: 4326 }
        },
        distance: 25000, // 25km radius
        maxLocations: 20,
        outFields: ["Place_addr", "PlaceName", "Type", "Addr_type"],
        apiKey: ARCGIS_API_KEY
      };

      console.log('Searching with geocoding service:', params);

      const response = await locator.addressToLocations(serviceUrl, params);
      
      console.log('Geocoding search result:', response);
      
      if (response && response.length > 0) {
        const results = response
          .filter(result => result.score > 50) // Filter for better quality results
          .map((place, index) => ({
            placeId: `geocode_${index}`,
            name: place.attributes?.PlaceName || place.address,
            address: place.attributes?.Place_addr || place.address,
            location: {
              longitude: place.location.longitude,
              latitude: place.location.latitude
            },
            categories: place.attributes?.Type ? [{ label: place.attributes.Type }] : [],
            addressType: place.attributes?.Addr_type || 'Unknown',
            score: Math.round(place.score)
          }));
        
        setSearchResults(results);
        setShowSearchResults(true);
        
        // Add place markers to the map
        addPlaceMarkersToMap(results);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
        // Clear existing markers
        if (placesLayerRef.current) {
          placesLayerRef.current.removeAll();
        }
      }
    } catch (error) {
      console.error('Places search failed:', error);
      setSearchResults([]);
      setShowSearchResults(false);
      // Clear existing markers
      if (placesLayerRef.current) {
        placesLayerRef.current.removeAll();
      }
    }
  };

  const addPlaceMarkersToMap = (places) => {
    if (!placesLayerRef.current) return;

    // Clear existing markers
    placesLayerRef.current.removeAll();

    // Add markers for each place
    places.forEach((place, index) => {
      const point = {
        type: "point",
        longitude: place.location.longitude,
        latitude: place.location.latitude
      };

      const markerSymbol = {
        type: "simple-marker",
        color: [0, 123, 255], // Blue color for places
        size: "12px",
        outline: {
          color: [255, 255, 255],
          width: 2
        }
      };

      const popupTemplate = {
        title: place.name,
        content: `
          <div style="padding: 10px;">
            <p><strong>Address:</strong> ${place.address}</p>
            ${place.categories && place.categories.length > 0 ? 
              `<p><strong>Type:</strong> ${place.categories.map(cat => cat.label).join(', ')}</p>` : ''}
            ${place.score ? 
              `<p><strong>Relevance:</strong> ${place.score}%</p>` : ''}
            <p style="margin-top: 10px; color: #007bff;">
              📍 Search result
            </p>
          </div>
        `
      };

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
        popupTemplate: popupTemplate,
        attributes: {
          placeId: place.placeId,
          name: place.name
        }
      });

      placesLayerRef.current.add(pointGraphic);
    });
  };

  const showAllSearchResults = () => {
    if (!mapViewRef.current || !placesLayerRef.current || placesLayerRef.current.graphics.length === 0) {
      return;
    }

    // Close the search results dropdown
    setShowSearchResults(false);

    // Get all graphics (search results + rendezvous point)
    const allGraphics = [];
    
    // Add search result graphics
    placesLayerRef.current.graphics.forEach(graphic => {
      allGraphics.push(graphic);
    });

    // Add rendezvous point if we have rendezvous data
    if (rendezvous) {
      let rendezvousCoords;
      if (rendezvous.location.includes('Current Location') && rendezvous.location.includes('(')) {
        const coordMatch = rendezvous.location.match(/\(([^)]+)\)/);
        if (coordMatch) {
          const [lat, lng] = coordMatch[1].split(',').map(coord => parseFloat(coord.trim()));
          rendezvousCoords = { longitude: lng, latitude: lat };
        }
      }
      
      if (rendezvousCoords) {
        const rendezvousPoint = {
          type: "point",
          longitude: rendezvousCoords.longitude,
          latitude: rendezvousCoords.latitude
        };
        
        const rendezvousGraphic = new Graphic({
          geometry: rendezvousPoint
        });
        
        allGraphics.push(rendezvousGraphic);
      }
    }

    // Zoom to show all graphics
    if (allGraphics.length > 0) {
      mapViewRef.current.goTo(allGraphics, {
        duration: 1000, // 1 second animation
        easing: "ease-in-out"
      }).then(() => {
        // Add some padding around the extent
        const currentExtent = mapViewRef.current.extent;
        const expandedExtent = currentExtent.expand(1.2); // 20% padding
        mapViewRef.current.goTo(expandedExtent, { duration: 500 });
      });
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Clear any pending debounced search
      clearTimeout(window.searchTimeout);
      // Trigger immediate search
      handleSearch(searchValue);
    }
  };

  const selectSearchResult = (result) => {
    setSearchValue(result.name);
    setShowSearchResults(false);
    
    // Navigate to the selected place on the map
    if (mapViewRef.current && result.location) {
      mapViewRef.current.goTo({
        center: [result.location.longitude, result.location.latitude],
        zoom: 17
      });
      
      // Show popup for the selected place
      const selectedGraphic = placesLayerRef.current.graphics.find(
        graphic => graphic.attributes.placeId === result.placeId
      );
      
      if (selectedGraphic) {
        mapViewRef.current.popup.open({
          features: [selectedGraphic],
          location: {
            longitude: result.location.longitude,
            latitude: result.location.latitude
          }
        });
      }
    }
  };

  const clearSearch = () => {
    setSearchValue('');
    setSearchResults([]);
    setShowSearchResults(false);
    
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
        
        {showSearchResults && searchResults.length > 0 && (
          <div className="search-results">
            <div className="search-results-header">
              <span className="search-results-count">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </span>
              <button className="show-all-btn" onClick={showAllSearchResults}>
                📍 Show All on Map
              </button>
            </div>
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="search-result-item"
                onClick={() => selectSearchResult(result)}
              >
                <div className="search-result-name">{result.name}</div>
                <div className="search-result-address">{result.address}</div>
                {result.categories && result.categories.length > 0 && (
                  <div className="search-result-categories">
                    {result.categories.map(cat => cat.label).join(', ')}
                  </div>
                )}
                {result.score && (
                  <div className="search-result-distance">
                    Relevance: {result.score}%
                  </div>
                )}
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