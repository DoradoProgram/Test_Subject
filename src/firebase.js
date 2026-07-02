import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD5PpUKUYO7u4xXbOTyS4f0kbxZ--qroNo",
  authDomain: "campus-connect-3e760.firebaseapp.com",
  projectId: "campus-connect-3e760",
  storageBucket: "campus-connect-3e760.firebasestorage.app",
  messagingSenderId: "359126670799",
  appId: "1:359126670799:web:ac104437fe2a1e1ea686ba"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);