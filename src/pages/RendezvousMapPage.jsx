import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/RendezvousMapPage.css';

const RendezvousMapPage = () => {
  const { rendezvousData } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [rendezvous, setRendezvous] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [copied, setCopied] = useState(false);

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

  const geocodeAddress = async (address) => {
    try {
      const locator = await new Promise((resolve) => {
        window.require(['esri/rest/locator'], resolve);
      });

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
      // Load ArcGIS modules
      const [Map, MapView, Graphic, GraphicsLayer] = await new Promise((resolve) => {
        window.require([
          'esri/Map',
          'esri/views/MapView',
          'esri/Graphic',
          'esri/layers/GraphicsLayer'
        ], (...modules) => resolve(modules));
      });

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
        basemap: "streets-vector" // Street view basemap
      });

      // Create the view
      const view = new MapView({
        container: mapRef.current,
        map: map,
        center: coordinates,
        zoom: 15 // Good zoom level for street view
      });

      // Create graphics layer for the rendezvous point
      const graphicsLayer = new GraphicsLayer();
      map.add(graphicsLayer);

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

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Join me for: ${rendezvous?.name || 'Rendezvous'}`);
    const body = encodeURIComponent(
      `Hi! I'd like to invite you to join me for "${rendezvous?.name || 'a rendezvous'}"\n\n` +
      `📅 When: ${rendezvous ? new Date(rendezvous.datetime).toLocaleString() : 'TBD'}\n` +
      `📍 Where: ${rendezvous?.location || 'TBD'}\n\n` +
      `Click this link to view the location and join: ${shareableLink}\n\n` +
      `See you there!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
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
      <div className="map-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
          <div className="rendezvous-info">
            <h1 className="rendezvous-title">{rendezvous.name}</h1>
            <p className="rendezvous-details">
              {new Date(rendezvous.datetime).toLocaleString()} • {rendezvous.location}
            </p>
          </div>
        </div>
      </div>

      <div className="map-container" ref={mapRef}></div>

      <div className="sharing-panel">
        <h3>Share this Rendezvous</h3>
        <div className="share-actions">
          <div className="share-link-container">
            <input 
              type="text" 
              value={shareableLink} 
              readOnly 
              className="share-link-input"
            />
            <button 
              className={`copy-btn ${copied ? 'copied' : ''}`}
              onClick={copyShareableLink}
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <button className="email-share-btn" onClick={shareViaEmail}>
            📧 Share via Email
          </button>
        </div>
        <p className="share-help">
          Send this link to friends so they can view the location and join your rendezvous!
        </p>
      </div>
    </div>
  );
};

export default RendezvousMapPage; 