export const API_CONFIG = {
  baseUrl: Platform.select({
    android: 'http://10.0.2.2:3001',
    ios: 'http://localhost:3001',
    web: typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001',
    default: 'http://localhost:3001'
  })
};