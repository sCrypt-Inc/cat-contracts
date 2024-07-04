import * as fs from 'fs';
import * as path from 'path';

const filePath = path.resolve(__dirname, './artifacts/vaultCompleteWithdrawal.json');

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Replace occurrences of "OP_CODESEPARATOR OP_TRUE" with "OP_CSV OP_TRUE",
    // since sCrypt compiler doesn't support CSV for now...
    const result = data.replace(/ab51/g, 'b251');

    fs.writeFile(filePath, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }

        console.log('File updated successfully.');
    });
});
