# AI Excel Agent

A locally hosted AI assistant that runs inside a Microsoft Excel taskpane. It extracts structured spreadsheet data into context and uses Context-Augmented Generation (CAG) with Claude to answer questions about your data.

## Project Structure
- **/excel-agent-ui**: The frontend Office Add-in (HTML/JS) running inside Excel.
- **/excel-agent-be**: The NestJS backend API that interfaces between the Add-in and Claude.

---

## Prerequisites
1. **Node.js**: Ensure Node.js is installed.
2. **Claude API Key**: Get an API key from [Anthropic Console](https://console.anthropic.com/). Create `excel-agent-be/.env` with:
   ```
   ANTHROPIC_API_KEY=your-api-key-here
   ```
   (Copy from `excel-agent-be/.env.example` and fill in your key.)
3. **Office Dev Certificates**: The Office Taskpane requires a trusted HTTPS server. If you haven't installed the dev certificates on this machine yet, run this one-time command:
   ```bash
   npx office-addin-dev-certs install
   ```
   *Accept any system prompts to install the localhost certificates.*

---

## How to Run the Application

You must run *both* the Backend API and the Frontend UI simultaneously, each in a separate terminal.

### 1. Start the Backend API (NestJS)
The backend routes Excel data to your local Ollama instance. It uses the dev certificates to run on HTTPS so the Excel Taskpane can communicate with it securely.

Open a terminal and run:
```bash
cd excel-agent-be
npm install
npm run start
```
*The backend will boot up on `https://localhost:3000`.*

### 2. Start the Frontend UI (Office Add-in)
The frontend must be served locally using `http-server` pointed to the trusted developer certificates so Excel doesn't block the Add-in.

Open a *second* terminal and run:
```bash
cd excel-agent-ui
npx http-server -p 3001 --cors -c-1 -S -C "$env:USERPROFILE\.office-addin-dev-certs\localhost.crt" -K "$env:USERPROFILE\.office-addin-dev-certs\localhost.key"
```
*The frontend will boot up on `https://localhost:3001`.*

### 3. Load the Add-in into Excel
1. Open Microsoft Excel and create a blank workbook.
2. If this is your first time, you must trust the `excel-agent-ui` folder:
   - Go to **File -> Options -> Trust Center -> Trust Center Settings -> Trusted Add-in Catalogs**.
   - Paste the local network path to your `excel-agent-ui` folder (e.g. `\\YOUR-PC-NAME\excel-agent-ui`) into the "Catalog Url" box.
   - Click **Add catalog** and check the **Show in Menu** box. Restart Excel.
3. To open the Add-in:
   - Go to the **Insert** tab (or occasionally the far-right of the **Home** tab).
   - Click **My Add-ins** -> **SHARED FOLDER**.
   - Select **AI Excel Agent** and click **Insert**.
4. The Taskpane will open. Click the "Open AI Agent" button to start chatting!

> **Troubleshooting Tip:** If the chat fails or elements don't load, open Google Chrome and navigate to `https://localhost:3000` and `https://localhost:3001`. If Chrome shows a security warning, click "Advanced" -> "Proceed to localhost (unsafe)" to force your system to trust the developer certificates.
