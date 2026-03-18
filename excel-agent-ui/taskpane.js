/*
 * Office.js Add-in Initialization
 */
Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        document.getElementById("app-body").style.display = "flex";

        // Attach event listeners
        document.getElementById("send-button").onclick = handleSend;

        // Enter key to send
        document.getElementById("user-input").addEventListener("keypress", function (event) {
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

        // Direct answer (e.g. empty sheet) — skip chat API
        if (routeData.action === 'answer' && routeData.reply) {
            appendMessage(routeData.reply, 'agent');
            setLoadingState(false);
            return;
        }

        let finalContext = "";
        let sheetsUsed = routeData.sheets;

        // Frontend fallback: when fetch_all without sheets, prompt mentions "detail", and we have multiple sheets — infer sheets
        if (routeData.action === 'fetch_all' && !routeData.sheets?.length && schema.sheets?.length > 1) {
            const inferred = inferSheetsFromPrompt(message, schema.sheets);
            if (inferred.length > 0) sheetsUsed = inferred;
        }

        // Phase B: Conditionally Fetch Data
        if (routeData.action === 'fetch' && routeData.range) {
            finalContext = await fetchExcelRange(routeData.range, routeData.sheet);
        } else if (routeData.action === 'search' && routeData.column && routeData.value) {
            finalContext = await searchExcelData(routeData.column, routeData.value, routeData.sheet);
        } else if (routeData.action === 'fetch_all' && sheetsUsed?.length) {
            finalContext = await fetchAllSheets(sheetsUsed);
        } else if (routeData.action === 'fetch_all') {
            finalContext = await fetchExcelRange(schema.fullRangeAddress, schema.sheetName);
        }

        // Prepend worksheet context for the Answer Agent
        const sheetLabel = Array.isArray(sheetsUsed) && sheetsUsed.length > 1
            ? `Worksheets: ${sheetsUsed.join(", ")}`
            : `Worksheet: ${routeData.sheet || schema.sheetName}`;
        finalContext = `${sheetLabel}\n\n${finalContext}`;

        // 5. Send to Answer Backend (with schema for classifier)
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: message,
                context: finalContext,
                schema: schema.isEmpty ? undefined : { rowCount: schema.rowCount }
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // 6. Display agent response (with model indicator)
        appendMessage(data.reply, 'agent');
        if (data.model_used) {
            appendMessage(`Answered by ${data.model_used}`, 'system');
        }

    } catch (error) {
        console.error("Error communicating with backend:", error);
        appendMessage("Sorry, I encountered an error connecting to the local agent.", 'system');
    } finally {
        setLoadingState(false);
    }
}

/**
 * PHASE A: Extracts metadata schema from ALL worksheets.
 */
async function extractExcelSchema() {
    return Excel.run(async (context) => {
        const allSheets = context.workbook.worksheets;
        allSheets.load("items/name");
        const activeSheet = context.workbook.worksheets.getActiveWorksheet();
        activeSheet.load("name");
        await context.sync();

        const sheets = [];
        let totalRows = 0;

        for (let i = 0; i < allSheets.items.length; i++) {
            const ws = allSheets.items[i];
            const usedRange = ws.getUsedRange();
            usedRange.load(["address", "rowCount", "columnCount"]);
            await context.sync();

            const rowCount = usedRange.rowCount || 0;
            totalRows += rowCount;

            if (rowCount === 0) {
                sheets.push({
                    name: ws.name,
                    fullRangeAddress: "",
                    rowCount: 0,
                    columnCount: 0,
                    headers: []
                });
                continue;
            }

            const headerRange = usedRange.getRow(0);
            headerRange.load("values");
            await context.sync();

            const addr = usedRange.address;
            const rangePart = addr.includes("!") ? addr.split("!")[1] : addr;

            sheets.push({
                name: ws.name,
                fullRangeAddress: rangePart,
                rowCount,
                columnCount: usedRange.columnCount,
                headers: headerRange.values[0] || []
            });
        }

        if (totalRows === 0) {
            return { isEmpty: true, sheetName: activeSheet.name, sheets };
        }

        const activeInfo = sheets.find(s => s.name === activeSheet.name) || sheets[0];

        return {
            isEmpty: false,
            sheetName: activeSheet.name,
            fullRangeAddress: activeInfo.fullRangeAddress,
            rowCount: activeInfo.rowCount,
            columnCount: activeInfo.columnCount,
            headers: activeInfo.headers,
            sheets
        };
    }).catch(error => {
        console.error("Error extracting Schema:", error);
        return { error: true };
    });
}

/**
 * Infer sheet names from prompt (e.g. "các sheet detail" → sheets containing "detail").
 */
function inferSheetsFromPrompt(prompt, schemaSheets) {
    if (!schemaSheets?.length) return [];
    const lower = prompt.toLowerCase();
    if (!lower.includes('detail') && !lower.includes('sheet') && !lower.includes('chi tiết')) return [];
    const keywords = ['detail', 'tiết'];
    const matched = schemaSheets.filter(s => {
        const name = (s.name || '').toLowerCase();
        return keywords.some(k => name.includes(k));
    });
    return matched.map(s => s.name);
}

/**
 * PHASE B: Fetches from multiple worksheets and concatenates with sheet labels.
 */
