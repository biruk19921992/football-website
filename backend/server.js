require("dotenv").config();
const { XMLParser } = require("fast-xml-parser");
const express = require("express");
const cors = require("cors");
const amharicNewsCache = new Map();

const TELEGRAM_CHANNEL = process.env.TELEGRAM_CHANNEL || "-1004488425491";

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL,
        text,
        disable_web_page_preview: false
      })
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.description || "Telegram API error");
  }

  return data.result;
}


async function publishNewsToTelegram(item) {
  if (!item?.id || !item?.headline) return null;

  const docRef = firestore.collection("telegram_news").doc(String(item.id));
  const existing = await docRef.get();

  if (existing.exists && existing.data()?.sent === true) {
    return { skipped: true, reason: "already_sent" };
  }

  const titleAm = item.titleAm || item.headline;
  const descriptionAm = item.descriptionAm || item.description || "";

  const text =
    "⚽ VibeSport\n\n" +
    titleAm +
    (descriptionAm ? "\n\n" + descriptionAm : "") +
    "\n\n📰 Source: " + (item.source || "Football") +
    (item.link ? "\n🔗 " + item.link : "");

  const message = await sendTelegramMessage(text);

  await docRef.set({
    sent: true,
    messageId: message.message_id,
    source: item.source || "",
    headline: item.headline,
    titleAm,
    published: item.published || null,
    sentAt: new Date().toISOString()
  }, { merge: true });

  return {
    sent: true,
    messageId: message.message_id
  };
}

async function translateToAmharic(text) {
  if (!text || !text.trim()) return text;

  const original = text.trim();

  // Return cached translation when available
  if (amharicNewsCache.has(original)) {
    return amharicNewsCache.get(original);
  }

  try {
    const url =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(original) +
      "&langpair=en%7Cam";

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("MyMemory HTTP " + response.status);
    }

    const data = await response.json();

    const translated =
      data?.responseData?.translatedText?.trim() || "";

    const result = translated || original;

    // Save translation in memory cache
    amharicNewsCache.set(original, result);

    return result;
  } catch (error) {
    console.error("MyMemory translation error:", error.message);
    return original;
  }
}

const {
  initializeApp,
  cert
} = require("firebase-admin/app");

const {
  getAuth
} = require("firebase-admin/auth");

const {
  getMessaging
} = require("firebase-admin/messaging");
const { getDatabase } = require("firebase-admin/database");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   FIREBASE ADMIN
========================= */

let serviceAccount;

if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  };
} else {
  serviceAccount = require(
    "./footballxtra-firebase-adminsdk-fbsvc-7aeff5dae1.json"
  );
}

initializeApp({
  databaseURL: "https://footballxtra-default-rtdb.firebaseio.com",
  credential: cert(serviceAccount)
});

const firebaseAuth = getAuth();
const rtdb = getDatabase();
const messaging = getMessaging();
const firestore = getFirestore();

console.log("🔥 Firebase Admin initialized successfully!");

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());
app.use(express.json());
app.use(express.static("."));

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Football Website Backend is working! ⚽🔥"
  });
});

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    firebase: "connected"
  });
});

/* =========================
   FIREBASE STATUS
========================= */

app.get("/api/firebase-status", (req, res) => {
  res.json({
    success: true,
    firebase: "Firebase Admin is connected 🔥"
  });
});

/* =========================
   AUTH MIDDLEWARE
========================= */

async function verifyFirebaseUser(req, res, next) {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is required"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format"
      });
    }

    const idToken =
      authHeader.split("Bearer ")[1];

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: "Firebase ID token is required"
      });
    }

    const decodedToken =
      await firebaseAuth.verifyIdToken(idToken);

    req.user = decodedToken;

    next();

  } catch (error) {

    console.error("❌ Auth verification error:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase token"
    });
  }
}

/* =========================
   REGISTER FCM TOKEN
========================= */

app.post(
  "/api/register-fcm-token",
  verifyFirebaseUser,
  async (req, res) => {

    try {

      const {
        token,
        userAgent
      } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "FCM token is required"
        });
      }

      const uid = req.user.uid;

      await firestore
        .collection("fcmTokens")
        .doc(token)
        .set({
          uid: uid,
          token: token,
          userAgent: userAgent || "",
          updatedAt: FieldValue.serverTimestamp()
        }, {
          merge: true
        });

      console.log(
        "🔔 FCM token registered for:",
        uid
      );

      res.json({
        success: true,
        message: "FCM token registered successfully 🔥"
      });

    } catch (error) {

      console.error(
        "❌ Token registration error:",
        error
      );

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/* =========================
   SEND NOTIFICATION
========================= */

app.post(
  "/api/send-notification",
  verifyFirebaseUser,
  async (req, res) => {

    try {

      const {
        token,
        title,
        body
      } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "FCM token is required"
        });
      }

      const message = {

        token: token,

        notification: {
          title:
            title || "FOOTBALLXTRA ⚽",

          body:
            body ||
            "You have a new football notification 🔥"
        },

        data: {
          click_action: "/"
        }
      };

      const response =
        await messaging.send(message);

      console.log(
        "📲 FCM notification sent:",
        response
      );

      res.json({
        success: true,
        message:
          "Notification sent successfully 🔥",
        messageId: response
      });

    } catch (error) {

      console.error(
        "❌ FCM send error:",
        error
      );

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

async function requireSuperAdmin(req, res, next) {
  try {
    const userSnap = await firestore.collection("users").doc(req.user.uid).get();

    if (!userSnap.exists || userSnap.data().role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super Admin permission is required"
      });
    }

    next();
  } catch (error) {
    console.error("❌ Super Admin check error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify admin permission"
    });
  }
}

