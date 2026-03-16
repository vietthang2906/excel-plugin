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
        // Phase A: The Cheap Router
        // 3. Extract Schema (Metadata only)
        const schema = await extractExcelSchema();
        
        // 4. Send Prompt + Schema to Router
        const routeResponse = await fetch(`${API_BASE_URL}/chat/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: message,
                schema: schema
            })
        });

        if (!routeResponse.ok) {
            throw new Error(`Router error: ${routeResponse.status}`);
        }

        const routeData = await routeResponse.json();
        
        let finalContext = "";
        
        // Phase B: Conditionally Fetch Data
        if (routeData.action === 'fetch' && routeData.range) {
            // Router requested specific data
            finalContext = await fetchExcelRange(routeData.range);
        } else if (routeData.action === 'fetch_all') {
            // Fallback: Router requested everything
            finalContext = await fetchExcelRange(schema.fullRangeAddress);
        }

        // 5. Send to precision Answer Backend
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: message,
                context: finalContext
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        // 6. Display agent response
        appendMessage(data.reply, 'agent');
        
    } catch (error) {
        console.error("Error communicating with backend:", error);
        appendMessage("Sorry, I encountered an error connecting to the local agent.", 'system');
    } finally {
        setLoadingState(false);
    }
}

/**
 * PHASE A: Extracts ONLY metadata schema from the current worksheet.
 */
async function extractExcelSchema() {
    return Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const usedRange = sheet.getUsedRange();
        usedRange.load(["address", "rowCount", "columnCount"]);
        await context.sync();

        if (usedRange.rowCount === 0) {
            return { isEmpty: true };
        }

        // Just get the header row (assume row 1 of the used range)
        const headerRange = usedRange.getRow(0);
        headerRange.load("values");
        await context.sync();

        return {
            isEmpty: false,
            fullRangeAddress: usedRange.address.split("!")[1], // Strip SheetName
            rowCount: usedRange.rowCount,
            columnCount: usedRange.columnCount,
            headers: headerRange.values[0]
        };
    }).catch(error => {
        console.error("Error extracting Schema:", error);
        return { error: true };
    });
}

/**
 * PHASE B: Fetches a specific range and formats it efficiently (Coordinate-Mapped CSV)
 */
async function fetchExcelRange(rangeAddress) {
    if (!rangeAddress) return "";
    return Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getRange(rangeAddress);
        range.load(["values", "rowIndex", "columnIndex"]); // Get indices to map coordinates
        await context.sync();

        if (!range.values || range.values.length === 0) {
            return "Requested range is empty.";
        }
        
        // Fetch header row to provide context in the CSV
        // Default to the first row of used range as header
        const usedRange = sheet.getUsedRange();
        const headerRange = usedRange.getRow(0);
        headerRange.load("values");
        await context.sync();
        const headers = headerRange.values[0];

        // Format into token-efficient Coordinate-Mapped CSV
        const startRow = range.rowIndex + 1; // 1-indexed for human readability
        
        let csvBuilder = [headers.join(",")]; // First line is always header
        
        range.values.forEach((row, index) => {
            const rowNum = startRow + index;
            // Skip appending the header row again if the requested range started at row 1
            if (rowNum === 1) return;
            
            const rowCSV = row.map(cellValue => {
                if (typeof cellValue === 'string' && cellValue.includes(',')) {
                    return `"${cellValue}"`;
                }
                return cellValue === null || cellValue === undefined ? "" : cellValue;
            }).join(",");
            
            csvBuilder.push(`Row ${rowNum}: ${rowCSV}`);
        });

        return csvBuilder.join("\n");
    }).catch(error => {
        console.error("Error fetching Specific Range:", error);
        return "Failed to extract specified data range from Excel.";
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
