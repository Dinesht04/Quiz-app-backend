# Quiz-Verse Backend

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![WebSockets](https://img.shields.io/badge/WebSockets-1A1B1D?style=for-the-badge&logo=websocket&logoColor=white)
![Dotenv](https://img.shields.io/badge/Dotenv-E0E0E0?style=for-the-badge&logo=dotenv&logoColor=black)
![Google Gemini API](https://img.shields.io/badge/Google_Gemini_API-4285F4?style=for-the-badge&logo=google&logoColor=white)


---

## Table of Contents

* [About The Project](#about-the-project)
    * [Built With](#built-with)
* [Getting Started](#getting-started)
    * [Prerequisites](#prerequisites)
    * [Installation](#installation)
* [Usage](#usage)
* [Roadmap](#roadmap)
* [Contributing](#contributing)
* [License](#license)
* [Contact](#contact)
* [Acknowledgments](#acknowledgments)

---

## About The Project

This repository contains the backend services for **Quiz-Verse**, a real-time, open-source quiz application. It powers the core logic for managing quiz rooms, handling real-time communication via WebSockets, generating dynamic quiz questions using the Google Gemini API, and managing user scores and quiz flow.

The backend is designed to be robust and scalable, supporting up to 100 players per room, and is intended as a versatile solution for:

* College projects
* College club events
* Any other use case requiring an interactive, real-time quiz platform.

This project is freely available for anyone to copy, modify, and utilize for their own interests.

**Explore the Frontend:** For the user interface and client-side application, please visit the [Quiz-Verse Frontend Repository](https://github.com/Dinesht04/Quiz-App-Frontend/).

### Built With

The Quiz-Verse backend is built with a modern and efficient technology stack:

* [Node.js](https://nodejs.org/)
* [TypeScript](https://www.typescriptlang.org/)
* [Express.js](https://expressjs.com/)
* [ws (WebSockets)](https://github.com/websockets/ws)
* [dotenv](https://www.npmjs.com/package/dotenv) (for environment variable management)
* [Google Gemini API](https://ai.google.dev/models/gemini) (for dynamic question generation)

---

## Getting Started

This section provides instructions on how to set up and run the Quiz-Verse backend locally.

### Prerequisites

Ensure you have the following software installed on your machine:

* `npm`
    ```bash
    npm install npm@latest -g
    ```
* `Node.js` (npm is included with Node.js)

### Installation

Follow these steps to get your development environment running:

1.  **Clone the backend repository:**
    ```bash
    git clone https://github.com/Dinesht04/Quiz-app-backend.git
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd Quiz-app-backend/
    ```

3.  **Install dependencies:**
    ```bash
    npm i
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the root of the backend project and populate it with your environment variables. The backend primarily uses the `PORT` variable.

    ```env
    PORT=8080 # Or any other desired port for the WebSocket server
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY # Your Google Gemini API Key
    ```
    *Note: The `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `DATABASE_URL` are primarily used by the frontend for authentication and database setup. The backend relies on the frontend's authentication mechanism for user validation.*

5.  **Run the application:**
    To start the backend server:
   
    ```bash
    npm run dev # or similar script if defined
    ```
    The server will typically listen on `http://localhost:8080/` (or the `PORT` you configured).

---

## Usage

The Quiz-Verse backend acts as a WebSocket server, handling real-time interactions between quiz players and managing the quiz state.

### Core Logic and Features:

* **WebSocket Communication:** Utilizes `express-ws` to create a WebSocket server, enabling persistent, bidirectional communication with connected frontend clients.
* **Room Management:**
    * `rooms` object: A central store for all active quiz rooms, each containing a `Set` of connected clients, host information, quiz questions, game type, scores, and answered question tracking.
    * **Join/Leave Operations:** Handles `join` and `leave` messages from clients to add/remove them from rooms and update client lists for all participants.
* **Authentication:** Validates incoming messages based on an `expires` timestamp in the payload, ensuring only authenticated requests are processed.
* **Dynamic Question Generation:**
    * The `CallGemini` function (located in `./gemini.ts`) is responsible for making API calls to the Google Gemini API.
    * When the host `start`s a quiz, the backend sends the chosen topic and difficulty to `CallGemini` to fetch 5 relevant questions.
* **Quiz Modes:**
    * **Lightning Mode:** (Fastest Finger First) When a player answers correctly, all players in the room are immediately moved to the next question. This mode tracks which questions each user has attempted.
    * **Quiz Mode:** (Normal Quiz) Players answer at their own pace. The game progresses based on individual answers.
    * Each mode consists of 5 questions.
* **Scoring and Progress Tracking:**
    * `scores` Map: Tracks the current score for each connected WebSocket client.
    * `answered` Map: Records how many questions each user has attempted, crucial for determining quiz completion and progression in different modes.
    * **Live Score Updates:** Sends `live-score` updates to all clients in a room as answers are submitted.
* **Live Chat:** Facilitates real-time text communication between users in the lobby waiting room by broadcasting `message` payloads to all clients in a room.
* **Quiz Flow Management:**
    * Handles `start` messages (only by the host) to initiate the quiz, fetch questions, and transition the room state to 'in-progress'.
    * Processes `answer` messages, checks correctness, updates scores, and triggers `move-to-next-question` in Lightning mode.
    * Manages the `finish` state, calculating and broadcasting final scores once all players have completed the quiz (or all questions are answered in a mode).
* **Client Disconnection Handling:** The `removeClientFromRooms` function (located in `./RemoveClientFromRoom.ts`) ensures that when a client disconnects, they are properly removed from all active rooms, and room states are updated accordingly.

### Project Structure (Key Files):

* `index.ts`: The main entry point for the WebSocket server, handling all incoming messages and managing room logic.
* `./types.ts`: Defines TypeScript interfaces for messages, quiz rooms, questions, and other data structures.
* `./gemini.ts`: Contains the `CallGemini` function responsible for interacting with the Google Gemini API to generate quiz questions.
* `./RemoveClientFromRoom.ts`: Contains utility functions for gracefully handling client disconnections and updating room states.

---

## Roadmap

Here are some planned features and improvements for the Quiz-Verse Backend:

* [ ] **Rejoin Room Logic:** Enhance the backend to allow players to seamlessly rejoin a room after a temporary disconnection or quiz completion.
* [ ] **Host Transfer Logic:** Implement server-side logic to allow the current host to transfer host privileges to another player.
* [ ] **Robust Error Handling:** Improve error handling and logging for WebSocket connections and API interactions.
* [ ] **Scalability Enhancements:** Explore strategies for horizontal scaling of the WebSocket server for larger player bases.
* [ ] **Question Generation Refinements:** Optimize Gemini API calls for more diverse and challenging questions based on difficulty levels.
* [ ] **Security Improvements:** Further harden authentication and authorization mechanisms.
* [ ] **Performance Optimizations:** Continuous efforts to optimize real-time data processing and state management.

---

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  **Fork the Project.**
2.  **Make/comment on an existing issue** or create a new one to discuss your proposed changes.
3.  **Create your Feature Branch:** `git checkout -b feature/AmazingFeature`
4.  **Commit your Changes:** `git commit -m 'Add some AmazingFeature'`
5.  **Push to the Branch:** `git push origin feature/AmazingFeature`
6.  **Open a Pull Request.**

Please make sure to update tests as appropriate.

---

## License

Distributed under the MIT License. See `LICENSE` for more information. This project is open-source and freely available for use, modification, and distribution.

---

## Contact

Feel free to reach out to the maintainers for any questions or collaborations:

* **Maintainers:**
    * [RajPranshu12](https://x.com/RajPranshu12)
    * [Dinesht_04](https://x.com/Dinesht_04)

Project Link: [https://github.com/Dinesht04/Quiz-app-backend/](https://github.com/Dinesht04/Quiz-app-backend/)

---

## Acknowledgments

* Inspired By Matiks.
* [ChooseAnOpenSourceLicense.com](https://choosealicense.com/)
* [Img Shields](https://shields.io/)