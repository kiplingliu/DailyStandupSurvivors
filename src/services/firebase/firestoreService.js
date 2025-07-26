// src/services/firebase/firestoreService.js

import {
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "./config.js";

const tripsCollection = collection(db, "trips");

/**
 * Creates a new trip document in Firestore.
 * @param {string} tripName - The name for the new trip.
 * @param {string} userName - The name of the user creating the trip.
 * @param {object} initialLocation - The creator's initial location { latitude, longitude }.
 * @returns {Promise<string>} A promise that resolves with the new trip's ID.
 */
export const createTrip = async (tripName, userName, initialLocation) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated.");

  // 1. Create the main trip document
  const tripDocRef = await addDoc(tripsCollection, {
    tripName: tripName,
    createdAt: serverTimestamp(),
  });

  // 2. Add the creator as the first participant in the sub-collection
  const participantDocRef = doc(db, `trips/${tripDocRef.id}/participants`, user.uid);
  await setDoc(participantDocRef, {
    name: userName,
    location: initialLocation,
    lastUpdated: serverTimestamp(),
  });

  return tripDocRef.id;
};

/**
 * Adds the current user to an existing trip.
 * @param {string} tripId - The ID of the trip to join.
 * @param {string} userName - The name of the user joining.
 * @param {object} initialLocation - The user's initial location { latitude, longitude }.
 * @returns {Promise<void>}
 */
export const joinTrip = async (tripId, userName, initialLocation) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated.");

    const participantDocRef = doc(db, `trips/${tripId}/participants`, user.uid);
    await setDoc(participantDocRef, {
        name: userName,
        location: initialLocation,
        lastUpdated: serverTimestamp(),
    });
};


/**
 * Updates the current user's location in a specific trip.
 * @param {string} tripId - The ID of the trip.
 * @param {object} newLocation - The new location object { latitude, longitude }.
 * @returns {Promise<void>}
 */
export const updateMyLocation = async (tripId, newLocation) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated.");

  const participantDocRef = doc(db, `trips/${tripId}/participants`, user.uid);
  await setDoc(participantDocRef, {
    location: newLocation,
    lastUpdated: serverTimestamp(),
  }, { merge: true }); // Use merge:true to only update fields, not overwrite the doc
};

/**
 * Listens for real-time updates to participants in a trip.
 * @param {string} tripId - The ID of the trip to listen to.
 * @param {function} onUpdate - Callback function that receives the array of participants.
 * @returns {import("firebase/firestore").Unsubscribe} A function to unsubscribe the listener.
 */
export const listenToTripParticipants = (tripId, onUpdate) => {
  const participantsCollectionRef = collection(db, `trips/${tripId}/participants`);

  const unsubscribe = onSnapshot(participantsCollectionRef, (querySnapshot) => {
    const participants = [];
    querySnapshot.forEach((doc) => {
      participants.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    onUpdate(participants);
  });

  return unsubscribe;
};