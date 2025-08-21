import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="a-train"
        options={{
          title: 'A Train',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="train" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}