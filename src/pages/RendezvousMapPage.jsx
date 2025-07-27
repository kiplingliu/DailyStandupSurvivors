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
import * as route from "@arcgis/core/rest/route";
import RouteParameters from "@arcgis/core/rest/support/RouteParameters";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";
import Point from "@arcgis/core/geometry/Point";

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
  const routeLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const firstCandidateSelected = useRef(false);
  const firstClear = useRef(true);
  const [rendezvous, setRendezvous] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [characterLocations, setCharacterLocations] = useState([]);
  const [_joinedCharacters, setJoinedCharacters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [rendezvousStarted, setRendezvousStarted] = useState(false);
  const [confirmedCandidate, setConfirmedCandidate] = useState(null);
  const [userCoordinates, setUserCoordinates] = useState(null);
  const [tripStarted, setTripStarted] = useState(false);
  const [animationInProgress, setAnimationInProgress] = useState(false);
  const [currentDirections, setCurrentDirections] = useState([]);
  const [currentDirectionIndex, setCurrentDirectionIndex] = useState(0);
  const [showDirections, setShowDirections] = useState(false);
  const animationCancelRef = useRef(false);
  const progressViewActiveRef = useRef(false);
  const barryMovingRef = useRef(false);

  // Auto-advance directions: pause 5s, then advance every second
  useEffect(() => {
    let interval;
    let timeout;
    if (showDirections && currentDirections.length > 0) {
      // Only auto-advance if not at the last direction
      if (currentDirectionIndex < currentDirections.length - 1) {
        // Initial 5s pause, then advance every 1s
        timeout = setTimeout(() => {
          interval = setInterval(() => {
            setCurrentDirectionIndex((prev) => {
              if (prev < currentDirections.length - 1) {
                return prev + 1;
              } else {
                clearInterval(interval);
                return prev;
              }
            });
          }, 1000);
        }, 5000);
      }
    }
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [showDirections, currentDirections.length, currentDirectionIndex]);
// (removed duplicate/old auto-advance effect)



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
    const selectedCandidate = candidates.find((c) => c.isSelected);
    if (selectedCandidate && mapViewRef.current && candidateLayerRef.current) {
      const candidateGraphic = candidateLayerRef.current.graphics.find(
        (g) => g.attributes.placeId === selectedCandidate.placeId
      );
      if (candidateGraphic) {
        mapViewRef.current.popup.open({
          features: [candidateGraphic],
          location: candidateGraphic.geometry,
        });
      }
    } else if (mapViewRef.current) {
      mapViewRef.current.popup.close();
    }
  }, [candidates]);

