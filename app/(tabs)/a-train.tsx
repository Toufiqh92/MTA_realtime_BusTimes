import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import * as Location from "expo-location";

type StopTime = {
  stopId: string;
  arrival: number | null;
};

type Trip = {
  tripId: string;
  stopTimes: StopTime[];
};

type Station = {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
  distance: number;
};

export default function ATrainScreen() {
  const [stations, setStations] = useState<Station[]>([]);
  const [arrivals, setArrivals] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getApiUrl = () => {
    if (Platform.OS === "web" || Platform.OS === "ios") return "http://localhost:3001/nearest-a";
    if (Platform.OS === "android") return "http://10.0.2.2:3001/nearest-a";
    return "http://localhost:3001/nearest-a";
  };

  const formatArrivalTime = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    const now = Math.floor(Date.now() / 1000);
    const diffMinutes = Math.floor((timestamp - now) / 60);
    if (diffMinutes <= 0) return "Due";
    if (diffMinutes < 60) return `${diffMinutes} min`;
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const fetchNearestStations = async () => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const res = await fetch(`${getApiUrl()}?lat=${latitude}&lon=${longitude}`);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

      const data = await res.json();
      setStations(data.nearestStations || []);
      setArrivals(data.arrivals || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNearestStations();
    const interval = setInterval(fetchNearestStations, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNearestStations();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.header}>Nearest A Train Stations</Text>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text>Loading arrival data...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : stations.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text>No stations nearby.</Text>
        </View>
      ) : (
        stations.map((station) => {
          const stationArrivals = arrivals
            .map((t) => ({
              tripId: t.tripId,
              stopTime: t.stopTimes.find((s) => s.stopId === station.stopId),
            }))
            .filter((t) => t.stopTime);

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
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f5f5f5", flexGrow: 1 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 40 },
  header: { fontSize: 28, fontWeight: "bold", color: "#007AFF", marginBottom: 20, textAlign: "center" },
  errorText: { color: "red", fontSize: 16, textAlign: "center" },
  stationCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 16, elevation: 3 },
  stationName: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  arrivalText: { fontSize: 16, color: "#007AFF", marginBottom: 4 },
  noData: { fontSize: 16, color: "#666" },
});
