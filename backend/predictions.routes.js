const LEAGUES = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "uefa.champions"];

function validDate(date) {
  return typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date + "T00:00:00Z"));
}

async function fetchMatches(date) {
  const results = await Promise.allSettled(LEAGUES.map(async (league) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date.replace(/-/g, "")}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("ESPN unavailable");
    const data = await response.json();

    return (data.events || []).map(event => {
      const competition = event.competitions?.[0];
      const teams = competition?.competitors || [];
      const home = teams.find(team => team.homeAway === "home");
      const away = teams.find(team => team.homeAway === "away");
      if (!home || !away || !event.id || !event.date) return null;

      const state = event.status?.type?.state || "unknown";
      return {
        fixtureId: String(event.id),
        date: event.date.slice(0, 10),
        kickoffAt: event.date,
        status: state,
        statusText: event.status?.type?.shortDetail || "Scheduled",
        league: competition?.name || league,
        home: {
          id: String(home.id || ""),
          name: home.team?.displayName || home.team?.name || "Home",
          logo: home.team?.logo || ""
        },
        away: {
          id: String(away.id || ""),
          name: away.team?.displayName || away.team?.name || "Away",
          logo: away.team?.logo || ""
        },
        goals: {
          home: home.score == null || home.score === "" ? null : Number(home.score),
          away: away.score == null || away.score === "" ? null : Number(away.score)
        },
        canPredict: state === "pre" && new Date(event.date).getTime() > Date.now()
      };
    }).filter(Boolean);
  }));

  const matches = [];
  let successCount = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      successCount++;
      matches.push(...result.value);
    }
  }
  if (!successCount) throw new Error("ESPN unavailable");
  return matches.sort((a, b) => new Date(a.kickoffAt) - new Date(b.kickoffAt));
}

