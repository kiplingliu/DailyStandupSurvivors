import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Typography, Card } from 'antd';
import { PushpinOutlined, CloseOutlined } from '@ant-design/icons';

// --- CSS is included in the component for a self-contained example ---

const { Title, Text } = Typography;
const { Header, Content } = Layout;

// --- MOCK DATA & CONFIG ---
const tripData = {
  tripName: 'Rendeview at Pieology',
  startTime: '3:45 PM',
  endTime: '4:15 PM',
  totalTime: '30 minutes',
  gasMoneyThisTrip: 4.13,
  gasMoneyAllTrips: 25.86,
  leaderboard: [
    {
      name: 'Barry A.',
      latenessPoints: 45,
      responsivenessPoints: 50,
      totalScore: 95,
    },
    {
      name: 'Pietro M.',
      latenessPoints: 40,
      responsivenessPoints: 40,
      totalScore: 80,
    },
    {
      name: 'Jayvee L.',
      latenessPoints: 25,
      responsivenessPoints: 40,
      totalScore: 65,
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
const TripTimeline = ({ start, end, total }) => (
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
      <Title level={5}>Arrived at {end}</Title>
    </div>
    <div className="total-time">
      <Title level={4}>Total Trip Time: {total}</Title>
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
                        <Text 
                            className="person-score" 
                            style={{ color: getScoreColor(person.totalScore) }}
                        >
                            {person.totalScore} pts
                        </Text>
                    </div>
                    <div className="person-score-breakdown">
                        <Text className="breakdown-item">{`+${person.responsivenessPoints} responsiveness`}</Text>
                        <Text className="breakdown-item">{`+${person.latenessPoints} lateness`}</Text>
                    </div>
                </div>
            ))}
        </div>
    </Card>
);


/**
 * Renders a card for displaying key financial stats.
 */
const GasMoneyStats = ({ thisTrip, allTrips }) => (
  <Card className="dashboard-card stats-card" bordered={false}>
    <Title level={4} className="card-title">Gas Money</Title>
    <div className="stat-item">
      <Title level={2} className="stat-value">${thisTrip.toFixed(2)}</Title>
      <Text className="stat-label">spent on this trip</Text>
    </div>
    <div className="stat-item">
      <Title level={2} className="stat-value">${allTrips.toFixed(2)}</Title>
      <Text className="stat-label">spent on all trips</Text>
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
          --accent-coral: #7c4dff;
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
          position: fixed; /* Changed to fixed to cover the screen */
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: var(--light-lavender);
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.5s ease-out, transform 0.5s ease-out;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', 'Roboto', sans-serif;
          z-index: 1000;
          overflow-y: auto; /* Allow scrolling */
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
          padding: 24px 64px 24px 5%; /* Added right padding to avoid overlap */
          height: auto;
          line-height: 1;
          position: relative; /* Needed for z-index context if required */
        }

        .dashboard-header .ant-typography {
          color: var(--text-dark);
          text-align: center;
        }

        .dashboard-content {
          padding: 0 5% 32px 5%;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Trip Timeline */
        .trip-timeline {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 48px;
          text-align: center;
          position: relative;
        }

        .timeline-item {
          color: var(--text-dark);
        }

        .timeline-item .anticon {
          font-size: 24px;
          color: var(--primary-navy);
          margin-bottom: 8px;
        }

        .timeline-item .ant-typography {
          margin: 0;
          color: var(--text-dark);
        }
        
        .timeline-item h5.ant-typography {
            font-weight: 600;
            color: var(--text-medium);
        }

        .timeline-connector {
          width: 2px;
          height: 50px;
          background-color: var(--secondary-navy);
          margin: 12px 0;
        }
        
        .total-time {
            margin-top: 24px;
        }
        
        .total-time .ant-typography {
            color: var(--text-dark);
            font-weight: 700;
        }
        
        /* Responsive Timeline */
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
        }

        /* General Card Styling */
        .dashboard-card {
          background: var(--gradient-card);
          border: 1px solid var(--medium-lavender) !important;
          border-radius: 20px !important;
          box-shadow: 0 8px 25px var(--shadow-light) !important;
          height: 100%;
          padding: 24px;
        }
        
        .card-title {
            color: var(--text-dark);
            margin-bottom: 24px !important;
        }

        /* Leaderboard List */
        .leaderboard-list {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }
        
        .leaderboard-person {
            padding-bottom: 16px;
            border-bottom: 1px solid var(--medium-lavender);
        }
        
        .leaderboard-person:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }
        
        .person-main-info {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 8px;
        }
        
        .person-rank {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-medium);
        }
        
        .person-name {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-dark);
            flex-grow: 1;
        }
        
        .person-score {
            font-size: 1.2rem;
            font-weight: 700;
        }
        
        .person-score-breakdown {
            padding-left: 38px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .breakdown-item {
            color: var(--text-medium);
            font-size: 0.9rem;
        }

        /* Stats Card */
        .stats-card {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            gap: 32px;
        }
        
        .stat-value.ant-typography {
            color: var(--primary-navy);
            font-weight: 700;
            margin: 0;
            line-height: 1;
        }
        
        .stat-label {
            color: var(--text-medium);
            font-size: 1rem;
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
          />

          <Row gutter={[32, 32]}>
            <Col xs={24} lg={16}>
              <LeaderboardList data={tripData.leaderboard} />
            </Col>
            <Col xs={24} lg={8}>
              <GasMoneyStats 
                thisTrip={tripData.gasMoneyThisTrip}
                allTrips={tripData.gasMoneyAllTrips}
              />
            </Col>
          </Row>
        </Content>
      </Layout>
    </>
  );
};

export default DashboardPage;