// CONFIGURAÇÃO FIREBASE
// As chaves Web do Firebase não são, por si só, um segredo.
// A proteção real deve ser feita com Firebase Authentication e Firestore Security Rules.
const firebaseConfig = {
  apiKey: "AIzaSyAyZKCkq1fBWM8keHk_bcZv4VI3Rg_kgRQ",
  authDomain: "gestao-de-estoque-7bd06.firebaseapp.com",
  projectId: "gestao-de-estoque-7bd06",
  storageBucket: "gestao-de-estoque-7bd06.firebasestorage.app",
  messagingSenderId: "583155579792",
  appId: "1:583155579792:web:aa6de8bccb2c649f15d115"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
window.db = db;
