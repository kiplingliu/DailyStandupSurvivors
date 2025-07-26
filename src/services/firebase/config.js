// src/services/firebase/config.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// IMPORTANT: Store these in environment variables, not hardcoded in the repo for production.
const firebaseConfig = {
  apiKey: "AIzaSyCzrduW5nP9ItaUAAp1OVj2H3-vccPKBms",
  authDomain: "dailystandupsurvivors.firebaseapp.com",
  projectId: "dailystandupsurvivors",
  storageBucket: "dailystandupsurvivors.firebasestorage.app",
  messagingSenderId: "567797069742",
  appId: "1:567797069742:web:e6b070ce27d2063c3e3a3f",
  measurementId: "G-6DMSPSYKWD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);