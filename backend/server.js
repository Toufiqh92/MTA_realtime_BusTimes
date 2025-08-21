// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fetchBusAlerts } from "./busAlerts.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Endpoint: bus alerts
app.get("/bus/alerts", async (req, res) => {
  const alerts = await fetchBusAlerts();
  res.json(alerts);
});

// Endpoint: nearest bus stops
app.get("/nearest-bus", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: "lat and lon required" });

  try {
    const stopsRes = await fetch(
      `https://bustime.mta.info/api/where/stops-for-agency/MTA%20NYCT.json?key=${process.env.MTA_API_KEY}`
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
      .slice(0, 5);

    res.json({ nearestStops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bus stops" });
  }
});

// Endpoint: arrivals for specific stops
app.get("/bus-times", async (req, res) => {
  const stopIds = (req.query.stops || "").split(",");
  if (!stopIds.length) return res.status(400).json({ error: "stops query param required" });

  try {
    const arrivals = await Promise.all(
      stopIds.map(async (stopId) => {
        const stopRes = await fetch(
          `https://bustime.mta.info/api/where/arrivals-and-departures-for-stop/${stopId}.json?key=${process.env.MTA_API_KEY}`
        );
        const stopData = await stopRes.json();
        const predictions = stopData.data?.entry?.predictions || [];
        return {
          stopId,
          arrivals: predictions.map((p) => ({
            routeId: p.routeId,
            routeShortName: p.routeShortName,
            arrivalTime: p.arrivalTime,
          })),
        };
      })
    );

    res.json({ stops: arrivals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bus arrivals" });
  }
});

app.listen(PORT, () => {
  console.log(`Bus API server running on port ${PORT}`);
  console.log(`Bus alerts endpoint: http://localhost:${PORT}/bus/alerts`);
});