async function fetchAllSheets(sheetNames) {
    if (!sheetNames?.length) return "";
    const parts = [];
    for (const name of sheetNames) {
        try {
            const data = await fetchExcelRange(null, name);
            if (data) parts.push(`=== Sheet: ${name} ===\n${data}`);
        } catch (e) {
            parts.push(`=== Sheet: ${name} ===\nFailed to fetch.`);
        }
    }
    return parts.join('\n\n') || "No data fetched.";
}

/**
 * PHASE B: Fetches a specific range and formats it efficiently (Coordinate-Mapped CSV)
 * @param {string} rangeAddress - e.g. "A1:E10". If null/empty and sheetName provided, fetches full used range.
 * @param {string} [sheetName] - Worksheet name. If omitted, uses active worksheet.
 */
async function fetchExcelRange(rangeAddress, sheetName) {
    return Excel.run(async (context) => {
        const sheet = sheetName
            ? context.workbook.worksheets.getItem(sheetName)
            : context.workbook.worksheets.getActiveWorksheet();
        const usedRange = sheet.getUsedRange();
        usedRange.load(["address", "rowIndex", "values", "rowCount", "columnCount", "columnIndex"]);
        await context.sync();

        const range = (rangeAddress && String(rangeAddress).trim()) ? sheet.getRange(rangeAddress) : usedRange;
        if (range !== usedRange) {
            range.load(["values", "rowIndex", "columnIndex"]);
            await context.sync();
        }

        if (!range.values || range.values.length === 0) {
            return "Requested range is empty.";
        }

        // Fetch only the header cells that correspond to the fetched data columns
        const headerRowIndex = usedRange.rowIndex; // Assuming first row of used range is header
        const colIndex = range.columnIndex;
        const colCount = range.values[0].length;

        const headerRange = sheet.getRangeByIndexes(headerRowIndex, colIndex, 1, colCount);
        headerRange.load("values");
        await context.sync();
        const headers = headerRange.values[0];

        // Format into token-efficient Coordinate-Mapped CSV
        const startRow = range.rowIndex + 1; // 1-indexed for human readability

        let csvBuilder = [headers.join(",")]; // First line is always header

        const MAX_ROWS = 200;
        let rowsAdded = 0;

        for (let index = 0; index < range.values.length; index++) {
            const row = range.values[index];
            const rowNum = startRow + index;
            // Skip appending the header row again if the requested range started at the header row
            if (rowNum === headerRowIndex + 1) continue;

            if (rowsAdded >= MAX_ROWS) {
                csvBuilder.push(`... (${range.values.length - index} more rows truncated)`);
                break;
            }
            rowsAdded++;

            let tempRow = [...row];
            while (tempRow.length > 0 && (tempRow[tempRow.length - 1] === null || tempRow[tempRow.length - 1] === '' || tempRow[tempRow.length - 1] === undefined)) {
                tempRow.pop();
            }

            const rowCSV = tempRow.map(cellValue => {
                if (typeof cellValue === 'string' && cellValue.includes(',')) {
                    return `"${cellValue}"`;
                }
                return cellValue === null || cellValue === undefined ? "" : cellValue;
            }).join(",");

            csvBuilder.push(rowCSV);
        }

        return csvBuilder.join("\n");
    }).catch(error => {
        console.error("Error fetching Specific Range:", error);
        return "Failed to extract specified data range from Excel.";
    });
}

/**
 * PHASE B (Alternative): Searches for specific records matching a column value
 * @param {string} [sheetName] - Worksheet name. If omitted, uses active worksheet.
 */
async function searchExcelData(columnName, searchValue, sheetName) {
    if (!columnName || !searchValue) return "";
    return Excel.run(async (context) => {
        const sheet = sheetName
            ? context.workbook.worksheets.getItem(sheetName)
            : context.workbook.worksheets.getActiveWorksheet();
        const usedRange = sheet.getUsedRange();
        usedRange.load(["values", "rowIndex"]);
        await context.sync();

        if (!usedRange.values || usedRange.values.length === 0) {
            return "Worksheet is empty.";
        }

        const headers = usedRange.values[0];
        const targetColIndex = headers.findIndex(h => {
            // Case-insensitive match, trimming spaces
            return String(h).trim().toLowerCase() === String(columnName).trim().toLowerCase();
        });

        if (targetColIndex === -1) {
            return `Column "${columnName}" not found in sheet.`;
        }

        const startRow = usedRange.rowIndex + 1;
        let csvBuilder = [headers.join(",")];

        // Convert searchValue to string for loose comparison
        const searchStr = String(searchValue).trim().toLowerCase();

        // Skip header row (index 0)
        for (let i = 1; i < usedRange.values.length; i++) {
            const row = usedRange.values[i];
            const cellVal = String(row[targetColIndex] || "").trim().toLowerCase();

            if (cellVal === searchStr || cellVal.includes(searchStr)) {
                let tempRow = [...row];
                while (tempRow.length > 0 && (tempRow[tempRow.length - 1] === null || tempRow[tempRow.length - 1] === '' || tempRow[tempRow.length - 1] === undefined)) {
                    tempRow.pop();
                }

                const rowCSV = tempRow.map(cell => {
                    if (typeof cell === 'string' && cell.includes(',')) {
                        return `"${cell}"`;
                    }
                    return cell === null || cell === undefined ? "" : cell;
                }).join(",");

                csvBuilder.push(rowCSV);
            }
        }

        if (csvBuilder.length === 1) {
            return `No records found in column "${columnName}" matching "${searchValue}".`;
        }

        return csvBuilder.join("\n");
    }).catch(error => {
        console.error("Error searching Excel Data:", error);
        return "Failed to search specified data in Excel.";
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
