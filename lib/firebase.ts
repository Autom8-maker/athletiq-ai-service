import * as admin from "firebase-admin";

let app: admin.app.App | undefined;

export function getFirebaseApp() {
  if (!app) {
    const projectId = process.env.FB_PROJECT_ID!;
    const clientEmail = process.env.FB_CLIENT_EMAIL!;
    const privateKey = process.env.FB_PRIVATE_KEY!.replace(/\\n/g, "\n");
    if (!admin.apps.length) {
      app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      app = admin.app();
    }
  }
  return app!;
}

export async function verifyIdToken(authorization?: string | null) {
  if (!authorization?.startsWith("Bearer ")) throw new Error("Missing token");
  const token = authorization.slice(7);
  const auth = getFirebaseApp().auth();
  return auth.verifyIdToken(token);
}
