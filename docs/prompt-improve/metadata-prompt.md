================================================================================
SHEET METADATA — COMPLETE DOCUMENTATION
================================================================================


================================================================================
1. HOW IT ARRIVES
================================================================================

Sheet metadata is delivered in TWO places in my input:

  PLACE A: <identity> block — brief mention
    "No sheet metadata available" (if empty workbook)
    OR a brief summary if available

  PLACE B: <initial_state> block — full structured JSON
    Delivered ONLY on the FIRST message of the conversation.
    Wrapped in the user's message, not the system prompt itself.
    Format: JSON object

  PLACE C: <user_context> block — delivered with EVERY message
    Contains: current active sheet + selected range(s)


================================================================================
2. EXACT FORMAT OF <initial_state> (what I received for YOUR workbook)
================================================================================

{
  "success": true,
  "fileName": "HanNoiTax-BangLuong_2021.An Son.BCTC dã sua.xlsm.1.xlsm.xlsx",
  "sheetsMetadata": [
    {
      "id": 1,                    ← unique sheet ID (used for citations)
      "name": "Menu",             ← exact tab name (must match for tool calls)
      "maxRows": 0,               ← number of rows with data (0 = empty)
      "maxColumns": 0,            ← number of columns with data (0 = empty)
      "frozenRows": 0,            ← number of frozen/locked rows
      "frozenColumns": 0          ← number of frozen/locked columns
    },
    {
      "id": 2,
      "name": "dmThongTin",
      "maxRows": 8,
      "maxColumns": 2,
      "frozenRows": 0,
      "frozenColumns": 0
    },
    ... (one entry per sheet)
  ],
  "totalSheets": 12               ← total number of sheets in workbook
}


================================================================================
3. FIELD-BY-FIELD BREAKDOWN
================================================================================

FIELD: success (boolean)
  - Whether metadata was successfully retrieved
  - If false, something went wrong reading the workbook

FIELD: fileName (string)
  - Full filename of the workbook
  - Tells me what kind of file this is (naming clues about content)
  - Your file: "HanNoiTax-BangLuong_2021.An Son.BCTC dã sua.xlsm.1.xlsm.xlsx"
    → I can infer: Vietnamese tax/payroll file, 2021, company "An Son",
       BCTC = Báo Cáo Tài Chính (Financial Statements), modified (.xlsm = macros)

FIELD: sheetsMetadata (array of objects)
  Each sheet has:

  FIELD: id (number)
    - Unique identifier for the sheet
    - Used in citation syntax: [A1](citation:1!A1) where 1 is the sheet id
    - Does NOT change even if sheets are reordered
    - Sequential starting from 1

  FIELD: name (string)
    - Exact tab name as shown in Excel
    - MUST be used exactly as-is in all tool calls (case-sensitive, space-sensitive)
    - Example: I must use "05-1BK-QTT-TNCN" not "05-1bk-qtt-tncn"

  FIELD: maxRows (number)
    - Number of rows that contain data (the "used range" height)
    - 0 means the sheet is completely empty
    - Tells me how much data to expect before reading
    - Used to decide if I need chunked reading (>500 rows)

  FIELD: maxColumns (number)
    - Number of columns that contain data (the "used range" width)
    - 0 means the sheet is completely empty
    - Combined with maxRows tells me the data footprint

  FIELD: frozenRows (number)
    - Number of rows frozen at the top (header lock)
    - If > 0, tells me there's likely a header row structure
    - frozenRows: 1 = single header row (very common)
    - frozenRows: 7 = multi-row header block (complex structure)

  FIELD: frozenColumns (number)
    - Number of columns frozen on the left
    - If > 0, tells me there are label/identifier columns
    - frozenColumns: 3 = first 3 columns are identifiers (names, IDs, etc.)

FIELD: totalSheets (number)
  - Total count of all sheets in the workbook
  - Quick reference without counting the array


================================================================================
4. EXACT FORMAT OF <user_context> (received with EVERY message)
================================================================================

<user_context>
Current active sheet: "05-1BK-QTT-TNCN"
Selected ranges: '05-1BK-QTT-TNCN'!A1
</user_context>

FIELD: Current active sheet
  - Which tab the user is currently looking at
  - This is where they expect me to focus by default
  - Changes with every message as user navigates

