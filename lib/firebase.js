import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,getFirestore
} from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyC5m81LGmv7uFDb4hWjOtYwd19FEJ_7gkA",
  authDomain: "prat-16d46.firebaseapp.com",
  projectId: "prat-16d46",
  storageBucket: "prat-16d46.firebasestorage.app",
  messagingSenderId: "720751278419",
  appId: "1:720751278419:web:2b0b896a148e0a9ab509a6",
  measurementId: "G-C1F46DGF6C"
};
const app = initializeApp(firebaseConfig,"pos");

export const db = getFirestore(app);
