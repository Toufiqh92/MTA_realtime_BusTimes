// File: app/(tabs)/a-train.tsx

import React, { useEffect, useState } from "react";
import { 
  ActivityIndicator, 
  RefreshControl, 
  ScrollView, 
  StyleSheet, 
  Text, 
  View, 
  Alert
} from "react-native";
import { API_CONFIG } from "/workspaces/MTA_realtime_BusTimes/app/(tabs)/config.js";

type StopTime = {
  stopId: string;
  arrival: number | null;
};

type Trip = {
  tripId: string;
  stopTimes: StopTime[];
};

export default function ATrainScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = async () => {
    try {
      setError(null);
      const API_URL = `${API_CONFIG.baseUrl}/a-train`;
      
      console.log("Fetching from:", API_URL);
      
      const res = await fetch(API_URL);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Received data:", data);
      
      setTrips(data.trips || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching trips:", err);
      setError((err as Error).message);
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrips();
    const interval = setInterval(fetchTrips, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  // Format arrival time
  const formatArrivalTime = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    
    const now = Math.floor(Date.now() / 1000);
    const diffInMinutes = Math.floor((timestamp - now) / 60);
    
    if (diffInMinutes <= 0) return "Due";
    if (diffInMinutes < 60) return `${diffInMinutes} min`;
    
    return new Date(timestamp * 1000).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerContainer}>
        <Text style={styles.header}>A Train Arrivals</Text>
        <Text style={styles.subheader}>Last updated: {lastUpdated.toLocaleTimeString()}</Text>
      </View>
      
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading arrival data...</Text>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.noData}>No arrival data available.</Text>
        </View>
      ) : (
        <View style={styles.tripsContainer}>
          {trips.map((trip) => (
            <View key={trip.tripId} style={styles.tripCard}>
              <Text style={styles.tripId}>Trip ID: {trip.tripId}</Text>
              <View style={styles.stopTimesContainer}>
                {trip.stopTimes.slice(0, 5).map((st, idx) => (
                  <View key={idx} style={styles.stopTimeRow}>
                    <Text style={styles.stopId}>{st.stopId}</Text>
                    <Text style={[
                      styles.arrivalTime,
                      st.arrival && Math.floor((st.arrival - Date.now()/1000) / 60) < 5 
                        ? styles.arrivingSoon 
                        : null
                    ]}>
                      {formatArrivalTime(st.arrival)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  headerContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 8,
  },
  subheader: {
    fontSize: 16,
    color: "#666",
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: 16,
    color: "#666",
  },
  noData: {
    color: "#666",
    fontSize: 18,
  },
  tripsContainer: {
    marginBottom: 20,
  },
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripId: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 12,
    color: "#333",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
  },
  stopTimesContainer: {
    marginLeft: 8,
  },
  stopTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f9f9f9",
  },
  stopId: {
    fontSize: 16,
    color: "#555",
    fontWeight: '500',
  },
  arrivalTime: {
    fontSize: 16,
    fontWeight: '600',
    color: "#007AFF",
  },
  arrivingSoon: {
    color: '#FF3B30',
    fontWeight: 'bold',
  }
});