import { TextDecoder } from 'node:util';

export class TsvSyntaxError extends Error {
  constructor(code, message, { line = 1, columnIndex = 1, suggestedAction } = {}) {
    super(message);
    this.name = 'TsvSyntaxError';
    this.code = code;
    this.line = line;
    this.columnIndex = columnIndex;
    this.suggestedAction = suggestedAction;
  }
}

export function decodeTsv(buffer) {
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new TsvSyntaxError('TSV-E002', 'UTF-8として読み込めないバイト列があります。', {
      suggestedAction: 'GoogleスプレッドシートからUTF-8のTSVとして再出力してください。'
    });
  }
  return source.startsWith('\uFEFF') ? source.slice(1) : source;
}

export function parseTsv(source) {
  const rows = [];
  let cells = [];
  let cellStartLines = [];
  let cell = '';
  let state = 'unquoted';
  let line = 1;
  let rowStartLine = 1;
  let cellStartLine = 1;
  let rowStarted = false;

  const finishCell = () => {
    cells.push(cell);
    cellStartLines.push(cellStartLine);
    cell = '';
    state = 'unquoted';
  };

  const finishRow = () => {
    finishCell();
    rows.push({ cells, line: rowStartLine, cellStartLines });
    cells = [];
    cellStartLines = [];
    rowStarted = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (state === 'quoted') {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          state = 'after-quote';
        }
      } else {
        cell += character;
        if (character === '\n') line += 1;
      }
      rowStarted = true;
      continue;
    }

    if (state === 'after-quote') {
      if (character === '\t') {
        finishCell();
        cellStartLine = line;
      } else if (character === '\n') {
        finishRow();
        line += 1;
        rowStartLine = line;
        cellStartLine = line;
      } else if (character === '\r' && source[index + 1] === '\n') {
        finishRow();
        index += 1;
        line += 1;
        rowStartLine = line;
        cellStartLine = line;
      } else {
        throw new TsvSyntaxError(
          'TSV-E004',
          '引用符付きセルの閉じ引用符の後に不正な文字があります。',
          {
            line,
            columnIndex: cells.length + 1,
            suggestedAction: 'セル全体を引用符で囲み、セル内の引用符は二重引用符にしてください。'
          }
        );
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      state = 'quoted';
      rowStarted = true;
    } else if (character === '\t') {
      finishCell();
      cellStartLine = line;
      rowStarted = true;
    } else if (character === '\n') {
      finishRow();
      line += 1;
      rowStartLine = line;
      cellStartLine = line;
    } else if (character === '\r') {
      if (source[index + 1] !== '\n') {
        throw new TsvSyntaxError('TSV-E004', '単独のCR改行は使用できません。', {
          line,
          columnIndex: cells.length + 1,
          suggestedAction: 'LFまたはCRLFのTSVとして再出力してください。'
        });
      }
      finishRow();
      index += 1;
      line += 1;
      rowStartLine = line;
      cellStartLine = line;
    } else {
      cell += character;
      rowStarted = true;
    }
  }

  if (state === 'quoted') {
    throw new TsvSyntaxError('TSV-E003', '引用符付きセルが閉じられていません。', {
      line: cellStartLine,
      columnIndex: cells.length + 1,
      suggestedAction: 'セル末尾の閉じ引用符を追加してください。'
    });
  }
  if (rowStarted || cell.length > 0 || cells.length > 0 || state === 'after-quote') finishRow();
  return rows;
}
