const chai = require('chai');
const BN = web3.utils.BN;
const should = chai.use(require('chai-bn')(BN)).should();
const expect = chai.expect;

const getEventABI = function (abi, eventName) {
    let result = abi.find((el) => el.type == 'event' && el.name == eventName);
    should.exist(result, "Error in test. ABI doesn't have event", eventName);
    return result;
};

const inLogs = async (logs, eventName, eventArgs = {}) => {
    const event = logs.find((e) => e.event === eventName);
    should.exist(event, 'Event `' + eventName + '` has not emited!');
    for (const [k, v] of Object.entries(eventArgs)) {
        contains(event.args, k, v);
    }
    return event;
};

const convertToBN = function (v, type) {
    return type.includes('int') ? new BN(v) : v;
};

const decodeEvent = function (event, eventName, logAbi) {
    let logData = web3.eth.abi.decodeLog(
        logAbi.inputs,
        event.data,
        event.topics.slice(1)
    );
    for (const [k, v] of Object.entries(logData)) {
        let inputAbi = logAbi.inputs.find((el) => el.name == k);
        if (inputAbi) {
            logData[k] = Array.isArray(v)
                ? v.map((el) => convertToBN(el, inputAbi.type))
                : convertToBN(v, inputAbi.type);
        }
    }
    event.event = eventName;
    event.args = logData;
    return event;
};

const getEventArgs = async (tx, abi, eventName) => {
    const { receipt } = await tx;

    let eventAbi = getEventABI(abi, eventName);
    let signature = web3.utils.keccak256(
        eventName + '(' + eventAbi.inputs.map((el) => el.type).join(',') + ')'
    );
    let rawEvent = receipt.rawLogs.find((e) => e.topics[0] === signature);

    should.exist(rawEvent, 'Event `' + eventName + '` has not emited!');

    event = decodeEvent(rawEvent, eventName, eventAbi);

    return event.args;
};

const inRawLogs = async (
    rawLogs,
    abi,
    eventName,
    eventArgs = {},
    eventIndex = 0
) => {
    let eventAbi = getEventABI(abi, eventName);
    let signature = web3.utils.keccak256(
        eventName + '(' + eventAbi.inputs.map((el) => el.type).join(',') + ')'
    );

    let rawEvent;
    let calculatedEventIndex = 0;
    for (let i = 0; i < rawLogs.length; i++) {
        if (rawLogs[i].topics[0] == signature) {
            if (eventIndex == calculatedEventIndex) {
                rawEvent = rawLogs[i];
                break;
            }
            calculatedEventIndex++;
        }
    }

    should.exist(rawEvent, 'Event `' + eventName + '` has not emited!');

    event = decodeEvent(rawEvent, eventName, eventAbi);

    for (const [k, v] of Object.entries(eventArgs)) {
        contains(event.args, k, v);
    }

    return event;
};

const notInLogs = async (logs, eventName) => {
    const event = logs.find((e) => e.event === eventName);
    expect(event, 'Event `' + eventName + '` was emited!').to.be.undefined;
    return event;
};

const inTransaction = async (tx, eventName, eventArgs = {}) => {
    const { logs } = await tx;
    return inLogs(logs, eventName, eventArgs);
};

const inRawTransaction = async (
    tx,
    abi,
    eventName,
    eventArgs = {},
    eventIndex = 0
) => {
    const { receipt } = await tx;
    return inRawLogs(receipt.rawLogs, abi, eventName, eventArgs, eventIndex);
};

const notInTransaction = async (tx, eventName) => {
    const { logs } = await tx;
    return notInLogs(logs, eventName);
};

function contains(args, key, value) {
    (key in args).should.equal(true, `Unknown event argument '${key}'`);

    if (value === null) {
        expect(args[key]).to.equal(null);
    } else {
        match(key, args[key], value);
    }
}

function match(key, a, b) {
    if (isBN(a)) {
        expect(a).to.be.bignumber.equal(b, `Key: '${key}'`);
    } else {
        if (a.constructor.name == 'Array') {
            expect(a.length).to.be.equal(
                b.length,
                `Key: '${key}' Arrays of different length`
            );
            for (var i = 0; i < a.length; i++) {
                match(key, a[i], b[i]);
            }
        } else {
            expect(a).to.be.equal(b, `Key: '${key}'`);
        }
    }
}

function isBN(object) {
    return BN.isBN(object) || object instanceof BN;
}

function getLogByFirstTopic(tx, firstTopic) {
    const logs = tx.logs;

    for(let i = 0; i < logs.length; i++) {
        if(logs[i].topics[0] === firstTopic){
            return logs[i];
        }
    }
    return null;
}

function getIndexedEventArgs(tx, eventSignature) {
    const log = getLogByFirstTopic(tx, web3.utils.keccak256(eventSignature));
    return log.topics.slice(1);
}

function getLogFromAllTopics(tx, firstTopic) {
    const results = [];
    const logs = tx.logs;

    for(let i = 0; i < logs.length; i++) {
        if(logs[i].topics[0] === firstTopic) {
            results.push(logs[i]);
        }
    }
    
    return results;
}

function getAllIndexedEventArgs(tx, eventSignature) {
    const logs = getLogFromAllTopics(tx, web3.utils.keccak256(eventSignature));
    const results = [];

    for(let i = 0; i < logs.length; i++) {
        results.push(logs[i].topics.slice(1));
    }

    return results;
}

module.exports = {
    inLogs,
    inRawLogs,
    inTransaction,
    inRawTransaction,
    notInTransaction,
    getEventArgs,
    getLogByFirstTopic,
    getIndexedEventArgs,
    getAllIndexedEventArgs
};
