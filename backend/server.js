// backend/server.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import pkg from "gtfs-realtime-bindings";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const { transit_realtime } = pkg;
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Load A train stations
const stationsPath = path.resolve("./stations-a.json");
const stations = JSON.parse(fs.readFileSync(stationsPath, "utf8"));

// Haversine distance helper
function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fetch GTFS feed from MTA
async function fetchFeed() {
  const MTA_API_KEY = process.env.MTA_API_KEY;
  const MTA_API_URL =
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace";

  if (!MTA_API_KEY) throw new Error("MTA API key not configured");

  const res = await fetch(MTA_API_URL, {
    headers: { "x-api-key": MTA_API_KEY },
  });
  if (!res.ok) throw new Error(`MTA API error: ${res.status}`);

  const data = await res.arrayBuffer();
  return transit_realtime.FeedMessage.decode(new Uint8Array(data));
}

// Process feed into trips
function processFeedData(feed) {
  const trips = [];

  feed.entity.forEach((entity) => {
    if (entity.tripUpdate) {
      const trip = entity.tripUpdate.trip;
      const stopTimeUpdates = entity.tripUpdate.stopTimeUpdate || [];

      trips.push({
        tripId: trip.tripId,
        routeId: trip.routeId,
        stopTimes: stopTimeUpdates.map((s) => ({
          stopId: s.stopId,
          arrival: s.arrival ? s.arrival.time.low : null,
        })),
      });
    }
  });

  return trips;
}

// Filter trips for specific stops
function getArrivalsForStops(trips, stopIds) {
  return trips
    .map((trip) => {
      const filteredStops = trip.stopTimes.filter((s) =>
        stopIds.includes(s.stopId)
      );
      if (filteredStops.length === 0) return null;
      return { tripId: trip.tripId, stopTimes: filteredStops };
    })
    .filter(Boolean);
}

// --- ROUTES ---

// All A train trips
app.get("/a-train", async (req, res) => {
  try {
    const feed = await fetchFeed();
    const trips = processFeedData(feed);
    res.json({ trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch MTA data" });
  }
});

// Nearest 3 A train stations + arrivals
app.get("/nearest-a", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (!lat || !lon)
    return res.status(400).json({ error: "lat and lon are required" });

  try {
    const feed = await fetchFeed();
    const trips = processFeedData(feed);

    const nearestStations = stations
      .map((s) => ({ ...s, distance: getDistance(lat, lon, s.lat, s.lon) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    const stopIds = nearestStations.map((s) => s.stopId);
    const arrivals = getArrivalsForStops(trips, stopIds);

    res.json({ nearestStations, arrivals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch MTA data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Nearest A train endpoint: http://localhost:${PORT}/nearest-a?lat=LAT&lon=LON`
  );
  console.log(`All A train trips: http://localhost:${PORT}/a-train`);
});
