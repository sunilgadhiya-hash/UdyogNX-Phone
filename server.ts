import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Vobiz Answer URL
  app.post("/api/vobiz/answer", async (req, res) => {
    // Vobiz can send parameters in body or query
    const From = req.body.From || req.query.From;
    const To = req.body.To || req.query.To;
    const CallUUID = req.body.CallUUID || req.query.CallUUID;
    const Direction = req.body.Direction || req.query.Direction;
    let TenantId = req.body.TenantId || req.query.TenantId;

    console.log(`Incoming call from ${From} to ${To} (Tenant: ${TenantId || 'Dynamic'})`);

    let recordingEnabled = false;

    // If TenantId is not provided, try to look it up by the 'To' number (DID)
    if (!TenantId && To) {
      try {
        const vobizNumbersSnapshot = await db.collection("vobiz_numbers")
          .where("did", "==", To)
          .limit(1)
          .get();
        
        if (!vobizNumbersSnapshot.empty) {
          const vobizNumberData = vobizNumbersSnapshot.docs[0].data();
          TenantId = vobizNumberData.assignedToTenantId;
          console.log(`Found tenant ${TenantId} for DID ${To}`);
        }
      } catch (e) {
        console.error("Error looking up tenant by DID:", e);
      }
    }

    if (TenantId) {
      try {
        const tenantDoc = await db.collection("tenants").doc(TenantId as string).get();
        if (tenantDoc.exists) {
          recordingEnabled = tenantDoc.data()?.settings?.callRecordingEnabled || false;
        }
      } catch (e) {
        console.error("Error fetching tenant config:", e);
      }
    }

    const dialTarget = To || "";

    res.set("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${recordingEnabled ? '<Record action="record" />' : ''}
  <Dial>
    <Number>${dialTarget}</Number>
  </Dial>
</Response>`);
  });

  // Vobiz Status Callback
  app.post("/api/vobiz/status", async (req, res) => {
    const From = req.body.From || req.query.From;
    const To = req.body.To || req.query.To;
    const CallUUID = req.body.CallUUID || req.query.CallUUID;
    const CallStatus = req.body.CallStatus || req.query.CallStatus;
    const Direction = req.body.Direction || req.query.Direction;
    const RecordingUrl = req.body.RecordingUrl || req.query.RecordingUrl;
    let TenantId = req.body.TenantId || req.query.TenantId;
    const Duration = req.body.Duration || req.query.Duration;
    const HangupCause = req.body.HangupCause || req.query.HangupCause;

    console.log(`Call ${CallUUID} status: ${CallStatus} (Tenant: ${TenantId || 'Dynamic'})`);

    // Dynamic lookup if TenantId is missing
    if (!TenantId && To) {
      try {
        const vobizNumbersSnapshot = await db.collection("vobiz_numbers")
          .where("did", "==", To)
          .limit(1)
          .get();
        
        if (!vobizNumbersSnapshot.empty) {
          const vobizNumberData = vobizNumbersSnapshot.docs[0].data();
          TenantId = vobizNumberData.assignedToTenantId;
        }
      } catch (e) {
        console.error("Error looking up tenant by DID in status:", e);
      }
    }

    if (TenantId && CallUUID) {
      await db.collection("calls").doc(CallUUID as string).set({
        id: CallUUID,
        tenantId: TenantId,
        from: From,
        to: To,
        status: CallStatus,
        recordingUrl: RecordingUrl || null,
        duration: Duration ? parseInt(Duration as string) : null,
        hangupCause: HangupCause || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    res.sendStatus(200);
  });

  app.post("/api/vobiz/provision", async (req, res) => {
    const { authId, authSecret, username, password, tenantId } = req.body;
    if (!authId || !authSecret) {
      return res.status(400).json({ error: "Missing auth credentials" });
    }

    try {
      // Call Vobiz API to provision endpoint
      const response = await fetch(`https://api.vobiz.ai/api/v1/Account/${authId}/Endpoint/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-ID': authId,
          'X-Auth-Token': authSecret
        },
        body: JSON.stringify({
          username,
          password,
          alias: `tenant-${tenantId}`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Vobiz Provisioning Error:", errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        return res.status(response.status).json({ error: errorData });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Vobiz Provisioning Exception:", error);
      res.status(500).json({ error: "Internal server error during provisioning" });
    }
  });

  // Google Contacts OAuth
  app.get("/api/auth/google/url", (req, res) => {
    const { tenantId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    if (!process.env.APP_URL) {
      console.error("APP_URL environment variable is missing");
      return res.status(500).json({ error: "Server configuration error: APP_URL is missing" });
    }

    const redirectUri = `${process.env.APP_URL}/api/auth/google/callback`;
    console.log('Generating Google Auth URL with redirectUri:', redirectUri);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const scopes = [
      "https://www.googleapis.com/auth/contacts.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ];
    
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: tenantId as string
    });

    res.json({ url });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state: tenantId } = req.query;
    
    if (!code || !tenantId) {
      return res.status(400).send("Invalid request");
    }

    if (!process.env.APP_URL) {
      console.error("APP_URL environment variable is missing");
      return res.status(500).send("Server configuration error: APP_URL is missing");
    }

    try {
      const redirectUri = `${process.env.APP_URL}/api/auth/google/callback`;
      console.log('Handling Google Auth Callback with redirectUri:', redirectUri);
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);

      // Get user info
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      if (tokens.refresh_token) {
        await db.collection("tenants").doc(tenantId as string).update({
          googleConnection: {
            refreshToken: tokens.refresh_token,
            email: userInfo.data.email,
            connectedAt: admin.firestore.FieldValue.serverTimestamp()
          }
        });
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, window.location.origin);
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Google OAuth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/contacts/sync", async (req, res) => {
    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    try {
      const tenantDoc = await db.collection("tenants").doc(tenantId).get();
      const tenantData = tenantDoc.data();
      
      if (!tenantData?.googleConnection?.refreshToken) {
        return res.status(400).json({ error: "Google account not connected" });
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        refresh_token: tenantData.googleConnection.refreshToken
      });

      const people = google.people({ version: "v1", auth: oauth2Client });
      const response = await people.people.connections.list({
        resourceName: "people/me",
        personFields: "names,phoneNumbers,emailAddresses",
        pageSize: 1000
      });

      const connections = response.data.connections || [];
      const batch = db.batch();
      
      for (const person of connections) {
        const name = person.names?.[0]?.displayName || "Unknown";
        const phone = person.phoneNumbers?.[0]?.value;
        const email = person.emailAddresses?.[0]?.value;
        const googleId = person.resourceName;

        if (phone) {
          const contactRef = db.collection("contacts").doc();
          batch.set(contactRef, {
            tenantId,
            name,
            phone,
            email: email || null,
            googleId,
            source: "google",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      await batch.commit();
      res.json({ success: true, count: connections.length });
    } catch (error) {
      console.error("Sync Error:", error);
      res.status(500).json({ error: "Failed to sync contacts" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
