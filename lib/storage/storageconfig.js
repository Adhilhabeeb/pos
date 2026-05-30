import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBUhKliTOKWKVW-TCTaYiRN9FXCjoxcsHg",
  authDomain: "dclub-32718.firebaseapp.com",
  databaseURL: "https://dclub-32718-default-rtdb.firebaseio.com",
  projectId: "dclub-32718",
  storageBucket: "dclub-32718.firebasestorage.app",
  messagingSenderId: "401946278556",
  appId: "1:401946278556:web:efd912ca5196ce248b0b59",
  measurementId: "G-Q9RC6QRR7K"
};
export const dclubapp = initializeApp(FIREBASE_CONFIG,"dclub");
export const storageBUCKET = getStorage(dclubapp);