FIELD: Selected ranges
  - Which cell(s) the user has highlighted/selected
  - Can be single cell: A1
  - Can be range: A1:D10
  - Can be multiple selections: A1:B5, D1:E5
  - Format: 'SheetName'!Range
  - Tells me exactly where the user's cursor/attention is


================================================================================
5. HOW I PROCESS & USE METADATA EFFECTIVELY
================================================================================

--- 5A. FIRST-GLANCE TRIAGE (immediate understanding) ---

When I first receive initial_state, I mentally build a picture:

  YOUR WORKBOOK MAP:
  ┌──────────────────────────────────────────────────────────────────┐
  │ Sheet              │ Size      │ Frozen  │ What I Infer          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Menu               │ empty     │ none    │ Navigation/landing     │
  │ dmThongTin         │ 8×2       │ none    │ Small lookup/config    │
  │ DanhSachLaoDong    │ 167×17    │ R1,C3   │ Employee list (main)   │
  │ BangLuong          │ 370×66    │ none    │ Payroll (LARGE, wide)  │
  │ thTheoNam          │ 50×25     │ R7,C3   │ Annual summary         │
  │ thTheoThang        │ 133×50    │ none    │ Monthly summary        │
  │ 05-1BK-QTT-TNCN   │ 32×66     │ none    │ Tax form (PIT)         │
  │ CheckList          │ 43×5      │ none    │ Checklist/validation   │
  │ HopDongLaoDong     │ 76×45     │ none    │ Labor contracts        │
  │ CamKetThuNhap      │ 22×14     │ none    │ Income commitments     │
  │ QuyetDinhThoiViec  │ 27×12     │ none    │ Resignation decisions  │
  │ QuyetDinhThuong    │ 114×6     │ none    │ Bonus decisions        │
  └──────────────────────────────────────────────────────────────────┘

--- 5B. SIZING DECISIONS (how to read data) ---

Based on maxRows × maxColumns, I decide reading strategy:

  Small (< 100 cells):
    → Read entire range in ONE get_cell_ranges call
    → Example: dmThongTin (8×2 = 16 cells) → read all at once

  Medium (100-1000 cells):
    → Read in one or two get_cell_ranges / get_range_as_csv calls
    → Example: QuyetDinhThoiViec (27×12 = 324 cells) → single read

  Large (1000-10,000 cells):
    → May need multiple reads or get_range_as_csv with pagination
    → Example: DanhSachLaoDong (167×17 = 2,839 cells) → might chunk

  Very Large (>10,000 cells):
    → MUST use chunked reading via code execution
    → Example: BangLuong (370×66 = 24,420 cells) → definitely chunk
    → Read in batches of ~500 rows via get_range_as_csv

--- 5C. STRUCTURAL INFERENCE (understanding without reading) ---

From metadata alone, before reading any cells, I can infer:

  FROZEN ROWS tell me about headers:
    frozenRows: 0 → no fixed header (or single-use form layout)
    frozenRows: 1 → standard data table with 1 header row
    frozenRows: 7 → complex multi-row header (thTheoNam has this)
                     likely: title, subtitle, date row, column groups, etc.

  FROZEN COLUMNS tell me about row identifiers:
    frozenColumns: 3 → first 3 columns are frozen
      DanhSachLaoDong: probably employee ID, name, department
      thTheoNam: probably category labels, subcategories, units

  SHEET DIMENSIONS tell me about data type:
    Wide + short (32×66): form/report layout (05-1BK-QTT-TNCN = tax form)
    Tall + narrow (114×6): list/register (QuyetDinhThuong = bonus list)
    Tall + wide (370×66): full database/payroll (BangLuong)
    Small (8×2): lookup/config table (dmThongTin)
    Empty (0×0): placeholder/navigation (Menu)

  FILENAME tells me context:
    "HanNoiTax" → Hanoi tax office related
    "BangLuong" → Payroll (Bảng Lương)
    "2021" → fiscal year 2021
    "An Son" → company name
    "BCTC" → Financial statements (Báo Cáo Tài Chính)
    ".xlsm" → originally had VBA macros
    "dã sua" → likely "đã sửa" (modified/corrected)

  SHEET NAMES tell me purpose (Vietnamese context):
    DanhSachLaoDong → Danh Sách Lao Động = Employee List
    BangLuong → Bảng Lương = Payroll Table
    thTheoNam → Tổng Hợp Theo Năm = Annual Summary
    thTheoThang → Tổng Hợp Theo Tháng = Monthly Summary
    05-1BK-QTT-TNCN → Tax form code (PIT settlement)
    HopDongLaoDong → Hợp Đồng Lao Động = Labor Contracts
    CamKetThuNhap → Cam Kết Thu Nhập = Income Commitment
    QuyetDinhThoiViec → Quyết Định Thôi Việc = Resignation Decision
    QuyetDinhThuong → Quyết Định Thưởng = Bonus Decision
    dmThongTin → Danh Mục Thông Tin = Information Directory
    CheckList → Validation checklist

