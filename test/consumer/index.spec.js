const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');
const dotenv = require('dotenv');
const AWSMock = require('@mapbox/mock-aws-sdk-js');
const nock = require('nock');
const querystring = require('querystring');
const util = require('util');

const { expect } = chai;
chai.use(chaiAsPromised);
chai.use(sinonChai);

dotenv.config({ path: './test/.env' });

AWSMock.config.update({ region: 'us-east-1' });

const consumer = require('../../src/consumer/index');
const consumerPromise = require('../aws-handler-promise');

const lambdaEventMessage = require('../data/lambda.event.json');
const coinbaseResponse = require('../data/coinbase.json');

const rule = JSON.parse(lambdaEventMessage.Records[0].Sns.Message);
const twilioSid = process.env.TWILIO_SID || '';
const twilioToken = process.env.TWILIO_TOKEN || '';
const twilioFrom = process.env.TWILIO_FROM || '';

coinbaseResponse.data.amount = parseInt(coinbaseResponse.data.amount, 10);

const lambdaEvent = (newRule) => {
    const newEvent = JSON.parse(JSON.stringify(lambdaEventMessage));
    newEvent.Records[0].Sns.Message = JSON.stringify(newRule);

    return newEvent;
};

const nockCoinbase = (currencyPair, priceType, statusCode, response) => {
    const coinbaseOrigin = 'https://api.coinbase.com';
    const coinbasePath = '/v2/prices/%s/%s';

    return nock(coinbaseOrigin)
        .get(util.format(coinbasePath, currencyPair, priceType))
        .reply(statusCode, response);
};

const nockTwilio = (currencyPair, rulePrice, currentPrice, currentPercent, statusCode) => {
    const twilioOrigin = 'https://api.twilio.com';
    const twilioPath = '/2010-04-01/Accounts/%s/Messages.json';
    const type = (rulePrice > currentPrice) ? 'down' : 'up';
    const data = {
        From: twilioFrom,
        To: twilioFrom,
        Body: `${currencyPair} ${type} with ${currentPercent}% - new: ${currentPrice}, old: ${rulePrice}`,
    };
    const headers = {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': Buffer.byteLength(querystring.stringify(data)).toString(),
    };
    const basicAuth = {
        user: twilioSid,
        pass: twilioToken,
    };

    return nock(twilioOrigin, { reqheaders: headers })
        .post(util.format(twilioPath, twilioSid), (body) => {
            return Object.keys(data).reduce((acc, field) => (field in body && acc === true), true);
        })
        .basicAuth(basicAuth)
        .reply(statusCode);
};

