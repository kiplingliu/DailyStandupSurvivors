# Daily Standup Survivors

A social meetup planner web app built with React, Vite, and ArcGIS JavaScript SDK.

## Features

- **Loading Screen**: Animated splash screen with app branding
- **Home Page**: Main app interface (currently blank, ready for features)
- **Mobile Responsive**: Optimized for mobile viewing and demo
- **Modern UI**: Dark theme with smooth animations

## Tech Stack

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and development server
- **ArcGIS JavaScript SDK** - For mapping and location services
- **React Router** - For navigation (ready to implement)
- **CSS3** - Modern styling with animations and responsive design

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd DailyStandupSurvivors
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Mobile Demo

To view the app on mobile for demo purposes:
1. Start the development server
2. Open Chrome DevTools (F12)
3. Click the "Toggle device toolbar" button (mobile icon)
4. Select a mobile device from the dropdown
5. The app will now display in mobile view

## Project Structure

```
src/
├── components/
│   └── LoadingScreen.jsx    # Animated splash screen
├── pages/
│   └── HomePage.jsx         # Main home page
├── styles/
│   ├── LoadingScreen.css    # Loading screen styles
│   └── HomePage.css         # Home page styles
├── App.jsx                  # Main app component
└── App.css                  # Global styles
```

## Development

The app currently includes:
- A beautiful loading screen with animations
- Responsive home page ready for additional features
- Modern dark theme UI
- Mobile-first responsive design
- ArcGIS SDK ready for integration

## Next Steps

Ready to add:
- User authentication
- Meetup creation and management
- Map integration with ArcGIS
- Social features
- Location-based services
- Real-time updates

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Contributing

This is a work in progress. More features will be added as development continues.
