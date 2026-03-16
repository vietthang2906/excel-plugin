/*
 * Office.js Add-in Initialization
 */
Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        document.getElementById("app-body").style.display = "flex";
        
        // Attach event listeners
        document.getElementById("send-button").onclick = handleSend;
        
        // Enter key to send
        document.getElementById("user-input").addEventListener("keypress", function(event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
            }
        });
    }
});

const API_BASE_URL = 'https://localhost:3000'; // Default NestJS port

async function handleSend() {
    const inputElement = document.getElementById("user-input");
    const message = inputElement.value.trim();
    
    if (!message) return;

    // 1. Display user message
    appendMessage(message, 'user');
    inputElement.value = '';
    
    // 2. Disable input while processing
    setLoadingState(true);

    try {
        // 3. Extract Context from Excel (CAG)
        const excelContext = await extractExcelContext();
        
        // 4. Send to Backend
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: message,
                context: excelContext
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        // 5. Display agent response
        appendMessage(data.reply, 'agent');
        
        // (Optional Future) 6. Execute actions if returned by LLM
        if (data.action) {
            // e.g. executeOfficeJsAction(data.action);
        }
        
    } catch (error) {
        console.error("Error communicating with backend:", error);
        appendMessage("Sorry, I encountered an error connecting to the local agent.", 'system');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Extracts data from the currently active worksheet to build the CAG context.
 * For now, this extracts the used range as a CSV string.
 */
async function extractExcelContext() {
    return Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        // Get the range that actually contains data
        const usedRange = sheet.getUsedRange();
        
        // Load the values of the used range
        usedRange.load("values");
        await context.sync();

        if (!usedRange.values || usedRange.values.length === 0) {
            return "The current worksheet is empty.";
        }

        // Convert 2D array of values to JSON format for the LLM
        // Assume the first row contains headers
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

        return JSON.stringify(jsonData);
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
