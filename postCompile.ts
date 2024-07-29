import * as fs from 'fs';
import * as path from 'path';

/////////////////////////////////////
//
let filePath = path.resolve(__dirname, './artifacts/vaultCompleteWithdrawal.json');

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

/////////////////////////////////////

filePath = path.resolve(__dirname, './artifacts/tests/testMerklePath.json');

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Replace occurrences of "OP_2 OP_MUL" with "OP_DUP OP_ADD",
    // since BTC doesn't support OP_MUL...
    const result = data.replace(/5295/g, '7693');

    fs.writeFile(filePath, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }

        console.log('File updated successfully.');
    });
});

/////////////////////////////////////

filePath = path.resolve(__dirname, './artifacts/tests/testLamportOracle.json');

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Replace occurrences of "OP_2 OP_MUL" with "OP_DUP OP_ADD",
    // since BTC doesn't support OP_MUL...
    let result = data.replace(/5295/g, '7693');

    // Remove redundant "OP_1 OP_MUL"
    result = result.replace(/5195/g, '');

    fs.writeFile(filePath, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }

        console.log('File updated successfully.');
    });
});