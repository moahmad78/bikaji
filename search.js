const fs = require('fs');
const path = require('path');

function search(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            search(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (line.includes('$')) {
                    let cleanedLine = line.replace(/\$\{/g, '')
                                          .replace(/db\.\$/g, '')
                                          .replace(/auth\.\$/g, '')
                                          .replace(/\/\^[^\$]*\$\/i/, ''); 
                    
                    if (cleanedLine.includes('$')) {
                        console.log(fullPath + ':' + (i+1) + ' ' + line.trim());
                    }
                }
            });
        }
    });
}
search('src');
