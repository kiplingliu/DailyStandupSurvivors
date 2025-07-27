import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HamburgerMenu.css';

const HamburgerMenu = ({ title, time, userAddress, shareableLink, copyShareableLink, copied }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingField, setEditingField] = useState(null); // 'name', 'datetime', 'location', 'transportation', or null
  const [savedData, setSavedData] = useState({
    name: title,
    datetime: time,
    location: userAddress,
    transportation: 'car'
  });
  const [editData, setEditData] = useState({
    name: title,
    datetime: time,
    location: userAddress,
    transportation: 'car'
  });
  const [settings, setSettings] = useState({
    notifications: false,
    privacy: false
  });
  const editRef = useRef(null);
  const navigate = useNavigate();

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  const toggleShare = () => {
    setShowShare(!showShare);
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const closeDrawer = () => {
    setIsOpen(false);
    setShowShare(false);
    setShowSettings(false);
    setEditingField(null);
  };

  const goHome = () => {
    navigate('/');
    closeDrawer();
  };

  const startEditing = (field) => {
    setEditingField(field);
    setEditData({
      ...savedData
    });
  };

  const saveField = () => {
    // Save the current edit data to savedData
    setSavedData({
      ...savedData,
      [editingField]: editData[editingField]
    });
    setEditingField(null);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditData({
      ...savedData
    });
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  // Handle click outside to cancel editing
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editRef.current && !editRef.current.contains(event.target) && editingField) {
        cancelEditing();
      }
    };

    if (editingField) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingField]);

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const dateOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const timeOptions = { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    };
    
    return {
      date: date.toLocaleDateString(undefined, dateOptions),
      time: date.toLocaleTimeString(undefined, timeOptions)
    };
  };

  // Format datetime for input field (YYYY-MM-DDTHH:MM format)
  const formatDateTimeForInput = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Use edited data if editing that field, otherwise use saved data
  const displayData = {
    name: editingField === 'name' ? editData.name : savedData.name,
    datetime: editingField === 'datetime' ? editData.datetime : savedData.datetime,
    location: editingField === 'location' ? editData.location : savedData.location,
    transportation: editingField === 'transportation' ? editData.transportation : savedData.transportation
  };
  
  const { date, time: formattedTime } = formatDateTime(displayData.datetime);

  return (
    <>
      <button 
        className="hamburger-btn"
        onClick={toggleDrawer}
        aria-label="Open menu"
      >
        <div className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>

      {isOpen && <div className="overlay" onClick={closeDrawer}></div>}
      
      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title-section">
            {editingField === 'name' ? (
              <div className="header-edit-container" ref={editRef}>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  className="header-edit-input"
                  placeholder="Enter event name"
                  autoFocus
                />
                <button className="header-save-btn" onClick={saveField}>✓</button>
              </div>
            ) : (
              <h2 className="sidebar-title" onClick={() => startEditing('name')}>{displayData.name}</h2>
            )}
            <button 
              className="close-btn"
              onClick={closeDrawer}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="sidebar-content">
          <div className="event-details">
            <h3 className="section-title">Event Details</h3>
            
            <div className="detail-item">
              <div className="detail-content">
                <div className="detail-label">Date & Time</div>
                {editingField !== 'datetime' ? (
                  <div className="detail-value clickable-field" onClick={() => startEditing('datetime')}>
                    <div>{date}</div>
                    <div>{formattedTime}</div>
                  </div>
                ) : (
                  <div className="edit-container" ref={editRef}>
                    <input
                      type="datetime-local"
                      value={formatDateTimeForInput(editData.datetime)}
                      onChange={(e) => handleEditChange('datetime', e.target.value)}
                      className="edit-input datetime-input"
                      autoFocus
                    />
                    <button className="save-btn" onClick={saveField}>✓</button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="detail-item">
              <div className="detail-content">
                <div className="detail-label">Transportation</div>
                {editingField !== 'transportation' ? (
                  <div className="detail-value clickable-field" onClick={() => startEditing('transportation')}>
                    {displayData.transportation.charAt(0).toUpperCase() + displayData.transportation.slice(1)}
                  </div>
                ) : (
                  <div className="edit-container" ref={editRef}>
                    <select
                      value={editData.transportation}
                      onChange={(e) => handleEditChange('transportation', e.target.value)}
                      className="edit-input transportation-select"
                      autoFocus
                    >
                      <option value="car">Car</option>
                    </select>
                    <button className="save-btn" onClick={saveField}>✓</button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="detail-item">
              <div className="detail-content">
                <div className="detail-label">Leaving From</div>
                {editingField !== 'location' ? (
                  <div className="detail-value clickable-field" onClick={() => startEditing('location')}>{displayData.location}</div>
                ) : (
                  <div className="edit-container" ref={editRef}>
                    <input
                      type="text"
                      value={editData.location}
                      onChange={(e) => handleEditChange('location', e.target.value)}
                      className="edit-input"
                      placeholder="Enter location"
                      autoFocus
                    />
                    <button className="save-btn" onClick={saveField}>✓</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="actions-section">
            <h3 className="section-title">Actions</h3>
            
            <button 
              className="action-btn share-btn"
              onClick={toggleShare}
            >
              <span className="action-text">Share Rendezvous</span>
              <span className={`action-arrow ${showShare ? 'action-arrow-up' : ''}`}>›</span>
            </button>
            
            {showShare && (
              <div className="share-panel">
                <div className="share-input-container">
                  <input 
                    type="text" 
                    value={shareableLink} 
                    readOnly 
                    className="share-input"
                    placeholder="Shareable link"
                  />
                  <button 
                    onClick={copyShareableLink} 
                    className={`copy-btn ${copied ? 'copy-btn-copied' : ''}`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="share-help">Share this link with others to invite them to the rendezvous</p>
              </div>
            )}
            
            <button 
              className="action-btn settings-btn"
              onClick={toggleSettings}
            >
              <span className="action-text">Settings</span>
              <span className={`action-arrow ${showSettings ? 'action-arrow-up' : ''}`}>›</span>
            </button>
            
            {showSettings && (
              <div className="settings-panel">
                <div className="setting-item">
                  <span className="setting-label">Location Buffer</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.notifications}
                      onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Location Sharing</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.privacy}
                      onChange={(e) => handleSettingChange('privacy', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            )}
            
            <button 
              className="action-btn home-btn"
              onClick={goHome}
            >
              <span className="action-text">Home</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default HamburgerMenu;