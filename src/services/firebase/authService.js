// src/services/firebase/authService.js

import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "./config.js";

/**
 * Signs in the user anonymously and returns the user object.
 * Ensures that a user is signed in before any other action is taken.
 * @returns {Promise<import("firebase/auth").User>} A promise that resolves with the user object.
 */
export const ensureSignedIn = async () => {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  const userCredential = await signInAnonymously(auth);
  return userCredential.user;
};

/**
 * Sets up a listener for authentication state changes.
 * This is useful for the root of the app to know if a user is logged in.
 * @param {function} callback - A function to call with the user object when auth state changes.
 * @returns {import("firebase/auth").Unsubscribe} A function to unsubscribe the listener.
 */
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};