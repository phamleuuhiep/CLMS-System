# 🛡️ CLMS - Children's Location Monitoring System

A real-time, web-based GPS tracking and geofencing system designed to help parents monitor their children's safety. The system processes continuous location updates from IoT devices/smartphones and triggers instant alerts if the device breaches a predefined safe zone.

## ✨ Core Features

*   **Real-time GPS Tracking:** Receives and displays live location data with sub-second latency using MQTT and WebSockets.
*   **Dual Geofencing Modes:**
    *   **Point-based Mode:** Define a safe zone using a center point and a specific radius.
    *   **Zone-based Mode:** Draw a custom polygon safe zone directly on the map.
*   **Instant Alerts:** Triggers visual and auditory alerts on the Command Center dashboard when a boundary violation occurs.
*   **Actionable Logs:** Persistent storage of all security events and violations for parents to review.

## 🛠️ Tech Stack

*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB (Mongoose ORM)
*   **IoT Protocol:** MQTT (via `mqtt.js` and EMQX Public Broker)
*   **Real-time Communication:** Socket.io
*   **Frontend UI:** HTML/EJS, CSS, JavaScript
*   **Mapping Services:** Leaflet.js, Leaflet-Geoman (for drawing polygons), OpenStreetMap
*   **Alerts/Popups:** SweetAlert2

## 🚀 Installation & Setup

### Prerequisites
*   [Node.js](https://nodejs.org/) (v16.x or higher)
*   [MongoDB](https://www.mongodb.com/) (Local or MongoDB Atlas cluster)

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/phamleuuhiep/CLMS-System.git
cd CLMS-System
\`\`\`

### 2. Install dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Configuration
Ensure your MongoDB connection string (`DB_URI`) is correctly set up in the `server.js` or `database` configuration file.

### 4. Start the server
\`\`\`bash
npm start
\`\`\`
The application will run on `http://localhost:3000` (or your defined port).

## 📱 Device Setup (OwnTracks Integration)

To simulate a child's IoT device or use a real smartphone, install the **OwnTracks** app (available on iOS and Android) and configure it as follows:

1.  **Mode:** MQTT
2.  **Host:** `broker.emqx.io` (Do not include `ssl://` or `tcp://` prefixes)
3.  **Port:** `8883`
4.  **Identification:**
    *   **Username:** `clms` (Crucial for proper topic mapping)
    *   **Device ID:** `[your_child_username]` (Must perfectly match the child's username registered in the CLMS Dashboard).
5.  **Security:** Enable **Use TLS** (Required for port 8883).

## 📄 License
This project is created for educational purposes (Advanced Software Engineering course - HCMUT).