// === ETHER — Lecture des documents Word (.docx) et Excel (.xlsx) ===
// Sans bibliotheque : un .docx/.xlsx est un zip de fichiers XML. On lit le
// repertoire central du zip, on decompresse les entrees utiles avec
// DecompressionStream('deflate-raw') et on extrait le texte du XML.
// (docgen.js fait l'inverse : il ecrit ces fichiers.)

var ETHER_DOCREAD = (function() {
    // Au-dela, on arrete de lire une feuille : le texte serait coupe a l'envoi.
    var MAX_CHARS = 200000;

    function u16(b, o) { return b[o] | (b[o + 1] << 8); }
    function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

    // Repertoire central : { chemin: { method, csize, offset } }.
    function listZip(bytes) {
        var min = Math.max(0, bytes.length - 65557);
        var eocd = -1;
        for (var i = bytes.length - 22; i >= min; i--) {
            if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('Pas un fichier zip');
        var count = u16(bytes, eocd + 10);
        var p = u32(bytes, eocd + 16);
        var dec = new TextDecoder();
        var entries = {};
        for (var n = 0; n < count; n++) {
            if (u32(bytes, p) !== 0x02014b50) throw new Error('Zip abime');
            var nameLen = u16(bytes, p + 28);
            entries[dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))] = {
                method: u16(bytes, p + 10), csize: u32(bytes, p + 20), offset: u32(bytes, p + 42)
            };
            p += 46 + nameLen + u16(bytes, p + 30) + u16(bytes, p + 32);
        }
        return entries;
    }

    // Contenu texte (UTF-8) d'une entree du zip, ou null si elle n'existe pas.
    function readEntry(bytes, entries, name) {
        var e = entries[name];
        if (!e) return Promise.resolve(null);
        var o = e.offset;
        if (u32(bytes, o) !== 0x04034b50) return Promise.reject(new Error('Zip abime'));
        var start = o + 30 + u16(bytes, o + 26) + u16(bytes, o + 28);
        var data = bytes.subarray(start, start + e.csize);
        if (e.method === 0) return Promise.resolve(new TextDecoder().decode(data));
        if (e.method !== 8) return Promise.reject(new Error('Compression non geree'));
        var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).text();
    }

    function decodeXml(s) {
        return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function(m, ent) {
            var named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[ent.toLowerCase()];
            if (named) return named;
            var code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
            return isNaN(code) ? m : String.fromCodePoint(code);
        });
    }

    function attr(tag, name) {
        var m = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
        return m ? decodeXml(m[1]) : null;
    }

    // Texte d'un document.xml : un paragraphe par ligne, tabulations et sauts conserves.
    function docxText(xml) {
        var out = '';
        var re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>|<\/w:p>|<\/w:tc>/g;
        var m;
        while ((m = re.exec(xml))) {
            if (m[1] !== undefined) out += decodeXml(m[1]);
            else if (m[0] === '<w:tab/>' || m[0] === '</w:tc>') out += '\t';
            else out += '\n';
        }
        return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function readDocx(bytes, entries) {
        return readEntry(bytes, entries, 'word/document.xml').then(function(xml) {
            if (xml === null) throw new Error('Pas un document Word');
            return docxText(xml);
        });
    }

    // Index de colonne (0 pour A) depuis une reference de cellule "AB12".
    function colIndex(ref) {
        var letters = (ref || '').match(/^[A-Z]+/);
        if (!letters) return -1;
        var n = 0;
        for (var i = 0; i < letters[0].length; i++) n = n * 26 + (letters[0].charCodeAt(i) - 64);
        return n - 1;
    }

    function runsText(xml) {
        return (xml.match(/<t(?:\s[^>]*)?>[^<]*<\/t>/g) || []).map(function(t) { return decodeXml(t.replace(/<[^>]+>/g, '')); }).join('');
    }

    // Une ligne par rangee, cellules separees par des tabulations.
    function sheetText(xml, shared) {
        var lines = [];
        var size = 0;
        var rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
        var row;
        while ((row = rowRe.exec(xml)) && size < MAX_CHARS) {
            var cells = [];
            var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
            var c;
            while ((c = cellRe.exec(row[1]))) {
                var head = '<c' + c[1] + '>';
                var body = c[2] || '';
                var type = attr(head, 't');
                var v = body.match(/<v>([^<]*)<\/v>/);
                var val = '';
                if (type === 's' && v) val = shared[parseInt(v[1], 10)] || '';
                else if (type === 'inlineStr') val = runsText(body);
                else if (type === 'b' && v) val = v[1] === '1' ? 'VRAI' : 'FAUX';
                else if (v) val = decodeXml(v[1]);
                var col = colIndex(attr(head, 'r'));
                if (col < 0) col = cells.length;
                while (cells.length < col) cells.push('');
                cells[col] = val.replace(/[\t\n]+/g, ' ');
            }
            var line = cells.join('\t').replace(/\t+$/, '');
            if (line.trim()) { lines.push(line); size += line.length + 1; }
        }
        return lines.join('\n');
    }

    function readXlsx(bytes, entries) {
        return Promise.all([
            readEntry(bytes, entries, 'xl/workbook.xml'),
            readEntry(bytes, entries, 'xl/_rels/workbook.xml.rels'),
            readEntry(bytes, entries, 'xl/sharedStrings.xml')
        ]).then(function(parts) {
            var workbook = parts[0], rels = parts[1], sst = parts[2];
            if (workbook === null) throw new Error('Pas un classeur Excel');
            var shared = [];
            var siRe = /<si>([\s\S]*?)<\/si>/g, si;
            while (sst && (si = siRe.exec(sst))) shared.push(runsText(si[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')));
            var targets = {};
            ((rels || '').match(/<Relationship\b[^>]*>/g) || []).forEach(function(tag) {
                var target = attr(tag, 'Target') || '';
                targets[attr(tag, 'Id')] = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target;
            });
            var sheets = (workbook.match(/<sheet\b[^>]*>/g) || []).map(function(tag) {
                return { name: attr(tag, 'name') || 'Feuille', path: targets[attr(tag, 'r:id')] };
            }).filter(function(s) { return s.path && entries[s.path]; });
            return Promise.all(sheets.map(function(s) { return readEntry(bytes, entries, s.path); })).then(function(xmls) {
                return sheets.map(function(s, i) {
                    var text = sheetText(xmls[i] || '', shared);
                    return text ? '## ' + s.name + '\n' + text : '';
                }).filter(Boolean).join('\n\n');
            });
        });
    }

    // Texte d'un .docx ou .xlsx (ArrayBuffer). Rejette si le fichier n'est pas lisible.
    function read(buffer, ext) {
        return Promise.resolve().then(function() {
            var bytes = new Uint8Array(buffer);
            var entries = listZip(bytes);
            if (ext === 'docx') return readDocx(bytes, entries);
            if (ext === 'xlsx') return readXlsx(bytes, entries);
            throw new Error('Format non gere : ' + ext);
        });
    }

    return { read: read, canRead: function(ext) { return ext === 'docx' || ext === 'xlsx'; } };
})();
