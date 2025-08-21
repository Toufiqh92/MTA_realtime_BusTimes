// busAlerts.js
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const API_KEY = process.env.MTA_API_KEY;

export async function fetchBusAlerts() {
  try {
    const res = await fetch(`https://gtfsrt.prod.obanyc.com/alerts?key=${API_KEY}`);
    if (!res.ok) throw new Error("Failed to fetch bus alerts");
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching bus alerts:", err);
    return [];
  }
}
