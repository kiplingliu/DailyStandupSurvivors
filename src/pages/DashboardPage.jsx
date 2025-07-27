import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Typography, Card } from 'antd';
import { PushpinOutlined, CloseOutlined } from '@ant-design/icons';

// --- CSS is included in the component for a self-contained example ---

const { Title, Text } = Typography;
const { Header, Content } = Layout;

// --- MOCK DATA & CONFIG ---
const tripData = {
  tripName: 'Pizza Time',
  startTime: '3:45 PM',
  endTime: '3:51 PM',
  totalTime: '6 minutes',
  destination: 'Pieology Pizzeria',
  gasMoneyThisTrip: 1.25,
  gasMoneyAllTrips: 5.12,
  tripDetails: {
    totalDistance: '0.8 miles',
    averageSpeed: '9.6 mph',
    carbonSaved: '0.5 kg CO2',
    caloriesBurned: 8
  },
  participants: [
    {
      name: 'Deanne Watts',
      departureTime: '3:45 PM',
      arrivalTime: '3:51 PM',
      travelTime: '5 minutes',
      distance: '0.8 miles',
      status: 'late',
      firstToLeave: true,
      firstToArrive: false,
      onTime: false,
      responsive: true,
      latenessPoints: -10, // Late arrival penalty
      responsivenessPoints: 15,
      punctualityPoints: 0, // No punctuality points for being late
      leadershipPoints: 10,
      totalScore: 15,
    },
    {
      name: 'Barry Allen',
      departureTime: '3:47 PM',
      arrivalTime: '3:48 PM',
      travelTime: '1 minute',
      distance: '0.6 miles',
      status: 'on-time',
      firstToLeave: false,
      firstToArrive: true,
      onTime: true,
      responsive: true,
      latenessPoints: 0,
      responsivenessPoints: 15,
      punctualityPoints: 25,
      leadershipPoints: 0,
      totalScore: 40,
    },
    {
      name: 'Pietro Maximoff',
      departureTime: '3:50 PM',
      arrivalTime: '3:49 PM',
      travelTime: '4 minutes',
      distance: '0.7 miles',
      status: 'on-time',
      firstToLeave: false,
      firstToArrive: false,
      onTime: true,
      responsive: true,
      latenessPoints: 0,
      responsivenessPoints: 20,
      punctualityPoints: 15,
      leadershipPoints: 0,
      totalScore: 35,
    },
  ],
  leaderboard: [
    {
      name: 'Barry Allen',
      latenessPoints: 0,
      responsivenessPoints: 15,
      punctualityPoints: 25,
      leadershipPoints: 0,
      totalScore: 40,
      arrivalTime: '3:48 PM',
      travelTime: '1 minute',
      status: '🏆 First to arrive'
    },
    {
      name: 'Pietro Maximoff',
      latenessPoints: 0,
      responsivenessPoints: 20,
      punctualityPoints: 15,
      leadershipPoints: 0,
      totalScore: 35,
      arrivalTime: '3:49 PM',
      travelTime: '4 minutes',
      status: '⏰ On time'
    },
    {
      name: 'Deanne Watts',
      latenessPoints: -10,
      responsivenessPoints: 15,
      punctualityPoints: 0,
      leadershipPoints: 10,
      totalScore: 25,
      arrivalTime: '3:51 PM',
      travelTime: '5 minutes',
      status: '🚀 First to leave'
    },
  ],
};

// --- COLOR HELPER FUNCTIONS ---

/**
 * Converts a hex color string to an [R, G, B] array.
 * @param {string} hex - The hex color string (e.g., "#RRGGBB").
 * @returns {number[] | null} - An array of [R, G, B] values or null if invalid.
 */
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
};

/**
 * Converts an [R, G, B] array to a hex color string.
 * @param {number[]} rgb - An array of [R, G, B] values.
 * @returns {string} - The hex color string.
 */
const rgbToHex = (rgb) => {
    return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1).toUpperCase();
};

