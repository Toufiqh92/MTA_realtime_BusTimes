import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import pkg from "gtfs-realtime-bindings";
import fetch from "node-fetch";

const { transit_realtime } = pkg;
const app = express();
const PORT = process.env.PORT || 3001;

// Load A train stations data
const stationsPath = path.resolve("./stations-a.json");
const stations = JSON.parse(fs.readFileSync(stationsPath, "utf-8"));

// Enable CORS for your front-end
app.use(cors({
  origin: 'https://bookish-meme-wrx5j4vvw695cvgxp-8081.app.github.dev',
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Helper: approximate distance
const getDistance = (lat1, lon1, lat2, lon2) => {
  return Math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2);
};

// Endpoint: nearest A train stations
app.get("/nearest-a", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!lat || !lon) return res.status(400).json({ error: "lat and lon required" });

  const nearestStations = stations
    .map(s => ({ ...s, distance: getDistance(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  res.json({ nearestStations });
});

// Endpoint: trips filtered by nearest stations
app.get("/a-train-nearest", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (!lat || !lon) return res.status(400).json({ error: "lat and lon required" });

    const nearestStations = stations
      .map(s => ({ ...s, distance: getDistance(lat, lon, s.lat, s.lon) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    const nearestStopIds = nearestStations.map(s => s.stopId);

    // Fetch GTFS feed
    const MTA_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace";
    const response = await fetch(MTA_API_URL);
    if (!response.ok) throw new Error(`MTA API error: ${response.status}`);

    const data = await response.arrayBuffer();
    const feed = transit_realtime.FeedMessage.decode(new Uint8Array(data));

    console.log("Total trips in feed:", feed.entity.length);
    if (feed.entity.length > 0) console.log("First 5 trips:", feed.entity.slice(0, 5));

    const trips = feed.entity
      .filter(e => e.tripUpdate)
      .map(e => ({
        tripId: e.tripUpdate.trip.tripId,
        stopTimes: (e.tripUpdate.stopTimeUpdate || [])
          .filter(s => nearestStopIds.includes(s.stopId))
          .map(s => ({
            stopId: s.stopId,
            arrival: s.arrival ? s.arrival.time.low : null
          }))
      }))
      .filter(t => t.stopTimes.length > 0);

    console.log("Trips matching nearest stations:", trips.length);

    res.json({ trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch MTA data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



