# Waypoint: Technical Overview

Waypoint is a high-stakes geography guessing game built on a microservice architecture. It uses Real-time News via NewsAPI, Large Language Models (AWS Bedrock/Claude), and a modern React frontend to create a dynamic, ever-changing gameplay experience.

---

## 🏗️ System Architecture

The project follows a **Microservices Architecture**. Each concern is isolated into its own service to ensure stability and independent scalability.

### 1. Data Flow Summary

1. **Frontend** requests stories from the **Story Service**.
2. **Story Service** pulls headlines from **NewsAPI** and uses **Bedrock AI** to find where those stories happened.
3. **Frontend** then requests clues for a specific story from the **Clue Service**.
4. **Clue Service** uses **Bedrock AI** to generate three progressively difficult clues based on the story content.
5. **Frontend** sends the player's guess to the **Score Service**, which calculates distance and points.

---

## 🛠️ Backend Services (FastAPI)

All services are built with **Python 3.11+** and **FastAPI**. They are "boring" by design: plain dictionaries, no heavy Pydantic models (for maximum readability), and high performance.

### 📊 Score Service (:8001)

* **Role**: The "Judge". Purely mathematical.
* **Logic**:
  * Uses the **Haversine Formula** to calculate the distance between two points on a sphere (Earth).
  * **Scoring Formula**: `Base (5000) * exp(-distance / 2000) * ClueMultiplier * TimeMultiplier`.
  * **Multipliers**: Using 2 clues gives a 30% penalty; 3 clues gives a 55% penalty. Faster guesses (under 15s) get a 10% bonus.

### 📰 Story Service (:8002)

* **Role**: The "Source". Manages the news cycle and geocoding.
* **AI Integration**: Sends headlines/descriptions to **Claude 3 Haiku** to extract [lat](file:///c:/Users/karke/OneDrive/Desktop/projects/Waypoint/services/score/main.py#42-72), `lng`, `city`, and `country`.
* **Caching Strategy**: Implements a **Daily Cache**. News is fetched and geocoded once per day. Subsequent requests on the same day serve the cached JSON to save on API costs and Bedrock latency.
* **Rate Limiting**: Hard-capped at 60 Bedrock calls per day to prevent runaway costs.

### 💡 Clue Service (:8003)

* **Role**: The "Designer". Transforms raw news into game content.
* **AI Integration**: Prompts **Claude 3 Haiku** to generate three clues:
  * **Clue 1**: Human drama only (No locations).
  * **Clue 2**: Regional/Geopolitical context.
  * **Clue 3**: Specific landmarks and city-specific details.
* **Validation**: It explicitly checks that Clue 1 doesn't "leak" the country name. If it does, the generation is rejected and retried.

---

## 🎨 Frontend (React + Vite)

The frontend is a **Typed React** application focused on a "Brutalist Editorial" aesthetic.

### 🧠 The Logic Engine ([useGame.js](file:///c:/Users/karke/OneDrive/Desktop/projects/Waypoint/frontend/src/hooks/useGame.js))

Instead of scattering logic across 20 components, the entire game state is managed in a single **Custom Hook**. This hook handles:

* **Round Management**: Sequencing through 5 stories.
* **Bot Simulation**: 4 AI opponents with varying accuracy levels (Riley, Sasha, Alex, Drew). They "guess" simultaneously when the player submits.
* **Keyboard Shortcuts**: `R` for clues, `Enter` to submit, `Esc` for the next round.
* **Screen Transitions**: Transitions through Splash → Loading → Game → Result → Final.

### 🗺️ Map Implementation ([MapView.jsx](file:///c:/Users/karke/OneDrive/Desktop/projects/Waypoint/frontend/src/components/MapView.jsx))

* **Library**: **Leaflet**.
* **Design**: Grayscale tiles (`OSM`) with a high-contrast CSS filter applied to the tile pane.
* **Interactions**: Custom markers use `L.divIcon` to allow for CSS animations.
* **Persistence**: The map component stays mounted even during the "Result" overlay so it doesn't have to re-render or lose its state.

### 💅 Design System ([global.css](file:///c:/Users/karke/OneDrive/Desktop/projects/Waypoint/frontend/src/styles/global.css))

* **Typography**: Bebas Neue (Display), JetBrains Mono (UI), Lora (Reading).
* **Visual Polish**: Zero border-radius. Hard shadows. High-contrast colors (`--accent: #e05c2a`).
* **Animations**: Custom `markerPop` for locations and `fadeUp` for text elements.

---

## 🤖 AI Prompt Engineering

The "magic" of Waypoint lies in the prompts:

1. **Geocoding Prompt**: Forced to return raw JSON. Instructed to ignore news organization home bases (like "London" for the BBC) and find the event location.
2. **Clue Prompt**: Enforces a strict hierarchy of "Intel". It uses specific constraints (e.g., "Describe human drama without geographic references") to ensure the game is challenging.

---

## 🚀 Environment & Deployment

* **Proxying**: Vite uses a local proxy ([vite.config.js](file:///c:/Users/karke/OneDrive/Desktop/projects/Waypoint/frontend/vite.config.js)) to route requests from `/api` to different ports (8001, 8002, 8003). This avoids CORS issues and allows the frontend to use clean URLs like `/api/stories`.
* **Security**: All AWS/NewsAPI keys are managed via [.env](file:///c:/Users/karke/OneDrive/Desktop/projects/Waypoint/.env) files and never committed to version control.