/**
 * Interpolates between two colors.
 * @param {number[]} color1 - The start color as [R, G, B].
 * @param {number[]} color2 - The end color as [R, G, B].
 * @param {number} factor - The interpolation factor (0 to 1).
 * @returns {number[]} - The resulting color as [R, G, B].
 */
const interpolateColor = (color1, color2, factor) => {
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
        result[i] = Math.round(result[i] + factor * (color2[i] - result[i]));
    }
    return result;
};

/**
 * Calculates a color based on a score, creating a gradient.
 * @param {number} score - The score (0-100) to base the color on.
 * @returns {string} - The calculated hex color string.
 */
const getScoreColor = (score) => {
    // Using colors from the app's theme for the gradient
    const lightColor = hexToRgb('#E8E6FF'); // --medium-lavender
    const darkColor = hexToRgb('#1A237E');  // --primary-navy
    
    if (!lightColor || !darkColor) return '#8884d8'; // Fallback color

    const factor = score / 100;
    const interpolatedRgb = interpolateColor(lightColor, darkColor, factor);
    
    return rgbToHex(interpolatedRgb);
};


// --- SUB-COMPONENTS ---

/**
 * Renders the top timeline visual for the trip.
 */
const TripTimeline = ({ start, end, total, destination, details }) => (
  <div className="trip-timeline">
    <div className="timeline-item">
      <PushpinOutlined />
      <Text>Start Location</Text>
      <Title level={5}>Departed at {start}</Title>
    </div>
    <div className="timeline-connector" />
    <div className="timeline-item">
      <PushpinOutlined />
      <Text>Destination</Text>
      <Title level={5}>{destination}</Title>
      <Title level={5}>Arrived at {end}</Title>
    </div>
    <div className="total-time">
      <Title level={4}>Total Trip Time: {total}</Title>
    </div>
    <div className="trip-stats">
      <div className="stat-chip">
        <Text>{details.totalDistance}</Text>
      </div>
      <div className="stat-chip">
        <Text>{details.averageSpeed}</Text>
      </div>
      <div className="stat-chip">
        <Text>{details.carbonSaved}</Text>
      </div>
    </div>
  </div>
);

/**
 * Renders the leaderboard as a textual list with point breakdowns.
 */
const LeaderboardList = ({ data }) => (
    <Card className="dashboard-card" bordered={false}>
        <Title level={4} className="card-title">Leaderboard</Title>
        <div className="leaderboard-list">
            {data.sort((a, b) => b.totalScore - a.totalScore).map((person, index) => (
                <div key={index} className="leaderboard-person">
                    <div className="person-main-info">
                        <Text className="person-rank">{index + 1}.</Text>
                        <Text className="person-name">{person.name}</Text>
                        <Text className="person-status">{person.status}</Text>
                        <Text 
                            className="person-score" 
                            style={{ color: getScoreColor(person.totalScore) }}
                        >
                            {person.totalScore} pts
                        </Text>
                    </div>
                    <div className="person-details">
                        <Text className="detail-item">Arrived: {person.arrivalTime}</Text>
                        <Text className="detail-item">Travel time: {person.travelTime}</Text>
                    </div>
                    <div className="person-score-breakdown">
                        <Text className="breakdown-item">{`+${person.responsivenessPoints} responsiveness`}</Text>
                        <Text className="breakdown-item">{`+${person.punctualityPoints} punctuality`}</Text>
                        <Text className="breakdown-item">{`+${person.leadershipPoints} leadership`}</Text>
                    </div>
                </div>
            ))}
        </div>
    </Card>
);


/**
 * Renders a card for displaying key financial and trip stats.
 */
