// Login com Google e perfil na nuvem (Firebase Auth + Firestore), exposto como window.Cloud
// para o jogo, que é feito de scripts comuns. Sem configuração em firebase-config.js o jogo
// segue funcionando e o progresso fica só no aparelho (Cloud.available = false).
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const listeners = [];
let user = null;
let auth = null;
let db = null;
let authSdk = null;
let storeSdk = null;

const Cloud = {
  available: false,
  user: () => user,
  // `cb(user)` é chamado no login, no logout e logo após a página abrir.
  onChange(cb) { listeners.push(cb); },

  async signIn() {
    const provider = new authSdk.GoogleAuthProvider();
    try {
      await authSdk.signInWithPopup(auth, provider);
    } catch (e) {
      // Alguns navegadores de celular bloqueiam a janela; aí vai pelo redirecionamento.
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await authSdk.signInWithRedirect(auth, provider);
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        throw e;
      }
    }
  },

  signOut: () => authSdk.signOut(auth),

  async load() {
    if (!user) return null;
    const snap = await storeSdk.getDoc(storeSdk.doc(db, 'profiles', user.uid));
    return snap.exists() ? snap.data() : null;
  },

  async save(data) {
    if (!user) return;
    await storeSdk.setDoc(storeSdk.doc(db, 'profiles', user.uid), {
      ...data,
      name: user.displayName || '',
      photo: user.photoURL || '',
      updatedAt: storeSdk.serverTimestamp(),
    }, { merge: true });
  },
};
window.Cloud = Cloud;

if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) {
  try {
    const [appSdk, a, f] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const app = appSdk.initializeApp(FIREBASE_CONFIG);
    authSdk = a;
    storeSdk = f;
    auth = a.getAuth(app);
    db = f.getFirestore(app);
    Cloud.available = true;
    a.onAuthStateChanged(auth, (u) => {
      user = u;
      listeners.forEach((cb) => cb(u));
    });
  } catch (e) {
    console.warn('Firebase indisponível, seguindo sem login:', e);
  }
}
window.dispatchEvent(new Event('cloud-ready'));
