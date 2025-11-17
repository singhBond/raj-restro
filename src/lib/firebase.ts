// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyAeGbpnuOCU46uC9Bz9UwX2JrmJ1r_UDQw",
//   authDomain: "food-cat-118d5.firebaseapp.com",
//   projectId: "food-cat-118d5",
//   storageBucket: "food-cat-118d5.firebasestorage.app",
//   messagingSenderId: "866456771942",
//   appId: "1:866456771942:web:1ff09c83db07831ddefca7"
// };
const firebaseConfig = {
  apiKey: "AIzaSyBmZcDu_p7dRYfbyQkm3vDIL_o1cgvXv1k",
  authDomain: "food-cat2.firebaseapp.com",
  projectId: "food-cat2",
  storageBucket: "food-cat2.firebasestorage.app",
  messagingSenderId: "122447805590",
  appId: "1:122447805590:web:d2321ef55d30945c6e96b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore & Storage
export const db = getFirestore(app);
export const storage = getStorage(app);

// Optional: Export app if needed elsewhere
export default app;