const TripStats = ({ thisTrip, allTrips, details }) => (
  <Card className="dashboard-card stats-card" bordered={false}>
    <Title level={4} className="card-title">Trip Stats</Title>
    <div className="stat-item">
      <Title level={2} className="stat-value">${thisTrip.toFixed(2)}</Title>
      <Text className="stat-label">gas money this trip</Text>
    </div>
    <div className="stat-item">
      <Title level={2} className="stat-value">${allTrips.toFixed(2)}</Title>
      <Text className="stat-label">gas money all trips</Text>
    </div>
    <div className="stat-item">
      <Title level={2} className="stat-value">{details.caloriesBurned}</Title>
      <Text className="stat-label">calories burned</Text>
    </div>
  </Card>
);


// --- MAIN DASHBOARD PAGE COMPONENT ---

const DashboardPage = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // This triggers the entry animation
    setIsVisible(true);
  }, []);

  return (
    <>
      <style>{`
        /* Modern color palette */
        :root {
          --primary-navy: #1a237e;
          --secondary-navy: #3949ab;
          --light-lavender: #f3f2ff;
          --medium-lavender: #e8e6ff;
          --accent-coral: #303D66;
          --white: #ffffff;
          --text-dark: #2c2c54;
          --text-medium: #6c7293;
          --text-light: #9ca3af;
          --shadow-light: rgba(26, 35, 126, 0.08);
          --shadow-medium: rgba(26, 35, 126, 0.15);
          --gradient-primary: linear-gradient(135deg, #1a237e 0%, #3949ab 100%);
          --gradient-card: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        }

        /* Main Dashboard Container */
        .dashboard-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, var(--light-lavender) 0%, #f8fafc 100%);
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.5s ease-out, transform 0.5s ease-out;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', 'Roboto', sans-serif;
          z-index: 1000;
          overflow-y: auto;
        }

        .dashboard-container.visible {
          opacity: 1;
          transform: translateY(0);
        }
        
        .close-btn {
            position: absolute;
            top: 24px;
            right: 32px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 24px;
            color: var(--text-medium);
            transition: color 0.3s ease, transform 0.3s ease;
            z-index: 1010;
        }
        
        .close-btn:hover {
            color: var(--text-dark);
            transform: scale(1.1) rotate(90deg);
        }

        .dashboard-header {
          background: transparent;
          padding: 32px 64px 24px 5%;
          height: auto;
          line-height: 1;
          position: relative;
          text-align: center;
        }

        .dashboard-header .ant-typography {
          color: var(--text-dark);
          text-align: center;
          font-weight: 700;
          font-size: 2.5rem;
          margin: 0;
          background: linear-gradient(135deg, var(--primary-navy) 0%, var(--accent-coral) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .dashboard-content {
          padding: 0 5% 48px 5%;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Trip Timeline */
        .trip-timeline {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 64px;
          text-align: center;
          position: relative;
          background: var(--white);
          padding: 32px;
          border-radius: 24px;
          box-shadow: 0 8px 32px var(--shadow-light);
          border: 1px solid var(--medium-lavender);
        }

        .timeline-item {
          color: var(--text-dark);
          padding: 16px;
          border-radius: 16px;
          background: var(--light-lavender);
          min-width: 200px;
        }

        .timeline-item .anticon {
          font-size: 28px;
          color: var(--primary-navy);
          margin-bottom: 12px;
        }

        .timeline-item .ant-typography {
          margin: 0;
          color: var(--text-dark);
        }
        
        .timeline-item h5.ant-typography {
            font-weight: 600;
            color: var(--text-medium);
            margin-top: 8px;
        }

        .timeline-connector {
          width: 3px;
          height: 60px;
          background: linear-gradient(to bottom, var(--primary-navy), var(--accent-coral));
          margin: 16px 0;
          border-radius: 2px;
        }
        
        .total-time {
            margin-top: 32px;
            padding: 16px 24px;
            background: linear-gradient(135deg, var(--primary-navy) 0%, var(--accent-coral) 100%);
            border-radius: 16px;
            color: white;
        }
        
        .total-time .ant-typography {
            color: white;
            font-weight: 700;
            margin: 0;
        }
        
        .trip-stats {
            display: flex;
            gap: 12px;
            margin-top: 32px;
            flex-wrap: wrap;
            justify-content: center;
        }
        
        .stat-chip {
            background: linear-gradient(135deg, var(--medium-lavender) 0%, #f0f0ff 100%);
            padding: 12px 20px;
            border-radius: 25px;
            border: 1px solid var(--secondary-navy);
            box-shadow: 0 4px 12px var(--shadow-light);
            transition: all 0.3s ease;
        }
        
        .stat-chip:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px var(--shadow-medium);
        }
        
        .stat-chip .ant-typography {
            color: var(--text-dark);
            font-weight: 600;
            font-size: 0.95rem;
            margin: 0;
        }
        
        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
            .dashboard-header {
                padding: 20px 20px 16px 20px;
            }
            
            .dashboard-header .ant-typography {
                font-size: 1.8rem;
            }
            
            .dashboard-content {
                padding: 0 20px 32px 20px;
            }
            
            .trip-timeline {
                padding: 20px;
                margin-bottom: 40px;
            }
            
            .timeline-item {
                padding: 12px;
                min-width: auto;
                width: 100%;
                margin-bottom: 8px;
            }
            
            .timeline-item .anticon {
                font-size: 24px;
            }
            
            .timeline-connector {
                width: 2px;
                height: 40px;
                margin: 8px 0;
            }
            
            .total-time {
                margin-top: 20px;
                padding: 12px 16px;
            }
            
            .total-time .ant-typography {
                font-size: 1.2rem;
            }
            
            .trip-stats {
                margin-top: 20px;
                gap: 8px;
            }
            
            .stat-chip {
                padding: 8px 12px;
                font-size: 0.85rem;
            }
            
            .dashboard-card {
                padding: 20px;
                margin-bottom: 16px;
            }
            
            .card-title {
                font-size: 1.3rem;
                margin-bottom: 20px !important;
            }
            
            .leaderboard-person {
                padding: 16px;
                margin-bottom: 12px;
            }
            
            .person-main-info {
                flex-wrap: wrap;
                gap: 12px;
            }
            
            .person-rank {
                font-size: 1.1rem;
                min-width: 25px;
            }
            
            .person-name {
                font-size: 1.1rem;
            }
            
            .person-status {
                font-size: 0.9rem;
                padding: 3px 8px;
                margin: 0;
                order: 3;
                width: 100%;
                text-align: center;
            }
            
            .person-score {
                font-size: 1.2rem;
                padding: 6px 12px;
            }
            
            .person-details {
                padding-left: 37px;
                gap: 12px;
                flex-wrap: wrap;
            }
            
            .detail-item {
                font-size: 0.85rem;
            }
            
            .person-score-breakdown {
                padding-left: 37px;
                gap: 8px;
            }
            
            .breakdown-item {
                font-size: 0.8rem;
                padding: 3px 6px;
            }
            
            .stats-card {
                gap: 24px;
            }
            
            .stat-item {
                padding: 16px;
                min-width: auto;
                width: 100%;
            }
            
            .stat-value.ant-typography {
                font-size: 2rem;
            }
            
            .stat-label {
                font-size: 0.9rem;
            }
        }
        
        /* Desktop Timeline */
        @media (min-width: 768px) {
            .trip-timeline {
                flex-direction: row;
                justify-content: center;
            }
            .timeline-connector {
                width: 200px;
                height: 2px;
                margin: 0 24px;
            }
            .total-time {
                position: absolute;
                bottom: -40px;
                left: 50%;
                transform: translateX(-50%);
                margin-top: 0;
            }
            .trip-stats {
                position: absolute;
                bottom: -80px;
                left: 50%;
                transform: translateX(-50%);
                margin-top: 0;
            }
        }

        /* General Card Styling */
        .dashboard-card {
          background: var(--white);
          border: 1px solid var(--medium-lavender) !important;
          border-radius: 24px !important;
          box-shadow: 0 12px 40px var(--shadow-light) !important;
          height: 100%;
          padding: 32px;
          transition: all 0.3s ease;
        }
        
        .dashboard-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 50px var(--shadow-medium) !important;
        }
        
        .card-title {
            color: var(--text-dark);
            margin-bottom: 32px !important;
            font-weight: 700;
            font-size: 1.5rem;
            position: relative;
        }
        
        .card-title::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 0;
            width: 40px;
            height: 3px;
            background: linear-gradient(135deg, var(--primary-navy) 0%, var(--accent-coral) 100%);
            border-radius: 2px;
        }

        /* Leaderboard List */
        .leaderboard-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .leaderboard-person {
            padding: 20px;
            border-radius: 16px;
            background: var(--light-lavender);
            border: 1px solid var(--medium-lavender);
            transition: all 0.3s ease;
        }
        
        .leaderboard-person:hover {
            transform: translateX(4px);
            box-shadow: 0 4px 20px var(--shadow-light);
        }
        
        .leaderboard-person:first-child {
            background: linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%);
            border: 2px solid #ffb74d;
        }
        
        .person-main-info {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 12px;
        }
        
        .person-rank {
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--primary-navy);
            min-width: 30px;
        }
        
        .person-name {
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--text-dark);
            flex-grow: 1;
        }
        
        .person-status {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-medium);
            margin-left: auto;
            margin-right: 16px;
            padding: 4px 12px;
            background: var(--medium-lavender);
            border-radius: 12px;
        }
        
        .person-score {
            font-size: 1.4rem;
            font-weight: 800;
            padding: 8px 16px;
            background: linear-gradient(135deg, var(--primary-navy) 0%, var(--accent-coral) 100%);
            color: white !important;
            border-radius: 12px;
        }
        
        .person-details {
            padding-left: 46px;
            display: flex;
            gap: 20px;
            margin-bottom: 12px;
        }
        
        .detail-item {
            color: var(--text-medium);
            font-size: 0.95rem;
            font-weight: 500;
        }
        
        .person-score-breakdown {
            padding-left: 46px;
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }
        
        .breakdown-item {
            color: var(--text-medium);
            font-size: 0.9rem;
            font-weight: 500;
            padding: 4px 8px;
            background: var(--white);
            border-radius: 8px;
            border: 1px solid var(--medium-lavender);
        }

        /* Stats Card */
        .stats-card {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            gap: 40px;
        }
        
        .stat-item {
            padding: 24px;
            border-radius: 16px;
            background: var(--light-lavender);
            border: 1px solid var(--medium-lavender);
            transition: all 0.3s ease;
            min-width: 200px;
        }
        
        .stat-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 25px var(--shadow-light);
        }
        
        .stat-value.ant-typography {
            color: var(--primary-navy);
            font-weight: 800;
            margin: 0;
            line-height: 1;
            font-size: 2.5rem;
        }
        
        .stat-label {
            color: var(--text-medium);
            font-size: 1rem;
            font-weight: 500;
            margin-top: 8px;
        }
      `}</style>
      <Layout className={`dashboard-container ${isVisible ? 'visible' : ''}`}>
        <button className="close-btn" onClick={onClose} aria-label="Close dashboard">
            <CloseOutlined />
        </button>
        <Header className="dashboard-header">
          <Title level={2}>{tripData.tripName}</Title>
        </Header>
        <Content className="dashboard-content">
          <TripTimeline 
            start={tripData.startTime}
            end={tripData.endTime}
            total={tripData.totalTime}
            destination={tripData.destination}
            details={tripData.tripDetails}
          />

          <Row gutter={[32, 32]}>
            <Col xs={24} lg={16}>
              <LeaderboardList data={tripData.leaderboard} />
            </Col>
            <Col xs={24} lg={8}>
              <TripStats 
                thisTrip={tripData.gasMoneyThisTrip}
                allTrips={tripData.gasMoneyAllTrips}
                details={tripData.tripDetails}
              />
            </Col>
          </Row>
        </Content>
      </Layout>
    </>
  );
};

export default DashboardPage;