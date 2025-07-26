// src/services/firebase/testFirebase.js

// This file is for testing purposes only and should not be included in production builds.

import { ensureSignedIn, onAuthChange } from "./authService.js";
import { auth, db } from "./config.js";
import { createTrip, joinTrip, updateMyLocation, listenToTripParticipants } from "./firestoreService.js";

const runTests = async () => {
  console.log("Starting Firebase service tests...");

  // Test config.js exports
  console.log("\n--- Testing config.js exports ---");
  if (auth) {
    console.log("Firebase Auth initialized successfully.");
  } else {
    console.error("Firebase Auth initialization failed!");
  }

  if (db) {
    console.log("Firebase Firestore initialized successfully.");
  } else {
    console.error("Firebase Firestore initialization failed!");
  }

  // Ensure user is signed in for auth and firestore tests
  let currentUser = null;
  try {
    console.log("\nEnsuring user is signed in for tests...");
    currentUser = await ensureSignedIn();
    console.log("User signed in:", currentUser.uid);
  } catch (error) {
    console.error("Failed to sign in user:", error);
    return; // Stop tests if no user
  }

  // Test authService.js functions
  console.log("\n--- Testing authService.js functions ---");

  // Test onAuthChange
  console.log("Setting up onAuthChange listener...");
  const unsubscribeAuth = onAuthChange((user) => {
    if (user) {
      console.log("Auth state changed: User is signed in anonymously.", user.uid);
    } else {
      console.log("Auth state changed: No user is signed in.");
    }
  });

  // Test ensureSignedIn (already covered by initial sign-in)
  console.log("ensureSignedIn already verified by initial sign-in.");

  // Test firestoreService.js functions
  console.log("\n--- Testing firestoreService.js functions ---");

  let testTripId = null;
  const initialLocation = { latitude: 34.0522, longitude: -118.2437 }; // Los Angeles

  try {
    // Test createTrip
    console.log("Calling createTrip...");
    testTripId = await createTrip("Test Trip " + Date.now(), "Test User", initialLocation);
    console.log("createTrip successful. New Trip ID:", testTripId);

    // Test joinTrip
    console.log("Calling joinTrip...");
    await joinTrip(testTripId, "Another Test User", { latitude: 34.0, longitude: -118.0 });
    console.log("joinTrip successful.");

    // Test updateMyLocation
    console.log("Calling updateMyLocation...");
    const newLocation = { latitude: 34.123, longitude: -118.456 };
    await updateMyLocation(testTripId, newLocation);
    console.log("updateMyLocation successful.");

    // Test listenToTripParticipants
    console.log("Setting up listenToTripParticipants listener...");
    const unsubscribeFirestore = listenToTripParticipants(testTripId, (participants) => {
      console.log("Firestore listener update: Participants:", participants);
    });

    // Give some time for listeners to fire and observe changes
    setTimeout(() => {
      console.log("\nUnsubscribing from listeners.");
      unsubscribeAuth();
      unsubscribeFirestore();
      console.log("Firebase service tests finished.");
    }, 10000); // Keep listeners active for 10 seconds
  } catch (error) {
    console.error("Firestore service test failed:", error);
  }
};

runTests();