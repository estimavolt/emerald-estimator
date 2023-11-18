const fs = require('fs');

const csvTransformer = {
    process(src, filename) {
        const csvData = fs.readFileSync(filename, 'utf8');
        return {
            code: 'module.exports = ' + JSON.stringify(csvData) + ';',
        };
    }
};

module.exports = csvTransformer;
