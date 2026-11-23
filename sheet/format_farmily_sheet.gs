/**
 * Farmily AI Onboarding Prototype - one-click sheet formatter
 *
 * Formats the five existing tabs IN PLACE (same spreadsheet, same tabs, same
 * column headers), so the n8n workflows keep working with no re-connecting.
 *
 * HOW TO RUN
 *   1. In your Google Sheet: Extensions > Apps Script
 *   2. Delete the placeholder code, paste this whole file, click Save
 *   3. Choose "formatFarmilySheets" in the function dropdown, click Run
 *   4. Approve the permission prompt (it is your own script)
 *
 * Make a copy of the sheet first (File > Make a copy) as a backup.
 */

const CLEAR_TEST_ROWS = false;   // true = also delete every data row under the headers (backup first!)
const LAST_ROW = 500;            // formatting and dropdowns are applied down to this row

const HEADER_BG = '#1F5C3A';
const PALETTE = {
  amber:  ['#FFF2CC', '#7F6000'],
  blue:   ['#DDEBF7', '#1F4E79'],
  green:  ['#E2F0D9', '#375623'],
  red:    ['#FFC7CE', '#9C0006'],
  orange: ['#FCE4D6', '#833C0B'],
  grey:   ['#EDEDED', '#595959']
};
const STATUS_COLOR = {
  PENDING: 'amber', IN_PROGRESS: 'blue', COMPLETED: 'green', OPEN: 'blue',
  ESCALATED: 'orange', RESOLVED: 'green', CLOSED: 'grey', SENT: 'green',
  FAILED: 'red', LOW: 'grey', MEDIUM: 'amber', HIGH: 'orange', CRITICAL: 'red'
};

