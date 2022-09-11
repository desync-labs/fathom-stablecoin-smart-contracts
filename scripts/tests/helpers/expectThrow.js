const { assert } = require('chai');

const errTypes = {
    revert: 'revert',
    outOfGas: 'out of gas',
    invalidJump: 'invalid JUMP',
    invalidOpcode: 'invalid opcode',
    stackOverflow: 'stack overflow',
    stackUnderflow: 'stack underflow',
    staticStateChange: 'static state change',
};

async function shouldRevert(promise, errType, message) {
    const PREFIX = 'VM Exception while processing transaction: ';
    const POSTFIX = '\\",\\"code\\":';

    try {
        await promise;
        throw null;
    } catch (error) {
        assert(error, 'Expected an error but did not get one');

        let stringError = JSON.stringify(error);

        const n = stringError.indexOf(PREFIX);
        assert(n >= 0, 'Wrong error structure (no prefix): ' + stringError);

        const m = stringError.indexOf(POSTFIX);
        assert(m >= 0, 'Wrong error structure (no postfix): ' + stringError);

        const searchMessage = PREFIX + errType + (message ? ' ' + message : '');

        const foundMessage = stringError.substring(n, m);

        assert(
            searchMessage == foundMessage,
            "Expected an error '" +
                searchMessage +
                "' but got '" +
                foundMessage +
                "' instead"
        );
    }
}

async function shouldRevertAndHaveSubstring(promise, errType, substring) {
    const nospaces = substring.replace(/\s+/g, '');
    if (nospaces == '') {
        throw new Error('Empty substring requested');
    }

    const PREFIX = 'VM Exception while processing transaction: ';
    const POSTFIX = '\\",\\"code\\":';

    try {
        await promise;
        throw null;
    } catch (error) {
        assert(error, 'Expected an error but did not get one');

        let stringError = JSON.stringify(error);

        const n = stringError.indexOf(PREFIX);
        assert(n >= 0, 'Wrong error structure (no prefix): ' + stringError);

        const m = stringError.indexOf(POSTFIX);
        assert(m >= 0, 'Wrong error structure (no postfix): ' + stringError);

        const foundMessage = stringError.substring(n, m);

        assert(
            foundMessage.includes(substring),
            "Expected error to contain '" +
                substring +
                "' but got '" +
                foundMessage +
                "' instead"
        );
    }
}

module.exports = { errTypes, shouldRevert, shouldRevertAndHaveSubstring };
