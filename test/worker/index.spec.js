const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');
const dotenv = require('dotenv');
const AWSMock = require('@mapbox/mock-aws-sdk-js');

const { expect } = chai;
chai.use(chaiAsPromised);
chai.use(sinonChai);

dotenv.config({ path: './test/.env' });

AWSMock.config.update({ region: 'us-east-1' });

const worker = require('../../src/worker/index');
const workerPromise = require('../aws-handler-promise');

const dynamoScanResponse = require('../data/dynamo.scan.json');
const snsPublishResponse = require('../data/sns.publish.json');

const dynamoScan = (callNo) => {
    const data = JSON.parse(JSON.stringify(dynamoScanResponse));
    const index = parseInt(callNo, 10) || 0;

    if (index > 0) {
        delete data.LastEvaluatedKey;
        data.Items = [];
    }

    return workerPromise.resolve(data);
};

describe('Worker', () => {
    let dynamoClient;
    let snsClient;

    beforeEach(() => {
        dynamoClient = AWSMock.stub('DynamoDB.DocumentClient', 'scan');
        dynamoClient.onCall(0).returns(dynamoScan(0));
        dynamoClient.onCall(1).returns(dynamoScan(1));

        snsClient = AWSMock.stub('SNS', 'publish');
        snsClient.returns(workerPromise.resolve(snsPublishResponse));
    });

    afterEach(() => {
        dynamoClient.restore();
        snsClient.restore();
    });

    it('expect to do recursive DynamoDb scan when LastEvaluatedKey exists in response', (done) => {
        workerPromise.handler(worker).then(() => {
            expect(dynamoClient).to.have.callCount(2);
            done();
        });
    });

    it('expect to publish rule to SNS Topic', (done) => {
        workerPromise.handler(worker).then(() => {
            expect(snsClient).to.have.callCount(dynamoScanResponse.Items.length);
            done();
        });
    });

    describe('expect to callback with an error when', () => {
        it('DynamoDb API returns an error', (done) => {
            const rejectedWith = 'DynamoDb API Error';
            dynamoClient.onCall(0).returns(workerPromise.reject(new Error(rejectedWith)));

            expect(workerPromise.handler(worker))
                .to.eventually.be.rejectedWith(rejectedWith).notify(done);
        });

        it('SNS API returns an error', (done) => {
            const rejectedWith = 'SNS API Error';
            snsClient.returns(workerPromise.reject(new Error(rejectedWith)));

            expect(workerPromise.handler(worker))
                .to.eventually.be.rejectedWith(rejectedWith).notify(done);
        });
    });
});
