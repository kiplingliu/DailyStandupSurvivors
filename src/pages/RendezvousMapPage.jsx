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
  const [isAISearchEnabled, setIsAISearchEnabled] = useState(false);

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
              </div>
            `;
            const buttonContainer = document.createElement("div");

            const upvoteButton = document.createElement("button");
            upvoteButton.innerText = "Upvote";
            upvoteButton.style.cssText = "background-color: green; color: white; margin-right: 5px;";
            upvoteButton.classList.add("esri-button");
            upvoteButton.addEventListener("click", () => handleVote(candidate.placeId, "upvotes"));
            buttonContainer.appendChild(upvoteButton);
            
            const downvoteButton = document.createElement("button");
            downvoteButton.innerText = "Downvote";
            downvoteButton.style.cssText = "background-color: red; color: white;";
            downvoteButton.classList.add("esri-button");
            downvoteButton.addEventListener("click", () => handleVote(candidate.placeId, "downvotes"));
            buttonContainer.appendChild(downvoteButton);

            div.appendChild(buttonContainer);
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
}, [candidates]); // This single effect handles all updates

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

  const handleAISearch = async (query) => {
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
    return results.filter(result => {
      const resultPoint = {
        latitude: result.location.latitude,
        longitude: result.location.longitude
      };
      
      return isPointInTriangle(resultPoint, trianglePoints);
    });
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



  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      if (isAISearchEnabled) {
        handleAISearch(value);
      } else {
        handleSearch(value);
      }
    }, 300);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Clear any pending debounced search
      clearTimeout(window.searchTimeout);
      // Trigger immediate search
      if (isAISearchEnabled) {
        handleAISearch(searchValue);
      } else {
        handleSearch(searchValue);
      }
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
      return [...newCandidates, { ...place, upvotes: 0, downvotes: 0, isSelected: true }];
    });
  };

  const handleVote = (placeId, voteType) => {
    setCandidates((prevCandidates) => {
      return prevCandidates.map((candidate) => {
        if (candidate.placeId === placeId) {
          return { ...candidate, [voteType]: candidate[voteType] + 1, isSelected: true };
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
            placeholder={isAISearchEnabled ? "Try: 'pizza place near me with 4 star rating'" : "Search for places..."}
            value={searchValue}
            onChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
          />
          <button 
            className={`ai-toggle-btn ${isAISearchEnabled ? 'active' : ''}`}
            onClick={() => setIsAISearchEnabled(!isAISearchEnabled)}
            title={isAISearchEnabled ? "Switch to regular search" : "Switch to AI search"}
          >
            🤖
          </button>
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
                {isAISearchEnabled && (
                  <span className="ai-indicator">🤖 AI: </span>
                )}
                {displayedResults.length} result{displayedResults.length !== 1 ? 's' : ''} found
              </span>
            </div>
            {displayedResults.map((result, index) => (
              <div
                key={index}
                className="search-result-item"
              >
                <div onClick={() => selectSearchResult(result)} style={{ cursor: 'pointer', flex: 1 }}>
                  <div className="search-result-name">
                    {result.name}
                    {isAISearchEnabled && result.aiContext && (
                      <span className="ai-badge">🤖</span>
                    )}
                  </div>
                  <div className="search-result-address">{result.address}</div>
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