app.post("/api/admins", verifyFirebaseUser, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    const allowedRoles = ["super_admin", "content_admin", "video_admin", "match_admin", "moderator_admin"];

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "Name, email, password and role are required" });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid admin role" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const newUser = await firebaseAuth.createUser({
      email: email.trim(),
      password,
      displayName: name.trim()
    });

    try {
      await firestore.collection("users").doc(newUser.uid).set({
        uid: newUser.uid,
        name: name.trim(),
        email: email.trim(),
        role,
        premium: false,
        createdAt: FieldValue.serverTimestamp()
      });
    } catch (firestoreError) {
      await firebaseAuth.deleteUser(newUser.uid).catch(() => {});
      throw firestoreError;
    }

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      admin: {
        uid: newUser.uid,
        name: name.trim(),
        email: email.trim(),
        role
      }
    });
  } catch (error) {
    console.error("❌ Admin creation error:", error);

    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    return res.status(500).json({ success: false, message: error.message || "Failed to create admin" });
  }
});

/* =========================
   SERVER
========================= */

app.listen(PORT, () => {

  console.log(
    `⚽ Backend running on http://localhost:${PORT}`
  );

});

/* =========================
   FOOTBALL API
========================= */

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const FOOTBALL_API_BASE_URL =
  process.env.FOOTBALL_API_BASE_URL ||
  "https://v3.football.api-sports.io";

