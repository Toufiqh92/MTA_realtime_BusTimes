import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";

type StopTime = { stopId: string; arrival: number | null };
type Trip = { tripId: string; stopTimes: StopTime[] };
type Station = { stopId: string; name: string; lat: number; lon: number; distance: number };


const LOCAL_IP = "192.168.1.151";
const CODESPACE_URL = "https://bookish-meme-wrx5j4vvw695cvgxp-3001.app.github.dev";

const getStationsApiUrl = () => `${CODESPACE_URL}/nearest-a`;
const getTripsApiUrl = () => `${CODESPACE_URL}/a-train-nearest`;

export default function ATrainScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock fallback data
  const mockStations: Station[] = [
    { stopId: "R062", name: "59 St – Columbus Circle", lat: 40.768, lon: -73.981, distance: 0.5 },
    { stopId: "R061", name: "50 St", lat: 40.761, lon: -73.982, distance: 1.2 },
    { stopId: "R060", name: "42 St – Port Authority", lat: 40.757, lon: -73.989, distance: 1.5 },
  ];

  const mockTrips: Trip[] = [
    {
      tripId: "A123",
      stopTimes: [
        { stopId: "R062", arrival: Math.floor(Date.now() / 1000) + 120 },
        { stopId: "R061", arrival: Math.floor(Date.now() / 1000) + 300 },
      ],
    },
    {
      tripId: "A456",
      stopTimes: [
        { stopId: "R062", arrival: Math.floor(Date.now() / 1000) + 600 },
      ],
    },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("Location permission denied. Using mock data.");
        setStations(mockStations);
        setTrips(mockTrips);
        setUsingMock(true);
        setLastUpdated(new Date());
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      console.log("User location:", lat, lon);

      // Fetch nearest stations
      const stationsRes = await fetch(`${getStationsApiUrl()}?lat=${lat}&lon=${lon}`);
      const stationsData = await stationsRes.json();

      // Fetch trips filtered for nearest stations
      const tripsRes = await fetch(`${getTripsApiUrl()}?lat=${lat}&lon=${lon}`);
      const tripsData = await tripsRes.json();

      setStations(stationsData.nearestStations || []);
      setTrips(tripsData.trips || []);
      setUsingMock(false);
      setLastUpdated(new Date());

      console.log("Nearest stations:", stationsData.nearestStations);
      console.log("Trips:", tripsData.trips);
    } catch (err) {
      console.warn("Using mock data due to fetch error:", err);
      setStations(mockStations);
      setTrips(mockTrips);
      setUsingMock(true);
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatArrivalTime = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    const now = Math.floor(Date.now() / 1000);
    const diffMinutes = Math.floor((timestamp - now) / 60);
    if (diffMinutes <= 0) return "Due";
    if (diffMinutes < 60) return `${diffMinutes} min`;
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>Loading A Train data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.header}>
        Nearest A Train Stations {usingMock ? "(Mock)" : ""}
      </Text>

      {lastUpdated && (
        <Text style={styles.updated}>
          Updated: {lastUpdated.toLocaleTimeString()}
        </Text>
      )}

      {stations.length === 0 && <Text style={styles.noData}>No stations found</Text>}

      {stations.map((station) => {
        const stationArrivals = trips
          .map((t) => ({ tripId: t.tripId, stopTime: t.stopTimes.find((s) => s.stopId === station.stopId) }))
          .filter((t) => t.stopTime)
          .sort((a, b) => (a.stopTime?.arrival ?? Infinity) - (b.stopTime?.arrival ?? Infinity))
          .slice(0, 3);

        return (
          <View key={station.stopId} style={styles.stationCard}>
            <Text style={styles.stationName}>{station.name}</Text>
            {stationArrivals.length === 0 ? (
              <Text style={styles.noData}>No upcoming arrivals</Text>
            ) : (
              stationArrivals.map((t, idx) => (
                <Text key={idx} style={styles.arrivalText}>
                  Trip {t.tripId}: {formatArrivalTime(t.stopTime?.arrival ?? null)}
                </Text>
              ))
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f5f5f5", flexGrow: 1 },
  header: { fontSize: 28, fontWeight: "bold", color: "#007AFF", marginBottom: 10, textAlign: "center" },
  updated: { textAlign: "center", color: "#666", marginBottom: 20 },
  stationCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 16, elevation: 3 },
  stationName: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  arrivalText: { fontSize: 16, color: "#007AFF", marginBottom: 4 },
  noData: { fontSize: 16, color: "#666", textAlign: "center" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});

