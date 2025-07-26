import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/RendezvousMapPage.css';
import HamburgerMenu from './HamburgerMenu';
import useAppNotification from '../hooks/useAppNotification';
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
  const charactersLayerRef = useRef(null);
  const candidateLayerRef = useRef(null);
  const [rendezvous, setRendezvous] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [characterLocations, setCharacterLocations] = useState([]);
  const [_joinedCharacters, setJoinedCharacters] = useState([]);
  const [candidates, setCandidates] = useState([]);

  // Hardcoded nice-looking shareable link
  const shareableLink = "https://rendezview.app/join/748372590";

  // ArcGIS API key
  const ARCGIS_API_KEY = "AAPTxy8BH1VEsoebNVZXo8HurL6nxPIkajIUT_yWL44ecbAWd5Fs0xSXmPreZMEXzk6HSmBOc05PQbjX0cRXkfIwDMzyPeHaM_i8CHGCGigW4zmUKkyD-wgJ3m8k7lHsQ8NLmgiHhoXsN01cGdjAnAxLn3WOs5udBwQAA1iXwjWeGvGyD7OIeZhfUhOpAFYLF496OL1wEqBy-oV-tlvQrfVgRnuRMeHAPeoVf2OfPFytoFk6E0mTNJfpj2gbE1Z9fxpYAT1_8TEW7Qkn";

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

  useEffect(() => {
    if (!candidateLayerRef.current) return;

    candidateLayerRef.current.removeAll();

    candidates.forEach((candidate) => {
      const point = {
        type: "point",
        longitude: candidate.location.longitude,
        latitude: candidate.location.latitude,
      };

      const markerSymbol = {
        type: "simple-marker",
        color: [255, 255, 0], // Yellow for candidates
        size: "14px",
        outline: {
          color: [0, 0, 0],
          width: 2,
        },
      };

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
        attributes: candidate,
      });

      candidateLayerRef.current.add(pointGraphic);
    });
  }, [candidates]);

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

  // Generate character locations with specific coordinates
  const generateCharacterLocations = () => {
    // Create Barry Allen and Pietro Maximoff at specific coordinates
    return [
      { 
        name: "Barry Allen",
        latitude: 34.054767, 
        longitude: -117.16708, 
        color: [255, 215, 0], // Gold
        character: "barry",
        joined: false
      },
      { 
        name: "Pietro Maximoff",
        latitude: 34.069237, 
        longitude: -117.186327, 
        color: [138, 43, 226], // Blue Violet
        character: "pietro",
        joined: false
      }
    ];
  };

  const addCharacterLocationsToMap = (characters) => {
    if (!charactersLayerRef.current) return;

    // Clear existing character markers
    charactersLayerRef.current.removeAll();

    // Add markers for each character location
    characters.forEach((character) => {
      const point = {
        type: "point",
        longitude: character.longitude,
        latitude: character.latitude
      };

      const markerSymbol = {
        type: "simple-marker",
        color: character.color,
        size: "16px",
        outline: {
          color: [255, 255, 255],
          width: 2
        }
      };

      const popupTemplate = {
        title: character.name
      };

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
        popupTemplate: popupTemplate,
        attributes: {
          name: character.name,
          character: character.character,
          joined: character.joined
        }
      });

      charactersLayerRef.current.add(pointGraphic);
    });
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

      // Create the map with custom basemap
      const map = new Map({
        basemap: {
          portalItem: {
            id: "4016f6953ec14d03a551611be139ef59"
          }
        },
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

      // Create graphics layer for character locations
      const charactersLayer = new GraphicsLayer();
      map.add(charactersLayer);
      charactersLayerRef.current = charactersLayer;

      // Create graphics layer for candidates
      const candidateLayer = new GraphicsLayer();
      map.add(candidateLayer);
      candidateLayerRef.current = candidateLayer;

      // Generate and add character locations
      const characters = generateCharacterLocations();
      setCharacterLocations(characters);
      addCharacterLocationsToMap(characters);

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
        title: "Jayvee"
      };

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
        popupTemplate: popupTemplate
      });

      graphicsLayer.add(pointGraphic);

      // Wait for the view to be ready before opening popup
      view.when(() => {
        // Show popup by default
        view.popup.open({
          features: [pointGraphic],
          location: point
        });
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
      notification.success('Rendezvous link copied to clipboard!');
      
      // Trigger character join notifications with delays
      setTimeout(() => {
        notification.info('Barry Allen joined the rendezvous!');
        // Mark Barry as joined
        setCharacterLocations(prev => 
          prev.map(char => 
            char.character === 'barry' ? { ...char, joined: true } : char
          )
        );
        setJoinedCharacters(prev => [...prev, 'barry']);
        
        // Update map markers to reflect joined status
        if (charactersLayerRef.current) {
          const barryGraphic = charactersLayerRef.current.graphics.find(
            g => g.attributes.character === 'barry'
          );
          if (barryGraphic) {
            barryGraphic.attributes.joined = true;
          }
        }
      }, 2000); // 2 seconds after copy
      
      setTimeout(() => {
        notification.info('Pietro Maximoff joined the rendezvous!');
        // Mark Pietro as joined
        setCharacterLocations(prev => 
          prev.map(char => 
            char.character === 'pietro' ? { ...char, joined: true } : char
          )
        );
        setJoinedCharacters(prev => [...prev, 'pietro']);
        
        // Update map markers to reflect joined status
        if (charactersLayerRef.current) {
          const pietroGraphic = charactersLayerRef.current.graphics.find(
            g => g.attributes.character === 'pietro'
          );
          if (pietroGraphic) {
            pietroGraphic.attributes.joined = true;
          }
        }
      }, 5000); // 5 seconds after copy
      
    } catch (error) {
      console.error('Failed to copy link:', error);
      notification.error('Failed to copy rendezvous link');
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
      // Get the rendezvous location coordinates
      let mainSearchCenter;
      if (rendezvous.location.includes('Current Location') && rendezvous.location.includes('(')) {
        const coordMatch = rendezvous.location.match(/\(([^)]+)\)/);
        if (coordMatch) {
          const [lat, lng] = coordMatch[1].split(',').map(coord => parseFloat(coord.trim()));
          mainSearchCenter = { latitude: lat, longitude: lng };
        }
      } else {
        // If it's an address, geocode it first
        const coordinates = await geocodeAddress(rendezvous.location);
        if (coordinates) {
          mainSearchCenter = { latitude: coordinates[1], longitude: coordinates[0] };
        }
      }

      // If we don't have search center, use default (this shouldn't happen)
      if (!mainSearchCenter) {
        mainSearchCenter = { latitude: 34.0522, longitude: -118.2437 }; // Default to LA
      }

      // Create array of all search centers (main + characters)
      const searchCenters = [
        { ...mainSearchCenter, name: 'Main Location' },
        ...characterLocations.map(character => ({
          latitude: character.latitude,
          longitude: character.longitude,
          name: character.name
        }))
      ];

      console.log('Searching from multiple centers:', searchCenters);

      // Search from all locations
      const allResults = [];
      const serviceUrl = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      
      for (const center of searchCenters) {
        try {
          const params = {
            address: {
              SingleLine: query
            },
            location: {
              x: center.longitude,
              y: center.latitude,
              spatialReference: { wkid: 4326 }
            },
            distance: 8000, // 8km radius from each center
            maxLocations: 10, // Limit per center to avoid too many results
            outFields: ["Place_addr", "PlaceName", "Type", "Addr_type"],
            apiKey: ARCGIS_API_KEY
          };

          const response = await locator.addressToLocations(serviceUrl, params);
          
          if (response && response.length > 0) {
            const results = response
              .filter(result => result.score > 50) // Filter for better quality results
              .map((place, index) => ({
                placeId: `${center.name.replace(/\s+/g, '_')}_${index}`,
                name: place.attributes?.PlaceName || place.address,
                address: place.attributes?.Place_addr || place.address,
                location: {
                  longitude: place.location.longitude,
                  latitude: place.location.latitude
                },
                categories: place.attributes?.Type ? [{ label: place.attributes.Type }] : [],
                addressType: place.attributes?.Addr_type || 'Unknown',
                score: Math.round(place.score),
                searchArea: center.name
              }));
            
            allResults.push(...results);
          }
        } catch (error) {
          console.error(`Search failed for ${center.name}:`, error);
          // Continue with other centers even if one fails
        }
      }

      // Remove duplicates based on location proximity (within 100m)
      const uniqueResults = [];
      allResults.forEach(result => {
        const isDuplicate = uniqueResults.some(existing => {
          const distance = Math.sqrt(
            Math.pow((existing.location.latitude - result.location.latitude) * 111000, 2) +
            Math.pow((existing.location.longitude - result.location.longitude) * 111000 * Math.cos(result.location.latitude * Math.PI / 180), 2)
          );
          return distance < 100; // Less than 100 meters apart
        });

        if (!isDuplicate) {
          uniqueResults.push(result);
        }
      });

      // Sort by score (highest first) and limit to 25 results
      const sortedResults = uniqueResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 25);
      
      console.log(`Found ${sortedResults.length} unique places from ${searchCenters.length} search centers`);
      
      setSearchResults(sortedResults);
      setShowSearchResults(sortedResults.length > 0);
      
      // Add place markers to the map
      if (sortedResults.length > 0) {
        addPlaceMarkersToMap(sortedResults);
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
    places.forEach((place) => {
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
        title: "{name}",
        content: [
          {
            type: "custom",
            creator: function () {
              const { address, categories, score, searchArea } = place;

              // Create a div container for the custom content.
              const div = document.createElement("div");
              div.style.padding = "10px";

              // Add static content
              const addressElement = document.createElement("p");
              addressElement.innerHTML = `<strong>Address:</strong> ${address}`;
              div.appendChild(addressElement);

              if (categories && categories.length > 0) {
                const typeElement = document.createElement("p");
                typeElement.innerHTML = `<strong>Type:</strong> ${categories.map(cat => cat.label).join(', ')}`;
                div.appendChild(typeElement);
              }

              if (score) {
                const relevanceElement = document.createElement("p");
                relevanceElement.innerHTML = `<strong>Relevance:</strong> ${score}%`;
                div.appendChild(relevanceElement);
              }

              if (searchArea) {
                const foundFromElement = document.createElement("p");
                foundFromElement.innerHTML = `<strong>Found from:</strong> ${searchArea}`;
                div.appendChild(foundFromElement);
              }

              const searchResultElement = document.createElement("p");
              searchResultElement.style.marginTop = "10px";
              searchResultElement.style.color = "#007bff";
              searchResultElement.innerHTML = `📍 Search result`;
              div.appendChild(searchResultElement);

              // Create the button element.
              const button = document.createElement("button");
              button.innerText = "Select as candidate";
              button.classList.add("esri-button"); // Use ArcGIS styles
              button.style.marginTop = "10px";


              // Add the click event listener to the button.
              button.addEventListener("click", () => {
                addCandidate(place);
              });

              // Append the button to the div container.
              div.appendChild(button);

              // Return the div container.
              return div;
            },
          },
        ],
      };

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: markerSymbol,
        popupTemplate: popupTemplate,
        attributes: {
          placeId: place.placeId,
          name: place.name,
          searchArea: place.searchArea
        }
      });

      placesLayerRef.current.add(pointGraphic);
    });
  };

  const showAllSearchResults = () => {
    if (!mapViewRef.current) {
      return;
    }

    // Close the search results dropdown
    setShowSearchResults(false);

    // Get all graphics (search results + rendezvous point + character locations)
    const allGraphics = [];
    
    // Add search result graphics
    if (placesLayerRef.current) {
      placesLayerRef.current.graphics.forEach(graphic => {
        allGraphics.push(graphic);
      });
    }

    // Add character location graphics
    if (charactersLayerRef.current) {
      charactersLayerRef.current.graphics.forEach(graphic => {
        allGraphics.push(graphic);
      });
    }

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

  const addCandidate = (place) => {
    setCandidates((prevCandidates) => {
      if (prevCandidates.find((candidate) => candidate.placeId === place.placeId)) {
        return prevCandidates;
      }
      return [...prevCandidates, place];
    });
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

  const navigateToPlace = (latitude, longitude, placeName) => {
    // Get user's current location first
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser. Please use ArcGIS directions manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        // Create ArcGIS navigation URL
        const arcgisUrl = `https://www.arcgis.com/apps/directions/index.html?startLat=${userLat}&startLng=${userLng}&endLat=${latitude}&endLng=${longitude}`;
        
        // Check if mobile device
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // For mobile, try ArcGIS Navigator app first
          const navigatorAppUrl = `arcgis-navigator://?stop=${latitude},${longitude}&stopname=${encodeURIComponent(placeName)}&start=${userLat},${userLng}&startname=Current%20Location`;
          
          // Try ArcGIS Navigator app
          const tempLink = document.createElement('a');
          tempLink.href = navigatorAppUrl;
          tempLink.click();
          
          // Fallback to ArcGIS web directions after a short delay
          setTimeout(() => {
            window.open(arcgisUrl, '_blank');
          }, 1000);
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
    setSearchResults([]);
    setShowSearchResults(false);
    
    // Clear place markers from map (but keep character locations visible)
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

  const displayedResults = useMemo(() => {
    const candidateIds = new Set(candidates.map((c) => c.placeId));
    return searchResults.filter((result) => !candidateIds.has(result.placeId));
  }, [searchResults, candidates]);

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
        
        {showSearchResults && (
          <div className="search-results">
            <div className="search-results-header">
              <span className="search-results-count">
                {displayedResults.length} result{displayedResults.length !== 1 ? 's' : ''} found
              </span>
              <button className="show-all-btn" onClick={showAllSearchResults}>
                📍 Show All on Map
              </button>
            </div>
            {displayedResults.map((result, index) => (
              <div
                key={index}
                className="search-result-item"
              >
                <div onClick={() => selectSearchResult(result)} style={{ cursor: 'pointer', flex: 1 }}>
                  <div className="search-result-name">{result.name}</div>
                  <div className="search-result-address">{result.address}</div>
                  {result.categories && result.categories.length > 0 && (
                    <div className="search-result-categories">
                      {result.categories.map(cat => cat.label).join(', ')}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {result.score && (
                      <div className="search-result-distance">
                        Relevance: {result.score}%
                      </div>
                    )}
                    {result.searchArea && (
                      <div style={{ fontSize: '11px', color: '#28a745', fontWeight: '500' }}>
                        📍 {result.searchArea}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
                  <button 
                    className="navigate-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToPlace(result.location.latitude, result.location.longitude, result.name);
                    }}
                  >
                    🧭 Get Directions
                  </button>
                </div>
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