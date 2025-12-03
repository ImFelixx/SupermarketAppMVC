function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str === '') return '';
    const escaped = str.replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${escaped}"` : escaped;
}

function toCSV(rows, columns) {
    const header = columns.map(col => escapeCsvValue(col.label)).join(',');
    const lines = rows.map(row =>
        columns.map(col => escapeCsvValue(row[col.key])).join(',')
    );
    return [header, ...lines].join('\n');
}

module.exports = { toCSV };
