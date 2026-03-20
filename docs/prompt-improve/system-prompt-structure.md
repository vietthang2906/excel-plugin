================================================================================
SYSTEM PROMPT STRUCTURE — ORGANIZATION MAP (LOCAL OFFICE.JS ADD-IN)
================================================================================

The system prompt is delivered to the local LLM as a single block before the
user's message. Here is the structural organization for our local add-in:


================================================================================
SECTION 1: TOOL DEFINITIONS (Function Schemas)
================================================================================

These come first as JSON schemas defining each tool's interface.
Each tool definition includes:
  - name
  - description
  - parameters (with types, required fields, enums, defaults)

Tools defined (Office.js tools available to the add-in):
  1.  get_cell_ranges       — Read cell values/formulas from specific ranges
  2.  get_range_as_csv      — Read a range and return as CSV text
  3.  search_data           — Search for values across the sheet
  4.  set_cell_range        — Write values/formulas to cells
  5.  modify_sheet_structure — Insert/delete rows, columns, sheets
  6.  copy_to               — Copy cell patterns to a destination range
  7.  get_all_objects        — List charts, pivot tables, etc.
  8.  modify_object          — Edit chart/pivot properties
  9.  resize_range           — Resize a named range or table
  10. clear_cell_range       — Clear cell contents and/or formatting
  11. extract_chart_xml      — Get chart configuration as XML
  12. execute_office_js      — Run arbitrary Office.js code for advanced ops
  13. ask_user_question      — Prompt the user for clarification
  14. get_sheets_metadata    — Get sheet names, dimensions, frozen panes


================================================================================
SECTION 2: IDENTITY
================================================================================

Short block establishing:
  - I am an AI assistant integrated into Microsoft Excel via an Office.js add-in
  - Running locally via Ollama (no internet access)
  - Current sheet metadata (if available)
  - Expert at spreadsheet analysis and manipulation


================================================================================
SECTION 3: USER INTERACTION WORKFLOW
================================================================================

4 sub-sections:
  3a. Upfront Clarification (when to ask vs proceed)
  3b. Planning (when to plan multi-phase tasks)
  3c. Mid-task Check-ins (checkpoints and unanticipated forks)
  3d. Final Review (verification pass, quality control)

Also includes: Limitations list (what I cannot do)


================================================================================
SECTION 4: TOOL USAGE GUIDELINES
================================================================================

  - When to use WRITE tools vs READ-only
  - Examples of requests requiring writes
  - Examples where I should NOT modify the sheet


================================================================================
SECTION 5: OVERWRITE PROTECTION
================================================================================

  - Default workflow: try without allow_overwrite first
  - When protection triggers: read cells, inform user, wait for confirmation
  - When to use allow_overwrite=true


================================================================================
SECTION 6: WRITING FORMULAS
================================================================================

  - Use formulas over static values
  - Leading equals sign required
  - Avoid #VALUE! and #NAME? errors
  - Use clear_cell_range for clearing


================================================================================
SECTION 7: SHOW YOUR WORK
================================================================================

  - Why traceable spreadsheets matter
  - Anti-pattern: compute internally, paste static values
  - Rule: calculations must be formulas in cells
  - Do/Don't examples


================================================================================
SECTION 8: COPY TO RANGE
================================================================================

  - Best practices for copyToRange parameter
  - Absolute vs relative references ($A$1, $A1, A$1, A1)
  - Examples: calculation columns, financial projections


================================================================================
SECTION 9: SHEET OPERATIONS
================================================================================

  - Use execute_office_js for create/delete/rename/duplicate
  - worksheet.copy() preserves formatting


================================================================================
SECTION 10: RANGE OPTIMIZATION
================================================================================

  - Prefer smaller targeted ranges
  - Break large operations into multiple calls
  - Only include cells with actual data


================================================================================
SECTION 11: CLEARING CELLS
================================================================================

  - clear_cell_range tool usage
  - Three clearTypes: contents, all, formats
  - Range support (finite and infinite)


================================================================================
SECTION 12: ROW/COLUMN VISIBILITY
================================================================================

  - ALWAYS use grouping, NOT hiding
  - +/- toggle for users
  - Check chart anchors before hiding/collapsing


================================================================================
SECTION 13: FORMATTING
================================================================================

  Sub-sections:
  13a. Maintaining formatting consistency (preserve existing, formatFromCell)
  13b. Finance color coding (blue=input, black=formula, green=link)
  13c. Number formatting (currency, zeros, percentages, multiples, negatives)
  13d. Assumptions placement (separate cells, cell references, no hardcodes)
  13e. Avoid hardcoded calculations (always formulas)


================================================================================
SECTION 14: KEEP FORMULAS SIMPLE AND AUDITABLE
================================================================================

  - Easy to read and verify
  - Break complex logic into helper cells


================================================================================
SECTION 15: VERIFICATION GOTCHAS
================================================================================

  - Row/column inserts don't expand formula ranges reliably
  - Inserts inherit formatting from adjacent cells


================================================================================
SECTION 16: CHARTS
================================================================================

  - Data organization requirements (standard layout, chart-specific)
  - Using pivot tables with charts
  - Pivot table update limitations (must delete + recreate for source changes)


================================================================================
SECTION 17: ADVANCED FEATURES VIA execute_office_js
================================================================================

  - When to use execute_office_js
  - Pivot table editing, chart customization
  - Conditional formatting, sorting/filtering
  - Data validation, print formatting


================================================================================
SECTION 18: CITATIONS
================================================================================

  - Markdown link format for cell references
  - [A1](citation:sheetId!A1) syntax
  - When to use citations


================================================================================
SECTION 19: SENSITIVITY TABLES
================================================================================

  - Odd number of rows/columns
  - Base case in center cell
  - Yellow highlight for base case


================================================================================
SECTION 20: BULK FORMULA WRITES
================================================================================

  - Suspend automatic calculation before large formula writes
  - Save/restore calculationMode
  - Prevents crash on interdependent formulas


================================================================================
THEN: THE USER MESSAGE ARRIVES
================================================================================

After all the above, the LLM receives the user's actual message, which includes:

  - The user's text/question/request
  - Active Worksheet name (which tab the user is looking at)
  - Sheet metadata:
      - Full data range address
      - Row count, column count
      - Column-to-header mapping
  - Excel subset data (if fetched by the Router phase)


================================================================================
END OF SYSTEM PROMPT ORGANIZATION MAP
================================================================================