module.exports = function registerPredictionRoutes({ app, firestore, verifyFirebaseUser }) {
  if (!app || !firestore || typeof verifyFirebaseUser !== "function") {
    throw new Error("Prediction routes require app, firestore and verifyFirebaseUser");
  }

  app.get("/api/predictions/matches", async (req, res) => {
    try {
      const date = req.query.date;
      if (!validDate(date)) {
        return res.status(400).json({ success: false, message: "Use date format YYYY-MM-DD" });
      }
      const matches = await fetchMatches(date);
      return res.json({ success: true, source: "espn", date, count: matches.length, matches });
    } catch (error) {
      console.error("Prediction matches error:", error.message);
      return res.status(502).json({ success: false, message: "Unable to load matches right now" });
    }
  });

  app.get("/api/predictions/mine", verifyFirebaseUser, async (req, res) => {
    try {
      const snapshot = await firestore.collection("matchPredictions")
        .where("userId", "==", req.user.uid)
        .limit(100)
        .get();

      const predictions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });

      return res.json({ success: true, count: predictions.length, predictions });
    } catch (error) {
      console.error("Load predictions error:", error.message);
      return res.status(500).json({ success: false, message: "Unable to load predictions" });
    }
  });

  app.post("/api/predictions", verifyFirebaseUser, async (req, res) => {
    try {
      const { fixtureId, date, outcome } = req.body || {};

      if (typeof fixtureId !== "string" || !/^\d+$/.test(fixtureId) || !validDate(date)) {
        return res.status(400).json({ success: false, message: "Valid fixtureId and date are required" });
      }

      if (!["home", "draw", "away"].includes(outcome)) {
        return res.status(400).json({ success: false, message: "Choose Home Win, Draw, or Away Win" });
      }

      const matches = await fetchMatches(date);
      const match = matches.find(item => item.fixtureId === fixtureId);

      if (!match) {
        return res.status(404).json({ success: false, message: "Match not found for that date" });
      }
      if (!match.canPredict) {
        return res.status(409).json({ success: false, message: "Predictions are locked once the match starts" });
      }

      const now = Date.now();
      const ref = firestore.collection("matchPredictions")
        .doc(`${req.user.uid}_${fixtureId}`);

      await firestore.runTransaction(async transaction => {
        const existing = await transaction.get(ref);
        if (Date.now() >= new Date(match.kickoffAt).getTime()) {
          throw new Error("PREDICTION_LOCKED");
        }

        const prediction = {
          userId: req.user.uid,
          userEmail: req.user.email || "",
          userName: req.user.name || req.user.email || "Player",
          fixtureId,
          matchDate: date,
          league: match.league,
          homeTeam: match.home.name,
          awayTeam: match.away.name,
          homeLogo: match.home.logo,
          awayLogo: match.away.logo,
          kickoffAt: new Date(match.kickoffAt),
          predictedOutcome: outcome,
          points: 0,
          updatedAt: new Date(now)
        };

        if (!existing.exists) prediction.createdAt = new Date(now);
        transaction.set(ref, prediction, { merge: true });
      });

      return res.json({
        success: true,
        message: "Prediction saved",
        prediction: { fixtureId, outcome, kickoffAt: match.kickoffAt }
      });
    } catch (error) {
      if (error.message === "PREDICTION_LOCKED") {
        return res.status(409).json({ success: false, message: "Predictions are locked once the match starts" });
      }
      console.error("Save prediction error:", error.message);
      return res.status(500).json({ success: false, message: "Unable to save prediction" });
    }
  });
  app.get("/api/predictions/leaderboard", async (req, res) => {
    try {
      const snapshot = await firestore.collection("matchPredictions").limit(1000).get();
      const docs = snapshot.docs;
      const dates = [...new Set(
        docs.map(doc => doc.data().matchDate).filter(validDate)
      )];
      const resultsByDate = new Map();

      for (const date of dates) {
        try {
          const matches = await fetchMatches(date);
          resultsByDate.set(
            date,
            new Map(matches.map(match => [match.fixtureId, match]))
          );
        } catch (error) {
          console.error("Scoring fetch error:", date, error.message);
        }
      }

      const updates = [];
      const totals = new Map();

      for (const doc of docs) {
        const p = doc.data();
        const match = resultsByDate.get(p.matchDate)?.get(p.fixtureId);

        if (match && match.status === "post" &&
            Number.isInteger(match.goals.home) &&
            Number.isInteger(match.goals.away)) {
          const predictedOutcome = p.predictedOutcome ||
            (Number.isInteger(p.predictedHomeGoals) &&
             Number.isInteger(p.predictedAwayGoals)
              ? (p.predictedHomeGoals > p.predictedAwayGoals
                  ? "home"
                  : p.predictedHomeGoals < p.predictedAwayGoals
                    ? "away" : "draw")
              : null);

          const actualOutcome =
            match.goals.home > match.goals.away ? "home" :
            match.goals.home < match.goals.away ? "away" : "draw";

          const points = predictedOutcome === actualOutcome ? 1 : 0;

          if (p.points !== points ||
              p.actualHomeGoals !== match.goals.home ||
              p.actualAwayGoals !== match.goals.away) {
            updates.push({
              ref: doc.ref,
              points,
              home: match.goals.home,
              away: match.goals.away
            });
          }
        }

        if (p.userId && !totals.has(p.userId)) {
          totals.set(p.userId, {
            userId: p.userId,
            name: p.userName || "Player",
            points: 0,
            predictions: 0
          });
        }
      }

      for (let i = 0; i < updates.length; i += 400) {
        const batch = firestore.batch();
        for (const item of updates.slice(i, i + 400)) {
          batch.update(item.ref, {
            points: item.points,
            actualHomeGoals: item.home,
            actualAwayGoals: item.away,
            scoredAt: new Date()
          });
        }
        await batch.commit();
      }

      const refreshed = await firestore.collection("matchPredictions")
        .limit(1000).get();

      for (const doc of refreshed.docs) {
        const p = doc.data();
        if (!p.userId) continue;

        if (!totals.has(p.userId)) {
          totals.set(p.userId, {
            userId: p.userId,
            name: p.userName || "Player",
            points: 0,
            predictions: 0
          });
        }

        const row = totals.get(p.userId);
        row.points += Number(p.points) || 0;
        row.predictions++;
      }

      const leaderboard = [...totals.values()]
        .sort((a, b) => b.points - a.points || b.predictions - a.predictions)
        .map((row, index) => ({ ...row, rank: index + 1 }));

      return res.json({
        success: true,
        count: leaderboard.length,
        leaderboard
      });
    } catch (error) {
      console.error("Leaderboard error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to load leaderboard"
      });
    }
  });
};
