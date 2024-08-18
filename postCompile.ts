import * as fs from 'fs';
import * as path from 'path';

/////////////////////////////////////

const filePathVaultCompleteWithdrawal = path.resolve(__dirname, './artifacts/vaultCompleteWithdrawal.json');

fs.readFile(filePathVaultCompleteWithdrawal, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Replace occurrences of "OP_CODESEPARATOR OP_TRUE" with "OP_CSV OP_TRUE",
    // since sCrypt compiler doesn't support CSV for now...
    const result = data.replace(/ab51/g, 'b251');

    fs.writeFile(filePathVaultCompleteWithdrawal, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }


        console.log('Post-compile hook completed for:', filePathVaultCompleteWithdrawal.toString())
    });
});

/////////////////////////////////////

const filePathTestMerklePath = path.resolve(__dirname, './artifacts/tests/testMerklePath.json');

fs.readFile(filePathTestMerklePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Replace occurrences of "OP_2 OP_MUL" with "OP_DUP OP_ADD",
    // since BTC doesn't support OP_MUL...
    const result = data.replace(/5295/g, '7693');

    fs.writeFile(filePathTestMerklePath, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }

        console.log('Post-compile hook completed for:', filePathTestMerklePath.toString())
    });
});

/////////////////////////////////////

const filePathTestLamportOracle = path.resolve(__dirname, './artifacts/tests/testLamportOracle.json');

fs.readFile(filePathTestLamportOracle, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Replace occurrences of "OP_2 OP_MUL" with "OP_DUP OP_ADD",
    // since BTC doesn't support OP_MUL...
    let result = data.replace(/5295/g, '7693');

    // Remove redundant "OP_1 OP_MUL"
    result = result.replace(/5195/g, '');

    fs.writeFile(filePathTestLamportOracle, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }

        console.log('Post-compile hook completed for:', filePathTestLamportOracle.toString())
    });
});