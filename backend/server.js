import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const stationsPath = path.resolve("./stations-a.json");
const stations = JSON.parse(fs.readFileSync(stationsPath, "utf-8"));

import pkg from "gtfs-realtime-bindings";
import fetch from "node-fetch";

const { transit_realtime } = pkg;
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Fetch all A train trips
app.get("/a-train", async (req, res) => {
  try {
    const MTA_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace";

    const response = await fetch(MTA_API_URL); // No API key required

    if (!response.ok) throw new Error(`MTA API error: ${response.status}`);

    const data = await response.arrayBuffer();
    const feed = transit_realtime.FeedMessage.decode(new Uint8Array(data));

    const trips = feed.entity
      .filter((e) => e.tripUpdate)
      .map((e) => ({
        tripId: e.tripUpdate.trip.tripId,
        stopTimes: (e.tripUpdate.stopTimeUpdate || []).map((s) => ({
          stopId: s.stopId,
          arrival: s.arrival ? s.arrival.time.low : null,
        })),
      }));

    res.json({ trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch MTA data" });
  }
});

// Nearest stations based on lat/lon
app.get("/nearest-a", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (!lat || !lon) return res.status(400).json({ error: "lat and lon are required" });

  const nearestStations = stations
    .map((s) => ({
      ...s,
      distance: Math.sqrt((lat - s.lat) ** 2 + (lon - s.lon) ** 2),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  res.json({ nearestStations });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`All A train trips: http://localhost:${PORT}/a-train`);
  console.log(`Nearest A train endpoint: http://localhost:${PORT}/nearest-a?lat=LAT&lon=LON`);
});

