function intToHexColor(raw) {
  return '#' + raw.toString(16).padStart(6, '0');
}

function getHighlightName(id) {
  return `hl-${id}`;
}

function makeCss(id, attrs) {
  const className = getHighlightName(id);

  var fgcolor = defcolors.color;
  var bgcolor = defcolors.backgroundColor;

  if ('background' in attrs) bgcolor = intToHexColor(attrs.background);
  if ('foreground' in attrs) fgcolor = intToHexColor(attrs.foreground);

  if (attrs.reverse) {
    const tmp = fgcolor;
    fgcolor = bgcolor;
    bgcolor = tmp;
  }

  var rules = new Array();
  const fgvar = `--highlight-${id}-color`;
  const bgvar = `--highlight-${id}-background-color`;

  var rule0 = '';
  rule0 += `.${className} {`;
  rule0 += `color: var(${fgvar});\n`;
  rule0 += `background-color: var(${bgvar});\n`;
  rule0 += '}\n';
  rules.push(rule0);

  var rule1 = '';
  rule1 += `.${className}::-moz-selection {`;
  rule1 += `color: var(${bgvar});\n`;
  rule1 += `background-color: var(${fgvar});\n`;
  rule1 += '}\n';
  rules.push(rule1);

  var rule2 = '';
  rule2 += `.${className}::selection {`;
  rule2 += `color: var(${bgvar});\n`;
  rule2 += `background-color: var(${fgvar});\n`;
  rule2 += '}\n';
  rules.push(rule2);

  var rule3 = '';
  rule3 += `.${className}[data-selected="1"] {`;
  rule3 += `color: var(${bgvar});\n`;
  rule3 += `background-color: var(${fgvar});\n`;
  rule3 += '}\n';
  rules.push(rule3);

  return {
    rules,
    props: [
      [fgvar, fgcolor],
      [bgvar, bgcolor]
    ]
  };
}

const keymap = new Map();
keymap.set('<',         '<LT>');
keymap.set('Backspace', '<BS>');
keymap.set('Enter',     '<CR>');
keymap.set('Escape',    '<Esc>');

function onKeyDown(e) {
  var key = e.key;
  if ((key.length === 1) || keymap.has(key)) {
    if (keymap.has(key)) key = keymap.get(key);
    sock.emit('key', key);
  }
}

function onFocusOut(e) {
  e.preventDefault();
  e.stopPropagation();
  e.target.focus();
}

const width = 80;
const height = 20;
var cells = new Array(width * height);

let oldcur = [0, 0];

const defcolors = {};
let root = document.documentElement;

const head = document.head || document.getElementsByTagName('head')[0];
const style = document.createElement('style');
head.appendChild(style);

var defaultCssAdded = false;
var hlCssAdded = false;

const url = 'ws://localhost:9000';
const sock = io(url);

const terminal = document.getElementById('container');
terminal.addEventListener('keydown', onKeyDown);
terminal.addEventListener('focusout', onFocusOut);
terminal.addEventListener('blur', onFocusOut);
terminal.tabIndex = 0;
terminal.focus();

for (let y = 0; y < height; y++) {
  const row = document.createElement('div');
  for (let x = 0; x < width; x++) {
    const span = document.createElement('span');
    span.innerHTML = '&nbsp;';
    span.className = getHighlightName(0);
    cells[y*width+x] = span;
    row.appendChild(span);
  }
  terminal.appendChild(row);
}

sock.on('notify', (msg) => {
  const events = msg[2];
  for (const ev of events) {
    switch (ev[0]) {
      case 'win_viewport': {
        const params = ev[1];
        const row = params[4];
        const col = params[5];

        let newsel = cells[row*width+col];
        newsel.dataset.selected = "1";

        if ((row != oldcur[0]) || (col != oldcur[1])) {
          const oldrow = oldcur[0];
          const oldcol = oldcur[1];

          let oldsel = cells[oldrow*width+oldcol];
          oldsel.dataset.selected = "0";
          oldcur = [row, col];
        }
      }
      break;

      case 'grid_cursor_goto': {
        const params = ev[1];
        const row = params[1];
        const col = params[2];

        let newsel = cells[row*width+col];
        newsel.dataset.selected = "1";

        if ((row != oldcur[0]) || (col != oldcur[1])) {
          const oldrow = oldcur[0];
          const oldcol = oldcur[1];

          let oldsel = cells[oldrow*width+oldcol];
          oldsel.dataset.selected = "0";
          oldcur = [row, col];
        }
      }
      break;

      case 'grid_line': {
        for (const line of ev.slice(1)) {
          const row = line[1];
          var col = line[2];
          var hlid = 0;
          for (const cell of line[3]) {
            const text = (cell[0] === ' ') ? '&nbsp;' : cell[0];
            hlid = (cell.length > 1) ? cell[1] : hlid;
            const repeat = (cell.length > 2) ? cell[2] : 1;
            for (let i = 0; i < repeat; i++) {
              let cur = cells[row*width+col];
              cur.innerHTML = text;
              cur.className = getHighlightName(hlid);
              col += 1;
            }
          }
        }
      }
      break;

      case 'default_colors_set': {
        const colors = ev[1];
        const css = makeCss(0, {
          foreground: colors[0],
          background: colors[1]
        });

        for (prop of css.props) {
          root.style.setProperty(prop[0], prop[1]);
        }

        if (!defaultCssAdded) {
          style.innerHTML = css.rules.join('\n');
          defaultCssAdded = true;
        }
      }
      break;

      case 'hl_attr_define': {
        for (const entry of ev.slice(1)) {
          const css = makeCss(entry[0], entry[1]);

          for (prop of css.props) {
            root.style.setProperty(prop[0], prop[1]);
          }

          if (!hlCssAdded) {
            style.innerHTML += css.rules.join('\n');
          }
        }
        hlCssAdded = true;
      }
      break;
    }
  }
});

// vim: set ft=javascript:
