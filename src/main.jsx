import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import './index.css';
import App from './App.jsx';
import esriConfig from "@arcgis/core/config.js";

esriConfig.apiKey = 'AAPTxy8BH1VEsoebNVZXo8HurL6nxPIkajIUT_yWL44ecbAWd5Fs0xSXmPreZMEXzk6HSmBOc05PQbjX0cRXkfIwDMzyPeHaM_i8CHGCGigW4zmUKkyD-wgJ3m8k7lHsQ8NLmgiHhoXsN01cGdjAnAxLn3WOs5udBwQAA1iXwjWeGvGyD7OIeZhfUhOpAFYLF496OL1wEqBy-oV-tlvQrfVgRnuRMeHAPeoVf2OfPFytoFk6E0mTNJfpj2gbE1Z9fxpYAT1_8TEW7Qkn';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#00b96b',
          borderRadius: 8,
        },
        components: {
          Notification: {
            colorSuccess: '#52c41a',
          },
          Message: {
            contentBg: 'rgba(160, 163, 171, 0.9)',
            className: 'custom-message',
          }
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
