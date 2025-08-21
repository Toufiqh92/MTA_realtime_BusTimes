import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";

// Use EXPO_PUBLIC_API_BASE_URL if present
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://bookish-meme-wrx5j4vvw695cvgxp-3001.app.github.dev";


type StopTime = {
  routeId: string;
  routeShortName: string;
  arrivalTime: string | null;
};

type Stop = {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
  distance: number;
  arrivals?: StopTime[];
};

export default function BusScreen() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getStopsApiUrl = () => `${API_BASE_URL}/nearest-bus`;
  const getArrivalsApiUrl = () => `${API_BASE_URL}/bus-times`;

  // Mock fallback
  const mockStops: Stop[] = [
    { stopId: "123", name: "Main St", lat: 40.620, lon: -73.995, distance: 0.5, arrivals: [] },
    { stopId: "456", name: "Broadway", lat: 40.621, lon: -73.996, distance: 0.8, arrivals: [] },
  ];

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMessage("Location permission denied. Showing mock data.");
        setStops(mockStops);
        setUsingMock(true);
        setLastUpdated(new Date());
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      // Fetch nearest bus stops
      const stopsRes = await fetch(`${getStopsApiUrl()}?lat=${lat}&lon=${lon}`);
      if (!stopsRes.ok) {
        throw new Error(`Stops API error: ${stopsRes.status}`);
      }
      const stopsData = await stopsRes.json();
      const nearestStops: Stop[] = Array.isArray(stopsData?.nearestStops) ? stopsData.nearestStops : [];

      if (nearestStops.length === 0) {
        setErrorMessage("No nearby stops found. Showing mock data.");
        setStops(mockStops);
        setUsingMock(true);
        setLastUpdated(new Date());
        return;
      }

      // Fetch arrivals for nearest stops
      const stopIds = nearestStops.map((s) => s.stopId).join(",");
      const arrivalsRes = await fetch(`${getArrivalsApiUrl()}?stops=${stopIds}`);
      if (!arrivalsRes.ok) {
        throw new Error(`Arrivals API error: ${arrivalsRes.status}`);
      }
      const arrivalsData = await arrivalsRes.json();

      // Merge arrivals into stops
      const stopsWithArrivals = nearestStops.map((s) => {
        const stopArrivals = (arrivalsData?.stops || []).find((a: any) => a.stopId === s.stopId)?.arrivals || [];
        return { ...s, arrivals: stopArrivals.slice(0, 3) }; // next 3 arrivals
      });

      setStops(stopsWithArrivals);
      setUsingMock(false);
      setLastUpdated(new Date());
    } catch (err: any) {
      setErrorMessage(err?.message || "Unknown error. Showing mock data.");
      setStops(mockStops);
      setUsingMock(true);
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatArrivalTime = (arrivalTime: string | null) => {
    if (!arrivalTime) return "N/A";
    const arrivalDate = new Date(arrivalTime);
    const now = new Date();
    const diffMinutes = Math.round((arrivalDate.getTime() - now.getTime()) / 60000);
    if (diffMinutes <= 0) return "Due";
    return diffMinutes < 60 ? `${diffMinutes} min` : arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>Loading bus data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.header}>
        Nearest Bus Stops {usingMock ? "(Mock)" : ""}
      </Text>
      {lastUpdated && <Text style={styles.updated}>Updated: {lastUpdated.toLocaleTimeString()}</Text>}
      {errorMessage && <Text style={[styles.updated, { color: "#c00" }]}>{errorMessage}</Text>}
      {stops.length === 0 && <Text style={styles.noData}>No stops found</Text>}

      {stops.map((stop) => (
        <View key={stop.stopId} style={styles.stationCard}>
          <Text style={styles.stationName}>{stop.name}</Text>
          {stop.arrivals && stop.arrivals.length > 0 ? (
            stop.arrivals.map((a, idx) => (
              <Text key={idx} style={styles.arrivalText}>
                Route {a.routeShortName}: {formatArrivalTime(a.arrivalTime)}
              </Text>
            ))
          ) : (
            <Text style={styles.noData}>No upcoming arrivals</Text>
          )}
        </View>
      ))}
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