async function footballApiRequest(endpoint, params = {}) {
  if (!FOOTBALL_API_KEY) {
    throw new Error("FOOTBALL_API_KEY is missing in backend/.env");
  }

  const url = new URL(
    `${FOOTBALL_API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key": FOOTBALL_API_KEY,
      "Accept": "application/json"
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.errors
        ? JSON.stringify(data.errors)
        : `Football API HTTP ${response.status}`
    );
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data;
}

/* =========================
   PREMIER LEAGUE STANDINGS
========================= */
app.get("/api/team/:id", async (req, res) => {
  try {
    const teamId = req.params.id;
    const leagueCode = req.query.league || "eng.1";

    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/teams/${teamId}`);

    if (!response.ok) {
      throw new Error("ESPN HTTP " + response.status);
    }

    const data = await response.json();
    const team = data.team || data;

    res.json({
      success: true,
      source: "espn",
      team: {
        id: team.id || teamId,
        name: team.displayName || team.name || "",
        shortName: team.shortDisplayName || team.abbreviation || "",
        logo: team.logos?.[0]?.href || team.logo || "",
        color: team.color || "",
        alternateColor: team.alternateColor || "",
        location: team.location || "",
        nickname: team.nickname || "",
        league: team.defaultLeague?.name || "",
        standingSummary: team.standingSummary || "",
        record: team.record?.items?.[0]?.summary || "",
        nextEvent: team.nextEvent?.[0] ? {
          date: team.nextEvent[0].date || "",
          name: team.nextEvent[0].name || "",
          venue: team.nextEvent[0].competitions?.[0]?.venue?.fullName || "",
          city: team.nextEvent[0].competitions?.[0]?.venue?.address?.city || "",
          country: team.nextEvent[0].competitions?.[0]?.venue?.address?.country || ""
        } : null
      }
    });
  } catch (error) {
    console.error("Team error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


/* =========================
   TEAM FIXTURES
========================= */
app.get("/api/team/:id/roster", async (req, res) => {
  try {
    const teamId = String(req.params.id);
    const leagueCode = req.query.league || "eng.1";

    if (!/^\d+$/.test(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID"
      });
    }

    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/teams/${teamId}/roster`
    );

    if (!response.ok) {
      throw new Error("ESPN HTTP " + response.status);
    }

    const data = await response.json();

    const players = (data.athletes || []).map(player => ({
      id: player.id || null,
      name: player.displayName || player.fullName || "",
      shortName: player.shortName || "",
      firstName: player.firstName || "",
      lastName: player.lastName || "",
      jersey: player.jersey || "",
      position: player.position?.displayName || "",
      positionAbbreviation: player.position?.abbreviation || "",
      age: player.age ?? null,
      height: player.displayHeight || "",
      weight: player.displayWeight || "",
      citizenship: player.citizenship || "",
      countryCode: player.citizenshipCountry?.abbreviation || "",
      headshot: player.headshot?.href || "",
      status: player.status?.name || ""
    }));

    res.json({
      success: true,
      source: "espn",
      teamId: Number(teamId),
      league: leagueCode,
      season: data.season || null,
      count: players.length,
      players
    });

  } catch (error) {
    console.error("Roster error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/team/:id/fixtures", async (req, res) => {
  try {
    const teamId = String(req.params.id);
    const leagueCode = req.query.league || "eng.1";

    if (!/^\d+$/.test(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID"
      });
    }

    const now = new Date();
    const fixtures = [];

    const addDays = (date, days) => {
      const d = new Date(date);
      d.setUTCDate(d.getUTCDate() + days);
      return d;
    };

    const fmt = d =>
      d.getUTCFullYear() +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      String(d.getUTCDate()).padStart(2, "0");

    for (let offset = -30; offset <= 30; offset++) { console.log("CHECK DATE:", fmt(addDays(now, offset)));
      const day = addDays(now, offset);
      const date = fmt(day);

      try {
        const url =
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard` +
          `?dates=${date}&limit=100`;

        const response = await fetch(url);

        if (!response.ok) continue;

        const data = await response.json();

        for (const event of (data.events || [])) {
          const competitors =
            event.competitions?.[0]?.competitors || [];

          const belongsToTeam = competitors.some(
            c => String(c.team?.id || c.id) === teamId
          );

          if (belongsToTeam) {
            fixtures.push(event);
          }
        }
      } catch (error) {
        console.error("Fixture day error:", date, error.message);
      }
    }

    const unique = [];
    const seen = new Set();

    for (const fixture of fixtures) {
      const key = String(fixture.id || fixture.date || fixture.name);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(fixture);
      }
    }

    unique.sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );

    res.json({
      success: true,
      source: "espn",
      teamId: Number(teamId),
      league: leagueCode,
      count: unique.length,
      fixtures: unique
    });

  } catch (error) {
    console.error("Team fixtures error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/standings/:league", async (req, res) => {
  try {
    const leagueMap = {
      "premier-league": {
        code: "eng.1",
        name: "Premier League"
      },
      "laliga": {
        code: "esp.1",
        name: "LaLiga"
      },
      "bundesliga": {
        code: "ger.1",
        name: "Bundesliga"
      },
      "serie-a": {
        code: "ita.1",
        name: "Serie A"
      },
      "ligue-1": {
        code: "fra.1",
        name: "Ligue 1"
      },
      "champions-league": {
        code: "uefa.champions",
        name: "Champions League"
      }
    };

    const selected = leagueMap[req.params.league];

    if (!selected) {
      return res.status(404).json({
        success: false,
        message: "League not supported"
      });
    }

    const response = await fetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${selected.code}/standings`
    );

    if (!response.ok) {
      throw new Error("ESPN HTTP " + response.status);
    }

    const data = await response.json();

    const entries =
      data.children?.[0]?.standings?.entries ||
      data.standings?.entries ||
      [];

    const table = entries.map((item, index) => {
      const stats = {};

      (item.stats || []).forEach(stat => {
        stats[stat.name] = stat.value;
      });

      return {
        rank: item.note?.rank || index + 1,
        team: {
          id: item.team?.id || null,
          name: item.team?.displayName || item.team?.name || "",
          logo: item.team?.logos?.[0]?.href || ""
        },
        played: stats.gamesPlayed ?? 0,
        wins: stats.wins ?? 0,
        draws: stats.ties ?? stats.draws ?? 0,
        losses: stats.losses ?? 0,
        goalDifference: stats.pointDifferential ?? 0,
        points: stats.points ?? 0
      };
    });

    res.json({
      success: true,
      source: "espn",
      league: selected.name,
      season: data.children?.[0]?.standings?.season || null,
      count: table.length,
      standings: table
    });

  } catch (error) {
    console.error("Standings error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   LIVE MATCHES
========================= */

app.get("/api/matches/live", async (req, res) => {
  try {
    const data = await footballApiRequest("fixtures", {
      live: "all"
    });

    const matches = (data.response || []).map((item) => ({
      fixtureId: item.fixture?.id,

      status: {
        short: item.fixture?.status?.short || null,
        long: item.fixture?.status?.long || null,
        elapsed: item.fixture?.status?.elapsed ?? null,
        extra: item.fixture?.status?.extra ?? null
      },

      league: {
        id: item.league?.id ?? null,
        name: item.league?.name || "",
        country: item.league?.country || "",
        logo: item.league?.logo || ""
      },

      home: {
        id: item.teams?.home?.id ?? null,
        name: item.teams?.home?.name || "",
        logo: item.teams?.home?.logo || "",
        winner: item.teams?.home?.winner ?? null
      },

      away: {
        id: item.teams?.away?.id ?? null,
        name: item.teams?.away?.name || "",
        logo: item.teams?.away?.logo || "",
        winner: item.teams?.away?.winner ?? null
      },

      goals: {
        home: item.goals?.home ?? 0,
        away: item.goals?.away ?? 0
      },

      fixture: {
        date: item.fixture?.date || null,
        timezone: item.fixture?.timezone || null,
        venue: item.fixture?.venue?.name || ""
      }
    }));

    res.json({
      success: true,
      source: "api-football",
      count: matches.length,
      matches
    });

  } catch (error) {
    console.error("❌ Live matches error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   ESPN TODAY'S MATCHES
========================= */
app.get("/api/matches/today-espn", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const dateParam = date.replace(/-/g, "");

    const competitions = [
      {
        slug: "eng.1",
        name: "English Premier League",
        country: "England"
      },
      {
        slug: "esp.1",
        name: "LaLiga",
        country: "Spain"
      },
      {
        slug: "ita.1",
        name: "Serie A",
        country: "Italy"
      },
      {
        slug: "ger.1",
        name: "Bundesliga",
        country: "Germany"
      },
      {
        slug: "fra.1",
        name: "Ligue 1",
        country: "France"
      },
      {
        slug: "uefa.champions",
        name: "UEFA Champions League",
        country: "Europe"
      }
    ];

    const results = await Promise.allSettled(
      competitions.map(async (competition) => {
        const url =
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${competition.slug}/scoreboard` +
          `?dates=${dateParam}&limit=100`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `${competition.slug}: ESPN HTTP ${response.status}`
          );
        }

        const data = await response.json();

        return (data.events || []).map((event) => {
          const match = event.competitions?.[0] || {};
          const teams = match.competitors || [];

          const home =
            teams.find((team) => team.homeAway === "home") || {};

          const away =
            teams.find((team) => team.homeAway === "away") || {};

          return {
            fixtureId: event.id || null,

            status: {
              short: event.status?.type?.state || null,
              long: event.status?.type?.description || "",
              detail: event.status?.type?.detail || "",
              elapsed: null
            },

            league: {
              name: competition.name,
              country: competition.country,
              logo: ""
            },

            home: {
              id: home.id || null,
              name: home.team?.displayName || "",
              logo:
                home.team?.logo ||
                home.team?.logos?.[0]?.href ||
                ""
            },

            away: {
              id: away.id || null,
              name: away.team?.displayName || "",
              logo:
                away.team?.logo ||
                away.team?.logos?.[0]?.href ||
                ""
            },

            goals: {
              home:
                home.score != null
                  ? Number(home.score)
                  : null,
              away:
                away.score != null
                  ? Number(away.score)
                  : null
            },

            fixture: {
              date: event.date || null,
              timezone: "UTC",
              venue:
                match.venue?.fullName ||
                match.venue?.address?.city ||
                ""
            }
          };
        });
      })
    );

    const matches = [];

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        matches.push(...result.value);
      } else {
        console.error(
          "❌ ESPN competition error:",
          result.reason?.message || result.reason
        );
      }
    });

    matches.sort((a, b) => {
      const dateA = a.fixture?.date
        ? new Date(a.fixture.date).getTime()
        : Infinity;

      const dateB = b.fixture?.date
        ? new Date(b.fixture.date).getTime()
        : Infinity;

      return dateA - dateB;
    });

    res.json({
      success: true,
      source: "espn",
      date,
      competitions: competitions.map((item) => item.name),
      count: matches.length,
      matches
    });

  } catch (error) {
    console.error("❌ ESPN today's matches error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   ESPN NEWS
========================= */
app.get("/api/news", async (req, res) => {
  try {
    const leagues = [
      { code: "eng.1", name: "Premier League" },
      { code: "esp.1", name: "LaLiga" },
      { code: "ita.1", name: "Serie A" },
      { code: "ger.1", name: "Bundesliga" },
      { code: "fra.1", name: "Ligue 1" }
    ];

    const results = await Promise.allSettled(
      leagues.map(async (league) => {
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/news`
        );

        if (!response.ok) {
          throw new Error(`ESPN ${league.code} HTTP ${response.status}`);
        }

        const data = await response.json();

        return (data.articles || []).map((article) => ({
          id: String(article.id || article.nowId || ""),
          headline: article.headline || "",
          description: article.description || "",
          published: article.published || article.lastModified || null,
          image: article.images?.[0]?.url || "",
          link: article.links?.web?.href || article.link?.href || "",
          league: league.name,
          source: "ESPN"
        }));
      })
    );

    const news = [];

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        news.push(...result.value.filter((item) => item.id && item.headline));
      } else {
        console.error("❌ ESPN news error:", result.reason?.message || result.reason);
      }
    });

    try {
      const rss = await fetch(
        "https://feeds.bbci.co.uk/sport/football/rss.xml"
      );

      if (rss.ok) {
        const xml = await rss.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

        for (const match of items) {
          const item = match[1];
          const get = (tag) => {
            const m = item.match(
              new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i")
            );

            return m
              ? m[1]
                  .replace(/<!\[CDATA\[|\]\]>/g, "")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/\s+/g, " ")
                  .trim()
              : "";
          };

          const title = get("title");
          const link = get("link");
          const published = get("pubDate");
          const description = get("description");

          if (title && link) {
            news.push({
              id: "BBC-" + Buffer.from(link).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-24),
              headline: title,
              description,
              published: published || null,
              image: "",
              link,
              league: "Football",
              source: "BBC Sport"
            });
          }
        }
      }
    } catch (error) {
      console.error("❌ BBC Sport RSS error:", error.message || error);
    }

    try {
      const rss = await fetch("https://www.cbssports.com/rss/headlines/soccer/");

      if (rss.ok) {
        const xml = await rss.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

        for (const match of items) {
          const item = match[1];

          const get = (tag) => {
            const m = item.match(new RegExp(`<${tag}[^>]*>[^]*?<\/${tag}>`, "i"));
            if (!m) return "";
            return m[0]
              .replace(new RegExp(`^<${tag}[^>]*>`, "i"), "")
              .replace(new RegExp(`<\/${tag}>$`, "i"), "")
              .replace(/<!\[CDATA\[|\]\]>/g, "")
              .trim();
          };

          const title = get("title");
          const link = get("link");
          const published = get("pubDate");
          const description = get("description");
          const enclosure = item.match(/<enclosure[^>]+url="([^"]+)"/i);

          if (title && link) {
            news.push({
              id: "CBS-" + Buffer.from(link).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-24),
              headline: title,
              description,
              published: published || null,
              image: enclosure ? enclosure[1] : "",
              link,
              league: "Football",
              source: "CBS Sports"
            });
          }
        }
      }
    } catch (error) {
      console.error("❌ CBS Sports RSS error:", error.message || error);
    }

    try {
      const rss = await fetch("https://www.theguardian.com/football/rss");

      if (rss.ok) {
        const xml = await rss.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

        for (const match of items) {
          const item = match[1];

          const get = (tag) => {
            const m = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
            return m
              ? m[1]
                  .replace(/<!\[CDATA\[|\]\]>/g, "")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/\s+/g, " ")
                  .trim()
              : "";
          };

          const title = get("title");
          const link = get("link");
          const published = get("pubDate");
          const description = get("description");

          if (title && link) {
            news.push({
              id: "GUARDIAN-" + Buffer.from(link).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-24),
              headline: title,
              description,
              published: published || null,
              image: "",
              link,
              league: "Football",
              source: "The Guardian"
            });
          }
        }
      }
    } catch (error) {
      console.error("❌ Guardian RSS error:", error.message || error);
    }

        try {
      const rss = await fetch("https://www.skysports.com/rss/12040");

      if (rss.ok) {
        const xml = await rss.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

        for (const match of items) {
          const item = match[1];

          const get = (tag) => {
            const m = item.match(
              new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i")
            );

            return m
              ? m[1]
                  .replace(/<!\[CDATA\[|\]\]>/g, "")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/\s+/g, " ")
                  .trim()
              : "";
          };

          const title = get("title");
          const link = get("link");
          const published = get("pubDate");
          const description = get("description");

          if (title && link) {
            news.push({
              id: "SKY-" + Buffer.from(link).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-24),
              headline: title,
              description,
              published: published || null,
              image: "",
              link,
              league: "Football",
              source: "Sky Sports"
            });
          }
        }
      }
    } catch (error) {
      console.error("❌ Sky Sports API RSS error:", error.message || error);
    }

    // LiveScore Firestore articles
    try {
      const snap = await firestore
        .collection("news")
        .where("source", "==", "LiveScore")
        .get();

      snap.forEach((doc) => {
        const item = doc.data() || {};

        const published = item.publishedAt?.toDate
          ? item.publishedAt.toDate().toISOString()
          : (item.publishedAt || item.createdAt || null);

        if (item.title && (item.sourceUrl || item.liveScoreUrl)) {
          news.push({
            id: "LIVESCORE-" + doc.id,
            headline: item.title,
            description: item.description || "",
            published,
            image: item.image || "",
            link: item.liveScoreUrl || item.sourceUrl || "",
            source: "LiveScore",
            sourcePublisher: item.sourcePublisher || "",
            titleAm: item.titleAm || "",
            descriptionAm: item.descriptionAm || ""
          });
        }
      });

      console.log(`🟢 LiveScore API: ${snap.size} Firestore articles added`);
      console.log("🔎 LiveScore sample:", news.filter(n => n.source === "LiveScore").slice(0,3).map(n => ({headline:n.headline,published:n.published,id:n.id})));
    } catch (error) {
      console.error(
        "❌ LiveScore Firestore API error:",
        error.message || error
      );
    }

    const unique = Array.from(
      new Map(news.map((item) => [item.id, item])).values()
    );

    unique.sort((a, b) =>
      new Date(b.published || 0).getTime() -
      new Date(a.published || 0).getTime()
    );

    const latestNews = unique.slice(0, 20);

    for (const item of latestNews) {
      try {
        const cacheKey = item.id + "|" + item.headline;

        if (item.titleAm) {
          continue;
        }

        if (amharicNewsCache.has(cacheKey)) {
          const cached = amharicNewsCache.get(cacheKey);
          item.titleAm = cached.titleAm || item.headline;
          item.descriptionAm = cached.descriptionAm || item.description || "";
          continue;
        }

        const translatedTitle = await translateToAmharic(item.headline);
        const translatedDescription = await translateToAmharic(item.description || "");

        const titleAm =
          translatedTitle && /[ሀ-ፚ]/.test(translatedTitle)
            ? translatedTitle
            : item.headline;

        const descriptionAm =
          translatedDescription && /[ሀ-ፚ]/.test(translatedDescription)
            ? translatedDescription
            : (item.description || "");

        const translatedData = {
          titleAm,
          descriptionAm
        };

        amharicNewsCache.set(cacheKey, translatedData);
        item.titleAm = titleAm;
        item.descriptionAm = descriptionAm;
      } catch (error) {
        console.error("Translation error:", error.message);
      }
    }

    if (latestNews.length > 0) {
      try {
        const telegramResult = await publishNewsToTelegram(latestNews[0]);
        console.log("📲 Telegram auto-publish:", telegramResult);
      } catch (telegramError) {
        console.error("❌ Telegram auto-publish error:", telegramError.message);
      }
    }

    res.json({
      success: true,
      source: "espn",
      count: unique.length,
      news: latestNews
    });
  } catch (error) {
    console.error("❌ ESPN news route error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   FIXTURES BY DATE
========================= */

app.get("/api/matches/fixtures", async (req, res) => {
  try {
    const date = req.query.date;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date query is required. Example: ?date=2026-09-07"
      });
    }

    const data = await footballApiRequest("fixtures", {
      date,
      timezone: req.query.timezone || "Africa/Addis_Ababa"
    });

    res.json({
      success: true,
      source: "api-football",
      date,
      count: data.results || 0,
      matches: data.response || []
    });

  } catch (error) {
    console.error("❌ Fixtures error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   SINGLE MATCH
========================= */

app.get("/api/matches/:fixtureId", async (req, res) => {
  try {
    const fixtureId = req.params.fixtureId;

    if (!/^\d+$/.test(fixtureId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fixture ID"
      });
    }

    const data = await footballApiRequest("fixtures", {
      id: fixtureId
    });

    res.json({
      success: true,
      source: "api-football",
      fixtureId: Number(fixtureId),
      count: data.results || 0,
      match: data.response?.[0] || null
    });

  } catch (error) {
    console.error("❌ Match details error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   MATCH LINEUPS
========================= */

app.get("/api/matches/:fixtureId/lineups", async (req, res) => {
  try {
    const fixtureId = req.params.fixtureId;

    if (!/^\d+$/.test(fixtureId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fixture ID"
      });
    }

    const data = await footballApiRequest("fixtures/lineups", {
      fixture: fixtureId
    });

    res.json({
      success: true,
      source: "api-football",
      fixtureId: Number(fixtureId),
      count: data.results || 0,
      lineups: data.response || []
    });

  } catch (error) {
    console.error("❌ Lineups error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   MATCH EVENTS
========================= */

app.get("/api/matches/:fixtureId/events", async (req, res) => {
  try {
    const fixtureId = req.params.fixtureId;

    if (!/^\d+$/.test(fixtureId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fixture ID"
      });
    }

    const data = await footballApiRequest("fixtures/events", {
      fixture: fixtureId
    });

    res.json({
      success: true,
      source: "api-football",
      fixtureId: Number(fixtureId),
      count: data.results || 0,
      events: data.response || []
    });

  } catch (error) {
    console.error("❌ Match events error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   MATCH STATISTICS
========================= */

app.get("/api/matches/:fixtureId/statistics", async (req, res) => {
  try {
    const fixtureId = req.params.fixtureId;

    if (!/^\d+$/.test(fixtureId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fixture ID"
      });
    }

    const data = await footballApiRequest("fixtures/statistics", {
      fixture: fixtureId
    });

    res.json({
      success: true,
      source: "api-football",
      fixtureId: Number(fixtureId),
      count: data.results || 0,
      statistics: data.response || []
    });

  } catch (error) {
    console.error("❌ Match statistics error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   ESPN AUTO NEWS IMPORTER
========================= */

async function sendEspnNotification({ headline, docId, sourceUrl }) {
  try {
    const users = await firebaseAuth.listUsers();
    const notification = {
      title: "New ESPN News",
      message: headline,
      source: "ESPN",
      articleId: docId,
      sourceUrl: sourceUrl || "",
      createdAt: Date.now(),
      read: false
    };

    const updates = {};
    for (const user of users.users) {
      updates[`notifications/${user.uid}/${docId}`] = notification;
    }

    if (Object.keys(updates).length > 0) {
      await rtdb.ref().update(updates);
      console.log(`🔔 ESPN notification sent to ${users.users.length} users: ${headline}`);
    }
  } catch (error) {
    console.error("❌ ESPN notification error:", error.message);
  }
}


async function importEspnGlobalNews() {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const response = await fetch(
      "https://now.core.api.espn.com/v1/sports/news?limit=50"
    );

    if (!response.ok) {
      throw new Error(`ESPN Global HTTP ${response.status}`);
    }

    const data = await response.json();
    const headlines = Array.isArray(data.headlines) ? data.headlines : [];

    const soccerHeadlines = headlines.filter(
      article => article.root === "soccer"
    );

    console.log(
      `🌍 ESPN Global Soccer feed: ${soccerHeadlines.length}/${headlines.length}`
    );

    for (const article of soccerHeadlines) {
      try {
        const sourceId = String(article.id);
        const docId = `espn_${sourceId}`;

        const headline = article.headline || article.title || "Untitled";
        const description = article.description || "";
        const sourceUrl = article.link || "";
        const publishedAt = article.published || article.originallyPosted || null;
        const image =
          article.images?.find(img => img.type === "header")?.url ||
          article.images?.[0]?.url ||
          "";

        const category = article.section || "Soccer";

        const newsRef = firestore.collection("news").doc(docId);
        const existing = await newsRef.get();

        if (!existing.exists) {
          await newsRef.set({
            title: headline,
            titleAm,
            type: "news",
            author: "ESPN",
            description,
            descriptionAm,
            image,
            content: descriptionAm,
            category,
            source: "ESPN",
            sourceId,
            sourceUrl,
            publishedAt,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          imported++;

          await sendEspnNotification({
            headline,
            docId,
            sourceUrl
          });

          console.log(`🆕 ESPN Global imported: ${headline}`);
        } else {
          const old = existing.data() || {};

          const changed =
            old.title !== headline ||
            old.description !== description ||
            old.image !== image ||
            old.sourceUrl !== sourceUrl ||
            old.publishedAt !== publishedAt ||
            old.category !== category;

          if (changed) {
            await newsRef.update({
              title: headline,
              titleAm,
              description,
              descriptionAm,
              image,
              content: descriptionAm,
              category,
              sourceUrl,
              publishedAt,
              updatedAt: new Date()
            });

            updated++;
            console.log(`♻️ ESPN Global updated: ${headline}`);
          } else {
            skipped++;
          }
        }
      } catch (articleError) {
        console.error(
          "❌ ESPN Global article error:",
          articleError.message
        );
      }
    }

    console.log(
      `🌍 ESPN Global finished | Imported: ${imported} | Updated: ${updated} | Skipped: ${skipped}`
    );
  } catch (error) {
    console.error("❌ ESPN Global import error:", error.message);
  }
}


importLiveScoreNews();
async function importLiveScoreNews() {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const response = await fetch("https://www.livescore.com/en/news/football/");

    if (!response.ok) {
      throw new Error(`LiveScore HTTP ${response.status}`);
    }

    const html = await response.text();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);

    if (!match) {
      throw new Error("LiveScore __NEXT_DATA__ not found");
    }

    const data = JSON.parse(match[1]);
    const articles = data?.props?.pageProps?.initialData?.category?.articles || [];

    console.log(`🟢 LiveScore feed: ${articles.length} articles`);

    for (const article of articles) {
      try {
        const title = String(article?.title || "").trim();
        const slug = String(article?.slug || "").trim();
        const source = String(article?.metaData?.publisher?.name || "LiveScore").trim();
        const sourceUrl = String(article?.metaData?.originalUrl || "").trim();
        const image = String(article?.metaData?.imageUrl || "").trim();
        const publishedAt = article?.sys?.firstPublishedAt || null;
        const liveScoreUrl = slug ? `https://www.livescore.com${slug}` : "";

        if (!title || !slug) {
          skipped++;
          continue;
        }

        const sourceId = String(article?.sys?.id || slug)
          .replace(/[^a-zA-Z0-9]/g, "_")
          .slice(-120);

        const docId = `livescore_${sourceId}`;
        const newsRef = firestore.collection("news").doc(docId);
        const existing = await newsRef.get();

        let titleAm = existing.exists
          ? (existing.data()?.titleAm || title)
          : await translateToAmharic(title);

        const description = `Source: ${source}. Read the full story on LiveScore.`;
        const descriptionAm = `ምንጭ፦ ${source}። ሙሉ ዜናውን LiveScore ላይ ያንብቡ።`;

        const newsData = {
          title,
          titleAm,
          type: "news",
          author: source,
          description,
          descriptionAm,
          image,
          content: descriptionAm,
          category: "Football",
          source: "LiveScore",
          sourcePublisher: source,
          sourceId,
          sourceUrl,
          liveScoreUrl,
          publishedAt,
          updatedAt: new Date()
        };

        if (!existing.exists) {
          newsData.createdAt = new Date();
          await newsRef.set(newsData);
          imported++;
          console.log(`🆕 LiveScore imported: ${title}`);
        } else {
          const old = existing.data() || {};
          const changed =
            old.title !== title ||
            old.titleAm !== titleAm ||
            old.image !== image ||
            old.sourceUrl !== sourceUrl ||
            old.liveScoreUrl !== liveScoreUrl ||
            old.publishedAt !== publishedAt;

          if (changed) {
            await newsRef.update(newsData);
            updated++;
            console.log(`♻️ LiveScore updated: ${title}`);
          } else {
            skipped++;
          }
        }
      } catch (articleError) {
        console.error("❌ LiveScore article error:", articleError.message);
      }
    }

    console.log(`🟢 LiveScore finished | Imported: ${imported} | Updated: ${updated} | Skipped: ${skipped}`);
  } catch (error) {
    console.error("❌ LiveScore import error:", error.message);
  }
}

async function importBbcNews() {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const response = await fetch(
      "https://feeds.bbci.co.uk/sport/football/rss.xml"
    );

    if (!response.ok) {
      throw new Error(`BBC RSS HTTP ${response.status}`);
    }

    const xml = await response.text();
    const data = new XMLParser({
      ignoreAttributes: false
    }).parse(xml);

    const items = Array.isArray(data?.rss?.channel?.item)
      ? data.rss.channel.item
      : data?.rss?.channel?.item
        ? [data.rss.channel.item]
        : [];

    console.log(`📰 BBC Football RSS: ${items.length} items`);

    for (const item of items) {
      try {
        const title = item.title || "Untitled";
        const description = item.description || "";
        const sourceUrl = item.link || "";
        const publishedAt = item.pubDate || null;

        const guid =
          typeof item.guid === "object"
            ? item.guid["#text"]
            : item.guid || sourceUrl;

        let image =
          String(item["media:thumbnail"]?.["@_url"] || "").replace("/240/", "/1024/");

        if (sourceUrl) {
          try {
            const articleResponse = await fetch(sourceUrl);

            if (articleResponse.ok) {
              const articleHtml = await articleResponse.text();

              const ogImage =
                articleHtml.match(
                  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i
                )?.[1] || "";

              if (ogImage) {
                image = ogImage;
              }
            }
          } catch (imageError) {
            console.error("⚠️ BBC HD image error:", imageError.message);
          }
        }

        const sourceId = String(guid || sourceUrl)
          .replace(/[^a-zA-Z0-9]/g, "_")
          .slice(-120);

        const docId = `bbc_${sourceId}`;

        const newsRef = firestore.collection("news").doc(docId);
        const existing = await newsRef.get();

        const newsData = {
          title,
          type: "news",
          author: "BBC Sport",
          description,
          image,
          content: description,
          category: "Football",
          source: "BBC Sport",
          sourceId,
          sourceUrl,
          publishedAt,
          createdAt: existing.exists
            ? existing.data().createdAt || new Date()
            : new Date(),
          updatedAt: new Date()
        };

        if (!existing.exists) {
          await newsRef.set(newsData);
          imported++;
          console.log(`🆕 BBC imported: ${title}`);
        } else {
          const old = existing.data() || {};

          const changed =
            old.title !== title ||
            old.description !== description ||
            old.image !== image ||
            old.sourceUrl !== sourceUrl ||
            old.publishedAt !== publishedAt;

          if (changed) {
            await newsRef.update(newsData);
            updated++;
            console.log(`♻️ BBC updated: ${title}`);
          } else {
            skipped++;
          }
        }
      } catch (articleError) {
        console.error(
          "❌ BBC article error:",
          articleError.message
        );
      }
    }

    console.log(
      `📰 BBC finished | Imported: ${imported} | Updated: ${updated} | Skipped: ${skipped}`
    );
  } catch (error) {
    console.error("❌ BBC import error:", error.message);
  }
}


async function importSkySportsNews() {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const response = await fetch("https://www.skysports.com/rss/12040");

    if (!response.ok) {
      throw new Error(`Sky Sports HTTP ${response.status}`);
    }

    const xml = await response.text();
    const data = new XMLParser({ ignoreAttributes: false }).parse(xml);
    const channel = data?.rss?.channel;

    const items = Array.isArray(channel?.item)
      ? channel.item
      : channel?.item
        ? [channel.item]
        : [];

    console.log(`☁️ Sky Sports RSS: ${items.length} items`);

    for (const item of items) {
      try {
        const title = String(item?.title || "Untitled").trim();
        const description = String(item?.description || "").trim();
        const sourceUrl = String(item?.link || "").trim();
        const publishedAt = item?.pubDate || null;

        if (!sourceUrl || !title || !sourceUrl.includes("/football/")) {
          skipped++;
          continue;
        }

        const guid = String(item?.guid || sourceUrl);
        const sourceId = guid
          .replace(/[^a-zA-Z0-9]/g, "_")
          .slice(-120);

        const docId = `sky_${sourceId}`;

        const newsRef = firestore.collection("news").doc(docId);
        const existing = await newsRef.get();

        let image = "";

        const mediaContent = item?.["media:content"];
        const mediaThumbnail = item?.["media:thumbnail"];

        if (mediaContent?.["@_url"]) {
          image = String(mediaContent["@_url"]);
        } else if (mediaThumbnail?.["@_url"]) {
          image = String(mediaThumbnail["@_url"]);
        }

        if (sourceUrl) {
          try {
            const articleResponse = await fetch(sourceUrl);

            if (articleResponse.ok) {
              const articleHtml = await articleResponse.text();

              const ogImage =
                articleHtml.match(
                  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i
                )?.[1] || "";

              if (ogImage) {
                image = ogImage;
              }
            }
          } catch (imageError) {
            console.error("⚠️ Sky image fetch error:", imageError.message);
          }
        }

        const newsData = {
          title,
          type: "news",
          author: "Sky Sports",
          description,
          content: description,
          image,
          category: "Football",
          source: "Sky Sports",
          sourceId,
          sourceUrl,
          publishedAt,
          updatedAt: new Date()
        };

        if (!existing.exists) {
          newsData.createdAt = new Date();

          await newsRef.set(newsData);

          imported++;
          console.log(`🆕 Sky imported: ${title}`);
        } else {
          const old = existing.data() || {};

          const changed =
            old.title !== title ||
            old.description !== description ||
            old.image !== image ||
            old.sourceUrl !== sourceUrl ||
            old.publishedAt !== publishedAt;

          if (changed) {
            await newsRef.update(newsData);

            updated++;
            console.log(`♻️ Sky updated: ${title}`);
          } else {
            skipped++;
          }
        }
      } catch (articleError) {
        console.error(
          "❌ Sky article error:",
          articleError.message
        );
      }
    }

    console.log(
      `☁️ Sky Sports finished | Imported: ${imported} | Updated: ${updated} | Skipped: ${skipped}`
    );
  } catch (error) {
    console.error("❌ Sky Sports import error:", error.message);
  }
}

async function importEspnNews() {
  const leagues = [
    { code: "eng.1", name: "Premier League" },
    { code: "esp.1", name: "LaLiga" },
    { code: "ita.1", name: "Serie A" },
    { code: "ger.1", name: "Bundesliga" },
    { code: "fra.1", name: "Ligue 1" }
  ];

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (const league of leagues) {
      try {
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/news`
        );

        if (!response.ok) {
          console.error(
            `❌ ESPN ${league.code}: HTTP ${response.status}`
          );
          continue;
        }

        const data = await response.json();

        for (const article of data.articles || []) {
          const sourceId = String(
            article.id || article.nowId || ""
          ).trim();

          if (!sourceId) {
            continue;
          }

          /*
           * IMPORTANT:
           * The ESPN source ID is the unique key.
           * Therefore the same ESPN article always gets
           * the same Firestore document ID.
           */
          const docId = `espn_${sourceId}`;
          const newsRef = firestore
            .collection("news")
            .doc(docId);

          const existing = await newsRef.get();

          const headline = String(
            article.headline || ""
          ).trim();

          const description = String(
            article.description || ""
          ).trim();

          const image =
            article.images?.[0]?.url || "";

          const sourceUrl =
            article.links?.web?.href ||
            article.link?.href ||
            "";

          const publishedAt =
            article.published ||
            article.lastModified ||
            null;

          /*
           * NEW ARTICLE
           * Translate ONLY new ESPN articles.
           * Existing articles must NOT call Google Translate again.
           */
          if (!existing.exists) {
            const titleAm = await translateToAmharic(headline);
            const descriptionAm = await translateToAmharic(description);

            await newsRef.set({
              title: headline,
              titleAm,
              type: "news",
              author: "ESPN",
              description,
              descriptionAm,
              image,
              content: descriptionAm,
              category: league.name,
              source: "ESPN",
              sourceId,
              sourceUrl,
              publishedAt,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            imported++;

            await sendEspnNotification({ headline, docId, sourceUrl });

            console.log(
              `🆕 ESPN imported: ${headline}`
            );

            continue;
          }

          /*
           * EXISTING ARTICLE
           *
           * Update ESPN information but NEVER create
           * another document.
           */
          const oldData = existing.data() || {};

          const changed =
            oldData.title !== headline ||
            oldData.description !== description ||
            oldData.image !== image ||
            oldData.sourceUrl !== sourceUrl ||
            oldData.publishedAt !== publishedAt ||
            oldData.category !== league.name;

          if (changed) {
            await newsRef.update({
              title: headline,
              description,
              image,
              content: oldData.content || oldData.descriptionAm || description,
              titleAm: oldData.titleAm || headline,
              descriptionAm: oldData.descriptionAm || description,
              category: league.name,
              source: "ESPN",
              sourceId,
              sourceUrl,
              publishedAt,
              updatedAt: new Date()
            });

            updated++;

            console.log(
              `♻️ ESPN updated: ${headline}`
            );
          } else {
            skipped++;
          }
        }
      } catch (leagueError) {
        console.error(
          `❌ ESPN ${league.code} importer error:`,
          leagueError.message
        );
      }
    }

    console.log(
      `✅ ESPN import finished | ` +
      `Imported: ${imported} | ` +
      `Updated: ${updated} | ` +
      `Skipped: ${skipped}`
    );

  } catch (error) {
    console.error(
      "❌ ESPN importer error:",
      error.message
    );
  }
}

//importEspnNews();
//importEspnGlobalNews();
//
//setInterval(importEspnNews, 10 * 1000);
//importBbcNews();
//setInterval(importBbcNews, 60 * 1000);
//importSkySportsNews();
//setInterval(importSkySportsNews, 60 * 1000);
//setInterval(importEspnGlobalNews, 10 * 1000);

