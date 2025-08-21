import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;


const API_KEY = process.env.MTA_API_KEY;


app.use(cors());
app.use(express.json());

// Endpoint: nearest bus stops
app.get("/nearest-bus", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: "lat and lon required" });

    if (!API_KEY) return res.status(500).json({ error: "Server missing MTA_API_KEY" });

    // Fetch nearby stops using location-aware endpoint
    const url = `https://bustime.mta.info/api/where/stops-for-location.json?key=${API_KEY}&lat=${lat}&lon=${lon}&radius=800`;
    const stopsRes = await fetch(url);
    if (!stopsRes.ok) {
      return res.status(502).json({ error: `Upstream stops API error: ${stopsRes.status}` });
    }
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
    const stopIds = String(req.query.stops || "").split(",").filter(Boolean);
    if (stopIds.length === 0) return res.status(400).json({ error: "stops query param required" });

    if (!API_KEY) return res.status(500).json({ error: "Server missing MTA_API_KEY" });

    const arrivalPromises = stopIds.map(async (stopId) => {
      const stopUrl = `https://bustime.mta.info/api/where/arrivals-and-departures-for-stop/${stopId}.json?key=${API_KEY}`;
      const stopRes = await fetch(stopUrl);
      if (!stopRes.ok) {
        return { stopId, arrivals: [] };
      }
      const data = await stopRes.json();
      const arrs = data.data?.entry?.arrivalsAndDepartures || [];
      return {
        stopId,
        arrivals: arrs.map((p) => {
          const arrivalMs = p.predictedArrivalTime || p.scheduledArrivalTime || p.predictedDepartureTime || p.scheduledDepartureTime || null;
          return {
            routeId: p.routeId,
            routeShortName: p.routeShortName || p.routeId,
            arrivalTime: arrivalMs ? new Date(arrivalMs).toISOString() : null,
          };
        }),
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