// [header, width in pixels, kind, dropdown list]
// kinds: text | center | status | date | dt | int | bool
const SHEETS = {
  'Customers': { tab: '#2E7D32', cols: [
    ['customer_id', 180, 'text'], ['created_at', 120, 'dt'], ['business_name', 180, 'text'],
    ['contact_name', 155, 'text'], ['email', 210, 'text'],
    ['business_type', 105, 'center', ['Exporter', 'Farmer', 'Cooperative', 'Certifier']],
    ['country_location', 140, 'text'], ['customer_goals', 280, 'text'], ['onboarding_challenges', 280, 'text'],
    ['customer_category', 180, 'text'], ['needs_summary', 315, 'text'], ['onboarding_plan', 315, 'text'],
    ['clarification_questions', 315, 'text'],
    ['onboarding_status', 120, 'status', ['PENDING', 'IN_PROGRESS', 'COMPLETED']],
    ['welcome_email_status', 140, 'status', ['PENDING', 'SENT', 'FAILED']],
    ['last_followup_at', 120, 'dt']
  ]},
  'Onboarding Tasks': { tab: '#1565C0', cols: [
    ['task_id', 210, 'text'], ['customer_id', 180, 'text'], ['task_title', 250, 'text'], ['task_description', 350, 'text'],
    ['responsible_party', 140, 'center', ['CUSTOMER', 'ONBOARDING_TEAM', 'HUMAN_SPECIALIST']],
    ['due_date', 95, 'date'],
    ['status', 105, 'status', ['PENDING', 'IN_PROGRESS', 'COMPLETED']],
    ['created_at', 120, 'dt'], ['completed_at', 120, 'dt']
  ]},
  'Support_Requests': { tab: '#EF6C00', cols: [
    ['support_id', 170, 'text'], ['customer_id', 180, 'text'], ['submitted_at', 120, 'dt'], ['customer_question', 350, 'text'],
    ['category', 130, 'center', ['ONBOARDING', 'DOCUMENTATION', 'TECHNICAL', 'COMPLIANCE', 'PAYMENT', 'GENERAL', 'UNCATEGORISED']],
    ['priority', 90, 'status', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']],
    ['ai_draft_response', 385, 'text'], ['escalation_required', 135, 'bool'],
    ['status', 105, 'status', ['OPEN', 'ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']],
    ['human_response', 315, 'text']
  ]},
  'Follow_Up_Log': { tab: '#6D4C41', cols: [
    ['followup_id', 240, 'text'], ['customer_id', 180, 'text'], ['task_id', 210, 'text'], ['sent_at', 120, 'dt'],
    ['channel', 75, 'center'], ['message', 350, 'text'],
    ['status', 80, 'status', ['SENT', 'FAILED']]
  ]},
  'Management_Reports': { tab: '#6A1B9A', cols: [
    ['report_id', 145, 'text'], ['generated_at', 120, 'dt'], ['total_customers', 115, 'int'], ['pending_customers', 130, 'int'],
    ['completed_customers', 145, 'int'], ['outstanding_tasks', 130, 'int'], ['unresolved_support_requests', 185, 'int'],
    ['report_summary', 420, 'text']
  ]}
};

function formatFarmilySheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Safety check first: every tab and header must match what n8n writes to.
  Object.keys(SHEETS).forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh) throw new Error('Tab not found: "' + name + '". Nothing was changed.');
    const expected = SHEETS[name].cols.map(function (c) { return c[0]; });
    const actual = sh.getRange(1, 1, 1, expected.length).getValues()[0];
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new Error('Headers on "' + name + '" are not what the workflows expect. Nothing was changed.\n' +
        'Expected: ' + expected.join(', ') + '\nFound: ' + actual.join(', '));
    }
  });

  // 2. Format each tab.
  Object.keys(SHEETS).forEach(function (name) {
    const spec = SHEETS[name];
    const sh = ss.getSheetByName(name);
    const n = spec.cols.length;

    if (sh.getMaxRows() < LAST_ROW) sh.insertRowsAfter(sh.getMaxRows(), LAST_ROW - sh.getMaxRows());

    const oldFilter = sh.getFilter();
    if (oldFilter) oldFilter.remove();
    sh.clearConditionalFormatRules();

    if (CLEAR_TEST_ROWS) {
      sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clear();
    }

    sh.setTabColor(spec.tab);
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 30);

    // Header row
    sh.getRange(1, 1, 1, n)
      .setBackground(HEADER_BG).setFontColor('#FFFFFF').setFontWeight('bold')
      .setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

    // Body base style: one tidy line per row (click a cell to read long text)
    sh.getRange(2, 1, LAST_ROW - 1, n)
      .setFontFamily('Arial').setFontSize(10).setFontWeight('normal').setFontColor('#000000')
      .setVerticalAlignment('middle').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

    const rules = [];

    spec.cols.forEach(function (c, i) {
      const col = i + 1;
      const kind = c[2];
      const list = c[3];
      const body = sh.getRange(2, col, LAST_ROW - 1, 1);
      const centred = ['center', 'status', 'date', 'dt', 'int', 'bool'].indexOf(kind) !== -1;

      sh.setColumnWidth(col, c[1]);
      sh.getRange(1, col).setHorizontalAlignment(centred ? 'center' : 'left');
      body.setHorizontalAlignment(centred ? 'center' : 'left');

      if (kind === 'date') body.setNumberFormat('yyyy-mm-dd');
      if (kind === 'dt')   body.setNumberFormat('yyyy-mm-dd hh:mm');
      if (kind === 'int')  body.setNumberFormat('0');

      if (list) {
        // allowInvalid = true -> shows a warning instead of blocking
        body.setDataValidation(SpreadsheetApp.newDataValidation()
          .requireValueInList(list, true).setAllowInvalid(true).build());
      }

      if (kind === 'status') {
        list.forEach(function (val) {
          const colour = STATUS_COLOR[val];
          if (!colour) return;
          rules.push(SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo(val)
            .setBackground(PALETTE[colour][0]).setFontColor(PALETTE[colour][1]).setBold(true)
            .setRanges([body]).build());
        });
      }

      if (kind === 'bool') {
        const letter = columnLetter(col);
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenFormulaSatisfied('=' + letter + '2=TRUE')
          .setBackground(PALETTE.orange[0]).setFontColor(PALETTE.orange[1]).setBold(true)
          .setRanges([body]).build());
      }
    });

    // Light banding on populated rows only (lowest priority, added last)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($A2<>"",ISEVEN(ROW()))')
      .setBackground('#F4F8F5')
      .setRanges([sh.getRange(2, 1, LAST_ROW - 1, n)]).build());

    sh.setConditionalFormatRules(rules);
    sh.getRange(1, 1, LAST_ROW, n).createFilter();
  });

  // 3. This column is never filled by the workflows. Hide it, but keep it (n8n still lists it).
  const customers = ss.getSheetByName('Customers');
  customers.hideColumns(16);

  SpreadsheetApp.flush();
  ss.toast('Farmily sheets formatted.', 'Done', 5);
}

function columnLetter(col) {
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - m) / 26);
  }
  return s;
}
