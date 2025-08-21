import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import supabase from "./supabaseClient"
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const API_KEY = process.env.MTA_API_KEY;

// Middleware 
app.use(cors());
app.use(express.json());

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, 
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data });
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ session: data.session, user: data.user });
});

// Endpoint: nearest bus stops
app.get("/nearest-bus", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: "lat and lon required" });

    // Fetch all stops for MTA NYCT
    const stopsRes = await fetch(
      `https://bustime.mta.info/api/where/stops-for-agency/MTA%20NYCT.json?key=${API_KEY}`
    );
    const stopsData = await stopsRes.json();

    const nearestStops = (stopsData.data?.list || [])
      .map((s) => ({
        stopId: s.id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        distance: Math.sqrt((lat - s.lat) ** 2 + (lon - s.lon) ** 2),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5); // top 5 nearest

    res.json({ nearestStops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bus stops" });
  }
});

// Endpoint: upcoming arrivals at nearest stops
app.get("/bus-times", async (req, res) => {
  try {
    const stopIds = (req.query.stops || "").split(",");
    if (!stopIds.length) return res.status(400).json({ error: "stops query param required" });

    const arrivalPromises = stopIds.map(async (stopId) => {
      const stopRes = await fetch(
        `https://bustime.mta.info/api/where/arrivals-and-departures-for-stop/${stopId}.json?key=${API_KEY}`
      );
      const data = await stopRes.json();
      const predictions = data.data?.entry?.predictions || [];
      return {
        stopId,
        arrivals: predictions.map((p) => ({
          routeId: p.routeId,
          routeShortName: p.routeShortName,
          arrivalTime: p.arrivalTime, // ISO string
        })),
      };
    });

    const results = await Promise.all(arrivalPromises);
    res.json({ stops: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bus arrivals" });
  }
});

app.listen(PORT, () => {
  console.log(`Bus API server running on port ${PORT}`);
});




