// backend/server.js
// backend/server.js - ESM version
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import pkg from "gtfs-realtime-bindings";
import fetch from "node-fetch"; // Now compatible with v3

const { transit_realtime } = pkg;
// ... rest of your code
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Add CORS middleware - THIS IS IMPORTANT!
app.use(cors());
app.use(express.json());

// Your MTA API routes here
app.get("/a-train", async (req, res) => {
  try {
    const MTA_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace";
    const MTA_API_KEY = process.env.MTA_API_KEY; // Your API key from .env file

    if (!MTA_API_KEY) {
      return res.status(500).json({ error: "MTA API key not configured" });
    }

    console.log("Fetching MTA data from:", MTA_API_URL);
    
    const response = await fetch(MTA_API_URL, {
      headers: {
        'x-api-key': MTA_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`MTA API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.arrayBuffer();
    const feed = transit_realtime.FeedMessage.decode(new Uint8Array(data));
    
    // Process the feed data
    const trips = processFeedData(feed);
    
    console.log(`Returning ${trips.length} trips`);
    res.json({ trips });
  } catch (error) {
    console.error("Error fetching MTA data:", error);
    res.status(500).json({ error: "Failed to fetch data from MTA API" });
  }
});

function processFeedData(feed) {
  const trips = [];
  
  // Process each entity in the feed
  feed.entity.forEach((entity) => {
    if (entity.tripUpdate) {
      const trip = entity.tripUpdate.trip;
      const stopTimeUpdates = entity.tripUpdate.stopTimeUpdate || [];
      
      const processedTrip = {
        tripId: trip.tripId,
        routeId: trip.routeId,
        stopTimes: stopTimeUpdates.map(stopUpdate => ({
          stopId: stopUpdate.stopId,
          arrival: stopUpdate.arrival ? stopUpdate.arrival.time.low : null,
          departure: stopUpdate.departure ? stopUpdate.departure.time.low : null
        }))
      };
      
      trips.push(processedTrip);
    }
  });
  
  return trips;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`A Train endpoint: http://localhost:${PORT}/a-train`);
});