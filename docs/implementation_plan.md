# Goal Description

The current implementation passes Excel worksheet data as a simple CSV-like text string to the Llama 3 model. However, this text format can cause hallucinations as the LLM struggles to parse the unstructured string accurately. The goal is to format the data extracted from Excel into a structured JSON array of objects (using the first row as headers and subsequent rows as data records) and update the backend prompt to properly instruct the model to read the JSON context.

## Proposed Changes

### UI Modifications
#### [MODIFY] taskpane.js(file:///c:/Users/thang/Projects/excel-plugin/excel-agent-ui/taskpane.js)
- Update the `extractExcelContext` function. Instead of converting `usedRange.values` to a CSV string, we will convert it to a JSON string.
- The logic will treat the first row of `usedRange.values` as headers.
- Subsequent rows will be mapped to objects using the headers as keys.
- Return `JSON.stringify(jsonData)` instead of the CSV string.

### Backend Modifications
#### [MODIFY] chat.service.ts(file:///c:/Users/thang/Projects/excel-plugin/excel-agent-be/src/chat.service.ts)
- Update the system prompt inside `generateResponse` to explicitly state that the provided data is in JSON format.
- Update the fallback text to `[]` instead of `"No data provided or sheet is empty."` so it is still valid JSON when empty, or we can handle it cleanly.
- Keep the recently added logging structure but we may need to slightly adjust how we print the "first 10 lines" to handle JSON if it's stringified as a single line. We can use `JSON.stringify(parsedContext, null, 2)` for pretty logging if we parse it first, or just log the first 200 characters.

## Verification Plan

### Automated Tests
- This project doesn't appear to have an existing test suite for the UI or backend.

### Manual Verification
1. Reload both the frontend (`excel-agent-ui`) and backend (`excel-agent-be`).
2. Open Microsoft Excel and insert some structured data (e.g., Row 1: `Name, Age, City`, Row 2: `John, 30, New York`, Row 3: `Jane, 25, Boston`).
3. Open the add-in taskpane.
4. Ask a specific question about the data, such as "What is John's age?" or "Who lives in Boston?".
5. Verify in the backend terminal logs that the context data was sent as structured JSON.
6. Verify that the Llama 3 model responds accurately without hallucination.