describe('Consumer', () => {
    let dynamo;

    beforeEach(() => {
        dynamo = AWSMock.stub('DynamoDB', 'updateItem');
        dynamo.returns(consumerPromise.resolve({}));
    });

    afterEach(() => {
        nock.cleanAll();
        AWSMock.DynamoDB.restore();
    });

    it('expect to get content from to Coinbase', (done) => {
        const coinbaseScope = nockCoinbase(rule.currencyPair, rule.priceType, 200, coinbaseResponse);

        consumerPromise.handler(consumer, lambdaEvent(rule)).then(() => {
            expect(coinbaseScope.isDone()).to.be.eq(true);
            done();
        });
    });

    it('expect to POST new message to Twilio when rule.price increases by rule.percent %', (done) => {
        const ruleUp = JSON.parse(JSON.stringify(rule));
        const percent = ruleUp.percent + 1;
        ruleUp.price = coinbaseResponse.data.amount;
        ruleUp.price -= ((coinbaseResponse.data.amount / 100) * percent);

        nockCoinbase(ruleUp.currencyPair, ruleUp.priceType, 200, coinbaseResponse);
        const twilioScope = nockTwilio(ruleUp.currencyPair, ruleUp.price, coinbaseResponse.data.amount, percent, 201);

        consumerPromise.handler(consumer, lambdaEvent(ruleUp)).then(() => {
            expect(twilioScope.isDone()).to.be.eq(true);
            done();
        });
    });

    it('expect to POST new message to Twilio when rule.price decreases by rule.percent %', (done) => {
        const ruleDown = JSON.parse(JSON.stringify(rule));
        const percent = ruleDown.percent + 2;
        ruleDown.price = coinbaseResponse.data.amount;
        ruleDown.price += ((coinbaseResponse.data.amount / 100) * percent);

        nockCoinbase(ruleDown.currencyPair, ruleDown.priceType, 200, coinbaseResponse);
        const twilioScope = nockTwilio(ruleDown.currencyPair, ruleDown.price, coinbaseResponse.data.amount, percent, 201);

        consumerPromise.handler(consumer, lambdaEvent(ruleDown)).then(() => {
            expect(twilioScope.isDone()).to.be.eq(true);
            done();
        });
    });

    it('expect to update rule.price in DynamoDb when rule.percent reached', (done) => {
        const ruleUp = JSON.parse(JSON.stringify(rule));
        const percent = ruleUp.percent + 1;
        ruleUp.price = coinbaseResponse.data.amount;
        ruleUp.price -= ((coinbaseResponse.data.amount / 100) * percent);

        nockCoinbase(ruleUp.currencyPair, ruleUp.priceType, 200, coinbaseResponse);
        nockTwilio(ruleUp.currencyPair, ruleUp.price, coinbaseResponse.data.amount, percent, 201);

        consumerPromise.handler(consumer, lambdaEvent(ruleUp)).then(() => {
            expect(dynamo).to.have.callCount(1);
            done();
        });
    });

    it('expect to callback with rule.id and Twilio trigger status', (done) => {
        const responseExpected = [rule.id, true];
        const ruleUp = JSON.parse(JSON.stringify(rule));
        const percent = ruleUp.percent + 1;
        ruleUp.price = coinbaseResponse.data.amount;
        ruleUp.price -= ((coinbaseResponse.data.amount / 100) * percent);

        nockCoinbase(ruleUp.currencyPair, ruleUp.priceType, 200, coinbaseResponse);
        nockTwilio(ruleUp.currencyPair, ruleUp.price, coinbaseResponse.data.amount, percent, 201);

        consumerPromise.handler(consumer, lambdaEvent(ruleUp)).then((response) => {
            expect(response).to.be.an('array').deep.equal(responseExpected);
            done();
        });
    });

    describe('expect to callback with an error when', () => {
        it('invalid rule object', (done) => {
            const ruleInvalid = {};
            const rejectedWith = `Invalid rule: ${JSON.stringify(ruleInvalid)}`;

            expect(consumerPromise.handler(consumer, lambdaEvent(ruleInvalid)))
                .to.eventually.be.rejectedWith(rejectedWith).notify(done);
        });

        it('Coinbase API returns an error', (done) => {
            const ruleInvalidCurrency = JSON.parse(JSON.stringify(rule));
            const rejectedWith = 'Https request failed: 400 ""';

            ruleInvalidCurrency.currencyPair = 'INVALID-CURRENCY-PAIR';

            nockCoinbase(ruleInvalidCurrency.currencyPair, ruleInvalidCurrency.priceType, 400);

            expect(consumerPromise.handler(consumer, lambdaEvent(ruleInvalidCurrency)))
                .to.eventually.be.rejectedWith(rejectedWith).notify(done);
        });

        it('Coinbase price is unavailable', (done) => {
            const coinbaseInvalidResponse = JSON.parse(JSON.stringify(coinbaseResponse));
            delete coinbaseInvalidResponse.data.amount;

            const rejectedWith = `Cannot extract price: ${JSON.stringify(coinbaseInvalidResponse)}`;

            nockCoinbase(rule.currencyPair, rule.priceType, 200, coinbaseInvalidResponse);

            expect(consumerPromise.handler(consumer, lambdaEvent(rule)))
                .to.eventually.be.rejectedWith(rejectedWith).notify(done);
        });

        it('Twilio API returns an error', (done) => {
            const rejectedWith = 'Https request failed: 400 ""';
            const ruleUp = JSON.parse(JSON.stringify(rule));
            const percent = ruleUp.percent + 1;
            ruleUp.price = coinbaseResponse.data.amount;
            ruleUp.price -= ((coinbaseResponse.data.amount / 100) * percent);

            nockCoinbase(ruleUp.currencyPair, ruleUp.priceType, 200, coinbaseResponse);
            nockTwilio(ruleUp.currencyPair, ruleUp.price, coinbaseResponse.data.amount, percent, 400);

            expect(consumerPromise.handler(consumer, lambdaEvent(ruleUp)))
                .to.eventually.be.rejectedWith(rejectedWith).notify(done);
        });

        it('DynamoDb API returns an error', (done) => {
            const rejectedWith = 'DynamoDb API Error';
            const ruleUp = JSON.parse(JSON.stringify(rule));
            const percent = ruleUp.percent + 1;
            ruleUp.price = coinbaseResponse.data.amount;
            ruleUp.price -= ((coinbaseResponse.data.amount / 100) * percent);

            nockCoinbase(ruleUp.currencyPair, ruleUp.priceType, 200, coinbaseResponse);
            nockTwilio(ruleUp.currencyPair, ruleUp.price, coinbaseResponse.data.amount, percent, 201);

            dynamo.returns(consumerPromise.reject(new Error(rejectedWith)));

            expect(consumerPromise.handler(consumer, lambdaEvent(ruleUp)))
                .to.eventually.be.rejectedWith(rejectedWith).notify(done);
        });
    });
});
