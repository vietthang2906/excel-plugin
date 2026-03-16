# Excel AI Agent - Project Context

This file serves as the persistent context for the Excel AI Agent project. If you are resuming work on this project, read this file to understand the architecture, stack, and goals.

## Core Objective
Build an Excel Add-in (Plugin) that features a chat window allowing users to communicate with a local AI Agent (Llama 3). The AI should be able to answer questions based on the data within the open Excel spreadsheet and (eventually) manipulate that data.

## Technology Stack
- **Frontend / Excel Add-in (`excel-agent-ui`):** HTML, JavaScript, CSS, and Office.js.
- **Backend Service (`excel-agent-be`):** NestJS (Node.js framework).
- **LLM Engine:** Local Llama 3 running via Ollama on port `11434`.

## Architecture & Data Approach: CAG (Context-Augmented Generation)
We are using **CAG** instead of RAG because Excel data is highly structured. 
1. **Schema Extraction:** The HTML/JS UI uses Office.js to read the sheet schema (sheet names, column headers, sample rows) or the specific active range.
2. **Context Injection:** The UI sends this structured data (e.g., as a CSV string) along with the user's prompt to the NestJS backend.
3. **LLM Processing:** The NestJS backend routes this combined prompt to the local Ollama instance. Due to Llama 3's context window, feeding the CSV directly allows the LLM to perform accurate mathematical reasoning and structural analysis over the rows/columns.
4. **Response Handling:** The LLM returns a response (text explanation or JSON command) to the backend, which forwards it to the UI. The UI either displays the text or uses Office.js to execute spreadsheet modifications.

## Current Project Structure
- `/excel-agent-ui`: Contains the HTML/JS frontend add-in code.
- `/excel-agent-be`: Contains the NestJS backend logic.
- `context.md`: This file.

## Next Steps
- Initialize the NestJS backend in `excel-agent-be` and set up the connection to `http://localhost:11434`.
- Initialize the Excel Add-in scaffolding inside `excel-agent-ui` with a basic chat interface.
- Implement the Office.js functions to read the active worksheet data.