useEffect(() => {
  if (!candidateLayerRef.current || !mapViewRef.current) return;

  // 1. Redraw all candidate graphics with the latest data
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
      outline: { color: [0, 0, 0], width: 2 },
    };

    // The popup template is now created with fresh data each time
    const popupTemplate = {
      title: "{name}",
      content: [
        {
          type: "custom",
          creator: () => {
            // Note: `candidate` here is from the fresh `candidates` state
            const div = document.createElement("div");
            div.innerHTML = `
              <div style="padding: 10px;">
                <p><strong>${candidate.name}</strong></p>
                <p>${candidate.address}</p>
                <p>Upvotes: ${candidate.upvotes}, Downvotes: ${candidate.downvotes}</p>
                <p><strong>Average Travel Time:</strong> <span id="candidate-travel-time-${candidate.placeId}">Calculating...</span></p>
              </div>
            `;
            
            // Calculate travel time asynchronously for candidates too
            calculateAverageTravelTime(candidate).then(avgTime => {
              const timeSpan = document.getElementById(`candidate-travel-time-${candidate.placeId}`);
              if (timeSpan) {
                timeSpan.innerHTML = avgTime || "Unable to calculate";
                timeSpan.style.color = avgTime ? "#28a745" : "#dc3545";
              }
            });
            
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "vote-buttons";

            const upvoteButton = document.createElement("button");
            upvoteButton.innerHTML = "&#x25B2;"; // Up arrow
            upvoteButton.classList.add("vote-btn", "upvote-btn");
            upvoteButton.className = `vote-btn upvote-btn ${candidate.userVote === 'up' ? 'voted' : ''}`;
            upvoteButton.addEventListener("click", () => handleVote(candidate.placeId, "upvotes"));
            buttonContainer.appendChild(upvoteButton);
            
            const downvoteButton = document.createElement("button");
            downvoteButton.innerHTML = "&#x25BC;"; // Down arrow
            downvoteButton.className = `vote-btn downvote-btn ${candidate.userVote === 'down' ? 'voted' : ''}`;
            downvoteButton.addEventListener("click", () => handleVote(candidate.placeId, "downvotes"));
            buttonContainer.appendChild(downvoteButton);

            div.appendChild(buttonContainer);

           if (!rendezvousStarted) {
             const confirmButton = document.createElement("button");
             confirmButton.innerText = "Confirm Rendezvous";
             confirmButton.className = "esri-button confirm-rendezvous-btn";
             confirmButton.style.marginTop = "10px";
             confirmButton.style.width = "100%";
             confirmButton.addEventListener("click", () => handleConfirmRendezvous(candidate));
             div.appendChild(confirmButton);
           }

            return div;
          },
        },
      ],
    };

    const pointGraphic = new Graphic({
      geometry: point,
      symbol: markerSymbol,
      attributes: candidate, // Ensure attributes have the latest data
      popupTemplate: popupTemplate,
    });

    candidateLayerRef.current.add(pointGraphic);
  });

  // 2. Find the selected candidate and open its popup
  const selectedCandidate = candidates.find((c) => c.isSelected);
  const popup = mapViewRef.current.popup;

  if (selectedCandidate) {
    const candidateGraphic = candidateLayerRef.current.graphics.find(
      (g) => g.attributes.placeId === selectedCandidate.placeId
    );
    if (candidateGraphic) {
      // Open the popup for the newly created graphic
      popup.open({
        features: [candidateGraphic],
        location: candidateGraphic.geometry,
      });
    }
  } else {
    // If no candidate is selected, ensure the popup is closed
    popup.close();
  }
}, [candidates, rendezvousStarted]); // This single effect handles all updates

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
          setUserCoordinates({ latitude: lat, longitude: lng });
        }
      } else {
        // Geocode the address
        coordinates = await geocodeAddress(rendezvous.location);
        if (coordinates) {
          setUserCoordinates({ latitude: coordinates[1], longitude: coordinates[0] });
        }
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

      // Disable docking
      view.popup.dockEnabled = false;
      view.popup.dockOptions = {
        buttonEnabled: false,
        breakpoint: false
      };

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

      // Create graphics layer for routes
      const routeLayer = new GraphicsLayer();
      map.add(routeLayer);
      routeLayerRef.current = routeLayer;

      // Character locations will be added when copy link is clicked

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
      userMarkerRef.current = pointGraphic; // Store reference for animation

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
      
      // Barry Allen joins after 2 seconds
      setTimeout(() => {
        notification.info('Barry Allen joined the rendezvous!');
        
        // Add Barry to the map and state
        const barryCharacter = {
          name: "Barry Allen",
          latitude: 34.054767, 
          longitude: -117.16708, 
          color: [255, 215, 0], // Gold
          character: "barry",
          joined: true
        };
        
        setCharacterLocations(prev => [...prev, barryCharacter]);
        setJoinedCharacters(prev => [...prev, 'barry']);
        
        // Add Barry's marker to the map
        if (charactersLayerRef.current) {
          const point = {
            type: "point",
            longitude: barryCharacter.longitude,
            latitude: barryCharacter.latitude
          };

          const markerSymbol = {
            type: "simple-marker",
            color: barryCharacter.color,
            size: "16px",
            outline: {
              color: [255, 255, 255],
              width: 2
            }
          };

          const popupTemplate = {
            title: barryCharacter.name
          };

          const pointGraphic = new Graphic({
            geometry: point,
            symbol: markerSymbol,
            popupTemplate: popupTemplate,
            attributes: {
              name: barryCharacter.name,
              character: barryCharacter.character,
              joined: barryCharacter.joined
            }
          });

          charactersLayerRef.current.add(pointGraphic);
        }
      }, 2000); // 2 seconds after copy
      
      // Pietro Maximoff joins after 5 seconds
      setTimeout(() => {
        notification.info('Pietro Maximoff joined the rendezvous!');
        
        // Add Pietro to the map and state
        const pietroCharacter = {
          name: "Pietro Maximoff",
          latitude: 34.069237, 
          longitude: -117.186327, 
          color: [138, 43, 226], // Blue Violet
          character: "pietro",
          joined: true
        };
        
        setCharacterLocations(prev => [...prev, pietroCharacter]);
        setJoinedCharacters(prev => [...prev, 'pietro']);
        
        // Add Pietro's privacy buffer to the map
        if (charactersLayerRef.current) {
          // Create a circular buffer around Pietro's location (approx 500m radius)
          const bufferRadius = 0.0045; // Roughly 500 meters in degrees
          const centerLat = pietroCharacter.latitude;
          const centerLng = pietroCharacter.longitude;
          const numPoints = 64; // More points for smoother circle
          
          const circleRings = [];
          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            // Adjust for longitude distortion at this latitude
            const latRadius = bufferRadius;
            const lngRadius = bufferRadius / Math.cos(centerLat * Math.PI / 180);
            
            const lat = centerLat + (latRadius * Math.cos(angle));
            const lng = centerLng + (lngRadius * Math.sin(angle));
            circleRings.push([lng, lat]);
          }

          const bufferPolygon = {
            type: "polygon",
            rings: [circleRings]
          };

          const bufferSymbol = {
            type: "simple-fill",
            color: [...pietroCharacter.color, 0.3], // Same color but 30% opacity
            outline: {
              color: pietroCharacter.color,
              width: 2
            }
          };

          const popupTemplate = {
            title: `${pietroCharacter.name} (Privacy Mode)`
          };

          const bufferGraphic = new Graphic({
            geometry: bufferPolygon,
            symbol: bufferSymbol,
            popupTemplate: popupTemplate,
            attributes: {
              name: pietroCharacter.name,
              character: pietroCharacter.character,
              joined: pietroCharacter.joined
            }
          });

          charactersLayerRef.current.add(bufferGraphic);
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
      
      // Filter results to only show places between all user locations
      const filteredResults = filterResultsBetweenUsers(sortedResults, mainSearchCenter, characterLocations);
      
      console.log(`Found ${sortedResults.length} unique places from ${searchCenters.length} search centers`);
      console.log(`After filtering between users: ${filteredResults.length} places`);
      
      setSearchResults(filteredResults);
      setShowSearchResults(filteredResults.length > 0);
      
      // Add place markers to the map
      if (filteredResults.length > 0) {
        addPlaceMarkersToMap(filteredResults);
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

  const _handleAISearch = async (query) => {
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
      // Get the rendezvous location coordinates for context
      let mainSearchCenter;
      if (rendezvous.location.includes('Current Location') && rendezvous.location.includes('(')) {
        const coordMatch = rendezvous.location.match(/\(([^)]+)\)/);
        if (coordMatch) {
          const [lat, lng] = coordMatch[1].split(',').map(coord => parseFloat(coord.trim()));
          mainSearchCenter = { latitude: lat, longitude: lng };
        }
      } else {
        const coordinates = await geocodeAddress(rendezvous.location);
        if (coordinates) {
          mainSearchCenter = { latitude: coordinates[1], longitude: coordinates[0] };
        }
      }

      if (!mainSearchCenter) {
        mainSearchCenter = { latitude: 34.0522, longitude: -118.2437 };
      }

             // Create search centers for AI search
       const searchCenters = [
         { ...mainSearchCenter, name: 'Main Location' },
         ...characterLocations.map(character => ({
           latitude: character.latitude,
           longitude: character.longitude,
           name: character.name
         }))
       ];

      console.log('AI Search query:', query);
      console.log('Searching from centers:', searchCenters);

      // Parse the AI query to extract relevant search terms
      const aiSearchTerms = parseAIQuery(query);
      console.log('Parsed AI search terms:', aiSearchTerms);

      const allResults = [];
      const serviceUrl = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
      
      for (const center of searchCenters) {
        try {
          // Use the parsed search terms for more targeted search
          const params = {
            address: {
              SingleLine: aiSearchTerms.searchTerm
            },
            location: {
              x: center.longitude,
              y: center.latitude,
              spatialReference: { wkid: 4326 }
            },
            distance: 8000, // 8km radius from each center
            maxLocations: 15, // Increase limit for AI search
            outFields: ["Place_addr", "PlaceName", "Type", "Addr_type"],
            apiKey: ARCGIS_API_KEY
          };

          const response = await locator.addressToLocations(serviceUrl, params);
          
          if (response && response.length > 0) {
            const results = response
              .filter(result => {
                // Apply AI filters
                let score = result.score;
                
                // Boost score based on AI criteria
                if (aiSearchTerms.rating) {
                  // For demo purposes, boost score for well-known chains
                  const wellKnownChains = ['starbucks', 'mcdonalds', 'pizza hut', 'dominos', 'subway', 'walmart', 'target'];
                  const placeName = (result.attributes?.PlaceName || result.address).toLowerCase();
                  if (wellKnownChains.some(chain => placeName.includes(chain))) {
                    score += 15; // Boost score for well-known places
                  }
                }
                
                if (aiSearchTerms.proximity && aiSearchTerms.proximity.includes('near me')) {
                  // Already handled by location-based search
                  score += 5;
                }
                
                return score > 45; // Slightly lower threshold for AI search
              })
              .map((place, index) => ({
                placeId: `${center.name.replace(/\s+/g, '_')}_ai_${index}`,
                name: place.attributes?.PlaceName || place.address,
                address: place.attributes?.Place_addr || place.address,
                location: {
                  longitude: place.location.longitude,
                  latitude: place.location.latitude
                },
                categories: place.attributes?.Type ? [{ label: place.attributes.Type }] : [],
                addressType: place.attributes?.Addr_type || 'Unknown',
                score: Math.round(place.score),
                searchArea: center.name,
                aiContext: aiSearchTerms // Add AI context for display
              }));
            
            allResults.push(...results);
          }
        } catch (error) {
          console.error(`AI Search failed for ${center.name}:`, error);
        }
      }

      // Remove duplicates and sort by enhanced score
      const uniqueResults = [];
      allResults.forEach(result => {
        const isDuplicate = uniqueResults.some(existing => {
          const distance = Math.sqrt(
            Math.pow((existing.location.latitude - result.location.latitude) * 111000, 2) +
            Math.pow((existing.location.longitude - result.location.longitude) * 111000 * Math.cos(result.location.latitude * Math.PI / 180), 2)
          );
          return distance < 100;
        });

        if (!isDuplicate) {
          uniqueResults.push(result);
        }
      });

      const sortedResults = uniqueResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 25);
      
      // Filter results to only show places between all user locations
      const filteredResults = filterResultsBetweenUsers(sortedResults, mainSearchCenter, characterLocations);
      
      console.log(`AI Search found ${sortedResults.length} unique places`);
      console.log(`After filtering between users: ${filteredResults.length} places`);
      
      setSearchResults(filteredResults);
      setShowSearchResults(filteredResults.length > 0);
      
      if (filteredResults.length > 0) {
        addPlaceMarkersToMap(filteredResults);
      }
      
    } catch (error) {
      console.error('AI Search failed:', error);
      setSearchResults([]);
      setShowSearchResults(false);
      if (placesLayerRef.current) {
        placesLayerRef.current.removeAll();
      }
    }
  };

  // Function to check if a point is within the triangle formed by the three user locations
  const isPointInTriangle = (point, triangle) => {
    const [p1, p2, p3] = triangle;
    
    // Calculate the area of the main triangle
    const areaOrig = Math.abs((p2.longitude - p1.longitude) * (p3.latitude - p1.latitude) - 
                             (p3.longitude - p1.longitude) * (p2.latitude - p1.latitude));
    
    // Calculate areas of triangles formed by the point and each edge
    const area1 = Math.abs((p1.longitude - point.longitude) * (p2.latitude - point.latitude) - 
                          (p2.longitude - point.longitude) * (p1.latitude - point.latitude));
    
    const area2 = Math.abs((p2.longitude - point.longitude) * (p3.latitude - point.latitude) - 
                          (p3.longitude - point.longitude) * (p2.latitude - point.latitude));
    
    const area3 = Math.abs((p3.longitude - point.longitude) * (p1.latitude - point.latitude) - 
                          (p1.longitude - point.longitude) * (p3.latitude - point.latitude));
    
    // Check if sum of areas equals original area (with small tolerance for floating point errors)
    return Math.abs(areaOrig - (area1 + area2 + area3)) < 0.0001;
  };

  // Function to filter results to only show places between all user locations
  const filterResultsBetweenUsers = (results, mainCenter, characterLocations) => {
    // If we don't have at least 2 character locations, return all results
    if (characterLocations.length < 2) {
      return results;
    }

    // Create triangle points from main location and first two characters
    const trianglePoints = [
      { latitude: mainCenter.latitude, longitude: mainCenter.longitude },
      { latitude: characterLocations[0].latitude, longitude: characterLocations[0].longitude },
      { latitude: characterLocations[1].latitude, longitude: characterLocations[1].longitude }
    ];

    // Filter results to only include places within the triangle
    const filteredResults = results.filter(result => {
      const resultPoint = {
        latitude: result.location.latitude,
        longitude: result.location.longitude
      };
      
      return isPointInTriangle(resultPoint, trianglePoints);
    });

    // If we have fewer than 3 results within the triangle, return at least the top 3 overall results
    if (filteredResults.length < 3) {
      return results.slice(0, Math.max(3, filteredResults.length));
    }
    return filteredResults;
  };

  // Simple AI query parser
  const parseAIQuery = (query) => {
    const lowerQuery = query.toLowerCase();
    
    // Extract rating mentions
    const ratingMatch = lowerQuery.match(/(\d+)\s*star/);
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
    
    // Extract proximity indicators
    const proximityIndicators = ['near me', 'nearby', 'close to', 'around here'];
    const proximity = proximityIndicators.find(indicator => lowerQuery.includes(indicator));
    
    // Extract main search term (remove rating and proximity words)
    let searchTerm = query;
    if (ratingMatch) {
      searchTerm = searchTerm.replace(ratingMatch[0], '').trim();
    }
    proximityIndicators.forEach(indicator => {
      searchTerm = searchTerm.replace(new RegExp(indicator, 'gi'), '').trim();
    });
    
    // Clean up common words
    searchTerm = searchTerm.replace(/\bwith\b|\bof\b|\ba\b|\ban\b/gi, '').trim();
    
    return {
      searchTerm: searchTerm || query, // Fallback to original if cleaned term is empty
      rating,
      proximity,
      originalQuery: query
    };
  };

  // Function to calculate average travel time from all user locations to a place
  const calculateAverageTravelTime = async (place) => {
    try {
      // Get all user locations (main + characters)
      const userLocations = [];
      
      // Add main rendezvous location
      if (rendezvous?.location) {
        let mainCoords;
        if (rendezvous.location.includes('Current Location') && rendezvous.location.includes('(')) {
          const coordMatch = rendezvous.location.match(/\(([^)]+)\)/);
          if (coordMatch) {
            const [lat, lng] = coordMatch[1].split(',').map(coord => parseFloat(coord.trim()));
            mainCoords = { latitude: lat, longitude: lng, name: 'Jayvee' };
          }
        } else {
          const coordinates = await geocodeAddress(rendezvous.location);
          if (coordinates) {
            mainCoords = { latitude: coordinates[1], longitude: coordinates[0], name: 'Jayvee' };
          }
        }
        if (mainCoords) userLocations.push(mainCoords);
      }
      
      // Add character locations
      characterLocations.forEach(char => {
        userLocations.push({
          latitude: char.latitude,
          longitude: char.longitude,
          name: char.name
        });
      });

      if (userLocations.length === 0) return null;

      // Use ArcGIS Route service to calculate travel times
      const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve";
      
      const travelTimes = [];
      
      for (const userLocation of userLocations) {
        try {
          const stops = [
            `${userLocation.longitude},${userLocation.latitude}`,
            `${place.location.longitude},${place.location.latitude}`
          ];

          const params = new URLSearchParams({
            f: 'json',
            token: ARCGIS_API_KEY,
            stops: stops.join(';'),
            returnDirections: 'false',
            returnRoutes: 'true',
            returnStops: 'false',
            returnBarriers: 'false',
            returnPolygonBarriers: 'false',
            returnPolylineBarriers: 'false',
            outputLines: 'esriNAOutputLineNone',
            findBestSequence: 'false',
            preserveFirstStop: 'true',
            preserveLastStop: 'true',
            useHierarchy: 'true',
            restrictionAttributeNames: '',
            impedanceAttributeName: 'TravelTime',
            accumulateAttributeNames: '',
            attributeParameterValues: '',
            maxAllowableViolationTime: 20,
            returnFacilities: 'false',
            returnIncidents: 'false',
            returnInputs: 'false',
            returnMessages: 'false',
            outputGeometryPrecision: '',
            outputGeometryPrecisionUnits: 'esriUnitsMeters'
          });

          const response = await fetch(routeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params
          });

          if (response.ok) {
            const data = await response.json();
            if (data.routes && data.routes.features && data.routes.features.length > 0) {
              const travelTimeMinutes = data.routes.features[0].attributes.Total_TravelTime;
              travelTimes.push(travelTimeMinutes);
            }
          }
        } catch (error) {
          console.error(`Failed to calculate travel time from ${userLocation.name}:`, error);
        }
      }

      if (travelTimes.length === 0) return null;

      // Calculate average travel time
      const avgTravelTime = travelTimes.reduce((sum, time) => sum + time, 0) / travelTimes.length;
      
      // Format the time nicely
      if (avgTravelTime < 1) {
        return `${Math.round(avgTravelTime * 60)} seconds`;
      } else if (avgTravelTime < 60) {
        return `${Math.round(avgTravelTime)} minutes`;
      } else {
        const hours = Math.floor(avgTravelTime / 60);
        const minutes = Math.round(avgTravelTime % 60);
        return `${hours}h ${minutes}m`;
      }

    } catch (error) {
      console.error('Error calculating average travel time:', error);
      return null;
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
              const { address, categories } = place;

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

              // Add travel time information
              const travelTimeElement = document.createElement("p");
              travelTimeElement.innerHTML = `<strong>Average Travel Time:</strong> <span id="travel-time-${place.placeId}">Calculating...</span>`;
              travelTimeElement.style.marginTop = "5px";
              div.appendChild(travelTimeElement);

              // Calculate travel time asynchronously
              calculateAverageTravelTime(place).then(avgTime => {
                const timeSpan = document.getElementById(`travel-time-${place.placeId}`);
                if (timeSpan) {
                  timeSpan.innerHTML = avgTime || "Unable to calculate";
                  timeSpan.style.color = avgTime ? "#28a745" : "#dc3545";
                }
              });

              const searchResultElement = document.createElement("p");
              searchResultElement.style.marginTop = "10px";
              searchResultElement.style.color = "#007bff";
              searchResultElement.innerHTML = `📍 Search result`;
              div.appendChild(searchResultElement);

              // Create the button element.
              const button = document.createElement("button");
              button.innerText = "Suggest candidate";
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
      const newCandidates = prevCandidates.map(c => ({...c, isSelected: false}));
      const existingCandidate = newCandidates.find((candidate) => candidate.placeId === place.placeId);
      if (existingCandidate) {
        existingCandidate.isSelected = true;
        return newCandidates;
      }
      const newCandidate = { ...place, upvotes: 1, downvotes: 0, isSelected: true, userVote: 'up' };
      if (!firstCandidateSelected.current) {
        firstCandidateSelected.current = true;
        // Barry upvotes after 2 seconds
        setTimeout(() => {
          setCandidates(prev => prev.map(c => c.placeId === newCandidate.placeId ? { ...c, upvotes: c.upvotes + 1 } : c));
          notification.info(`Barry just upvoted ${place.name}.`);
        }, 2000);
        
        // Pietro downvotes after 4 seconds
        setTimeout(() => {
          setCandidates(prev => prev.map(c => c.placeId === newCandidate.placeId ? { ...c, downvotes: c.downvotes + 1 } : c));
          notification.info(`Pietro just downvoted ${place.name}.`);
        }, 4000);
      }
      return [...newCandidates, newCandidate];
    });
  };

  const addSuggestedCandidate = (place) => {
    setCandidates((prevCandidates) => {
      const newCandidates = prevCandidates.map(c => ({...c, isSelected: false}));
      const existingCandidate = newCandidates.find((candidate) => candidate.placeId === place.placeId);
      if (existingCandidate) {
        return newCandidates;
      }
      const newCandidate = { ...place, upvotes: 1, downvotes: 0, isSelected: false, userVote: null };
      return [...newCandidates, newCandidate];
    });
  };

  const handleVote = (placeId, voteType) => {
    setCandidates((prevCandidates) => {
      return prevCandidates.map((candidate) => {
        if (candidate.placeId === placeId) {
          const newVoteDirection = voteType === 'upvotes' ? 'up' : 'down';
          // If the user is trying to cast the same vote again, do nothing.
          if (candidate.userVote === newVoteDirection) {
            return candidate;
          }

          let newUpvotes = candidate.upvotes;
          let newDownvotes = candidate.downvotes;

          // If there was a previous vote, reverse it.
          if (candidate.userVote === 'up') {
            newUpvotes -= 1;
          } else if (candidate.userVote === 'down') {
            newDownvotes -= 1;
          }

          // Apply the new vote.
          if (newVoteDirection === 'up') {
            newUpvotes += 1;
          } else {
            newDownvotes += 1;
          }

          return {
            ...candidate,
            upvotes: newUpvotes,
            downvotes: newDownvotes,
            isSelected: true,
            userVote: newVoteDirection,
          };
        }
        return { ...candidate, isSelected: false };
      });
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

  const handleConfirmRendezvous = (candidate) => {
    setConfirmedCandidate(candidate);
    setCandidates([candidate]);
    setSearchResults([]);
    setShowSearchResults(false);
    if (placesLayerRef.current) {
      placesLayerRef.current.removeAll();
    }
    notification.success(`Rendezvous point confirmed: ${candidate.name}!`);

    setTimeout(() => {
      notification.info('You should leave soon!');
      setRendezvousStarted(true);
    }, 4000);
  };

  // Function to calculate route using ArcGIS
  const calculateRoute = async (startPoint, endPoint) => {
    try {
      const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

      // Create route parameters
      const routeParams = new RouteParameters({
        stops: new FeatureSet({
          features: [
            new Graphic({
              geometry: new Point({
                longitude: startPoint.longitude,
                latitude: startPoint.latitude
              })
            }),
            new Graphic({
              geometry: new Point({
                longitude: endPoint.longitude,
                latitude: endPoint.latitude
              })
            })
          ]
        }),
        returnDirections: true,
        directionsLengthUnits: "miles",
        directionsTimeAttribute: "TravelTime",
        apiKey: ARCGIS_API_KEY
      });

      // Solve the route
      const result = await route.solve(routeUrl, routeParams);
      
      if (result.routeResults && result.routeResults.length > 0) {
        const routeResult = result.routeResults[0];
        
        // Extract directions from the result (following ArcGIS tutorial approach)
        const directions = [];
        let cumulativeDistance = 0;
        let cumulativeTime = 0;
        
        if (routeResult.directions && routeResult.directions.features) {
          console.log('Raw directions from ArcGIS:', routeResult.directions.features.length);
          
          routeResult.directions.features.forEach((feature, index) => {
            const attrs = feature.attributes;
            const segmentDistance = attrs.length || 0; // miles
            const segmentTime = attrs.time || 0; // minutes  
            const directionText = attrs.text || "Continue";
            
            console.log(`Direction ${index}: "${directionText}", ${segmentDistance.toFixed(2)} miles, ${segmentTime.toFixed(2)} min`);
            
            // Filter out unwanted directions (but keep more than before)
            if (directionText.toLowerCase().includes('start at') || 
                directionText.toLowerCase().includes('finish at')) {
              return; // Skip only start/finish
            }
            
            directions.push({
              index: index,
              text: directionText,
              distance: segmentDistance, // miles
              time: segmentTime, // minutes
              maneuverType: attrs.maneuverType || "unknown",
              cumulativeDistance: cumulativeDistance,
              endDistance: cumulativeDistance + segmentDistance,
              cumulativeTime: cumulativeTime,
              endTime: cumulativeTime + segmentTime,
              geometry: feature.geometry
            });
            
            cumulativeDistance += segmentDistance;
            cumulativeTime += segmentTime;
          });
          
          console.log(`Processed ${directions.length} directions, total time: ${cumulativeTime.toFixed(2)} minutes`);
        }
        
        return {
          route: routeResult.route,
          directions: directions
        };
      }
      throw new Error('No route found');
    } catch (error) {
      console.error('Route calculation failed:', error);
      throw error;
    }
  };

    // Function to animate user to destination with simple, consistent timing
  const animateUserToDestination = async (routeGeometry) => {
    if (!userMarkerRef.current || !routeGeometry || animationInProgress) return;

    setAnimationInProgress(true);
    animationCancelRef.current = false;
    
    try {
      // Get all the path coordinates from the route
      const paths = routeGeometry.paths[0];
      const totalAnimationTime = 35000; // 35 seconds total (slower than friends)
      const stepDuration = totalAnimationTime / (paths.length - 1);
      
      console.log(`Starting user navigation: ${paths.length} points over ${totalAnimationTime}ms`);
      console.log(`Step duration: ${stepDuration.toFixed(0)}ms per point`);
      
      // Animate through each point with consistent timing
      for (let i = 0; i < paths.length; i++) {
        if (animationCancelRef.current) {
          console.log('User animation cancelled at step', i);
          break;
        }
        
        const [longitude, latitude] = paths[i];
        
        // Update user marker position
        const newPoint = {
          type: "point",
          longitude: longitude,
          latitude: latitude
        };

        userMarkerRef.current.geometry = newPoint;

        // Center map on user only if progress view is not active
        if (!progressViewActiveRef.current && mapViewRef.current && i % 2 === 0) {
          requestAnimationFrame(() => {
            if (mapViewRef.current && !progressViewActiveRef.current) {
              mapViewRef.current.goTo({
                center: [longitude, latitude],
                zoom: 16
              }, {
                duration: 150,
                easing: "out-cubic"
              }).catch(() => {
                // Ignore errors
              });
            }
          });
        }

        // Wait for next step with consistent timing
        if (i < paths.length - 1) {
          await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
      }

      if (!animationCancelRef.current) {
        notification.success('You have arrived at Pieology Pizzeria!');
        setShowDirections(false);
        progressViewActiveRef.current = false;
        arrivals.user = true;
        checkIfEveryoneArrived();
      }
    } catch (error) {
      console.error('User animation failed:', error);
    } finally {
      setAnimationInProgress(false);
    }
  };









  // Function to clear only non-essential layers (keep characters and destination)
  const clearNonEssentialLayers = () => {
    // Clear places layer (search results)
    if (placesLayerRef.current) {
      placesLayerRef.current.removeAll();
    }

    // Clear all candidates except the confirmed one
    if (candidateLayerRef.current) {
      candidateLayerRef.current.removeAll();
      
      // Re-add only the confirmed candidate
      if (confirmedCandidate) {
        const point = {
          type: "point",
          longitude: confirmedCandidate.location.longitude,
          latitude: confirmedCandidate.location.latitude,
        };
        
        const markerSymbol = {
          type: "simple-marker",
          color: [0, 255, 0], // Green for destination
          size: "16px",
          outline: { color: [255, 255, 255], width: 2 },
        };

        const popupTemplate = {
          title: confirmedCandidate.name,
          content: "Destination"
        };

        const pointGraphic = new Graphic({
          geometry: point,
          symbol: markerSymbol,
          popupTemplate: popupTemplate,
        });

        candidateLayerRef.current.add(pointGraphic);
      }
    }
    // Keep characters layer visible - do not clear
  };

  const handleStartTrip = async () => {
    setTripStarted(true);
    notification.info("Trip started! Calculating route...");

    // Reset arrivals and movement flags for new trip
    arrivals.user = false;
    arrivals.barry = false; 
    arrivals.maximoff = false;
    barryMovingRef.current = false;

    try {
      if (!confirmedCandidate || !userCoordinates) {
        notification.error("Missing location data for routing");
        return;
      }

      // Clear non-essential layers (keep characters visible)
      clearNonEssentialLayers();

      // Close any open popups
      if (mapViewRef.current) {
        mapViewRef.current.popup.close();
      }

      // Zoom to user location for navigation
      await mapViewRef.current.goTo({
        center: [userCoordinates.longitude, userCoordinates.latitude],
        zoom: 16 // Good zoom for navigation
      });

      const startPoint = {
        latitude: userCoordinates.latitude,
        longitude: userCoordinates.longitude
      };

      const endPoint = {
        latitude: confirmedCandidate.location.latitude,
        longitude: confirmedCandidate.location.longitude
      };

      // Calculate the route
      const routeResult = await calculateRoute(startPoint, endPoint);
      
      // Use custom directions instead of ArcGIS directions for better timing control
      const customDirections = [
        { text: "Head northwest on New York St", duration: 1000 }, // 2 seconds
        { text: "Continue forward on New York St", duration: 2000 }, // 7 seconds  
        { text: "Turn right onto W Redlands Blvd", duration: 2000 }, // 3 seconds
        { text: "Turn left onto Orange St", duration: 12000 } // 12 seconds (longer segment)
      ];
      
      setCurrentDirections(customDirections);
      setCurrentDirectionIndex(0);
      setShowDirections(true);

      // Add route to map for user navigation
      if (routeLayerRef.current && routeResult.route) {
        routeLayerRef.current.removeAll();

        const routeSymbol = {
          type: "simple-line",
          color: [0, 100, 255], // Blue route line
          width: 4
        };

        const routeGraphic = new Graphic({
          geometry: routeResult.route.geometry,
          symbol: routeSymbol
        });

        routeLayerRef.current.add(routeGraphic);

        // Start navigation immediately
        notification.success("Navigation started!");
        
        // Notify about friends starting their trips and start their movement
        setTimeout(() => {
          notification.info("Barry Allen started his trip!");
          // Start Barry moving immediately when notification appears
          startBarryMovement();
        }, 2000);

        setTimeout(() => {
          notification.info("Pietro Maximoff started his trip!");
          // Start Maximoff moving immediately when notification appears (off screen)
          startMaximoffMovement();
        }, 4000); // Increased delay

        // Start user navigation animation (35 seconds total)
        animateUserToDestination(routeResult.route.geometry);
        
        // Start custom direction progression
        startCustomDirections(customDirections);
      }

    } catch (error) {
      console.error('Route calculation failed:', error);
      notification.error("Failed to calculate route. Please try again.");
    }
  };

  // Function to progress through custom directions with predefined timing
  const startCustomDirections = (directions) => {
    console.log('Starting custom direction progression');
    
    let cumulativeTime = 0;
    
    directions.forEach((direction, index) => {
      setTimeout(() => {
        // Only update directions if progress view is not active
        if (!progressViewActiveRef.current && index < directions.length) {
          setCurrentDirectionIndex(index);
          console.log(`Direction ${index + 1}: "${direction.text}" (${direction.duration}ms)`);
        }
      }, cumulativeTime);
      
      cumulativeTime += direction.duration;
    });
  };

  // Start Barry moving to destination (called when trip notification appears)
  const startBarryMovement = async () => {
    if (!confirmedCandidate || barryMovingRef.current) return;
    
    const barryLocation = characterLocations.find(char => char.character === 'barry');
    if (!barryLocation) return;

    console.log('Barry starting his journey immediately');
    barryMovingRef.current = true;
    
    try {
      const barryRoute = await calculateRoute(
        { latitude: barryLocation.latitude, longitude: barryLocation.longitude },
        { latitude: confirmedCandidate.location.latitude, longitude: confirmedCandidate.location.longitude }
      );

      // Animate Barry to destination over 25 seconds
      animateBarryToDestination(barryLocation, barryRoute.route.geometry, 25000);
      
    } catch (error) {
      console.error('Failed to calculate Barry\'s route:', error);
      barryMovingRef.current = false;
    }
  };

    // Start Maximoff moving to destination (called when trip notification appears, off screen)
  const startMaximoffMovement = () => {
    if (!confirmedCandidate) return;
    
    const maximoffLocation = characterLocations.find(char => char.character === 'pietro');
    if (!maximoffLocation) return;

    console.log('Pietro Maximoff starting his journey immediately (off screen)');
    
    // Start Maximoff's virtual journey - only send arrival notification here
    const maximoffJourneyDuration = 30000; // 30 seconds
    
    // Only send arrival notification from here (progress notifications handled in progress view)
    setTimeout(() => {
      notification.success('Pietro Maximoff has arrived at Pieology Pizzeria! (Privacy mode)');
      arrivals.maximoff = true;
      checkIfEveryoneArrived();
    }, maximoffJourneyDuration + 500);
  };

  // Track arrivals and notify when everyone has arrived
  const arrivals = { user: false, barry: false, maximoff: false };
  const checkIfEveryoneArrived = () => {
    if (arrivals.user && arrivals.barry && arrivals.maximoff) {
      setTimeout(() => {
        notification.success('🎉 Everyone has arrived at Pieology Pizzeria! Time to enjoy some pizza!');
      }, 1000);
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

  const handleProgressView = () => {
    console.log('Progress view clicked');
    
    // Don't cancel user animation - let them continue moving
    // Hide directions and activate progress view
    setShowDirections(false);
    progressViewActiveRef.current = true;
    
    // Clear route lines when entering progress view (cleaner look)
    if (routeLayerRef.current) {
      routeLayerRef.current.removeAll();
    }
    
    notification.info("Switching to Progress View - tracking Barry and Pietro heading to the pizza place!");

    // Remove Maximoff from the map (privacy mode - location sharing off)
    removeMaximoffFromMap();

    // Zoom out to show user, Barry, and destination
    if (mapViewRef.current && confirmedCandidate) {
      const barryLocation = characterLocations.find(char => char.character === 'barry');
      
      if (barryLocation) {
        const allLocations = [
          { latitude: userCoordinates?.latitude, longitude: userCoordinates?.longitude },
          { latitude: barryLocation.latitude, longitude: barryLocation.longitude },
          { latitude: confirmedCandidate.location.latitude, longitude: confirmedCandidate.location.longitude }
        ].filter(loc => loc.latitude && loc.longitude);

        if (allLocations.length > 0) {
          // Find center and zoom level to fit all locations
          const lats = allLocations.map(loc => loc.latitude);
          const lngs = allLocations.map(loc => loc.longitude);
          
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          
          mapViewRef.current.goTo({
            center: [centerLng, centerLat],
            zoom: 14 // Reduced zoom (was 12) - less zoomed out
          }, {
            duration: 1500,
            easing: "ease-in-out"
          });
        }
      }
    }

    // Start Barry's journey to destination
    setTimeout(() => {
      startBarryJourney();
    }, 1500); // Start after zoom completes

    // Maximoff is already moving (started earlier), but restart notifications for progress view
    setTimeout(() => {
      startMaximoffProgressNotifications();
    }, 2000); // Start slightly after Barry
  };

  const startMaximoffProgressNotifications = () => {
    if (!progressViewActiveRef.current) return;

    console.log('Starting Maximoff progress view notifications (privacy mode)');
    
    // Calculate how much time is left in Maximoff's journey when progress view starts
    // Assuming progress view is typically activated around 12-15 seconds into the trip
    const remainingJourneyDuration = 15000; // 15 seconds remaining
    
    // Send progress notifications for Maximoff in progress view only
    const maximoffProgressNotifications = [
      { percent: 50, time: remainingJourneyDuration * 0.2 }, // Show 50% early since we're mid-journey
      { percent: 75, time: remainingJourneyDuration * 0.6 }
    ];

    maximoffProgressNotifications.forEach(progressNotif => {
      setTimeout(() => {
        if (progressViewActiveRef.current) {
          notification.info(`Pietro Maximoff is ${progressNotif.percent}% of the way there! (Privacy mode)`);
        }
      }, progressNotif.time);
    });

    // Don't send arrival notification here - it's handled in startMaximoffMovement
  };

  const removeMaximoffFromMap = () => {
    if (!charactersLayerRef.current) return;
    
    // Find and remove Maximoff's graphics (both marker and privacy buffer)
    const graphicsToRemove = [];
    charactersLayerRef.current.graphics.forEach(graphic => {
      if (graphic.attributes?.character === 'pietro') {
        graphicsToRemove.push(graphic);
      }
    });
    
    graphicsToRemove.forEach(graphic => {
      charactersLayerRef.current.remove(graphic);
    });
    
    console.log('Removed Maximoff from map');
  };

  const startBarryJourney = async () => {
    if (!confirmedCandidate) return;
    
    // If Barry is already moving, don't restart his animation - just let progress view show him
    if (barryMovingRef.current) {
      console.log('Barry is already moving, not restarting animation');
      return;
    }
    
    const barryLocation = characterLocations.find(char => char.character === 'barry');
    if (!barryLocation) return;

    console.log('Barry starting journey in progress view');
    barryMovingRef.current = true;

    // Calculate Barry's route
    try {
      const barryRoute = await calculateRoute(
        { latitude: barryLocation.latitude, longitude: barryLocation.longitude },
        { latitude: confirmedCandidate.location.latitude, longitude: confirmedCandidate.location.longitude }
      );

      // Skip adding Barry's route line - just show dot moving
      
      // Animate Barry to destination with progress notifications (15 seconds in progress view)
      animateBarryToDestination(barryLocation, barryRoute.route.geometry, 15000);
      
    } catch (error) {
      console.error('Failed to calculate Barry\'s route:', error);
      barryMovingRef.current = false;
    }
  };

    const animateBarryToDestination = async (barryLocation, routeGeometry, duration = 25000) => {
    if (!charactersLayerRef.current || !routeGeometry) return;

    // Find Barry's graphic on the map
    const barryGraphic = charactersLayerRef.current.graphics.find(
      graphic => graphic.attributes?.character === 'barry'
    );

    if (!barryGraphic) {
      console.log('Barry graphic not found');
      return;
    }

    console.log(`Starting Barry's ${duration}ms journey to destination`);

    // Get route path points  
    const paths = routeGeometry.paths[0];
    const stepDuration = duration / (paths.length - 1);

    // Send progress notifications (only if in progress view)
    const progressNotifications = [
      { percent: 25, time: duration * 0.25 },
      { percent: 50, time: duration * 0.5 },
      { percent: 75, time: duration * 0.75 }
    ];

    progressNotifications.forEach(progressNotif => {
      setTimeout(() => {
        if (progressViewActiveRef.current) {
          notification.info(`Barry is ${progressNotif.percent}% of the way there!`);
        }
      }, progressNotif.time);
    });

    // Animate Barry along the route
    for (let i = 0; i < paths.length; i++) {
      const [longitude, latitude] = paths[i];

      // Update Barry's position
      const newPoint = {
        type: "point",
        longitude: longitude,
        latitude: latitude
      };

      if (barryGraphic && charactersLayerRef.current.graphics.includes(barryGraphic)) {
        barryGraphic.geometry = newPoint;
      }

      // Wait for next step
      if (i < paths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      }
    }

    // Barry arrived notification
    setTimeout(() => {
      notification.success('Barry has arrived at Pieology Pizzeria!');
      arrivals.barry = true;
      barryMovingRef.current = false; // Reset Barry movement flag
      checkIfEveryoneArrived();
    }, 500);
  };



  const clearSearch = () => {
    setSearchValue('');
    setSearchResults([]);
    setShowSearchResults(false);

    if (firstClear.current) {
      const pielogoyPizzeria = {
        name: 'Pielogoy Pizzeria',
        address: '623 Orange St, Redlands, CA 92374',
        location: {
          latitude: 34.06041958385699,
          longitude: -117.18279298491065,
        },
        placeId: 'pielogoy_pizzeria', // Unique ID for this mock place
        categories: [{ label: 'Pizza' }],
        addressType: 'PointAddress',
        score: 100,
        searchArea: 'Redlands'
      };
      
      setTimeout(() => {
        notification.info('Pietro Maximoff suggested Pielogoy Pizzeria!');
        addSuggestedCandidate(pielogoyPizzeria);
      }, 1000);
      
      // Barry upvotes Pietro's suggestion after 3 seconds
      setTimeout(() => {
        setCandidates(prev => prev.map(c => 
          c.placeId === 'pielogoy_pizzeria' ? { ...c, upvotes: c.upvotes + 1 } : c
        ));
        notification.info('Barry just upvoted Pielogoy Pizzeria!');
      }, 3000);

      firstClear.current = false;
    }
    
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
      
     {!rendezvousStarted && (
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
                 {displayedResults.length} result
                 {displayedResults.length !== 1 ? "s" : ""} found
               </span>
             </div>
             {displayedResults.map((result, index) => (
               <div key={index} className="search-result-item">
                 <div
                   onClick={() => selectSearchResult(result)}
                   style={{ cursor: "pointer", flex: 1 }}
                 >
                   <div className="search-result-name">{result.name}</div>
                   <div className="search-result-address">
                     {result.address}
                   </div>
                 </div>
               </div>
             ))}
           </div>
         )}
       </div>
     )}
      
     <div className="map-container" ref={mapRef}></div>

     {rendezvousStarted && !tripStarted && (
       <div className="start-trip-container">
         <button className="start-trip-btn" onClick={handleStartTrip}>
           Start Trip
         </button>
       </div>
     )}

     {showDirections && (
       <div className="friends-view-container">
         <button className="friends-view-btn" onClick={handleProgressView}>
           Progress View
         </button>
       </div>
     )}

     {showDirections && currentDirections.length > 0 && (
       <div className="directions-panel">
         <div className="directions-header">
           <div className="directions-title">Navigation</div>
           <div className="directions-progress">
             Step {currentDirectionIndex + 1} of 8
           </div>
         </div>
         <div className="current-direction">
           <div className="direction-text">
             <div className="direction-instruction">
               {currentDirections[currentDirectionIndex]?.text || ""}
             </div>
           </div>
         </div>
         {currentDirectionIndex + 1 < currentDirections.length && (
           <div className="next-direction">
             <div className="next-direction-label">Then:</div>
             <div className="next-direction-text">
               {currentDirections[currentDirectionIndex + 1]?.text || ""}
             </div>
           </div>
         )}
       </div>
     )}
   </div>
 );
};

export default RendezvousMapPage; 