--- 5D. ROUTING USER REQUESTS ---

When user asks something, I combine:
  1. user_context (which sheet they're on, what's selected)
  2. initial_state (full workbook map)
  3. their request text

  Example scenarios:

  User on "BangLuong" says "sum the salaries":
    → I know BangLuong is 370×66 (large payroll)
    → I need to read headers first to find salary column
    → Read A1:BN1 to find column headers, then sum the right column

  User on "QuyetDinhThoiViec" says "how many people left?":
    → I know it's 27×12 (small, manageable)
    → Read entire sheet in one call
    → Count rows (subtract header) = number of resignations

  User says "audit this workbook":
    → I see 12 sheets, ~28,000 total cells
    → Need chunked reading strategy
    → Start with smaller sheets, work up to BangLuong

--- 5E. CITATION ROUTING ---

Sheet IDs from metadata map to citation syntax:

  Sheet "Menu" (id: 1)           → [A1](citation:1!A1)
  Sheet "dmThongTin" (id: 2)     → [A1:B8](citation:2!A1:B8)
  Sheet "DanhSachLaoDong" (id: 3)→ [C5](citation:3!C5)
  Sheet "BangLuong" (id: 4)      → [D10:D370](citation:4!D10:D370)
  Sheet "05-1BK-QTT-TNCN" (id: 7)→ [A1](citation:7!A1)
  ...etc.

  This lets me create clickable references in my chat responses.


================================================================================
6. WHAT METADATA DOES NOT TELL ME
================================================================================

Metadata is a MAP, not the CONTENT. It does NOT include:

  ✗ Actual cell values (must read with tools)
  ✗ Formulas in cells (must read with get_cell_ranges)
  ✗ Formatting/styles (must read with includeStyles=true)
  ✗ Charts or pivot tables (must use get_all_objects)
  ✗ Named ranges (must use execute_office_js)
  ✗ Data validation rules (must use execute_office_js)
  ✗ Conditional formatting (must use execute_office_js)
  ✗ VBA macro code (CANNOT access at all)
  ✗ Print settings (must use execute_office_js)
  ✗ Cell comments/notes (must read with get_cell_ranges)
  ✗ Merged cells (must discover when reading)
  ✗ Hidden rows/columns (must check with execute_office_js)

  Metadata tells me WHERE to look and HOW BIG things are.
  I still need to READ to know WHAT's actually there.


================================================================================
7. METADATA STALENESS
================================================================================

IMPORTANT: initial_state is a SNAPSHOT from the first message only.

  - If sheets are added/deleted/renamed during conversation,
    my initial_state is STALE
  - user_context updates every message (active sheet + selection)
  - If I modify the workbook (insert rows, add sheets), I should
    re-read affected areas rather than trusting initial dimensions
  - maxRows/maxColumns may change as I add/remove data


================================================================================
8. HOW METADATA IS PRODUCED (what happens before I see it)
================================================================================

The Excel add-in (running in the browser via Office.js) does this:

  1. When conversation starts, the add-in reads workbook properties
  2. It calls something like:
       context.workbook.worksheets.load("items/name")
       For each sheet: sheet.getUsedRange().load("rowCount, columnCount")
       sheet.freezePanes.getLocation().load(...)
  3. It packages this into the JSON structure
  4. It attaches it to the first user message as <initial_state>
  5. For every subsequent message, it reads:
       - context.workbook.worksheets.getActiveWorksheet().name
       - context.workbook.getSelectedRange().address
  6. It attaches these as <user_context>

  I don't control this process — the add-in does it automatically.
  I just receive the results.


================================================================================
END OF SHEET METADATA DOCUMENTATION
================================================================================


