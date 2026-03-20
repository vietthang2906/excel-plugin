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

        let routeData = await routeResponse.json();
        let structureContext = null;
        
        // --- MULTI-PASS ROUTING LOOP ---
        // Max 3 passes to prevent infinite loops (Spine -> Headers -> Data)
        for (let pass = 0; pass < 3; pass++) {
            if (routeData.action === 'scan_spine') {
                const spineResult = await scanSpineColumn(routeData.column);
                structureContext = (structureContext ? structureContext + "\n\n" : "") + 
                                   `Spine Scan (Col ${spineResult.column}):\n${spineResult.data}`;
                routeData = await callRouter(message, schema, structureContext);
            } else if (routeData.action === 'read_headers') {
                const headersResult = await readSpecificRows(routeData.rows);
                structureContext = (structureContext ? structureContext + "\n\n" : "") + `Specific Row Headers:\n${headersResult}`;
                routeData = await callRouter(message, schema, structureContext);
            } else {
                // Not a structural action, break loop to perform final fetch
                break;
            }
        }
        
        let finalContext = "";
        
        // Phase B: Fetch Final Data
        if (routeData.action === 'fetch_targeted' && routeData.ranges) {
            finalContext = await fetchMultipleRanges(routeData.ranges);
        } else if (routeData.action === 'fetch' && routeData.range) {
            // Router requested specific data
            finalContext = await fetchExcelRange(routeData.range);
        } else if (routeData.action === 'search' && routeData.column && routeData.value) {
            // Router requested searching by column value
            finalContext = await searchExcelData(routeData.column, routeData.value);
        } else if (routeData.action === 'fetch_all') {
            // Fallback: Router requested everything
            finalContext = await fetchExcelRange(schema.fullRangeAddress);
        } else if (routeData.action === 'answer' && routeData.reply) {
            // Router decided to answer directly (e.g. "Worksheet is empty")
            appendMessage(routeData.reply, 'agent');
            setLoadingState(false);
            return;
        }


        // Prepend structural context (spine scan, read headers) to the final data context
        // so the Answer LLM can see the layout boundaries and gaps.
        let fullContextForAnswer = `Active Worksheet: ${schema.sheetName}\n\n`;
        if (structureContext) {
            fullContextForAnswer += `================================================================================\nSTRUCTURAL CONTEXT (Discovered during Scan Phase)\n================================================================================\n${structureContext}\n================================================================================\n\n`;
        }
        fullContextForAnswer += `================================================================================\nEXCEL DATA CONTENT\n================================================================================\n${finalContext}`;

        // 5. Send to precision Answer Backend
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: message,
                context: fullContextForAnswer
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
        sheet.load("name");
        
        const usedRange = sheet.getUsedRange();
        usedRange.load(["address", "rowCount", "columnCount"]);
        await context.sync();

        if (usedRange.rowCount === 0) {
            return { isEmpty: true, sheetName: sheet.name };
        }

        // Just get the header row (assume row 1 of the used range)
        const headerRange = usedRange.getRow(0);
        headerRange.load("values");
        await context.sync();

        return {
            isEmpty: false,
            sheetName: sheet.name,
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
        
        const usedRange = sheet.getUsedRange();
        usedRange.load(["rowIndex"]);
        await context.sync();

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
        
        range.values.forEach((row, index) => {
            const rowNum = startRow + index;
            // Skip appending the header row again if the requested range started at the header row
            if (rowNum === headerRowIndex + 1) return;
            
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

/**
 * PHASE B (Alternative): Searches for specific records matching a column value
 */
async function searchExcelData(columnName, searchValue) {
    if (!columnName || !searchValue) return "";
    return Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
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
                const rowNum = startRow + i;
                const rowCSV = row.map(cell => {
                    if (typeof cell === 'string' && cell.includes(',')) {
                        return `"${cell}"`;
                    }
                    return cell === null || cell === undefined ? "" : cell;
                }).join(",");
                
                csvBuilder.push(`Row ${rowNum}: ${rowCSV}`);
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

/**
 * Helper to call the Router with optional structure context
 */
async function callRouter(prompt, schema, structureContext = null) {
    const response = await fetch(`${API_BASE_URL}/chat/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, schema, structureContext })
    });
    if (!response.ok) throw new Error(`Router error: ${response.status}`);
    return await response.json();
}

/**
 * Scans a specific column (or first non-empty) to find table boundaries.
 */
async function scanSpineColumn(columnHint = null) {
    return Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const usedRange = sheet.getUsedRange();
        usedRange.load(["address", "rowCount", "columnCount", "rowIndex", "columnIndex"]);
        await context.sync();

        let targetColIndex = usedRange.columnIndex;
        let columnValues = [];
        let colLetter = columnHint || "";

        if (columnHint) {
            // Excel column letter to 0-based index
            let index = 0;
            const letter = columnHint.toUpperCase();
            for (let i = 0; i < letter.length; i++) {
                index = index * 26 + (letter.charCodeAt(i) - 64);
            }
            targetColIndex = index - 1;
        }

        // Fetch the column
        const colRange = sheet.getRangeByIndexes(usedRange.rowIndex, targetColIndex, usedRange.rowCount, 1);
        colRange.load("values");
        await context.sync();
        
        columnValues = colRange.values.map(v => v[0]);
        if (!colLetter) colLetter = String.fromCharCode(65 + targetColIndex);

        // Token-efficient formatting: only show transitions and representative rows
        let result = [];
        let prevValType = null;
        const startRow = usedRange.rowIndex + 1;

        columnValues.forEach((val, idx) => {
            const rowNum = startRow + idx;
            const currentValType = (val === null || val === "" || val === undefined) ? "EMPTY" : "DATA";
            
            // Always show first row, last row, and any transition rows
            if (idx === 0 || idx === columnValues.length - 1 || currentValType !== prevValType) {
                const displayVal = (currentValType === "EMPTY") ? "<EMPTY>" : `"${String(val).substring(0, 20)}"`;
                result.push(`Row ${rowNum}: ${displayVal}`);
            } else if (idx > 0 && idx < columnValues.length - 1 && currentValType === prevValType && result[result.length-1] !== "...") {
                // If it's a long run of the same type, add a placeholder
                if (idx < columnValues.length - 2 && columnValues[idx+1] !== undefined) {
                     const nextValType = (columnValues[idx+1] === null || columnValues[idx+1] === "" || columnValues[idx+1] === undefined) ? "EMPTY" : "DATA";
                     if (nextValType === currentValType) {
                         result.push("...");
                     }
                }
            }
            prevValType = currentValType;
        });

        return { column: colLetter, data: result.join("\n") };
    });
}

/**
 * Reads specific rows (usually headers identified in spine scan)
 */
async function readSpecificRows(rowIndices) {
    if (!rowIndices || rowIndices.length === 0) return "";
    return Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const usedRange = sheet.getUsedRange();
        usedRange.load(["columnIndex", "columnCount"]);
        await context.sync();

        let results = [];
        for (const idx of rowIndices) {
            // idx is 0-based relative to worksheet
            const rowRange = sheet.getRangeByIndexes(idx, usedRange.columnIndex, 1, usedRange.columnCount);
            rowRange.load("values");
            await context.sync();
            results.push(`Row ${idx + 1}: ${rowRange.values[0].join(",")}`);
        }
        return results.join("\n");
    });
}

/**
 * Fetches multiple non-contiguous ranges and merges them.
 */
async function fetchMultipleRanges(ranges) {
    if (!ranges || ranges.length === 0) return "";
    let combinedContext = [];
    for (const range of ranges) {
        const data = await fetchExcelRange(range);
        combinedContext.push(`--- RANGE ${range} ---\n${data}`);
    }
    return combinedContext.join("\n\n");
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
