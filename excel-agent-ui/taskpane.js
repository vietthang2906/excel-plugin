/*
 * Office.js Add-in Initialization
 */
Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        document.getElementById("app-body").style.display = "flex";
        
        // Attach event listeners
        document.getElementById("send-button").onclick = handleSend;
        document.getElementById("clear-chat-button").onclick = clearChat;
        
        // Enter key to send
        document.getElementById("user-input").addEventListener("keypress", function(event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
            }
        });
    }
});

const API_BASE_URL = 'https://localhost:3000'; // NestJS backend port

// Chat history for conversation context: { role: 'user'|'assistant', content: string }
let chatHistory = [];

async function handleSend() {
    const inputElement = document.getElementById("user-input");
    const message = inputElement.value.trim();
    
    if (!message) return;

    // 1. Display user message and add to history
    appendMessage(message, 'user');
    chatHistory.push({ role: 'user', content: message });
    inputElement.value = '';
    
    // 2. Disable input while processing
    setLoadingState(true);

    try {
        // 3. Extract Context from Excel (CAG)
        const excelContext = await extractExcelContext();
        
        // 4. Send to Backend (include chat history for full context)
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: message,
                context: excelContext,
                history: chatHistory.slice(0, -1) // Exclude current message (already in prompt)
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        // 5. Display agent response and add to history
        appendMessage(data.reply, 'agent');
        chatHistory.push({ role: 'assistant', content: data.reply });
        
        // (Optional Future) 6. Execute actions if returned by LLM
        if (data.action) {
            // e.g. executeOfficeJsAction(data.action);
        }
        
    } catch (error) {
        console.error("Error communicating with backend:", error);
        appendMessage("Sorry, I encountered an error connecting to the local agent.", 'system');
        chatHistory.pop(); // Remove the user message since we didn't get a valid response
    } finally {
        setLoadingState(false);
    }
}

function clearChat() {
    chatHistory = [];
    const messagesArea = document.getElementById("chat-messages");
    messagesArea.innerHTML = '<div class="message system">Chat cleared. Ask me anything about your spreadsheet.</div>';
}

/**
 * Extracts data from all worksheets in the workbook to build the CAG context.
 * Returns a JSON object with sheet names as keys and arrays of row data as values.
 */
async function extractExcelContext() {
    return Excel.run(async (context) => {
        const worksheets = context.workbook.worksheets;
        worksheets.load("items/name");
        await context.sync();

        if (!worksheets.items || worksheets.items.length === 0) {
            return JSON.stringify({});
        }

        const workbookData = {};

        for (const sheet of worksheets.items) {
            const usedRange = sheet.getUsedRange();
            usedRange.load("values");
            await context.sync();

            if (!usedRange.values || usedRange.values.length === 0) {
                workbookData[sheet.name] = [];
                continue;
            }

            const headers = usedRange.values[0];
            const rowData = usedRange.values.slice(1);

            const jsonData = rowData.map(row => {
                const rowObject = {};
                row.forEach((cellValue, index) => {
                    const header = headers[index] || `Column${index + 1}`;
                    rowObject[header] = cellValue === null || cellValue === undefined ? "" : cellValue;
                });
                return rowObject;
            });

            workbookData[sheet.name] = jsonData;
        }

        return JSON.stringify(workbookData);
    }).catch(error => {
        console.error("Error extracting Excel data:", error);
        return "Failed to extract context from Excel.";
    });
}

// UI Helpers
function appendMessage(text, type) {
    const messagesArea = document.getElementById("chat-messages");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    // Simple text handling. In a real app, handle markdown parsing here.
    messageDiv.innerText = text;
    messagesArea.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function setLoadingState(isLoading) {
    const button = document.getElementById("send-button");
    const input = document.getElementById("user-input");
    
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<div class="loading"></div>';
        input.disabled = true;
    } else {
        button.disabled = false;
        button.innerHTML = '<span class="ms-Button-label">Send</span>';
        input.disabled = false;
        input.focus();
    }
}
