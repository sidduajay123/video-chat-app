# ConnectNow — Video & Chat App

Real-time anonymous 1-on-1 video and text chat with gender-based random matching.

## Features
- 📹 Video chat with location display (City + Country)
- 💬 Text chat alongside video (persistent sidebar)
- 🎯 Opposite gender matching
- 🔐 Camera/mic permission gate with redirect on denial
- 📍 Geolocation via browser API + Nominatim reverse geocoding
- ⚡ WebRTC P2P video, Socket.IO for signaling & text
- 🐳 Docker + Kubernetes ready
- ✅ Unit & integration tests

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Docker
docker-compose up --build
```

## Kubernetes Deploy

```bash
# Apply all manifests
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -n video-chat

# Scale manually
kubectl scale deployment video-chat-app --replicas=5 -n video-chat
```

## Project Structure

```
video-chat-app/
├── server.js           # Express + Socket.IO server
├── matchmaker.js       # Gender-based matching logic
├── public/
│   ├── index.html      # Single-page app
│   ├── css/style.css   # Design system
│   └── js/
│       ├── app.js      # State machine
│       ├── socket.js   # Socket client
│       ├── webrtc.js   # WebRTC engine
│       ├── location.js # Geolocation service
│       └── ui.js       # DOM manager
├── tests/
│   ├── matchmaker.test.js
│   └── server.test.js
├── k8s/
│   └── deployment.yaml  # K8s: Deployment, Service, Ingress, HPA, PDB
├── Dockerfile
└── docker-compose.yml
```

## Tech Stack
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla HTML/CSS/JS
- **Video**: WebRTC (P2P)
- **Location**: Browser Geolocation + Nominatim (OpenStreetMap)
- **Testing**: Jest + Supertest
- **Container**: Docker (multi-stage)
- **Orchestration**: Kubernetes with HPA (auto-scaling 2–10 pods)
# rebuilt Sat Aug  8 20:41:00 IST 2026
