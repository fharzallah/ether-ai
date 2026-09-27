// === ETHER — Generation de fichiers Office (.docx, .xlsx) ===
//
// Avant, "Word" etait une page HTML renommee en .doc (Word affichait un
// avertissement de format, Google Docs et Pages l'ouvraient mal) et "Excel"
// un simple CSV. Ce module produit de vrais fichiers Office Open XML, dans
// le navigateur, sans bibliotheque externe : un .docx ou un .xlsx n'est
// qu'une archive ZIP de fichiers XML.

var DOCGEN = (function() {
    'use strict';

    // === ZIP (methode "stockee", sans compression) ===
    var CRC_TABLE = (function() {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function utf8(s) { return new TextEncoder().encode(s); }

    function zip(files) {
        var parts = [], central = [], offset = 0;
        function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
        function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
        for (var i = 0; i < files.length; i++) {
            var name = utf8(files[i].name);
            var data = utf8(files[i].data);
            var crc = crc32(data);
            // Drapeau 0x0800 : noms de fichiers en UTF-8.
            var common = [].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length));
            var local = new Uint8Array([].concat([0x50, 0x4B, 0x03, 0x04], common, u16(0)));
            parts.push(local, name, data);
            central.push(new Uint8Array([].concat([0x50, 0x4B, 0x01, 0x02], u16(20), common, u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
            offset += local.length + name.length + data.length;
        }
        var centralSize = 0;
        for (var j = 0; j < central.length; j++) centralSize += central[j].length;
        var end = new Uint8Array([].concat([0x50, 0x4B, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)));
        var all = parts.concat(central, [end]);
        var total = 0;
        for (var k = 0; k < all.length; k++) total += all[k].length;
        var out = new Uint8Array(total), pos = 0;
        for (var m = 0; m < all.length; m++) { out.set(all[m], pos); pos += all[m].length; }
        return out;
    }

    // Echappement XML, et retrait des caracteres de controle interdits par XML 1.0.
    function x(s) {
        return String(s == null ? '' : s)
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

    function coreProps(title) {
        var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        return XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
            + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            + '<dc:title>' + x(title) + '</dc:title><dc:creator>ETHER AI</dc:creator>'
            + '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>'
            + '</cp:coreProperties>';
    }

    // === DOCX ===
    var W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

    function heading(level, size, color, before) {
        return '<w:style w:type="paragraph" w:styleId="Heading' + level + '"><w:name w:val="heading ' + level + '"/>'
            + '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
            + '<w:pPr><w:keepNext/><w:spacing w:before="' + before + '" w:after="120"/><w:outlineLvl w:val="' + (level - 1) + '"/></w:pPr>'
            + '<w:rPr><w:b/><w:color w:val="' + color + '"/><w:sz w:val="' + size + '"/></w:rPr></w:style>';
    }

    var TABLE_BORDERS = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function(b) {
        return '<w:' + b + ' w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>';
    }).join('') + '</w:tblBorders>';

    var DOCX_STYLES = XML_HEAD + '<w:styles ' + W_NS + '>'
        + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/>'
        + '<w:sz w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault>'
        + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
        + heading(1, 36, '1A1A2E', 360) + heading(2, 28, '16213E', 280) + heading(3, 24, '333333', 200)
        + '<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/>'
        + '<w:rPr><w:color w:val="888888"/><w:sz w:val="18"/></w:rPr></w:style>'
        + '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/>'
        + '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F3F3F3"/><w:spacing w:after="0"/></w:pPr>'
        + '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="19"/></w:rPr></w:style>'
        + '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/>'
        + '<w:pPr><w:ind w:left="567"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>'
        + '<w:style w:type="table" w:styleId="Grille"><w:name w:val="Grille"/><w:tblPr>' + TABLE_BORDERS + '<w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
        + '</w:styles>';

    // Transforme le HTML produit par l'IA (h1-h3, p, listes, tableaux, code,
    // gras, italique...) en paragraphes WordprocessingML.
    function htmlToDocx(html) {
        var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
        var body = [];
        var lists = [];          // une numerotation par liste : chaque liste numerotee repart a 1

        function runs(node, fmt) {
            var out = '';
            for (var c = node.firstChild; c; c = c.nextSibling) {
                if (c.nodeType === 3) {
                    var t = c.nodeValue.replace(/\s+/g, ' ');
                    if (!t) continue;
                    var rPr = (fmt.b ? '<w:b/>' : '') + (fmt.i ? '<w:i/>' : '') + (fmt.u ? '<w:u w:val="single"/><w:color w:val="1F5FBF"/>' : '')
                        + (fmt.code ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:shd w:val="clear" w:color="auto" w:fill="F3F3F3"/>' : '');
                    out += '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
                } else if (c.nodeType === 1) {
                    var tag = c.tagName.toLowerCase();
                    if (tag === 'br') { out += '<w:r><w:br/></w:r>'; continue; }
                    if (tag === 'ul' || tag === 'ol') continue;    // liste imbriquee : traitee a part
                    var f = { b: fmt.b, i: fmt.i, u: fmt.u, code: fmt.code };
                    if (tag === 'strong' || tag === 'b' || tag === 'th') f.b = true;
                    if (tag === 'em' || tag === 'i') f.i = true;
                    if (tag === 'a') f.u = true;
                    if (tag === 'code') f.code = true;
                    out += runs(c, f);
                }
            }
            return out;
        }

        function para(content, pPr) {
            return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + content + '</w:p>';
        }

        function list(el, level) {
            var numId = lists.length + 1;
            lists.push(el.tagName.toLowerCase() === 'ol' ? 'decimal' : 'bullet');
            for (var li = el.firstElementChild; li; li = li.nextElementSibling) {
                if (li.tagName.toLowerCase() !== 'li') continue;
                body.push(para(runs(li, {}), '<w:numPr><w:ilvl w:val="' + Math.min(level, 2) + '"/><w:numId w:val="' + numId + '"/></w:numPr><w:spacing w:after="60"/>'));
                for (var sub = li.firstElementChild; sub; sub = sub.nextElementSibling) {
                    var st = sub.tagName.toLowerCase();
                    if (st === 'ul' || st === 'ol') list(sub, level + 1);
                }
            }
        }

        function table(el) {
            var rows = el.querySelectorAll('tr');
            if (!rows.length) return;
            var cols = 0;
            for (var r = 0; r < rows.length; r++) cols = Math.max(cols, rows[r].children.length);
            var width = Math.floor(9000 / Math.max(cols, 1));
            // Bordures posees sur le tableau lui-meme : certains lecteurs ignorent le style.
            var t = '<w:tbl><w:tblPr><w:tblStyle w:val="Grille"/><w:tblW w:w="5000" w:type="pct"/>' + TABLE_BORDERS + '</w:tblPr><w:tblGrid>';
            for (var g = 0; g < cols; g++) t += '<w:gridCol w:w="' + width + '"/>';
            t += '</w:tblGrid>';
            for (var i = 0; i < rows.length; i++) {
                var header = rows[i].querySelector('th') !== null;
                t += '<w:tr>' + (header ? '<w:trPr><w:tblHeader/></w:trPr>' : '');
                var cells = rows[i].children;
                for (var c = 0; c < cols; c++) {
                    var cell = cells[c];
                    var shade = header ? '<w:shd w:val="clear" w:color="auto" w:fill="EDEDED"/>' : '';
                    t += '<w:tc><w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>' + shade + '</w:tcPr>'
                        + para(cell ? runs(cell, { b: header }) : '', '<w:spacing w:after="0"/>') + '</w:tc>';
                }
                t += '</w:tr>';
            }
            body.push(t + '</w:tbl>', para(''));
        }

        function block(el) {
            var tag = el.tagName.toLowerCase();
            if (/^h[1-6]$/.test(tag)) body.push(para(runs(el, {}), '<w:pStyle w:val="Heading' + Math.min(+tag[1], 3) + '"/>'));
            else if (tag === 'ul' || tag === 'ol') list(el, 0);
            else if (tag === 'table') table(el);
            else if (tag === 'pre') {
                var lines = el.textContent.replace(/\n$/, '').split('\n');
                for (var l = 0; l < lines.length; l++) body.push(para('<w:r><w:t xml:space="preserve">' + x(lines[l]) + '</w:t></w:r>', '<w:pStyle w:val="Code"/>'));
                body.push(para(''));
            }
            else if (tag === 'blockquote') body.push(para(runs(el, {}), '<w:pStyle w:val="Quote"/>'));
            else if (tag === 'hr') body.push(para('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr>'));
            else if (tag === 'div' || tag === 'section' || tag === 'article') walk(el);
            else body.push(para(runs(el, {})));
        }

        function walk(parent) {
            for (var n = parent.firstChild; n; n = n.nextSibling) {
                if (n.nodeType === 1) block(n);
                else if (n.nodeType === 3 && n.nodeValue.trim()) body.push(para('<w:r><w:t xml:space="preserve">' + x(n.nodeValue.trim()) + '</w:t></w:r>'));
            }
        }

        walk(doc.body);
        return { body: body.join(''), lists: lists };
    }

    // Une definition abstraite PAR liste : c'est la seule facon pour que chaque
    // liste numerotee reparte a 1 dans tous les lecteurs (Word, Pages, Quick Look),
    // certains ignorant startOverride.
    function numberingXml(lists) {
        var bullets = ['•', '◦', '▪'];
        var abs = '', nums = '';
        for (var i = 0; i < lists.length; i++) {
            var kind = lists[i];
            abs += '<w:abstractNum w:abstractNumId="' + i + '"><w:multiLevelType w:val="hybridMultilevel"/>';
            for (var l = 0; l < 3; l++) {
                abs += '<w:lvl w:ilvl="' + l + '"><w:start w:val="1"/><w:numFmt w:val="' + kind + '"/>'
                    + '<w:lvlText w:val="' + (kind === 'bullet' ? bullets[l] : '%' + (l + 1) + '.') + '"/><w:lvlJc w:val="left"/>'
                    + '<w:pPr><w:ind w:left="' + (720 + l * 360) + '" w:hanging="360"/></w:pPr></w:lvl>';
            }
            abs += '</w:abstractNum>';
            nums += '<w:num w:numId="' + (i + 1) + '"><w:abstractNumId w:val="' + i + '"/></w:num>';
        }
        return XML_HEAD + '<w:numbering ' + W_NS + '>' + abs + nums + '</w:numbering>';
    }

    function contentTypes(overrides) {
        return XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + overrides.map(function(o) { return '<Override PartName="' + o[0] + '" ContentType="' + o[1] + '"/>'; }).join('')
            + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            + '</Types>';
    }

    function rels(list) {
        return XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + list.map(function(r, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="' + r[0] + '" Target="' + r[1] + '"/>'; }).join('')
            + '</Relationships>';
    }

    var REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
    var CORE_REL = ['http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'];

    function docx(title, html) {
        var conv = htmlToDocx(html);
        var date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
        var meta = '<w:p><w:pPr><w:pStyle w:val="Meta"/></w:pPr><w:r><w:t xml:space="preserve">' + x('Généré par ETHER AI • ' + date) + '</w:t></w:r></w:p>';
        var document = XML_HEAD + '<w:document ' + W_NS + '><w:body>' + meta + conv.body
            + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>'
            + '</w:body></w:document>';
        var WML = 'application/vnd.openxmlformats-officedocument.wordprocessingml.';
        return zip([
            { name: '[Content_Types].xml', data: contentTypes([
                ['/word/document.xml', WML + 'document.main+xml'],
                ['/word/styles.xml', WML + 'styles+xml'],
                ['/word/numbering.xml', WML + 'numbering+xml']]) },
            { name: '_rels/.rels', data: rels([[REL + 'officeDocument', 'word/document.xml'], CORE_REL]) },
            { name: 'word/_rels/document.xml.rels', data: rels([[REL + 'styles', 'styles.xml'], [REL + 'numbering', 'numbering.xml']]) },
            { name: 'word/document.xml', data: document },
            { name: 'word/styles.xml', data: DOCX_STYLES },
            { name: 'word/numbering.xml', data: numberingXml(conv.lists) },
            { name: 'docProps/core.xml', data: coreProps(title) }
        ]);
    }

    // === XLSX ===
    // CSV avec guillemets ; separateur virgule, point-virgule ou tabulation
    // (deduit de la premiere ligne).
    function parseCsv(text) {
        text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
        var first = text.split('\n')[0] || '';
        var counts = { ',': first.split(',').length, ';': first.split(';').length, '\t': first.split('\t').length };
        var sep = ',';
        for (var s in counts) if (counts[s] > counts[sep]) sep = s;
        var rows = [], row = [], cell = '', q = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            if (q) {
                if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
                else if (ch === '"') q = false;
                else cell += ch;
            } else if (ch === '"' && cell === '') q = true;
            else if (ch === sep) { row.push(cell); cell = ''; }
            else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
            else cell += ch;
        }
        row.push(cell); rows.push(row);
        return rows.filter(function(r) { return r.length > 1 || (r[0] || '').trim(); });
    }

    function colName(i) {
        var s = '';
        for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
        return s;
    }

    function xlsx(title, csv) {
        var rows = parseCsv(csv);
        var widths = [];
        var sheetRows = '';
        for (var r = 0; r < rows.length; r++) {
            sheetRows += '<row r="' + (r + 1) + '">';
            for (var c = 0; c < rows[r].length; c++) {
                var v = rows[r][c].trim();
                widths[c] = Math.max(widths[c] || 8, Math.min(v.length + 2, 60));
                var ref = colName(c) + (r + 1);
                var style = r === 0 ? ' s="1"' : '';
                // Les nombres (1 234,56 ou 1234.56) sont stockes comme nombres : sommes et tris marchent.
                var num = v.replace(/[\s ]/g, '').replace(/^(-?\d+),(\d+)$/, '$1.$2');
                if (r > 0 && /^-?\d+(\.\d+)?$/.test(num) && num.length < 16) sheetRows += '<c r="' + ref + '"' + style + '><v>' + num + '</v></c>';
                else if (v) sheetRows += '<c r="' + ref + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
            }
            sheetRows += '</row>';
        }
        var cols = '';
        for (var w = 0; w < widths.length; w++) cols += '<col min="' + (w + 1) + '" max="' + (w + 1) + '" width="' + widths[w] + '" customWidth="1"/>';
        var sheet = XML_HEAD + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            + (rows.length > 1 ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '')
            + (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + sheetRows + '</sheetData></worksheet>';
        var sheetName = x(String(title || '').replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31).trim() || 'Feuille 1');
        var SML = 'application/vnd.openxmlformats-officedocument.spreadsheetml.';
        return zip([
            { name: '[Content_Types].xml', data: contentTypes([
                ['/xl/workbook.xml', SML + 'sheet.main+xml'],
                ['/xl/worksheets/sheet1.xml', SML + 'worksheet+xml'],
                ['/xl/styles.xml', SML + 'styles+xml']]) },
            { name: '_rels/.rels', data: rels([[REL + 'officeDocument', 'xl/workbook.xml'], CORE_REL]) },
            { name: 'xl/workbook.xml', data: XML_HEAD + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
                + '<sheet name="' + sheetName + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
            { name: 'xl/_rels/workbook.xml.rels', data: rels([[REL + 'worksheet', 'worksheets/sheet1.xml'], [REL + 'styles', 'styles.xml']]) },
            { name: 'xl/worksheets/sheet1.xml', data: sheet },
            { name: 'xl/styles.xml', data: XML_HEAD + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
                + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
                + '<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill></fills>'
                + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
                + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'
                + '</styleSheet>' },
            { name: 'docProps/core.xml', data: coreProps(title) }
        ]);
    }

    return { docx: docx, xlsx: xlsx, parseCsv: parseCsv };
})();
